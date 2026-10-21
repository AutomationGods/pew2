/**
 * Gemini Live, the parts that are pure data.
 *
 * The call loop in `useVoiceCall` speaks OpenAI Realtime events: it sends
 * `session.update` / `response.create` / `function_call_output` items and folds
 * the server's transcript and function-call events into captions. Rather than
 * fork that loop, the Gemini transport translates at its edge, both ways, so
 * `foldEvent`, `runVoiceTool` and `toolOutputEvents` stay the single path for
 * both engines. Everything here is Expo-free so `bun test` can load it.
 */

export type VoiceEngine = "openai" | "gemini";

/**
 * Which engine to call with. Gemini whenever the computer says it can mint for
 * it (OpenAI no longer admits ChatGPT-plan tokens to Realtime); otherwise
 * OpenAI, which is also what an older daemon (no list at all) can only mean.
 */
export function chooseEngine(engines: readonly string[] | undefined): VoiceEngine {
  return engines?.includes("gemini") ? "gemini" : "openai";
}

/** The engine a `voice.token.result` was minted for; absent = an older daemon = OpenAI. */
export function tokenEngine(result: unknown): VoiceEngine {
  return typeof result === "object" && result !== null && (result as { engine?: unknown }).engine === "gemini" ? "gemini" : "openai";
}

const LIVE_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

/** The socket URL for an ephemeral token (`auth_tokens/...`). Never a real API key. */
export function geminiUrl(token: string): string {
  return `${LIVE_WS}?access_token=${encodeURIComponent(token)}`;
}

export const GEMINI_INPUT_RATE = 16_000;
export const GEMINI_OUTPUT_RATE = 24_000;

// ---- tools --------------------------------------------------------------------

/**
 * Gemini's function schema is an OpenAPI subset: no `additionalProperties`,
 * and an OBJECT with no properties is rejected, so a no-argument tool omits
 * `parameters` entirely.
 */
function stripSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripSchema);
  if (typeof schema !== "object" || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    out[key] = key === "properties" && typeof value === "object" && value !== null
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripSchema(v)]))
      : stripSchema(value);
  }
  return out;
}

export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: unknown;
}

/** `VOICE_TOOLS` (Realtime shape) as Gemini function declarations. */
export function geminiTools(tools: readonly unknown[]): FunctionDeclaration[] {
  const out: FunctionDeclaration[] = [];
  for (const tool of tools) {
    if (typeof tool !== "object" || tool === null) continue;
    const t = tool as { name?: unknown; description?: unknown; parameters?: unknown };
    if (typeof t.name !== "string") continue;
    const params = t.parameters as { properties?: Record<string, unknown> } | undefined;
    const hasArgs = !!params?.properties && Object.keys(params.properties).length > 0;
    out.push({
      name: t.name,
      ...(typeof t.description === "string" ? { description: t.description } : {}),
      ...(hasArgs ? { parameters: stripSchema(params) } : {}),
    });
  }
  return out;
}

