import { describe, expect, test } from "bun:test";
import { matchOption, runVoiceTool, sessionUpdate, type VoiceSession, type VoiceToolContext } from "./tools";

const permission = {
  requestId: "r1",
  title: "Run npm test",
  options: [
    { optionId: "allow_once", name: "Allow" },
    { optionId: "allow_always", name: "Always allow" },
    { optionId: "reject", name: "Deny" },
  ],
};

function context(sessions: VoiceSession[], connected = true) {
  const calls: string[] = [];
  const ctx: VoiceToolContext = {
    sessions: () => sessions,
    isLive: (id) => id !== "old",
    providerName: (id) => (id === "claude" ? "Claude Code" : undefined),
    prompt: (id, text) => (calls.push(`prompt ${id} ${text}`), connected),
    answer: (id, req, opt) => (calls.push(`answer ${id} ${req} ${opt}`), connected),
    cancel: (id) => (calls.push(`cancel ${id}`), connected),
  };
  return { ctx, calls };
}

const sessions: VoiceSession[] = [
  { id: "s1", title: "Fix login", providerId: "claude", folder: "web", busy: true, turns: [{ role: "agent", text: "## Done\nTests pass now." }] },
  { id: "s2", title: "Docs", providerId: "codex", permission, turns: [] },
  { id: "old", title: "Archived", providerId: "claude", turns: [] },
];

describe("runVoiceTool", () => {
  test("list_sessions hides closed idle history", () => {
    const { ctx } = context(sessions);
    const out = runVoiceTool("list_sessions", "", ctx) as { sessions: { sessionId: string; state: string; agent: string }[] };
    expect(out.sessions.map((s) => [s.sessionId, s.state, s.agent])).toEqual([
      ["s1", "working", "Claude Code"],
      ["s2", "needs permission", "codex"],
    ]);
  });
  test("get_session_status summarises", () => {
    const { ctx } = context(sessions);
    expect(runVoiceTool("get_session_status", '{"sessionId":"s1"}', ctx)).toMatchObject({ state: "working", lastAgentMessage: "Done" });
    expect(runVoiceTool("get_session_status", '{"sessionId":"s2"}', ctx)).toMatchObject({
      pendingPermission: { title: "Run npm test", options: ["Allow", "Always allow", "Deny"] },
    });
    expect(runVoiceTool("get_session_status", '{"sessionId":"x"}', ctx)).toHaveProperty("error");
  });
  test("send_prompt", () => {
    const { ctx, calls } = context(sessions);
    expect(runVoiceTool("send_prompt", '{"sessionId":"s1","text":" run tests "}', ctx)).toEqual({ ok: true, sent: "run tests" });
    expect(calls).toEqual(["prompt s1 run tests"]);
    expect(runVoiceTool("send_prompt", '{"sessionId":"old","text":"hi"}', ctx)).toHaveProperty("error");
    expect(runVoiceTool("send_prompt", '{"sessionId":"s1","text":""}', ctx)).toHaveProperty("error");
    expect(runVoiceTool("send_prompt", '{"sessionId":"s1","text":"x"}', context(sessions, false).ctx)).toHaveProperty("error");
  });
  test("answer_permission", () => {
    const { ctx, calls } = context(sessions);
    expect(runVoiceTool("answer_permission", '{"sessionId":"s2","choice":"yes"}', ctx)).toEqual({ ok: true, chose: "Allow" });
    expect(calls).toEqual(["answer s2 r1 allow_once"]);
    expect(runVoiceTool("answer_permission", '{"sessionId":"s1","choice":"yes"}', ctx)).toHaveProperty("error");
    expect(runVoiceTool("answer_permission", '{"sessionId":"s2","choice":"banana"}', ctx)).toHaveProperty("options");
  });
  test("cancel_turn and junk", () => {
    const { ctx, calls } = context(sessions);
    expect(runVoiceTool("cancel_turn", '{"sessionId":"s1"}', ctx)).toEqual({ ok: true });
    expect(runVoiceTool("cancel_turn", '{"sessionId":"s2"}', ctx)).toMatchObject({ ok: true });
    expect(calls).toEqual(["cancel s1"]);
    expect(runVoiceTool("nope", "{not json", ctx)).toHaveProperty("error");
  });
});

