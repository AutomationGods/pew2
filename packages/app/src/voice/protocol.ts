/**
 * Live voice, the parts that are pure data.
 *
 * Everything here is Expo-free and React-Native-free so `bun test` can load it:
 * mapping the daemon's token answer to something the call screen can say,
 * reading an incoming-call payload (from the socket or from a VoIP push), the
 * `session.update` that tells the model what it is, and folding the Realtime
 * data-channel events into captions.
 */

/** What asking the daemon for a Realtime client secret came to. */
export type VoiceToken =
  | { ok: true; clientSecret: string; expiresAt: number; model: string; source: string }
  | { ok: false; error: VoiceFailure; message: string };

/**
 * Every way a call can fail before audio flows. `unavailable` is a daemon older
 * than live voice (it answered `unknown_message`) or no answer at all.
 */
export type VoiceFailure =
  | "not_signed_in"
  | "unauthorized"
  | "failed"
  | "unavailable"
  | "offline"
  | "mic_denied"
  | "unsupported";

/** Read a `voice.token.result` frame's `result` into a `VoiceToken`. */
export function readTokenResult(result: unknown): VoiceToken {
  if (typeof result !== "object" || result === null) {
    return { ok: false, error: "failed", message: "" };
  }
  const r = result as Record<string, unknown>;
  if (r.ok === true && typeof r.clientSecret === "string" && r.clientSecret.length > 0) {
    return {
      ok: true,
      clientSecret: r.clientSecret,
      expiresAt: typeof r.expiresAt === "number" ? r.expiresAt : 0,
      model: typeof r.model === "string" ? r.model : "",
      source: typeof r.source === "string" ? r.source : "",
    };
  }
  const error =
    r.error === "not_signed_in" || r.error === "unauthorized" || r.error === "failed"
      ? r.error
      : "failed";
  return { ok: false, error, message: typeof r.message === "string" ? r.message : "" };
}

/** The sentence the call screen shows for a failure. */
export function voiceFailureMessage(error: VoiceFailure, detail = ""): string {
  switch (error) {
    case "not_signed_in":
      return "Voice needs an OpenAI sign-in on your computer. Run `pew2 openai login` there, then try again.";
    case "unauthorized":
      return "OpenAI refused the sign-in on your computer. Run `pew2 openai login` there again.";
    case "unavailable":
      return "Voice isn't available from this computer yet. Update pew2 on your computer.";
    case "offline":
      return "Not connected to your computer. Voice needs pew2 running there.";
    case "mic_denied":
      return "pew2 can't use the microphone. Allow it in Settings > pew2 > Microphone.";
    case "unsupported":
      return "This build of the app can't make voice calls. Install the latest build.";
    case "failed":
      return detail ? `Voice couldn't start: ${detail}` : "Voice couldn't start. Try again.";
  }
}

/** An incoming call, from `voice.incoming` or from the VoIP push payload. */
export interface IncomingCall {
  callId: string;
  reason: "input" | "manual";
  sessionId?: string;
  providerId?: string;
  folder?: string;
  summary?: string;
  at: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Parse either shape. A push payload may nest the fields under `data` or
 * `voice`, depending on how the daemon builds it, so both are looked through.
 * Returns undefined for anything without a valid call id: CallKit keys calls
 * by that UUID and a bad one cannot be reported.
 */
export function parseIncoming(value: unknown): IncomingCall | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  let v = value as Record<string, unknown>;
  if (typeof v.callId !== "string") {
    for (const key of ["voice", "data", "payload"]) {
      const inner = v[key];
      if (typeof inner === "object" && inner !== null && typeof (inner as Record<string, unknown>).callId === "string") {
        v = inner as Record<string, unknown>;
        break;
      }
    }
  }
  if (typeof v.callId !== "string" || !UUID.test(v.callId)) return undefined;
  return {
    callId: v.callId.toLowerCase(),
    reason: v.reason === "input" ? "input" : "manual",
    sessionId: optionalString(v.sessionId),
    providerId: optionalString(v.providerId),
    folder: optionalString(v.folder),
    summary: optionalString(v.summary),
    at: typeof v.at === "number" ? v.at : Date.now(),
  };
}

/**
 * The incoming call inside an Android push, if this push is one.
 *
 * Android has no PushKit, so the daemon rings with a data-only Expo push
 * marked `pew2Call: "1"`. Depending on how it reaches the app (background task,
 * foreground listener, a tap on the fallback notification) the fields sit at
 * different depths, sometimes as a JSON string (`dataString`, `body`), and
 * every value is a string. Ordinary agent banners carry no marker and are
 * ignored here.
 */