/** The first frame on the socket. The token already locks model and modality. */
export function geminiSetup(model: string, instructions: string, tools: readonly unknown[], resumeHandle?: string): unknown {
  return {
    setup: {
      model: model.startsWith("models/") ? model : `models/${model}`,
      generationConfig: { responseModalities: ["AUDIO"] },
      systemInstruction: { parts: [{ text: instructions }] },
      tools: [{ functionDeclarations: geminiTools(tools) }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // A handle lets a dropped socket (or a server `goAway`) pick the same
      // conversation back up on a fresh token.
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    },
  };
}

// ---- client events (Realtime shape) -> Gemini messages ---------------------------

export interface ClientTranslation {
  /** The setup frame, when the event was the `session.update`. */
  setup?: { instructions: string; tools: unknown[] };
  /** Messages to send once the session is set up. */
  messages: unknown[];
}

/**
 * Translate one Realtime client event. `names` maps a function call id to its
 * name (Gemini's tool response wants both); it is filled by `foldGemini`.
 */
export function translateClientEvent(event: unknown, names: ReadonlyMap<string, string>): ClientTranslation {
  if (typeof event !== "object" || event === null) return { messages: [] };
  const e = event as Record<string, unknown>;
  switch (e.type) {
    case "session.update": {
      const session = (e.session ?? {}) as { instructions?: unknown; tools?: unknown };
      return {
        setup: {
          instructions: typeof session.instructions === "string" ? session.instructions : "",
          tools: Array.isArray(session.tools) ? session.tools : [],
        },
        messages: [],
      };
    }
    case "response.create": {
      // With instructions it is a nudge to speak (the greeting). Without, it
      // follows a tool output, and Gemini carries on by itself after one.
      const response = (e.response ?? {}) as { instructions?: unknown };
      if (typeof response.instructions !== "string" || !response.instructions) return { messages: [] };
      return { messages: [{ realtimeInput: { text: response.instructions } }] };
    }
    case "conversation.item.create": {
      const item = (e.item ?? {}) as { type?: unknown; call_id?: unknown; output?: unknown };
      if (item.type !== "function_call_output" || typeof item.call_id !== "string") return { messages: [] };
      let response: unknown;
      try {
        response = typeof item.output === "string" ? JSON.parse(item.output) : item.output;
      } catch {
        response = { output: item.output };
      }
      if (typeof response !== "object" || response === null || Array.isArray(response)) response = { output: response };
      return {
        messages: [
          { toolResponse: { functionResponses: [{ id: item.call_id, name: names.get(item.call_id) ?? "", response }] } },
        ],
      };
    }
    default:
      return { messages: [] };
  }
}

// ---- Gemini server messages -> Realtime-shaped events ----------------------------

export interface GeminiFoldState {
  /** Turn counter, so each turn's captions get their own ids. */
  turn: number;
  sawUser: boolean;
  sawAssistant: boolean;
}

export const GEMINI_START: GeminiFoldState = { turn: 0, sawUser: false, sawAssistant: false };

export interface GeminiFold {
  state: GeminiFoldState;
  /** Realtime-shaped server events for `foldEvent` (captions, function calls). */
  events: unknown[];
  /** base64 PCM16 chunks at `GEMINI_OUTPUT_RATE`, in order. */
  audio: string[];
  /** The user spoke over the model: drop whatever is still queued to play. */
  interrupted: boolean;
  setupComplete: boolean;
  /** Function calls seen, for the id -> name map. */
  calls: { id: string; name: string }[];
  /** A newer handle to resume this conversation with. */
  resumeHandle?: string;
  /** The server is about to close this socket (`goAway`). */
  goingAway: boolean;
  /** A line for the device log; never transcript text. */
  diagnostic?: string;
}

export function foldGemini(state: GeminiFoldState, message: unknown): GeminiFold {
  const out: GeminiFold = {
    state,
    events: [],
    audio: [],
    interrupted: false,
    setupComplete: false,
    calls: [],
    goingAway: false,
  };
  if (typeof message !== "object" || message === null) return out;
  const m = message as Record<string, unknown>;
  const userId = `gemini-user-${state.turn}`;
  const assistantId = `gemini-assistant-${state.turn}`;
  let next = state;

  if (m.setupComplete !== undefined) {
    out.setupComplete = true;
    out.diagnostic = "setup complete";
    out.events.push({ type: "session.created" });
  }

  const content = m.serverContent as Record<string, unknown> | undefined;
  if (content) {
    const input = (content.inputTranscription as { text?: unknown } | undefined)?.text;
    if (typeof input === "string" && input) {
      out.events.push({ type: "conversation.item.input_audio_transcription.delta", item_id: userId, delta: input });
      next = { ...next, sawUser: true };
    }
    const output = (content.outputTranscription as { text?: unknown } | undefined)?.text;
    if (typeof output === "string" && output) {
      out.events.push({ type: "response.output_audio_transcript.delta", item_id: assistantId, delta: output });
      next = { ...next, sawAssistant: true };
    }
    const parts = ((content.modelTurn as { parts?: unknown } | undefined)?.parts ?? []) as unknown[];
    for (const part of Array.isArray(parts) ? parts : []) {
      const inline = (part as { inlineData?: { data?: unknown; mimeType?: unknown } } | null)?.inlineData;
      if (inline && typeof inline.data === "string" && (typeof inline.mimeType !== "string" || inline.mimeType.startsWith("audio/"))) {
        out.audio.push(inline.data);
      }
    }
    if (content.interrupted === true) {
      out.interrupted = true;
      out.diagnostic = "interrupted (barge-in)";
    }
    if (content.turnComplete === true || content.interrupted === true) {
      // Close this turn's captions; the next turn gets fresh ids.
      if (next.sawUser) out.events.push({ type: "conversation.item.input_audio_transcription.completed", item_id: userId });
      if (next.sawAssistant) out.events.push({ type: "response.output_audio_transcript.done", item_id: assistantId });
      out.events.push({ type: "response.done", response: { status: content.interrupted === true ? "cancelled" : "completed" } });
      next = { turn: next.turn + 1, sawUser: false, sawAssistant: false };
      out.diagnostic ??= "turn complete";
    }
  }

  const toolCall = m.toolCall as { functionCalls?: unknown } | undefined;
  if (toolCall && Array.isArray(toolCall.functionCalls)) {
    for (const raw of toolCall.functionCalls) {
      const call = raw as { id?: unknown; name?: unknown; args?: unknown };
      if (typeof call.name !== "string") continue;
      const id = typeof call.id === "string" && call.id ? call.id : `${call.name}-${state.turn}`;
      out.calls.push({ id, name: call.name });
      out.events.push({
        type: "response.output_item.done",
        item: { type: "function_call", call_id: id, name: call.name, arguments: JSON.stringify(call.args ?? {}) },
      });
    }
    out.diagnostic = `tool call ${out.calls.map((c) => c.name).join(",")}`;
  }
  if (m.toolCallCancellation !== undefined) out.diagnostic = "tool call cancelled";

  const resumption = m.sessionResumptionUpdate as { newHandle?: unknown; resumable?: unknown } | undefined;
  if (resumption && resumption.resumable !== false && typeof resumption.newHandle === "string" && resumption.newHandle) {
    out.resumeHandle = resumption.newHandle;
  }
  if (m.goAway !== undefined) {
    out.goingAway = true;
    const left = (m.goAway as { timeLeft?: unknown } | null)?.timeLeft;
    out.diagnostic = `goAway${typeof left === "string" ? ` in ${left}` : ""}`;
  }

  out.state = next;
  return out;
}

// ---- failures ------------------------------------------------------------------

export interface GeminiFailure {
  error: "failed" | "gemini_key" | "gemini_quota";
  detail: string;
  /** False when reconnecting cannot help (bad key, quota). */
  retryable: boolean;
}

/**
 * What a socket close means. Google closes a refused Live session with a
 * status in the reason ("API key not valid", "quota", "token expired"), on
 * 1007 (bad request), 1008 (policy) or 1011 (internal). Any other close is
 * treated as a drop that a resume can cover.
 */
export function geminiFailure(code: number, reason: string): GeminiFailure {
  const r = reason.toLowerCase();
  if (/quota|resource_exhausted|rate limit|billing/.test(r)) {
    return { error: "gemini_quota", detail: "", retryable: false };
  }
  if (/api key|api_key|permission|unauthenticated|unauthori[sz]ed|credential/.test(r)) {
    return { error: "gemini_key", detail: "", retryable: false };
  }
  if (/model|not found|not supported|invalid argument|unknown name/.test(r) || code === 1007) {
    return {
      error: "failed",
      detail: `Gemini would not start this call (${reason.slice(0, 120) || `code ${code}`}). Update pew2 on your computer.`,
      retryable: false,
    };
  }
  return { error: "failed", detail: "the connection to Gemini dropped and did not come back.", retryable: true };
}

/** A failed `voice.token` for Gemini, as the call screen should say it. */
export function geminiTokenFailure<E extends string>(error: E, message: string): E | "gemini_key" | "gemini_quota" {
  if (error === "unauthorized") return "gemini_key";
  if (error === "failed" && /quota/i.test(message)) return "gemini_quota";
  return error;
}

// ---- PCM -----------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]));

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : "=";
    out += i + 2 < bytes.length ? B64[n & 63]! : "=";
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      ((B64_INDEX[clean[i]!] ?? 0) << 18) |
      ((B64_INDEX[clean[i + 1] ?? "A"] ?? 0) << 12) |
      ((B64_INDEX[clean[i + 2] ?? "A"] ?? 0) << 6) |
      (B64_INDEX[clean[i + 3] ?? "A"] ?? 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** UTF-8 bytes to text; Google sends its JSON in binary frames. */
export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++]!;
    let cp = b;
    if (b >= 0xf0) cp = ((b & 7) << 18) | ((bytes[i++]! & 63) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63);
    else if (b >= 0xe0) cp = ((b & 15) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63);
    else if (b >= 0xc0) cp = ((b & 31) << 6) | (bytes[i++]! & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

/**
 * Linear-interpolation resample of little-endian mono PCM16. The playback
 * engine runs at 16 kHz (the same voice-communication stream the echo
 * canceller listens to), Gemini speaks at 24 kHz.
 */
export function resamplePcm16(bytes: Uint8Array, fromRate: number, toRate: number): Uint8Array {
  const inCount = Math.floor(bytes.length / 2);
  if (fromRate === toRate || inCount === 0) return bytes.slice(0, inCount * 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, inCount * 2);
  const outCount = Math.floor((inCount * toRate) / fromRate);
  const out = new Uint8Array(outCount * 2);
  const outView = new DataView(out.buffer);
  const step = fromRate / toRate;
  for (let i = 0; i < outCount; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = view.getInt16(j * 2, true);
    const b = j + 1 < inCount ? view.getInt16((j + 1) * 2, true) : a;
    outView.setInt16(i * 2, Math.round(a + (b - a) * frac), true);
  }
  return out;
}

/**
 * Feeds playback no more than `leadMs` ahead of the clock, so barge-in can
 * drop what is still queued here: the native player has no "stop", and audio
 * already handed to it plays out. At most `leadMs` of stale speech survives an
 * interruption instead of the whole reply.
 */
export class PcmPacer {
  private queue: Uint8Array[] = [];
  private playhead = 0;

  constructor(
    private readonly bytesPerMs: number,
    private readonly leadMs = 240,
  ) {}

  push(chunk: Uint8Array): void {
    if (chunk.length > 0) this.queue.push(chunk);
  }

  /** The chunks to hand the player now. */
  take(now: number): Uint8Array[] {
    const out: Uint8Array[] = [];
    if (this.playhead < now) this.playhead = now;
    while (this.queue.length > 0 && this.playhead - now < this.leadMs) {
      const chunk = this.queue.shift()!;
      out.push(chunk);
      this.playhead += chunk.length / this.bytesPerMs;
    }
    return out;
  }

  /** Barge-in: forget everything not yet handed over. */
  flush(): void {
    this.queue = [];
  }

  get pending(): number {
    return this.queue.length;
  }
}
