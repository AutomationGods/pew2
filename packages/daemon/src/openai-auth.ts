/**
 * Signing in to OpenAI with a ChatGPT account, for live voice.
 *
 * Uses the public Codex CLI OAuth client — the same browser flow (PKCE S256 on
 * localhost:1455) and device-code flow `codex login` offers — but keeps its OWN
 * token file. `~/.codex/auth.json` is never read or refreshed: refresh tokens
 * rotate on use, so refreshing Codex's copy would sign Codex out.
 *
 * The fallback credential is a plain API key, stored beside it at 0600, or
 * `OPENAI_API_KEY` from the environment.
 *
 * Nothing in this module logs a token. Errors carry status codes, never bodies.
 */
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { writeFileAtomic } from "./atomic-file.js";

export const OPENAI_ISSUER = "https://auth.openai.com";
export const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_AUTHORIZE_URL = `${OPENAI_ISSUER}/oauth/authorize`;
export const OPENAI_TOKEN_URL = `${OPENAI_ISSUER}/oauth/token`;
export const OAUTH_PORT = 1455;
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_PORT}/auth/callback`;
export const OAUTH_SCOPE = "openid profile email offline_access";
/** Codex sends its client name as `originator`; matched so the consent page reads the same. */
const ORIGINATOR = "codex_cli_rs";
/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** `~/.pew2`, or `$PEW2_HOME`. */
export function pew2Home(env: NodeJS.ProcessEnv = process.env): string {
  return env.PEW2_HOME ?? join(homedir(), ".pew2");
}
export const openaiAuthPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "openai-auth.json");
export const openaiKeyPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "openai-key");

export interface StoredAuth {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms the access token expires, from its `exp` claim. */
  expiresAt: number;
  accountId?: string;
  email?: string;
  plan?: string;
}

// ---- PKCE / URL -------------------------------------------------------------

const b64url = (buf: Buffer) => buf.toString("base64url");

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(64));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function generateState(): string {
  return b64url(randomBytes(32));
}

export function buildAuthorizeUrl(challenge: string, state: string, redirectUri = OAUTH_REDIRECT_URI): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: OPENAI_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state,
    originator: ORIGINATOR,
  });
  return `${OPENAI_AUTHORIZE_URL}?${params}`;
}

// ---- JWT claims -------------------------------------------------------------

export function jwtClaims(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Account id, plan and email from the id_token's `https://api.openai.com/auth` claim. */
export function accountInfo(idToken: string): { accountId?: string; plan?: string; email?: string } {
  const claims = jwtClaims(idToken);
  const auth = claims["https://api.openai.com/auth"] as Record<string, unknown> | undefined;
  const profile = claims["https://api.openai.com/profile"] as Record<string, unknown> | undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return {
    accountId: str(auth?.chatgpt_account_id),
    plan: str(auth?.chatgpt_plan_type),
    email: str(claims.email) ?? str(profile?.email),
  };
}

function toStored(tokens: { id_token: string; access_token: string; refresh_token: string }, now: number): StoredAuth {
  const exp = jwtClaims(tokens.access_token).exp;
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    // Unknown expiry: assume an hour and let a 401 force the next refresh.
    expiresAt: typeof exp === "number" ? exp * 1000 : now + 3600_000,
    ...accountInfo(tokens.id_token),
  };
}

// ---- token endpoint ---------------------------------------------------------

async function tokenRequest(body: Record<string, string>, fetchImpl: FetchLike) {
  const response = await fetchImpl(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new OpenAIAuthError(`OpenAI sign-in refused the request (HTTP ${response.status}).`, response.status);
  const data = (await response.json()) as Record<string, unknown>;
  return data;
}

export class OpenAIAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
  fetchImpl: FetchLike = fetch,
  now = Date.now(),
): Promise<StoredAuth> {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: OPENAI_CLIENT_ID,
    code_verifier: verifier,
  }, fetchImpl);
  if (typeof data.id_token !== "string" || typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
    throw new OpenAIAuthError("OpenAI sign-in returned no tokens.");
  }
  return toStored(data as { id_token: string; access_token: string; refresh_token: string }, now);
}

