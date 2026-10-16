import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveApiKey, saveAuth } from "./openai-auth.js";
import { CLIENT_SECRETS_URL, DEFAULT_REALTIME_MODEL, mintVoiceToken } from "./voice.js";

const home = (): NodeJS.ProcessEnv => ({ PEW2_HOME: mkdtempSync(join(tmpdir(), "pew2-voice-")) });
const signIn = (env: NodeJS.ProcessEnv) =>
  saveAuth({ idToken: "i", accessToken: "chatgpt-at", refreshToken: "r", expiresAt: Date.now() + 3600_000, accountId: "acc" }, env);
const secret = () => Response.json({ value: "ek_1", expires_at: 1_900_000_000 });

describe("voice.token", () => {
  it("mints with the ChatGPT token first", async () => {
    const env = home();
    await signIn(env);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await mintVoiceToken({}, { env, fetchImpl: async (url, init) => { calls.push({ url, init }); return secret(); } });
    expect(result).toEqual({ ok: true, clientSecret: "ek_1", expiresAt: 1_900_000_000, model: DEFAULT_REALTIME_MODEL, source: "chatgpt" });
    expect(calls[0]!.url).toBe(CLIENT_SECRETS_URL);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer chatgpt-at");
    expect(headers["chatgpt-account-id"]).toBe("acc");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ session: { type: "realtime", model: DEFAULT_REALTIME_MODEL, audio: { output: { voice: "marin" } } } });
  });

  it("falls back to the API key when ChatGPT is refused", async () => {
    const env = home();
    await signIn(env);
    await saveApiKey("sk-test-key-123456", env);
    const auths: string[] = [];
    const result = await mintVoiceToken({ model: "m", voice: "v" }, {
      env,
      fetchImpl: async (url, init) => {
        if (url.includes("oauth/token")) return new Response("", { status: 400 });
        const auth = (init.headers as Record<string, string>).authorization!;
        auths.push(auth);
        return auth === "Bearer chatgpt-at" ? new Response("", { status: 403 }) : secret();
      },
    });
    expect(result).toMatchObject({ ok: true, source: "api_key", model: "m" });
    expect(auths.at(-1)).toBe("Bearer sk-test-key-123456");
  });

  it("uses OPENAI_API_KEY when not signed in", async () => {
    const env = { ...home(), OPENAI_API_KEY: "sk-env" };
    const result = await mintVoiceToken({}, { env, fetchImpl: async () => secret() });
    expect(result).toMatchObject({ ok: true, source: "api_key" });
  });

  it("says not_signed_in with no credential at all", async () => {
    const result = await mintVoiceToken({}, { env: home(), fetchImpl: async () => { throw new Error("no network expected"); } });
    expect(result).toMatchObject({ ok: false, error: "not_signed_in" });
  });

  it("says unauthorized when only ChatGPT exists and it is refused", async () => {
    const env = home();
    await signIn(env);
    const result = await mintVoiceToken({}, { env, fetchImpl: async () => new Response("", { status: 403 }) });
    expect(result).toMatchObject({ ok: false, error: "unauthorized" });
  });
});
