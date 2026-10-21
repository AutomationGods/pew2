/**
 * Live voice through Google's Gemini Live API.
 *
 * The Gemini API key lives on this computer only (`~/.pew2/gemini-key`, or
 * `GEMINI_API_KEY`). The phone is handed a single-use *ephemeral* token
 * (`auth_tokens/...`) that can open one Live session within a few minutes, with
 * the model and response modality locked in the token, so a leaked token cannot
 * be pointed at another model or used to run text generation on the user's bill.
 */
import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { wire } from "@pew2/protocol";
import { writeFileAtomic } from "./atomic-file.js";
import { pew2Home, readApiKey, readAuth, type FetchLike } from "./openai-auth.js";

export const GEMINI_AUTH_TOKENS_URL = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
/** Google's current default Live API model (native audio in and out). */
export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.8-live";
/** How long the phone has to open the session after the token is minted. */
const NEW_SESSION_WINDOW_MS = 3 * 60_000;
/** How long an opened session may keep using the token. */
const TOKEN_LIFETIME_MS = 30 * 60_000;

export const geminiKeyPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "gemini-key");

export async function readGeminiKey(env: NodeJS.ProcessEnv = process.env): Promise<{ key: string; from: "file" | "env" } | undefined> {
  try {
    const key = (await readFile(geminiKeyPath(env), "utf8")).trim();
    if (key) return { key, from: "file" };
  } catch {
    // fall through to the environment
  }
  const fromEnv = env.GEMINI_API_KEY?.trim();
  return fromEnv ? { key: fromEnv, from: "env" } : undefined;
}

async function writeSecret(path: string, content: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  await writeFileAtomic(path, content);
  await chmod(path, 0o600);
}

export const saveGeminiKey = (key: string, env: NodeJS.ProcessEnv = process.env) => writeSecret(geminiKeyPath(env), key.trim() + "\n");
export const clearGeminiKey = (env: NodeJS.ProcessEnv = process.env) => rm(geminiKeyPath(env), { force: true });

/**
 * Loose shape check for `pew2 voice gemini-key`. Google issues two shapes:
 * the classic `AIza` + 35 chars, and newer AI Studio keys that start `AQ.`
 * (dots inside). Rejecting the dot turned away a real, working key.
 */
export const looksLikeGeminiKey = (key: string) => /^[A-Za-z0-9_.-]{30,}$/.test(key) && !/\s/.test(key);

/** Which live-voice engines this computer can mint a token for, sorted. */
export async function voiceEngines(env: NodeJS.ProcessEnv = process.env): Promise<("gemini" | "openai")[]> {
  const [gemini, auth, key] = await Promise.all([readGeminiKey(env), readAuth(env), readApiKey(env)]);
  const engines: ("gemini" | "openai")[] = [];
  if (gemini) engines.push("gemini");
  if (auth || key) engines.push("openai");
  return engines;
}

type Result = wire.VoiceTokenResult["result"];

export interface GeminiTokenOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  now?: () => number;
}

const NO_KEY = "Live voice with Gemini needs a Gemini API key on your computer. Run `pew2 voice gemini-key` there.";

export async function mintGeminiToken(request: { model?: string }, options: GeminiTokenOptions = {}): Promise<Result> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = (options.now ?? Date.now)();
  const key = await readGeminiKey(env);
  if (!key) return { ok: false, error: "not_signed_in", message: NO_KEY };
  const model = request.model ?? DEFAULT_GEMINI_LIVE_MODEL;
  const expireMs = now + TOKEN_LIFETIME_MS;
  let response: Response;
  try {
    response = await fetchImpl(GEMINI_AUTH_TOKENS_URL, {
      method: "POST",
      headers: { "x-goog-api-key": key.key, "content-type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(expireMs).toISOString(),
        newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
        bidiGenerateContentSetup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: ["AUDIO"] },
        },
        // Locks only these; the phone still sends its own instructions and tools.
        fieldMask: "model,generationConfig.responseModalities",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "failed", message: "Could not reach Google to start voice. Try again." };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403 || /API key not valid|API_KEY_INVALID/i.test(body)) {
      return { ok: false, error: "unauthorized", message: "Google refused the Gemini API key on your computer. Run `pew2 voice gemini-key` with a valid key." };
    }
    if (response.status === 429) {
      return { ok: false, error: "failed", message: "Your Gemini API quota is used up for now. Try again later, or check your plan in Google AI Studio." };
    }
    return { ok: false, error: "failed", message: `Google answered ${response.status} when starting voice. Try again.` };
  }
  let data: { name?: unknown; expireTime?: unknown };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return { ok: false, error: "failed", message: "Google sent an unreadable answer when starting voice. Try again." };
  }
  if (typeof data.name !== "string" || !data.name) {
    return { ok: false, error: "failed", message: "Google did not return a voice token. Try again." };
  }
  const expiresAt = typeof data.expireTime === "string" && !Number.isNaN(Date.parse(data.expireTime)) ? Date.parse(data.expireTime) : expireMs;
  return {
    ok: true,
    clientSecret: data.name,
    expiresAt: Math.floor(expiresAt / 1000),
    model,
    source: "api_key",
    engine: "gemini",
  };
}
