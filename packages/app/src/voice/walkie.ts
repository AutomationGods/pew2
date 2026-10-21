/**
 * Walkie-talkie voice, the pure half: hold to talk, the phone transcribes,
 * the computer asks OpenAI on the user's ChatGPT plan (`voice.respond`), the
 * phone reads the answer aloud.
 *
 * Expo-free so `bun test` covers it. The tools are the live call's own
 * (`VOICE_TOOLS` / `runVoiceTool`), regrouped into one namespace because the
 * ChatGPT-plan preview accepts function tools only inside namespaces. History
 * lives here, in the `input` array: the preview forbids `previous_response_id`.
 */
import { VOICE_TOOLS } from "./tools";

export const WALKIE_NAMESPACE = "pew2";
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
/** Tool rounds per spoken turn before giving up on the model. */
export const MAX_TOOL_ROUNDS = 6;
/** Items kept in the history; older turns are dropped whole. */
export const MAX_HISTORY_ITEMS = 80;

export type InputItem = Record<string, unknown>;

export type WalkieError =
  | "not_signed_in"
  | "plan_not_enabled"
  | "reauth"
  | "usage_limit"
  | "not_eligible"
  | "unavailable"
  | "unsupported"
  | "incomplete"
  | "failed"
  /** The daemon predates walkie-talkie (`unknown_message`) or never answered. */
  | "outdated"
  | "offline"
  | "mic_denied"
  | "no_speech";

export type RespondEvent =
  | { kind: "delta"; text: string }
  | { kind: "call"; callId: string; name: string; namespace?: string; arguments: string }
  | { kind: "done"; model: string }
  | { kind: "error"; error: WalkieError; message: string; manageUrl?: string };

/** The live call's tools as one namespace of function tools. */
export function walkieTools(tools: readonly { name: string; description: string; parameters: unknown }[] = VOICE_TOOLS) {
  return [
    {
      type: "namespace",
      name: WALKIE_NAMESPACE,
      description: "Check on and act on the user's coding agents and goals on their computer.",
      tools: tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters })),
    },
  ];
}

/** Extra instructions for a turn-based, read-aloud exchange. */
export const WALKIE_NOTE =
  "This is a walkie-talkie: the user holds a button to speak, your reply is read aloud by the phone, and they cannot interrupt mid-sentence. Plain sentences only, no markdown, lists or emoji.";

const ERRORS = new Set<string>([
  "not_signed_in", "plan_not_enabled", "reauth", "usage_limit", "not_eligible", "unavailable", "unsupported", "incomplete", "failed", "offline",
]);

/** Read the `event` of a `voice.respond.event` frame. */
export function readRespondEvent(value: unknown): RespondEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const e = value as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  switch (e.kind) {
    case "delta":
      return { kind: "delta", text: str(e.text) ?? "" };
    case "call": {
      const callId = str(e.callId);
      const name = str(e.name);
      if (!callId || !name) return undefined;
      return { kind: "call", callId, name, ...(str(e.namespace) ? { namespace: str(e.namespace) } : {}), arguments: str(e.arguments) ?? "{}" };
    }
    case "done":
      return { kind: "done", model: str(e.model) ?? "" };
    case "error": {
      const error = typeof e.error === "string" && ERRORS.has(e.error) ? (e.error as WalkieError) : "failed";
      return { kind: "error", error, message: str(e.message) ?? "", ...(str(e.manageUrl) ? { manageUrl: str(e.manageUrl) } : {}) };
    }
    default:
      return undefined;
  }
}

/** What the screen says for a failure. */
export function walkieFailureMessage(error: WalkieError, detail = ""): string {
  switch (error) {
    case "outdated":
      return "Walkie-talkie needs a newer pew2. Update pew2 on your computer.";
    case "offline":
      return "Not connected to your computer. Walkie-talkie needs pew2 running there.";
    case "mic_denied":
      return "pew2 can't use the microphone. Allow it in Settings > pew2 > Microphone.";
    case "no_speech":
      return "Didn't catch that. Hold the button and speak.";
    case "usage_limit":
      return "Usage limit reached. Review your ChatGPT plan or pew2's app limit in ChatGPT settings.";
    case "not_signed_in":
      return detail || "Walkie-talkie uses your ChatGPT plan. On your computer, run `pew2 openai login --plan` and Continue with ChatGPT.";
    case "plan_not_enabled":
      return detail || "ChatGPT plan use isn't enabled for pew2. Run `pew2 openai login --plan` on your computer to enable it.";
    case "reauth":
      return detail || "Your ChatGPT sign-in on your computer has ended. Run `pew2 openai login --plan` there again.";
    default:
      return detail || "Walkie-talkie couldn't answer. Try again.";
  }
}

