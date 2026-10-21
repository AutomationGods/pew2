import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  beginAuthorization,
  completeAuthorization,
  DIRECT_SCOPE,
  hostId,
  PlanAuthError,
  PlanSession,
  planAuthPath,
  planGranted,
  readPlan,
  savePlan,
  signOutPlan,
  type PlanRecord,
} from "./openai-plan";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function idToken(claims: Record<string, unknown>): string {
  const head = `${b64({ alg: "RS256", kid: "k1" })}.${b64(claims)}`;
  return `${head}.${sign("RSA-SHA256", Buffer.from(head), privateKey).toString("base64url")}`;
}
const accessToken = (exp: number) => `x.${b64({ exp })}.y`;

const home = async () => ({ PEW2_HOME: await mkdtemp(join(tmpdir(), "pew2-plan-")) });
const NOW = 1_800_000_000_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Seen { url: string; body: string }
function fakeOpenAI(tokenBody: (form: URLSearchParams) => Response, seen: Seen[] = []) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    seen.push({ url, body: typeof init.body === "string" ? init.body : "" });
    if (url.endsWith("/.well-known/openid-configuration")) {
      return json({ jwks_uri: "https://auth.openai.com/jwks", revocation_endpoint: "https://auth.openai.com/oauth/revoke" });
    }
    if (url === "https://auth.openai.com/jwks") return json({ keys: [jwk] });
    if (url.endsWith("/oauth/token")) return tokenBody(new URLSearchParams(typeof init.body === "string" ? init.body : ""));
    if (url.endsWith("/oauth/revoke")) return new Response("", { status: 200 });
    return new Response("nope", { status: 404 });
  };
}

describe("host id", () => {
  test("is a urn:uuid created once and reused", async () => {
    const env = await home();
    const first = await hostId(env);
    expect(first).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    expect(await hostId(env)).toBe(first);
  });
});

describe("authorize URL", () => {
  test("first sign-in registers dynamically with the plan scopes and resource", () => {
    const { url, pending } = beginAuthorization("urn:uuid:1", "http://127.0.0.1:1455/auth/callback");
    const q = new URL(url).searchParams;
    expect(url.startsWith("https://auth.openai.com/api/accounts/authorize?")).toBe(true);
    expect(q.get("client_id")).toBe("dynamic_agent_client");
    expect(q.get("agent_name_hint")).toBe("pew2");
    expect(q.get("ext_agent_host_id")).toBe("urn:uuid:1");
    expect(q.get("scope")).toBe("openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
    expect(q.get("resource")).toBe("https://api.openai.com/v1");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("nonce")).toBe(pending.nonce);
    expect(q.get("prompt")).toBeNull();
  });

  test("returning sign-in reuses the issued client, hints the account, and re-asks consent only after a decline", () => {
    const saved: PlanRecord = { issuer: "https://auth.openai.com", clientId: "oaiapp_1", extAgentHostId: "urn:uuid:1", subject: "s", email: "a@b.c", idToken: "old", scopes: [] };
    const q = new URL(beginAuthorization("urn:uuid:1", "http://127.0.0.1:9/auth/callback", saved).url).searchParams;
    expect(q.get("client_id")).toBe("oaiapp_1");
    expect(q.get("agent_name_hint")).toBeNull();
    expect(q.get("id_token_hint")).toBe("old");
    expect(q.get("login_hint")).toBe("a@b.c");
    expect(q.get("prompt")).toBe("consent");
    const granted = new URL(beginAuthorization("urn:uuid:1", "x", { ...saved, scopes: [DIRECT_SCOPE] }).url).searchParams;
    expect(granted.get("prompt")).toBeNull();
  });
});

