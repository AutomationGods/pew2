/**
 * "Sign in with ChatGPT — ChatGPT plan usage" for open-source/local apps.
 *
 * The walkie-talkie voice mode pays for its Responses API calls with the
 * user's ChatGPT plan. The older voice sign-in (`openai-auth.ts`, Codex's
 * client id) cannot: OpenAI answers 401 "Missing scopes: api.responses.write".
 * Plan usage needs its own OAuth registration, documented at
 * https://developers.openai.com/siwc/token-sharing-open-source:
 *
 * - a stable, opaque `ext_agent_host_id` per host, chosen and persisted before
 *   the first sign-in (`urn:uuid:…`, kept in its own file so sign-out never
 *   loses it);
 * - first sign-in registers a client with `client_id=dynamic_agent_client` and
 *   `agent_name_hint=pew2`; the callback returns the issued `client_id`, which
 *   every later sign-in, exchange, refresh and revocation uses;
 * - scope `openid profile email offline_access resource.invoke
 *   chatgpt.tokens.use.direct`, resource `https://api.openai.com/v1`, PKCE S256,
 *   state and an OIDC nonce, loopback callback on 127.0.0.1;
 * - the ID token is signature-checked against OpenAI's JWKS, and plan usage is
 *   granted only when the token response's scopes include
 *   `chatgpt.tokens.use.direct`.
 *
 * Stored separately from the voice sign-in, in `openai-plan.json` (0600).
 * Nothing here logs a token, and errors carry codes, never bodies.
 */
import { createPublicKey, randomUUID, verify as verifySignature, type JsonWebKey } from "node:crypto";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeFileAtomic } from "./atomic-file.js";
import { generatePkce, generateState, jwtClaims, OPENAI_ISSUER, pew2Home, type FetchLike } from "./openai-auth.js";

export const PLAN_AUTHORIZE_URL = `${OPENAI_ISSUER}/api/accounts/authorize`;
export const PLAN_TOKEN_URL = `${OPENAI_ISSUER}/api/accounts/oauth/token`;
export const OPENID_CONFIGURATION_URL = `${OPENAI_ISSUER}/.well-known/openid-configuration`;
export const PLAN_RESOURCE = "https://api.openai.com/v1";
export const DIRECT_SCOPE = "chatgpt.tokens.use.direct";
export const PLAN_SCOPE = `openid profile email offline_access resource.invoke ${DIRECT_SCOPE}`;
/** First-time registration entrypoint. Never saved, never used to exchange. */
export const DYNAMIC_CLIENT = "dynamic_agent_client";
/** The app's actual name, the same on every install. */
export const AGENT_NAME_HINT = "pew2";
export const PLAN_CALLBACK_PATH = "/auth/callback";
export const PLAN_PREFERRED_PORT = 1455;
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
const REFRESH_MARGIN_MS = 5 * 60_000;

export const planAuthPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "openai-plan.json");
export const hostIdPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "openai-host-id");

/** One registration: the issued client, its verified account, and (while signed in) its tokens. */
export interface PlanRecord {
  issuer: string;
  /** Issued client id (`oaiapp_…`), retained across sign-outs. */
  clientId: string;
  extAgentHostId: string;
  /** Validated ID-token `sub`. */
  subject: string;
  email?: string;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  /** Epoch ms. */
  expiresAt?: number;
  scopes: string[];
  /** ISO time the last token response was received. */
  savedAt?: string;
  /** Whether the first-use "You're using your ChatGPT plan" notice was shown. */
  welcomed?: boolean;
}

export type PlanErrorKind =
  /** Consent declined (`access_denied`) or the grant lacks `chatgpt.tokens.use.direct`. */
  | "declined"
  /** The refresh token is unusable; sign in again. */
  | "reauth"
  /** `invalid_client`: the registration itself is broken. */
  | "invalid_client"
  /** The code was refused (`invalid_grant`); start a fresh sign-in. */
  | "invalid_grant"
  /** State, client id, ID token or account did not check out. */
  | "invalid"
  /** Network or OpenAI-side failure; credentials are kept. */
  | "network";

export class PlanAuthError extends Error {
  constructor(message: string, readonly kind: PlanErrorKind, readonly status?: number) {
    super(message);
  }
}