test("matchOption", () => {
  expect(matchOption(permission.options, "Deny")?.optionId).toBe("reject");
  expect(matchOption(permission.options, "no")?.optionId).toBe("reject");
  expect(matchOption(permission.options, "always allow")?.optionId).toBe("allow_always");
  expect(matchOption(permission.options, "")).toBeUndefined();
});

test("sessionUpdate carries tools and voice", () => {
  const u = sessionUpdate("be brief", "marin") as { session: { tools: unknown[]; audio: { output?: { voice: string } } } };
  expect(u.session.tools).toHaveLength(11);
  expect(u.session.audio.output?.voice).toBe("marin");
});

describe("GG Coder questions and goals", () => {
  const ask = {
    requestId: "ask1",
    questions: [
      { id: "db", question: "Which database?", kind: "choice" as const, options: [{ label: "Postgres", value: "pg", recommended: true }, { label: "SQLite" }] },
      { id: "go", question: "Ship today?", kind: "confirm" as const },
    ],
  };
  const goals = [{ id: "g1", name: "gpt live", goal: "Voice calls", status: "running", sessionId: "s1" }];

  function gg(connected = true) {
    const calls: string[] = [];
    const base = context(sessions, connected).ctx;
    const ctx: VoiceToolContext = {
      ...base,
      asks: (id) => (id === "s1" ? [ask] : []),
      answerAsk: (id, req, result) => (calls.push(`${id} ${req} ${JSON.stringify(result)}`), connected),
      goals: () => goals,
      goalWorkers: () => [{ name: "app builder", state: "running", activity: "editing App.tsx" }],
      goalAction: (id, action) => (calls.push(`${action} ${id}`), connected),
    };
    return { ctx, calls };
  }

  test("status shows the open question with its options", () => {
    const out = runVoiceTool("get_session_status", JSON.stringify({ sessionId: "s1" }), gg().ctx) as {
      state: string;
      openQuestion: { questionId: string; options: string[] }[];
    };
    expect(out.state).toBe("has a question for you");
    expect(out.openQuestion.map((q) => [q.questionId, q.options])).toEqual([
      ["db", ["Postgres (recommended)", "SQLite"]],
      ["go", ["Yes", "No"]],
    ]);
  });

  test("spoken answers map onto option values", () => {
    const { ctx, calls } = gg();
    const out = runVoiceTool(
      "answer_question",
      JSON.stringify({ sessionId: "s1", answers: [{ questionId: "db", answer: "postgres" }, { questionId: "go", answer: "yeah, go ahead" }] }),
      ctx,
    );
    expect(out).toEqual({ ok: true, answered: { db: "pg", go: "yes" } });
    expect(calls).toEqual([`s1 ask1 ${JSON.stringify({ action: "answer", answers: { db: "pg", go: "yes" } })}`]);
  });

  test("a missing answer is reported, not sent", () => {
    const { ctx, calls } = gg();
    const out = runVoiceTool("answer_question", JSON.stringify({ sessionId: "s1", answers: [{ questionId: "db", answer: "SQLite" }] }), ctx) as {
      needsAnswer: { questionId: string }[];
    };
    expect(out.needsAnswer.map((q) => q.questionId)).toEqual(["go"]);
    expect(calls).toEqual([]);
  });

  test("dismiss cancels the question", () => {
    const { ctx, calls } = gg();
    expect(runVoiceTool("dismiss_question", JSON.stringify({ sessionId: "s1" }), ctx)).toEqual({ ok: true });
    expect(calls).toEqual([`s1 ask1 {"action":"cancel"}`]);
  });

  test("goals list, report workers, and pause", () => {
    const { ctx, calls } = gg();
    expect(runVoiceTool("list_goals", "", ctx)).toEqual({ goals: [{ goalId: "g1", name: "gpt live", status: "running" }] });
    const status = runVoiceTool("get_goal_status", JSON.stringify({ goalId: "g1" }), ctx) as { workers: unknown[] };
    expect(status.workers).toEqual([{ name: "app builder", state: "running", doing: "editing App.tsx" }]);
    expect(runVoiceTool("pause_goal", JSON.stringify({ goalId: "g1" }), ctx)).toEqual({ ok: true });
    expect(calls).toEqual(["pause g1"]);
  });
});