describe("callback", () => {
  const start = () => beginAuthorization("urn:uuid:1", "http://127.0.0.1:1455/auth/callback");
  const tokens = (nonce: string, scope: string) => () =>
    json({
      access_token: accessToken(NOW / 1000 + 3600),
      refresh_token: "r1",
      id_token: idToken({ iss: "https://auth.openai.com", aud: "oaiapp_new", exp: NOW / 1000 + 3600, nonce, sub: "user-1", email: "a@b.c" }),
      token_type: "Bearer",
      expires_in: 3600,
      scope,
    });

  test("exchanges with the issued client and the resource, validates the ID token, records plan usage", async () => {
    const { pending } = start();
    const seen: Seen[] = [];
    const query = new URLSearchParams({ code: "c", state: pending.state, client_id: "oaiapp_new" });
    const record = await completeAuthorization(query, pending, undefined, {
      fetchImpl: fakeOpenAI(tokens(pending.nonce, "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"), seen),
      now: () => NOW,
    });
    expect(record.clientId).toBe("oaiapp_new");
    expect(record.subject).toBe("user-1");
    expect(planGranted(record)).toBe(true);
    const form = new URLSearchParams(seen.find((s) => s.url.endsWith("/oauth/token"))?.body);
    expect(form.get("client_id")).toBe("oaiapp_new");
    expect(form.get("resource")).toBe("https://api.openai.com/v1");
    expect(form.get("code_verifier")).toBe(pending.verifier);
  });

  test("a grant without chatgpt.tokens.use.direct is kept but plan usage is off", async () => {
    const { pending } = start();
    const query = new URLSearchParams({ code: "c", state: pending.state, client_id: "oaiapp_new" });
    const record = await completeAuthorization(query, pending, undefined, { fetchImpl: fakeOpenAI(tokens(pending.nonce, "openid profile email offline_access")), now: () => NOW });
    expect(planGranted(record)).toBe(false);
  });

  test("declined consent stops before any exchange", async () => {
    const { pending } = start();
    const seen: Seen[] = [];
    const run = completeAuthorization(new URLSearchParams({ error: "access_denied", state: pending.state }), pending, undefined, { fetchImpl: fakeOpenAI(tokens("", ""), seen) });
    await expect(run).rejects.toMatchObject({ kind: "declined" });
    expect(seen).toHaveLength(0);
  });

  test("rejects a wrong state, a missing client id and a bad nonce", async () => {
    const { pending } = start();
    const fetchImpl = fakeOpenAI(tokens("other-nonce", DIRECT_SCOPE));
    await expect(completeAuthorization(new URLSearchParams({ code: "c", state: "x", client_id: "oaiapp_new" }), pending, undefined, { fetchImpl })).rejects.toBeInstanceOf(PlanAuthError);
    await expect(completeAuthorization(new URLSearchParams({ code: "c", state: pending.state }), pending, undefined, { fetchImpl })).rejects.toMatchObject({ kind: "invalid" });
    await expect(completeAuthorization(new URLSearchParams({ code: "c", state: pending.state, client_id: "oaiapp_new" }), pending, undefined, { fetchImpl, now: () => NOW })).rejects.toThrow(/nonce/);
  });
});

const signedInRecord = (expiresAt: number): PlanRecord => ({
  issuer: "https://auth.openai.com",
  clientId: "oaiapp_1",
  extAgentHostId: "urn:uuid:1",
  subject: "user-1",
  idToken: "id",
  accessToken: "a0",
  refreshToken: "r0",
  expiresAt,
  scopes: [DIRECT_SCOPE],
});

describe("refresh", () => {
  test("refreshes near expiry with the issued client and resource, rotating the refresh token", async () => {
    const env = await home();
    await savePlan(signedInRecord(NOW + 60_000), env);
    const seen: Seen[] = [];
    const session = new PlanSession({
      now: () => NOW,
      fetchImpl: fakeOpenAI(() => json({ access_token: accessToken(NOW / 1000 + 3600), refresh_token: "r1", scope: "chatgpt.tokens.use.direct openid" }), seen),
    });
    const next = await session.fresh(env);
    expect(next?.refreshToken).toBe("r1");
    const form = new URLSearchParams(seen[0]?.body);
    expect(form.get("client_id")).toBe("oaiapp_1");
    expect(form.get("resource")).toBe("https://api.openai.com/v1");
    expect(form.get("scope")).toBeNull();
    expect((await stat(planAuthPath(env))).mode & 0o777).toBe(0o600);
  });

  test("an unusable refresh token clears the tokens, keeps the registration, and asks for sign-in", async () => {
    const env = await home();
    await savePlan(signedInRecord(NOW - 1), env);
    const session = new PlanSession({ now: () => NOW, fetchImpl: fakeOpenAI(() => json({ error: "refresh_token_reused" }, 400)) });
    await expect(session.fresh(env)).rejects.toMatchObject({ kind: "reauth" });
    const after = await readPlan(env);
    expect(after?.clientId).toBe("oaiapp_1");
    expect(after?.accessToken).toBeUndefined();
  });

  test("a network failure keeps the credentials", async () => {
    const env = await home();
    await savePlan(signedInRecord(NOW - 1), env);
    const session = new PlanSession({ now: () => NOW, fetchImpl: async () => { throw new Error("offline"); } });
    await expect(session.fresh(env)).rejects.toMatchObject({ kind: "network" });
    expect((await readPlan(env))?.refreshToken).toBe("r0");
  });
});

describe("sign-out", () => {
  test("revokes the refresh token, clears tokens, keeps the client", async () => {
    const env = await home();
    await savePlan(signedInRecord(NOW + 3600_000), env);
    const seen: Seen[] = [];
    const result = await signOutPlan(env, { fetchImpl: fakeOpenAI(() => json({}), seen), sleep: async () => {} });
    expect(result).toEqual({ wasSignedIn: true, revoked: true });
    const form = new URLSearchParams(seen.find((s) => s.url.endsWith("/oauth/revoke"))?.body);
    expect(form.get("token_type_hint")).toBe("refresh_token");
    expect(form.get("client_id")).toBe("oaiapp_1");
    const after = await readPlan(env);
    expect(after?.clientId).toBe("oaiapp_1");
    expect(after?.refreshToken).toBeUndefined();
    expect(after?.idToken).toBeUndefined();
  });
});