export const planGranted = (record: PlanRecord | undefined): boolean => !!record?.scopes.includes(DIRECT_SCOPE);
export const signedIn = (record: PlanRecord | undefined): record is PlanRecord & { accessToken: string; refreshToken: string } =>
  !!record?.accessToken && !!record.refreshToken;

// ---- storage ----------------------------------------------------------------

async function writeSecret(path: string, content: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  await writeFileAtomic(path, content);
  await chmod(path, 0o600);
}

const HOST_ID = /^(urn:uuid:[0-9a-f-]{36}|urn:ietf:params:oauth:jwk-thumbprint:\S+|did:key:\S+)$/i;

/** This host's `ext_agent_host_id`, created once and reused for its lifetime. */
export async function hostId(env: NodeJS.ProcessEnv = process.env, uuid: () => string = randomUUID): Promise<string> {
  try {
    const existing = (await readFile(hostIdPath(env), "utf8")).trim();
    if (HOST_ID.test(existing)) return existing;
  } catch {
    // none yet
  }
  const id = `urn:uuid:${uuid()}`;
  await writeSecret(hostIdPath(env), id + "\n");
  return id;
}

export async function readPlan(env: NodeJS.ProcessEnv = process.env): Promise<PlanRecord | undefined> {
  try {
    const value = JSON.parse(await readFile(planAuthPath(env), "utf8")) as PlanRecord;
    return typeof value.clientId === "string" && Array.isArray(value.scopes) ? value : undefined;
  } catch {
    return undefined;
  }
}

export const savePlan = (record: PlanRecord, env: NodeJS.ProcessEnv = process.env) =>
  writeSecret(planAuthPath(env), JSON.stringify(record, null, 2) + "\n");

/** The record without tokens: the registration and host survive for the next sign-in. */
export function withoutTokens(record: PlanRecord, keepIdToken: boolean): PlanRecord {
  const { accessToken: _a, refreshToken: _r, expiresAt: _e, tokenType: _t, idToken, ...rest } = record;
  return { ...rest, ...(keepIdToken && idToken ? { idToken } : {}), scopes: [] };
}

// ---- authorize URL ----------------------------------------------------------

export interface PendingAuthorization {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  /** Issued client id for a returning account; undefined for a new registration. */
  clientId?: string;
  hostId: string;
  /** Subject of the account being reauthorized, which the new ID token must match. */
  subject?: string;
}

export function beginAuthorization(
  hostIdValue: string,
  redirectUri: string,
  saved?: PlanRecord,
): { url: string; pending: PendingAuthorization } {
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const nonce = generateState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: saved?.clientId ?? DYNAMIC_CLIENT,
    redirect_uri: redirectUri,
    scope: PLAN_SCOPE,
    resource: PLAN_RESOURCE,
    ext_agent_host_id: hostIdValue,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (saved) {
    if (saved.idToken) params.set("id_token_hint", saved.idToken);
    if (saved.email) params.set("login_hint", saved.email);
    // Enabling plan usage after an earlier decline asks for consent again;
    // an ordinary returning sign-in never forces it.
    if (!planGranted(saved)) params.set("prompt", "consent");
  } else {
    params.set("agent_name_hint", AGENT_NAME_HINT);
  }
  return {
    url: `${PLAN_AUTHORIZE_URL}?${params}`,
    pending: { state, nonce, verifier, redirectUri, clientId: saved?.clientId, hostId: hostIdValue, subject: saved?.subject },
  };
}

// ---- discovery / ID token ---------------------------------------------------

interface Discovery {
  jwksUri: string;
  revocationEndpoint?: string;
}