export function findCallPush(value: unknown, depth = 0): IncomingCall | undefined {
  if (depth > 5 || value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    if (!value.includes("pew2Call")) return undefined;
    try {
      return findCallPush(JSON.parse(value), depth + 1);
    } catch {
      return undefined;
    }
  }
  if (typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (v.pew2Call === "1" || v.pew2Call === 1 || v.pew2Call === true) {
    const at = typeof v.at === "string" ? Number(v.at) : v.at;
    return parseIncoming({ ...v, at: typeof at === "number" && Number.isFinite(at) ? at : undefined });
  }
  for (const inner of Object.values(v)) {
    const found = findCallPush(inner, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** What CallKit shows as the caller. */
export function callerName(call: Pick<IncomingCall, "summary" | "folder" | "reason">): string {
  const summary = call.summary?.trim();
  if (summary) return summary.length > 60 ? `${summary.slice(0, 59)}…` : summary;
  if (call.folder) return call.reason === "input" ? `${call.folder} needs you` : `pew2 · ${call.folder}`;
  return call.reason === "input" ? "An agent needs you" : "pew2";
}

/** Spoken-style instructions for the model. */
export function voiceInstructions(focus?: { title?: string; folder?: string; sessionId?: string }): string {
  const lines = [
    "You are pew2, a voice remote for the user's coding agents running on their computer.",
    "You are not the coding agent. You check on agents and relay the user's instructions to them using your tools.",
    "Speak briefly and naturally, like a phone call: one or two short sentences.",
    "Summarize what agents did; never read code, file paths, diffs, or long output aloud.",
    "Before send_prompt, read the prompt back in a few words and send it only after the user says yes.",
    "Before answering a permission request, say what it is and which option you'll pick, and act on the user's yes.",
    "If a tool fails, say so plainly.",
  ];
  if (focus?.sessionId) {
    const what = [focus.title, focus.folder ? `in ${focus.folder}` : undefined].filter(Boolean).join(" ");
    lines.push(
      `The user is focused on session ${focus.sessionId}${what ? ` (${what})` : ""}. Use it unless they name another.`,
    );
  }
  return lines.join(" ");
}

/** A caption line. */
export interface Caption {
  id: string;
  who: "user" | "assistant";
  text: string;
  final: boolean;
}

/** A function call the model asked for, ready to run. */
export interface FunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

const MAX_CAPTIONS = 40;

function upsert(captions: Caption[], id: string, who: Caption["who"], update: (text: string) => string, final: boolean): Caption[] {
  const index = captions.findIndex((c) => c.id === id);
  if (index === -1) {
    const next = [...captions, { id, who, text: update(""), final }];
    return next.length > MAX_CAPTIONS ? next.slice(next.length - MAX_CAPTIONS) : next;
  }
  const next = captions.slice();
  const existing = next[index]!;
  next[index] = { ...existing, text: update(existing.text), final: final || existing.final };
  return next;
}

/**
 * Fold one Realtime server event. Returns the new captions and any function
 * call to run. Handles both the GA event names and the older beta ones.
 */
export function foldEvent(
  captions: Caption[],
  event: unknown,
): { captions: Caption[]; call?: FunctionCall; error?: string } {
  if (typeof event !== "object" || event === null) return { captions };
  const e = event as Record<string, unknown>;
  const type = typeof e.type === "string" ? e.type : "";
  const itemId = typeof e.item_id === "string" ? e.item_id : typeof e.response_id === "string" ? e.response_id : type;
  switch (type) {
    case "response.output_audio_transcript.delta":
    case "response.audio_transcript.delta":
      return { captions: upsert(captions, itemId, "assistant", (t) => t + (typeof e.delta === "string" ? e.delta : ""), false) };
    case "response.output_audio_transcript.done":
    case "response.audio_transcript.done":
      return {
        captions: upsert(captions, itemId, "assistant", (t) => (typeof e.transcript === "string" ? e.transcript : t), true),
      };
    case "conversation.item.input_audio_transcription.delta":
      return { captions: upsert(captions, itemId, "user", (t) => t + (typeof e.delta === "string" ? e.delta : ""), false) };
    case "conversation.item.input_audio_transcription.completed":
      return {
        captions: upsert(captions, itemId, "user", (t) => (typeof e.transcript === "string" ? e.transcript.trim() : t), true),
      };
    // The finished item carries name, call id and arguments together in both
    // the GA and beta event sets; the arguments.done event lacks `name` in GA.
    case "response.output_item.done": {
      const item = e.item as Record<string, unknown> | undefined;
      if (item?.type === "function_call" && typeof item.call_id === "string" && typeof item.name === "string") {
        return {
          captions,
          call: { callId: item.call_id, name: item.name, arguments: typeof item.arguments === "string" ? item.arguments : "{}" },
        };
      }
      return { captions };
    }
    case "error": {
      const err = e.error as Record<string, unknown> | undefined;
      return { captions, error: typeof err?.message === "string" ? err.message : "Realtime error" };
    }
    default:
      return { captions };
  }
}

/** The client events that hand a tool's result back and ask for a reply. */
export function toolOutputEvents(callId: string, output: unknown): unknown[] {
  return [
    {
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
    },
    { type: "response.create" },
  ];
}
