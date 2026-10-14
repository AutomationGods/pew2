/**
 * The tools the voice model can call, run in the app against its own state.
 *
 * Expo-free on purpose: the context is plain functions and data, supplied by
 * the call screen from `useDaemon`, so `bun test` covers the dispatch.
 */
import { summarise } from "@pew2/protocol";

export interface VoiceSession {
  id: string;
  title: string;
  providerId: string;
  folder?: string;
  busy?: boolean;
  unread?: boolean;
  permission?: { requestId: string; title: string; options: { optionId: string; name: string }[] };
  turns: { role: string; text: string }[];
}

export interface VoiceToolContext {
  sessions: () => VoiceSession[];
  /** Live session ids; others are history that would need reopening. */
  isLive: (sessionId: string) => boolean;
  providerName: (providerId: string) => string | undefined;
  prompt: (sessionId: string, text: string) => boolean;
  answer: (sessionId: string, requestId: string, optionId: string) => boolean;
  cancel: (sessionId: string) => boolean;
}

const sessionIdParam = {
  type: "string",
  description: "The session id from list_sessions.",
} as const;

/** Tool definitions, in the Realtime `session.tools` shape. */
export const VOICE_TOOLS = [
  {
    type: "function",
    name: "list_sessions",
    description: "List the user's open agent sessions with their state.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_session_status",
    description:
      "Recent activity of one session: whether it is working, the last agent message (summarized), and any pending permission request with its options.",
    parameters: {
      type: "object",
      properties: { sessionId: sessionIdParam },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "send_prompt",
    description:
      "Send a prompt to a session's coding agent. Only call after reading the prompt back and hearing the user's yes.",
    parameters: {
      type: "object",
      properties: { sessionId: sessionIdParam, text: { type: "string", description: "The prompt." } },
      required: ["sessionId", "text"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "answer_permission",
    description:
      "Answer the pending permission request of a session. choice is an option name or id from get_session_status, e.g. 'Allow' or 'Deny'.",
    parameters: {
      type: "object",
      properties: { sessionId: sessionIdParam, choice: { type: "string" } },
      required: ["sessionId", "choice"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "cancel_turn",
    description: "Stop the agent's current turn in a session.",
    parameters: {
      type: "object",
      properties: { sessionId: sessionIdParam },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
] as const;

function lastAgentText(session: VoiceSession): string | undefined {
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const turn = session.turns[i]!;
    if (turn.role === "agent" && turn.text.trim()) return turn.text;
  }
  return undefined;
}

function state(session: VoiceSession, live: boolean): string {
  if (session.permission) return "needs permission";
  if (session.busy) return "working";
  if (!live) return "closed";
  return session.unread ? "finished, unread" : "idle";
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Pick the option a spoken choice means: exact id, exact name, then loose. */
export function matchOption(
  options: { optionId: string; name: string }[],
  choice: string,
): { optionId: string; name: string } | undefined {
  const c = choice.trim().toLowerCase();
  if (!c) return undefined;
  const exact = options.find((o) => o.optionId.toLowerCase() === c || o.name.toLowerCase() === c);
  if (exact) return exact;
  const yes = /^(yes|yeah|allow|approve|ok|okay|sure|go ahead)\b/.test(c);
  const no = /^(no|nope|deny|reject|don'?t|stop)\b/.test(c);
  const loose = options.find((o) => {
    const n = `${o.name} ${o.optionId}`.toLowerCase();
    return n.includes(c) || c.includes(o.name.toLowerCase());
  });
  if (loose) return loose;
  if (yes) return options.find((o) => /allow|approve|yes|accept/i.test(`${o.name} ${o.optionId}`) && !/always/i.test(o.name));
  if (no) return options.find((o) => /deny|reject|no|decline/i.test(`${o.name} ${o.optionId}`));
  return undefined;
}

/** Run one tool call; always resolves to a JSON-able result. */
export function runVoiceTool(name: string, rawArgs: string, ctx: VoiceToolContext): Record<string, unknown> {
  const args = parseArgs(rawArgs);
  const sessions = ctx.sessions();
  const find = () => {
    const id = typeof args.sessionId === "string" ? args.sessionId : "";
    return sessions.find((s) => s.id === id);
  };

  switch (name) {
    case "list_sessions":
      return {
        sessions: sessions
          .filter((s) => ctx.isLive(s.id) || s.busy || s.permission)
          .slice(0, 12)
          .map((s) => ({
            sessionId: s.id,
            title: s.title,
            agent: ctx.providerName(s.providerId) ?? s.providerId,
            folder: s.folder,
            state: state(s, ctx.isLive(s.id)),
          })),
      };
    case "get_session_status": {
      const s = find();
      if (!s) return { error: "No session with that id. Call list_sessions." };
      return {
        sessionId: s.id,
        title: s.title,
        agent: ctx.providerName(s.providerId) ?? s.providerId,
        folder: s.folder,
        state: state(s, ctx.isLive(s.id)),
        lastAgentMessage: summarise(lastAgentText(s)),
        pendingPermission: s.permission
          ? { title: s.permission.title, options: s.permission.options.map((o) => o.name) }
          : undefined,
      };
    }
    case "send_prompt": {
      const s = find();
      const text = typeof args.text === "string" ? args.text.trim() : "";
      if (!s) return { error: "No session with that id. Call list_sessions." };
      if (!text) return { error: "The prompt is empty." };
      if (!ctx.isLive(s.id)) return { error: "That session is closed. Open it on the phone first." };
      return ctx.prompt(s.id, text) ? { ok: true, sent: text } : { error: "Not connected to the computer." };
    }
    case "answer_permission": {
      const s = find();
      if (!s) return { error: "No session with that id. Call list_sessions." };
      if (!s.permission) return { error: "That session has no pending permission request." };
      const option = matchOption(s.permission.options, typeof args.choice === "string" ? args.choice : "");
      if (!option) {
        return { error: "That choice doesn't match an option.", options: s.permission.options.map((o) => o.name) };
      }
      return ctx.answer(s.id, s.permission.requestId, option.optionId)
        ? { ok: true, chose: option.name }
        : { error: "Not connected to the computer." };
    }
    case "cancel_turn": {
      const s = find();
      if (!s) return { error: "No session with that id. Call list_sessions." };
      if (!s.busy) return { ok: true, note: "It wasn't working." };
      return ctx.cancel(s.id) ? { ok: true } : { error: "Not connected to the computer." };
    }
    default:
      return { error: `Unknown tool ${name}.` };
  }
}

/** The `session.update` sent once the data channel opens. */
export function sessionUpdate(instructions: string, voice?: string): unknown {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      instructions,
      tools: VOICE_TOOLS,
      tool_choice: "auto",
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: { type: "semantic_vad" },
        },
        ...(voice ? { output: { voice } } : {}),
      },
    },
  };
}