export async function discover(fetchImpl: FetchLike): Promise<Discovery> {
  const response = await fetchImpl(OPENID_CONFIGURATION_URL, { method: "GET", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new PlanAuthError(`OpenAI sign-in discovery failed (HTTP ${response.status}).`, "network", response.status);
  const data = (await response.json()) as { jwks_uri?: unknown; revocation_endpoint?: unknown };
  if (typeof data.jwks_uri !== "string") throw new PlanAuthError("OpenAI sign-in discovery had no key set.", "network");
  return {
    jwksUri: data.jwks_uri,
    revocationEndpoint: typeof data.revocation_endpoint === "string" ? data.revocation_endpoint : undefined,
  };
}

/** Verify signature (RS256 against the JWKS), issuer, audience, expiry and nonce. Returns the claims. */
export async function validateIdToken(
  idToken: string,
  expect: { clientId: string; nonce: string },
  fetchImpl: FetchLike,
  now = Date.now(),
): Promise<{ subject: string; email?: string }> {
  const parts = idToken.split(".");
  const [h, p, s] = parts;
  if (parts.length !== 3 || !h || !p || !s) throw new PlanAuthError("The ID token is malformed.", "invalid");
  let header: { alg?: unknown; kid?: unknown };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as typeof header;
  } catch {
    throw new PlanAuthError("The ID token is malformed.", "invalid");
  }
  if (header.alg !== "RS256") throw new PlanAuthError("The ID token uses an unexpected algorithm.", "invalid");

  const { jwksUri } = await discover(fetchImpl);
  const jwksResponse = await fetchImpl(jwksUri, { method: "GET", signal: AbortSignal.timeout(15_000) });
  if (!jwksResponse.ok) throw new PlanAuthError(`Could not read OpenAI's signing keys (HTTP ${jwksResponse.status}).`, "network");
  const jwks = (await jwksResponse.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const jwk = jwks.keys?.find((k) => k.kid === header.kid) ?? (jwks.keys?.length === 1 ? jwks.keys[0] : undefined);
  if (!jwk) throw new PlanAuthError("The ID token was signed by an unknown key.", "invalid");
  const ok = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${h}.${p}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(s, "base64url"),
  );
  if (!ok) throw new PlanAuthError("The ID token signature did not verify.", "invalid");

  const claims = jwtClaims(idToken);
  const aud = claims.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (claims.iss !== OPENAI_ISSUER) throw new PlanAuthError("The ID token has the wrong issuer.", "invalid");
  if (!audiences.includes(expect.clientId)) throw new PlanAuthError("The ID token was issued to another client.", "invalid");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 60_000) throw new PlanAuthError("The ID token has expired.", "invalid");
  if (claims.nonce !== expect.nonce) throw new PlanAuthError("The ID token nonce did not match this sign-in.", "invalid");
  if (typeof claims.sub !== "string" || !claims.sub) throw new PlanAuthError("The ID token names no account.", "invalid");
  const profile = claims["https://api.openai.com/profile"] as Record<string, unknown> | undefined;
  const email = typeof claims.email === "string" ? claims.email : typeof profile?.email === "string" ? profile.email : undefined;
  return { subject: claims.sub, email };
}

// ---- token endpoint ---------------------------------------------------------

const UNUSABLE_REFRESH = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
]);

/** The machine-readable code of an OAuth error body, without keeping the body. */
async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.json()) as { error?: unknown; code?: unknown };
    const e = data.error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string") return (e as { code: string }).code;
    return typeof data.code === "string" ? data.code : undefined;
  } catch {
    return undefined;
  }
}

type TokenResponse = Record<string, unknown>;

async function tokenRequest(body: Record<string, string>, fetchImpl: FetchLike, refresh: boolean): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetchImpl(PLAN_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PlanAuthError("Could not reach OpenAI to sign in.", "network");
  }
  if (response.ok) return (await response.json()) as TokenResponse;
  const code = await errorCode(response);
  if (code === "invalid_client") {
    throw new PlanAuthError("OpenAI no longer recognises pew2's registration. Run `pew2 openai login --plan` again.", "invalid_client", response.status);
  }
  if (refresh && code && UNUSABLE_REFRESH.has(code)) {
    throw new PlanAuthError("Your ChatGPT plan sign-in has ended. Run `pew2 openai login --plan` again.", "reauth", response.status);
  }
  if (!refresh && code === "invalid_grant") {
    throw new PlanAuthError("OpenAI refused that sign-in code. Run `pew2 openai login --plan` again.", "invalid_grant", response.status);
  }
  throw new PlanAuthError(`OpenAI sign-in refused the request (HTTP ${response.status}${code ? `, ${code}` : ""}).`, "network", response.status);
}

function tokenFields(data: TokenResponse, now: number) {
  if (typeof data.access_token !== "string") throw new PlanAuthError("OpenAI returned no access token.", "network");
  const exp = jwtClaims(data.access_token).exp;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;
  return {
    accessToken: data.access_token,
    tokenType: typeof data.token_type === "string" ? data.token_type : "Bearer",
    expiresAt: typeof exp === "number" ? exp * 1000 : now + (expiresIn ?? 3600) * 1000,
    scopes: typeof data.scope === "string" ? data.scope.split(/\s+/).filter(Boolean).sort() : [],
    savedAt: new Date(now).toISOString(),
  };
}

