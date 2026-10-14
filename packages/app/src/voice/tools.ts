/**
 * The tools the voice model can call, run in the app against its own state.
 *
 * Expo-free on purpose: the context is plain functions and data, supplied by
 * the call screen from `useDaemon`, so `bun test` covers the dispatch.
 */
import { summarise } from "@pew2/protocol";
import { allowsOther, optionValue, questionOptions, type AskQuestion, type AskRequest, type AskResult } from "../askUser";

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
  /** GG Coder questions (`ask_user`) still open in a session, oldest first. */
  asks?: (sessionId: string) => AskRequest[];
  /** Answer (or dismiss) one open question. */
  answerAsk?: (sessionId: string, requestId: string, result: AskResult) => boolean;
  /** GG Coder goals, or undefined before the computer has listed them. */
  goals?: () => VoiceGoal[] | undefined;
  /** Live workers of the goal a session coordinates. */
  goalWorkers?: (sessionId: string) => VoiceGoalWorker[] | undefined;
  /** Pause or resume a goal. */
  goalAction?: (goalId: string, action: "pause" | "resume") => boolean;
}

export interface VoiceGoal {
  id: string;
  name: string;
  goal: string;
  status: string;
  sessionId?: string;
}

export interface VoiceGoalWorker {
  name: string;
  state: string;
  activity?: string;
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
    name: "answer_question",
    description:
      "Answer the open question GG Coder asked in a session (see openQuestion in get_session_status). Give one answer per question id: an option label, or the user's own words where free text is allowed. For a multi-choice question, pass several labels separated by commas.",
    parameters: {
      type: "object",
      properties: {
        sessionId: sessionIdParam,
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionId: { type: "string" },
              answer: { type: "string" },
            },
            required: ["questionId", "answer"],
            additionalProperties: false,
          },
        },
      },
      required: ["sessionId", "answers"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "dismiss_question",
    description: "Dismiss GG Coder's open question in a session without answering, when the user says to skip it.",
    parameters: {
      type: "object",
      properties: { sessionId: sessionIdParam },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_goals",
    description: "List the user's GG Coder goals (long-running objectives) with their status.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_goal_status",
    description:
      "How one goal is going: its status, its workers and what each is doing, and the coordinator's latest message.",
    parameters: {
      type: "object",
      properties: { goalId: { type: "string", description: "The goal id from list_goals." } },
      required: ["goalId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "pause_goal",
    description: "Pause a goal: stops its run and workers until resumed. Confirm with the user first.",
    parameters: {
      type: "object",
      properties: { goalId: { type: "string" } },
      required: ["goalId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "resume_goal",
    description: "Resume a paused or interrupted goal.",
    parameters: {
      type: "object",
      properties: { goalId: { type: "string" } },
      required: ["goalId"],
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

function state(session: VoiceSession, live: boolean, asking = false): string {
  if (session.permission) return "needs permission";
  if (asking) return "has a question for you";
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

/** A question as the voice model needs it: what is asked and what it may say. */
function describeQuestion(q: AskQuestion) {
  return {
    questionId: q.id,
    question: q.question,
    detail: q.detail,
    kind: q.kind,
    options: questionOptions(q).map((o) => (o.recommended ? `${o.label} (recommended)` : o.label)),
    freeTextAllowed: allowsOther(q),
  };
}

/**
 * Turn one spoken answer into what GG Coder expects: option values where the
 * words name options, the words themselves where free text is allowed.
 */
export function answerQuestion(q: AskQuestion, spoken: string): string | string[] | undefined {
  const text = spoken.trim();
  if (!text) return undefined;
  const options = questionOptions(q);
  const pick = (word: string) => {
    const w = word.trim().toLowerCase().replace(/\s*\(recommended\)$/, "");
    if (!w) return undefined;
    const exact = options.find((o) => o.label.toLowerCase() === w || optionValue(o).toLowerCase() === w);
    if (exact) return exact;
    if (q.kind === "confirm" || options.some((o) => /^(yes|no)$/i.test(o.label))) {
      if (/^(yes|yeah|yep|sure|ok|okay|do it|go ahead|correct)\b/.test(w)) return options.find((o) => /^yes/i.test(o.label));
      if (/^(no|nope|don'?t|not)\b/.test(w)) return options.find((o) => /^no/i.test(o.label));
    }
    return options.find((o) => o.label.toLowerCase().includes(w) || w.includes(o.label.toLowerCase()));
  };
  if (q.kind === "multi") {
    const parts = text.split(/,|\band\b/).map((p) => p.trim()).filter(Boolean);
    const chosen: string[] = [];
    for (const part of parts) {
      const o = pick(part);
      if (o) chosen.push(optionValue(o));
      else if (allowsOther(q)) chosen.push(part);
      else return undefined;
    }
    return chosen.length > 0 ? [...new Set(chosen)] : undefined;
  }
  const o = q.kind === "text" ? undefined : pick(text);
  if (o) return optionValue(o);
  return allowsOther(q) ? text : undefined;
}

/** Run one tool call; always resolves to a JSON-able result. */
export function runVoiceTool(name: string, rawArgs: string, ctx: VoiceToolContext): Record<string, unknown> {
  const args = parseArgs(rawArgs);
  const sessions = ctx.sessions();
  const find = () => {
    const id = typeof args.sessionId === "string" ? args.sessionId : "";
    return sessions.find((s) => s.id === id);
  };
  const openAsks = (id: string) => ctx.asks?.(id) ?? [];
  const findGoal = () => {
    const id = typeof args.goalId === "string" ? args.goalId : "";
    return ctx.goals?.()?.find((g) => g.id === id);
  };

  switch (name) {
    case "list_sessions":
      return {
        sessions: sessions
          .filter((s) => ctx.isLive(s.id) || s.busy || s.permission || openAsks(s.id).length > 0)
          .slice(0, 12)
          .map((s) => ({
            sessionId: s.id,
            title: s.title,
            agent: ctx.providerName(s.providerId) ?? s.providerId,
            folder: s.folder,
            state: state(s, ctx.isLive(s.id), openAsks(s.id).length > 0),
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
        state: state(s, ctx.isLive(s.id), openAsks(s.id).length > 0),
        lastAgentMessage: summarise(lastAgentText(s)),
        pendingPermission: s.permission
          ? { title: s.permission.title, options: s.permission.options.map((o) => o.name) }
          : undefined,
        openQuestion: openAsks(s.id)[0]?.questions.map(describeQuestion),
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
    case "answer_question": {
      const s = find();
      if (!s) return { error: "No session with that id. Call list_sessions." };
      const ask = openAsks(s.id)[0];
      if (!ask || !ctx.answerAsk) return { error: "That session has no open question." };
      const given = new Map<string, string>();
      if (Array.isArray(args.answers)) {
        for (const entry of args.answers as unknown[]) {
          const e = entry as { questionId?: unknown; answer?: unknown };
          if (typeof e?.questionId === "string" && typeof e.answer === "string") given.set(e.questionId, e.answer);
        }
      }
      const answers: Record<string, string | string[]> = {};
      const problems: Record<string, unknown>[] = [];
      for (const q of ask.questions) {
        const spoken = given.get(q.id) ?? (ask.questions.length === 1 ? [...given.values()][0] : undefined);
        const value = spoken === undefined ? undefined : answerQuestion(q, spoken);
        if (value === undefined) problems.push(describeQuestion(q));
        else answers[q.id] = value;
      }
      if (problems.length > 0) {
        return { error: "Some questions still need an answer that matches their options.", needsAnswer: problems };
      }
      return ctx.answerAsk(s.id, ask.requestId, { action: "answer", answers })
        ? { ok: true, answered: answers }
        : { error: "Not connected to the computer." };
    }
    case "dismiss_question": {
      const s = find();
      if (!s) return { error: "No session with that id. Call list_sessions." };
      const ask = openAsks(s.id)[0];
      if (!ask || !ctx.answerAsk) return { error: "That session has no open question." };
      return ctx.answerAsk(s.id, ask.requestId, { action: "cancel" }) ? { ok: true } : { error: "Not connected to the computer." };
    }
    case "list_goals": {
      const goals = ctx.goals?.();
      if (!ctx.goals) return { error: "Goals need GG Coder on the computer." };
      if (!goals) return { error: "The goal list hasn't loaded yet. Try again in a moment." };
      return { goals: goals.slice(0, 12).map((g) => ({ goalId: g.id, name: g.name, status: g.status })) };
    }
    case "get_goal_status": {
      const g = findGoal();
      if (!g) return { error: "No goal with that id. Call list_goals." };
      const coordinator = g.sessionId ? sessions.find((s) => s.id === g.sessionId) : undefined;
      const ask = g.sessionId ? openAsks(g.sessionId)[0] : undefined;
      return {
        goalId: g.id,
        name: g.name,
        goal: summarise(g.goal),
        status: g.status,
        sessionId: g.sessionId,
        workers: g.sessionId ? ctx.goalWorkers?.(g.sessionId)?.map((w) => ({ name: w.name, state: w.state, doing: w.activity })) : undefined,
        latestMessage: coordinator ? summarise(lastAgentText(coordinator)) : undefined,
        openQuestion: ask?.questions.map(describeQuestion),
      };
    }
    case "pause_goal":
    case "resume_goal": {
      const g = findGoal();
      if (!g) return { error: "No goal with that id. Call list_goals." };
      if (!ctx.goalAction) return { error: "Goals need GG Coder on the computer." };
      return ctx.goalAction(g.id, name === "pause_goal" ? "pause" : "resume")
        ? { ok: true }
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
