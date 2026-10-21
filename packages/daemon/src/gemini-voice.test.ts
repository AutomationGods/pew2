import { describe, expect, it } from "bun:test";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveApiKey } from "./openai-auth.js";
import {
  clearGeminiKey,
  DEFAULT_GEMINI_LIVE_MODEL,
  GEMINI_AUTH_TOKENS_URL,
  geminiKeyPath,
  looksLikeGeminiKey,
  mintGeminiToken,
  readGeminiKey,
  saveGeminiKey,
  voiceEngines,
} from "./gemini-voice.js";

const home = (): NodeJS.ProcessEnv => ({ PEW2_HOME: mkdtempSync(join(tmpdir(), "pew2-gemini-")) });
const KEY = "AIzaFakeFakeFakeFakeFakeFakeFakeFake123";
const NOW = Date.parse("2026-10-16T12:00:00.000Z");

describe("gemini key", () => {
  it("is stored 0600 under PEW2_HOME, cleared, and falls back to GEMINI_API_KEY", async () => {
    const env = home();
    expect(await readGeminiKey(env)).toBeUndefined();
    await saveGeminiKey(KEY, env);
    expect(statSync(geminiKeyPath(env)).mode & 0o777).toBe(0o600);
    expect(await readGeminiKey(env)).toEqual({ key: KEY, from: "file" });
    await clearGeminiKey(env);
    expect(await readGeminiKey({ ...env, GEMINI_API_KEY: "envkey" })).toEqual({ key: "envkey", from: "env" });
  });

  it("advertises only the engines with a credential", async () => {
    const env = home();
    expect(await voiceEngines(env)).toEqual([]);
    await saveGeminiKey(KEY, env);
    expect(await voiceEngines(env)).toEqual(["gemini"]);
    await saveApiKey("sk-fakefakefakefake", env);
    expect(await voiceEngines(env)).toEqual(["gemini", "openai"]);
  });
});

describe("mintGeminiToken", () => {
  it("mints a single-use token with the model locked, never sending the key to the phone", async () => {
    const env = home();
    await saveGeminiKey(KEY, env);
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await mintGeminiToken({}, {
      env,
      now: () => NOW,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return Response.json({ name: "auth_tokens/abc", expireTime: "2026-10-16T12:30:00Z" });
      },
    });
    expect(result).toEqual({
      ok: true,
      clientSecret: "auth_tokens/abc",
      expiresAt: Math.floor(Date.parse("2026-10-16T12:30:00Z") / 1000),
      model: DEFAULT_GEMINI_LIVE_MODEL,
      source: "api_key",
      engine: "gemini",
    });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(calls[0]?.url).toBe(GEMINI_AUTH_TOKENS_URL);
    expect((calls[0]?.init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(calls[0]?.init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      uses: 1,
      expireTime: "2026-10-16T12:30:00.000Z",
      newSessionExpireTime: "2026-10-16T12:03:00.000Z",
      bidiGenerateContentSetup: {
        model: `models/${DEFAULT_GEMINI_LIVE_MODEL}`,
        generationConfig: { responseModalities: ["AUDIO"] },
      },
      fieldMask: "model,generationConfig.responseModalities",
    });
  });

  it("says how to add a key when there is none, without calling Google", async () => {
    let called = false;
    const result = await mintGeminiToken({}, { env: home(), fetchImpl: async () => { called = true; return new Response(""); } });
    expect(called).toBe(false);
    expect(result).toMatchObject({ ok: false, error: "not_signed_in" });
    expect(result.ok ? "" : result.message).toContain("pew2 voice gemini-key");
  });

  it("maps an invalid key, quota and network failures to clear answers", async () => {
    const env = home();
    await saveGeminiKey(KEY, env);
    const answer = (response: Response | Error) =>
      mintGeminiToken({}, { env, fetchImpl: async () => { if (response instanceof Error) throw response; return response; } });
    expect(await answer(new Response('{"error":{"message":"API key not valid. Please pass a valid API key."}}', { status: 400 }))).toMatchObject({ ok: false, error: "unauthorized" });
    expect(await answer(new Response("", { status: 403 }))).toMatchObject({ ok: false, error: "unauthorized" });
    const quota = await answer(new Response("", { status: 429 }));
    expect(quota).toMatchObject({ ok: false, error: "failed" });
    expect(quota.ok ? "" : quota.message).toContain("quota");
    expect(await answer(new Error("offline"))).toMatchObject({ ok: false, error: "failed" });
    expect(await answer(Response.json({}))).toMatchObject({ ok: false, error: "failed" });
  });
});

it("both Google key shapes are accepted, junk is not", () => {
  expect(looksLikeGeminiKey("AIzaSyD" + "x".repeat(32))).toBe(true);
  expect(looksLikeGeminiKey("AQ.Ab8" + "R".repeat(40))).toBe(true);
  expect(looksLikeGeminiKey("short")).toBe(false);
  expect(looksLikeGeminiKey("has spaces in it which no key has at all ok")).toBe(false);
});
