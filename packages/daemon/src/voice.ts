/**
 * Minting a short-lived Realtime client secret for the phone.
 *
 * The ChatGPT sign-in is tried first (what the user asked for); the API key is
 * the fallback when there is no sign-in or OpenAI refuses it. The phone only
 * ever sees the `ek_...` secret, never either desktop credential.
 */
import type { wire } from "@pew2/protocol";
import { freshAuth, readApiKey, type FetchLike } from "./openai-auth.js";

export const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
/** Realtime model in OpenAI's current WebRTC guide. */
export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
export const DEFAULT_VOICE = "marin";

type Result = wire.VoiceTokenResult["result"];

export interface VoiceTokenOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  now?: () => number;
}

type Attempt =
  | { ok: true; clientSecret: string; expiresAt: number }
  | { ok: false; status?: number };

async function requestSecret(
  bearer: string,
  accountId: string | undefined,
  model: string,
  voice: string,
  fetchImpl: FetchLike,
): Promise<Attempt> {
  try {
    const response = await fetchImpl(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
        // ChatGPT tokens name their workspace the way Codex does; harmless for keys.
        ...(accountId ? { "chatgpt-account-id": accountId } : null),
      },
      body: JSON.stringify({ session: { type: "realtime", model, audio: { output: { voice } } } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const data = (await response.json()) as { value?: unknown; expires_at?: unknown; client_secret?: { value?: unknown; expires_at?: unknown } };
    const value = data.value ?? data.client_secret?.value;
    const expiresAt = data.expires_at ?? data.client_secret?.expires_at;
    if (typeof value !== "string" || typeof expiresAt !== "number") return { ok: false };
    return { ok: true, clientSecret: value, expiresAt: Math.floor(expiresAt) };
  } catch {
    return { ok: false };
  }
}

const refused = (status?: number) => status === 401 || status === 403;

export async function mintVoiceToken(
  request: { model?: string; voice?: string },
  options: VoiceTokenOptions = {},
): Promise<Result> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = request.model ?? DEFAULT_REALTIME_MODEL;
  const voice = request.voice ?? DEFAULT_VOICE;
  let chatgptStatus: number | undefined;
  let chatgptTried = false;

  let auth;
  try {
    auth = await freshAuth(env, { fetchImpl, now: options.now });
  } catch {
    // Refresh refused or offline: fall through to the key.
    chatgptTried = true;
    chatgptStatus = 401;
  }
  if (auth) {
    chatgptTried = true;
    let attempt = await requestSecret(auth.accessToken, auth.accountId, model, voice, fetchImpl);
    if (!attempt.ok && attempt.status === 401) {
      // Revoked early: one forced refresh, then one retry.
      try {
        const next = await freshAuth(env, { fetchImpl, now: options.now, force: true });
        if (next) attempt = await requestSecret(next.accessToken, next.accountId, model, voice, fetchImpl);
      } catch {
        // keep the 401
      }
    }
    if (attempt.ok) return { ok: true, clientSecret: attempt.clientSecret, expiresAt: attempt.expiresAt, model, source: "chatgpt" };
    // Refused or failed: either way the key gets a turn below.
    chatgptStatus = attempt.status;
  }

  const key = await readApiKey(env);
  if (key) {
    const attempt = await requestSecret(key.key, undefined, model, voice, fetchImpl);
    if (attempt.ok) return { ok: true, clientSecret: attempt.clientSecret, expiresAt: attempt.expiresAt, model, source: "api_key" };
    return refused(attempt.status)
      ? { ok: false, error: "unauthorized", message: "OpenAI refused the API key stored on your computer. Run `pew2 openai key` with a valid key." }
      : { ok: false, error: "failed", message: "Could not reach OpenAI to start voice. Try again." };
  }

  if (!chatgptTried) {
    return { ok: false, error: "not_signed_in", message: "Sign in on your computer: run `pew2 openai login`, or store an API key with `pew2 openai key`." };
  }
  return refused(chatgptStatus)
    ? { ok: false, error: "unauthorized", message: "OpenAI refused your ChatGPT sign-in for voice. Run `pew2 openai login` again, or add an API key with `pew2 openai key`." }
    : { ok: false, error: "failed", message: "Could not reach OpenAI to start voice. Try again." };
}