export interface CallbackDeps {
  fetchImpl?: FetchLike;
  now?: () => number;
}

/**
 * Finish one authorization attempt from its callback query. Validates state
 * and client id, exchanges the code, validates the ID token and account, and
 * returns the record to save. Declined consent throws `declined` without an
 * exchange; a grant without plan usage returns a record with it disabled.
 */
export async function completeAuthorization(
  query: URLSearchParams,
  pending: PendingAuthorization,
  saved: PlanRecord | undefined,
  deps: CallbackDeps = {},
): Promise<PlanRecord> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = (deps.now ?? Date.now)();
  if (query.get("state") !== pending.state) throw new PlanAuthError("The sign-in response did not match this attempt.", "invalid");
  const error = query.get("error");
  if (error === "access_denied") {
    throw new PlanAuthError("ChatGPT plan use wasn't enabled, so walkie-talkie voice can't use your plan. Run `pew2 openai login --plan` to enable it.", "declined");
  }
  if (error) throw new PlanAuthError(`Sign-in was not completed (${error}).`, "invalid");
  const code = query.get("code");
  if (!code) throw new PlanAuthError("Sign-in returned no code.", "invalid");

  const returned = query.get("client_id") ?? undefined;
  let clientId: string;
  if (pending.clientId) {
    if (returned && returned !== pending.clientId) throw new PlanAuthError("Sign-in returned a different client; nothing was changed.", "invalid");
    clientId = pending.clientId;
  } else {
    if (!returned || returned === DYNAMIC_CLIENT) throw new PlanAuthError("Registration did not complete (no client id returned). Try again.", "invalid");
    clientId = returned;
  }

  const data = await tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: pending.verifier,
    redirect_uri: pending.redirectUri,
    resource: PLAN_RESOURCE,
  }, fetchImpl, false);
  if (typeof data.id_token !== "string" || typeof data.refresh_token !== "string") {
    throw new PlanAuthError("OpenAI returned no ID or refresh token.", "network");
  }
  const identity = await validateIdToken(data.id_token, { clientId, nonce: pending.nonce }, fetchImpl, now);
  if (pending.subject && identity.subject !== pending.subject) {
    throw new PlanAuthError("You signed in to a different ChatGPT account than the one registered; nothing was changed.", "invalid");
  }
  return {
    issuer: OPENAI_ISSUER,
    clientId,
    extAgentHostId: pending.hostId,
    subject: identity.subject,
    email: identity.email,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    ...tokenFields(data, now),
    welcomed: saved?.clientId === clientId ? saved.welcomed : undefined,
  };
}

/** Standard refresh; the access token, expiry, scopes and rotating refresh token are replaced together. */
export async function refreshPlan(record: PlanRecord, fetchImpl: FetchLike = fetch, now = Date.now()): Promise<PlanRecord> {
  if (!record.refreshToken) throw new PlanAuthError("Not signed in. Run `pew2 openai login --plan`.", "reauth");
  const data = await tokenRequest({
    grant_type: "refresh_token",
    client_id: record.clientId,
    refresh_token: record.refreshToken,
    resource: PLAN_RESOURCE,
  }, fetchImpl, true);
  const fields = tokenFields(data, now);
  return {
    ...record,
    ...fields,
    // A refresh that names no scope keeps the grant it had.
    scopes: fields.scopes.length ? fields.scopes : record.scopes,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : record.refreshToken,
    idToken: typeof data.id_token === "string" ? data.id_token : record.idToken,
  };
}

/** One refresh at a time per home: a rotating refresh token must never be spent twice. */
export class PlanSession {
  private inflight = new Map<string, Promise<PlanRecord | undefined>>();

  constructor(private readonly options: { fetchImpl?: FetchLike; now?: () => number } = {}) {}