export async function refreshAuth(auth: StoredAuth, fetchImpl: FetchLike = fetch, now = Date.now()): Promise<StoredAuth> {
  const data = await tokenRequest({
    grant_type: "refresh_token",
    client_id: OPENAI_CLIENT_ID,
    refresh_token: auth.refreshToken,
    scope: "openid profile email",
  }, fetchImpl);
  if (typeof data.access_token !== "string") throw new OpenAIAuthError("OpenAI refresh returned no access token.");
  return toStored({
    access_token: data.access_token,
    // Rotation: a new refresh token replaces the old; an absent one keeps it.
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : auth.refreshToken,
    id_token: typeof data.id_token === "string" ? data.id_token : auth.idToken,
  }, now);
}

// ---- storage ----------------------------------------------------------------

async function writeSecret(path: string, content: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  await writeFileAtomic(path, content);
  await chmod(path, 0o600);
}

export async function readAuth(env: NodeJS.ProcessEnv = process.env): Promise<StoredAuth | undefined> {
  try {
    const value = JSON.parse(await readFile(openaiAuthPath(env), "utf8")) as StoredAuth;
    return typeof value.accessToken === "string" && typeof value.refreshToken === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export const saveAuth = (auth: StoredAuth, env: NodeJS.ProcessEnv = process.env) =>
  writeSecret(openaiAuthPath(env), JSON.stringify(auth, null, 2) + "\n");

export const clearAuth = (env: NodeJS.ProcessEnv = process.env) => rm(openaiAuthPath(env), { force: true });

export async function readApiKey(env: NodeJS.ProcessEnv = process.env): Promise<{ key: string; from: "file" | "env" } | undefined> {
  try {
    const key = (await readFile(openaiKeyPath(env), "utf8")).trim();
    if (key) return { key, from: "file" };
  } catch {
    // fall through to the environment
  }
  const fromEnv = env.OPENAI_API_KEY?.trim();
  return fromEnv ? { key: fromEnv, from: "env" } : undefined;
}

export const saveApiKey = (key: string, env: NodeJS.ProcessEnv = process.env) => writeSecret(openaiKeyPath(env), key.trim() + "\n");
export const clearApiKey = (env: NodeJS.ProcessEnv = process.env) => rm(openaiKeyPath(env), { force: true });

/** One refresh at a time per home, so two voice requests never spend the same refresh token. */
const inflight = new Map<string, Promise<StoredAuth | undefined>>();

/**
 * A usable ChatGPT access token, refreshed when within five minutes of expiry
 * (or when `force` says the last one was refused).
 */
export function freshAuth(
  env: NodeJS.ProcessEnv = process.env,
  options: { fetchImpl?: FetchLike; now?: () => number; force?: boolean } = {},
): Promise<StoredAuth | undefined> {
  const key = openaiAuthPath(env);
  const running = inflight.get(key);
  if (running) return running;
  const work = (async () => {
    const auth = await readAuth(env);
    if (!auth) return undefined;
    const now = (options.now ?? Date.now)();
    if (!options.force && auth.expiresAt - now > REFRESH_MARGIN_MS) return auth;
    const next = await refreshAuth(auth, options.fetchImpl ?? fetch, now);
    await saveAuth(next, env);
    return next;
  })().finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}

// ---- interactive flows (CLI) ------------------------------------------------

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? ["open", url]
    : process.platform === "win32" ? ["cmd", "/c", "start", "", url]
    : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {
    // The URL is printed too.
  }
}

const PAGE = (text: string) =>
  `<!doctype html><meta charset="utf-8"><title>pew2</title><body style="font-family:system-ui;padding:3em"><h2>${text}</h2><p>You can close this tab.</p></body>`;

/** Browser login: localhost:1455 callback, PKCE S256, state checked. */
export async function loginWithBrowser(
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = console.log,
): Promise<StoredAuth> {
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const url = buildAuthorizeUrl(challenge, state);

  let settle!: { resolve: (a: StoredAuth) => void; reject: (e: Error) => void };
  const done = new Promise<StoredAuth>((resolve, reject) => (settle = { resolve, reject }));

  const handle = async (req: Request): Promise<Response> => {
    const u = new URL(req.url);
    if (u.pathname !== "/auth/callback") return new Response("Not found", { status: 404 });
    if (u.searchParams.get("state") !== state) return new Response("State mismatch", { status: 400 });
    const error = u.searchParams.get("error");
    const code = u.searchParams.get("code");
    if (error || !code) {
      settle.reject(new OpenAIAuthError(`Sign-in was not completed (${error ?? "no code"}).`));
      return new Response(PAGE("Sign-in failed."), { status: 400, headers: { "content-type": "text/html" } });
    }
    try {
      const auth = await exchangeCode(code, verifier, OAUTH_REDIRECT_URI);
      await saveAuth(auth, env);
      settle.resolve(auth);
      return new Response(PAGE("Signed in to pew2."), { headers: { "content-type": "text/html" } });
    } catch (e) {
      settle.reject(e as Error);
      return new Response(PAGE("Sign-in failed."), { status: 500, headers: { "content-type": "text/html" } });
    }
  };

  // The redirect says `localhost`, and a browser may resolve that to the IPv4
  // or the IPv6 loopback. Binding only "localhost" landed on [::1] alone here,
  // so a browser that tried 127.0.0.1 got "can't connect" with the code in its
  // address bar and the login never finished. Listen on both loopbacks; never
  // on a LAN address.
  const servers: ReturnType<typeof Bun.serve>[] = [];
  for (const hostname of ["127.0.0.1", "::1"]) {
    try {
      servers.push(Bun.serve({ port: OAUTH_PORT, hostname, fetch: handle }));
    } catch {
      // That loopback is unavailable (no IPv6, or the port is taken there).
    }
  }
  if (servers.length === 0) {
    throw new OpenAIAuthError(`Port ${OAUTH_PORT} is busy (is \`codex login\` running?). Close it, or use \`pew2 openai login --device\`.`);
  }

  log("Opening your browser to sign in with ChatGPT. If it does not open, visit:");
  log(`  ${url}`);
  openBrowser(url);
  const timeout = setTimeout(() => settle.reject(new OpenAIAuthError("Sign-in timed out after 10 minutes.")), 10 * 60_000);
  try {
    return await done;
  } finally {
    clearTimeout(timeout);
    // Let the success page flush before the socket closes.
    setTimeout(() => {
      for (const server of servers) void server.stop(true);
    }, 500);
  }
}

/** Device-code login for headless machines, as `codex login --device-auth` does it. */
export async function loginWithDeviceCode(
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = console.log,
  fetchImpl: FetchLike = fetch,
): Promise<StoredAuth> {
  const api = `${OPENAI_ISSUER}/api/accounts`;
  const start = await fetchImpl(`${api}/deviceauth/usercode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }),
  });
  if (start.status === 404) throw new OpenAIAuthError("Device-code sign-in is not enabled for this account. Use `pew2 openai login`.");
  if (!start.ok) throw new OpenAIAuthError(`Device-code request failed (HTTP ${start.status}).`, start.status);
  const uc = (await start.json()) as { device_auth_id: string; user_code?: string; usercode?: string; interval?: string | number };
  const userCode = uc.user_code ?? uc.usercode ?? "";
  const interval = Math.max(1, Number(uc.interval) || 5);

  log("Sign in with ChatGPT:");
  log(`  1. Open ${OPENAI_ISSUER}/codex/device`);
  log(`  2. Enter this code (expires in 15 minutes): ${userCode}`);
  log("Continue only if you started this sign-in yourself.");

  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    const poll = await fetchImpl(`${api}/deviceauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_auth_id: uc.device_auth_id, user_code: userCode }),
    });
    if (poll.ok) {
      const code = (await poll.json()) as { authorization_code: string; code_verifier: string };
      const auth = await exchangeCode(code.authorization_code, code.code_verifier, `${OPENAI_ISSUER}/deviceauth/callback`, fetchImpl);
      await saveAuth(auth, env);
      return auth;
    }
    if (poll.status !== 403 && poll.status !== 404) throw new OpenAIAuthError(`Device-code sign-in failed (HTTP ${poll.status}).`, poll.status);
    if (Date.now() >= deadline) throw new OpenAIAuthError("Device-code sign-in timed out after 15 minutes.");
    await Bun.sleep(interval * 1000);
  }
}