/** Whether pressing the button again could help, as opposed to fixing something first. */
export const retryable = (error: WalkieError): boolean =>
  error === "incomplete" || error === "failed" || error === "unavailable" || error === "no_speech" || error === "offline";

export const userItem = (text: string): InputItem => ({ role: "user", content: text });
export const assistantItem = (text: string): InputItem => ({ role: "assistant", content: text });
export const callItem = (c: Extract<RespondEvent, { kind: "call" }>): InputItem => ({
  type: "function_call",
  call_id: c.callId,
  name: c.name,
  ...(c.namespace ? { namespace: c.namespace } : {}),
  arguments: c.arguments,
});
export const outputItem = (callId: string, output: unknown): InputItem => ({
  type: "function_call_output",
  call_id: callId,
  output: JSON.stringify(output),
});

/** Drop the oldest turns whole (never leaving an orphan call output) to stay under the cap. */
export function trimHistory(items: readonly InputItem[], max = MAX_HISTORY_ITEMS): InputItem[] {
  if (items.length <= max) return [...items];
  let start = items.length - max;
  while (start < items.length && items[start]?.role !== "user") start++;
  return items.slice(start);
}

/** Markdown and symbols a speech engine would read out literally. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WalkieTurnDeps {
  /** Send one `voice.respond`; resolves after its terminal event, with every event passed to `onEvent` as it arrives. */
  respond: (input: InputItem[], onEvent: (event: RespondEvent) => void) => Promise<void>;
  runTool: (name: string, args: string) => Record<string, unknown>;
  /** The reply so far, for captions. */
  onText?: (text: string) => void;
  /** False once the user pressed again or closed: stop without touching state. */
  isCurrent?: () => boolean;
}

export interface WalkieTurnResult {
  history: InputItem[];
  reply: string;
  error?: { error: WalkieError; message: string; manageUrl?: string };
  /** A superseded turn; the caller drops it. */
  cancelled?: boolean;
}

/**
 * One spoken turn: the user's words, then model rounds until it answers
 * without calling a tool. History grows only by what was actually completed.
 */
export async function runWalkieTurn(history: readonly InputItem[], text: string, deps: WalkieTurnDeps): Promise<WalkieTurnResult> {
  const items = trimHistory([...history, userItem(text)]);
  const current = deps.isCurrent ?? (() => true);
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let reply = "";
    const calls: Extract<RespondEvent, { kind: "call" }>[] = [];
    let terminal: RespondEvent | undefined;
    await deps.respond(items, (event) => {
      if (!current() || terminal) return;
      if (event.kind === "delta") {
        reply += event.text;
        deps.onText?.(reply);
      } else if (event.kind === "call") {
        calls.push(event);
      } else {
        terminal = event;
      }
    });
    if (!current()) return { history: [...history], reply: "", cancelled: true };
    const end = terminal as RespondEvent | undefined;
    if (!end || end.kind === "error") {
      const error = end?.kind === "error" ? end : { error: "outdated" as const, message: "" };
      // The user's words stay out of the history: the next press is a fresh try.
      return { history: [...history], reply, error: { error: error.error, message: error.message, ...(end?.kind === "error" && end.manageUrl ? { manageUrl: end.manageUrl } : {}) } };
    }
    if (reply) items.push(assistantItem(reply));
    if (calls.length === 0) return { history: items, reply };
    for (const call of calls) {
      items.push(callItem(call));
      items.push(outputItem(call.callId, deps.runTool(call.name, call.arguments)));
    }
  }
  const fallback = "I couldn't finish that. Try asking again.";
  return { history: [...items, assistantItem(fallback)], reply: fallback };
}

// ---- which voice mode -------------------------------------------------------

export type VoiceMode = "live" | "walkie";

export function parseVoiceMode(raw: string | null | undefined): VoiceMode | undefined {
  return raw === "live" || raw === "walkie" ? raw : undefined;
}

/**
 * The user's choice, else live calls when the computer says it can make them
 * with Gemini, else walkie-talkie. An absent `engines` list (older daemon) is
 * "unknown", which is not a promise that live calls work.
 */
export function effectiveVoiceMode(saved: VoiceMode | undefined, engines: readonly string[] | undefined): VoiceMode {
  if (saved) return saved;
  return engines?.includes("gemini") ? "live" : "walkie";
}