  /**
   * A signed-in record with a usable access token, refreshed near expiry or
   * when `force` says the last one was refused. An unusable refresh token
   * clears the tokens (keeping the registration) and throws `reauth`.
   */
  fresh(env: NodeJS.ProcessEnv, force = false): Promise<PlanRecord | undefined> {
    const key = planAuthPath(env);
    const running = this.inflight.get(key);
    if (running) return running;
    const work = (async () => {
      const record = await readPlan(env);
      if (!signedIn(record)) return undefined;
      const now = (this.options.now ?? Date.now)();
      if (!force && (record.expiresAt ?? 0) - now > REFRESH_MARGIN_MS) return record;
      try {
        const next = await refreshPlan(record, this.options.fetchImpl ?? fetch, now);
        await savePlan(next, env);
        return next;
      } catch (error) {
        if (error instanceof PlanAuthError && error.kind === "reauth") await savePlan(withoutTokens(record, true), env);
        throw error;
      }
    })().finally(() => this.inflight.delete(key));
    this.inflight.set(key, work);
    return work;
  }
}

// ---- sign-out ---------------------------------------------------------------

/**
 * Revoke the renewable session, then clear the tokens. The registration and
 * host id are kept for a later sign-in. Returns whether revocation was confirmed.
 */
export async function signOutPlan(
  env: NodeJS.ProcessEnv = process.env,
  deps: { fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ wasSignedIn: boolean; revoked: boolean }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => Bun.sleep(ms));
  const record = await readPlan(env);
  if (!signedIn(record)) return { wasSignedIn: false, revoked: true };
  let revoked = false;
  for (let attempt = 0; attempt < 3 && !revoked; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** attempt);
    try {
      const { revocationEndpoint } = await discover(fetchImpl);
      if (!revocationEndpoint) break;
      const response = await fetchImpl(revocationEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: record.refreshToken, token_type_hint: "refresh_token", client_id: record.clientId }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) revoked = true;
      else if (response.status < 500) break;
    } catch {
      // network: retry
    }
  }
  await savePlan(withoutTokens(record, false), env);
  return { wasSignedIn: true, revoked };
}

// ---- interactive browser flow (CLI) ----------------------------------------

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

/** Browser sign-in on a 127.0.0.1 loopback (1455, or any free port if taken). */
export async function loginForPlan(
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = console.log,
): Promise<PlanRecord> {
  const host = await hostId(env);
  const saved = await readPlan(env);

  let settle!: { resolve: (r: PlanRecord) => void; reject: (e: Error) => void };
  const done = new Promise<PlanRecord>((resolve, reject) => (settle = { resolve, reject }));
  const attempt: { pending?: PendingAuthorization } = {};

  const handle = async (req: Request): Promise<Response> => {
    const u = new URL(req.url);
    const pending = attempt.pending;
    if (u.pathname !== PLAN_CALLBACK_PATH || !pending) return new Response("Not found", { status: 404 });
    if (u.searchParams.get("state") !== pending.state) return new Response("State mismatch", { status: 400 });
    try {
      const record = await completeAuthorization(u.searchParams, pending, saved);
      await savePlan(record, env);
      settle.resolve(record);
      return new Response(PAGE(planGranted(record) ? "pew2 can now use your ChatGPT plan." : "Signed in, but ChatGPT plan use isn't enabled."), {
        headers: { "content-type": "text/html" },
      });
    } catch (e) {
      settle.reject(e as Error);
      return new Response(PAGE(e instanceof PlanAuthError && e.kind === "declined" ? "ChatGPT plan use wasn't enabled." : "Sign-in failed."), {
        status: 400,
        headers: { "content-type": "text/html" },
      });
    }
  };

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({ port: PLAN_PREFERRED_PORT, hostname: "127.0.0.1", fetch: handle });
  } catch {
    // Only the port may vary; scheme, host and path stay fixed.
    server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handle });
  }
  const redirectUri = `http://127.0.0.1:${server.port}${PLAN_CALLBACK_PATH}`;
  const started = beginAuthorization(host, redirectUri, saved?.clientId ? saved : undefined);
  attempt.pending = started.pending;

  // The URL may carry an id_token_hint, so it is opened, not printed.
  log("Opening your browser: Continue with ChatGPT to let pew2 use your ChatGPT plan for walkie-talkie voice.");
  const printable = new URL(started.url);
  printable.searchParams.delete("id_token_hint");
  log("If it does not open, visit:");
  log(`  ${printable}`);
  openBrowser(started.url);
  const timeout = setTimeout(() => settle.reject(new PlanAuthError("Sign-in timed out after 10 minutes.", "network")), 10 * 60_000);
  try {
    return await done;
  } finally {
    clearTimeout(timeout);
    setTimeout(() => void server.stop(true), 500);
  }
}
