import { expect, test } from "bun:test";
import { computeLineDiff } from "./lineDiff";
import { diffCounts, MAX_OUTPUT_CHARS, mergeToolCard, readPlan, readSessionTitle, readToolPatch, shortPath } from "./toolCalls";
import { isEmptyChunk, readChunk } from "./chunks";
import { applyChunk, foldBackgroundEvent, foldSessionEvents } from "./replayFold";
import type { PermissionRequest, Session, Turn } from "./useDaemon";

const ev = (seq: number, update: Record<string, unknown>) => ({ sessionId: "s1", seq, payload: { update } });
const start = (seq: number, id = "t1") =>
  ev(seq, {
    sessionUpdate: "tool_call",
    toolCallId: id,
    title: "Edit src/a.ts",
    kind: "edit",
    status: "in_progress",
    rawInput: { file_path: "src/a.ts" },
    locations: [{ path: "/repo/src/a.ts" }],
  });
const finish = (seq: number, id = "t1") =>
  ev(seq, {
    sessionUpdate: "tool_call_update",
    toolCallId: id,
    status: "completed",
    content: [{ type: "diff", path: "/repo/src/a.ts", oldText: "a\nb\nc\n", newText: "a\nB\nc\nd\n" }],
  });
const say = (seq: number, text: string) => ev(seq, { sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
const prompt = (seq: number, text: string) => ev(seq, { sessionUpdate: "user_message_chunk", content: { type: "text", text } });
const plan = (seq: number, statuses: string[]) =>
  ev(seq, { sessionUpdate: "plan", entries: statuses.map((status, i) => ({ content: `step ${i}`, priority: "high", status })) });

const session: Session = { id: "s1", providerId: "ggcoder", title: "New conversation", startedAt: 1, turns: [], configOptions: [] };
const state = () => ({ turns: [] as Turn[], sessions: [session], busy: false, permission: undefined as PermissionRequest | undefined });

test("line diff counts and marks changes with context", () => {
  const diff = computeLineDiff("f", "a\nb\nc\n", "a\nB\nc\nd\n");
  expect(diff.added).toBe(2);
  expect(diff.removed).toBe(1);
  expect(diff.lines.map((l) => l.kind)).toEqual(["ctx", "del", "add", "ctx", "add"]);
  expect(diff.truncated).toBe(false);
});

test("line diff skips distant unchanged lines with a gap row", () => {
  const old = Array.from({ length: 50 }, (_, i) => `line ${i}`);
  const next = [...old];
  next[2] = "changed early";
  next[45] = "changed late";
  const diff = computeLineDiff("f", old.join("\n"), next.join("\n"));
  expect(diff.added).toBe(2);
  expect(diff.removed).toBe(2);
  expect(diff.lines.filter((l) => l.kind === "gap")).toHaveLength(1);
});

test("huge files are capped rather than aligned line by line", () => {
  const old = Array.from({ length: 5000 }, (_, i) => `a${i}`).join("\n");
  const next = Array.from({ length: 5000 }, (_, i) => `b${i}`).join("\n");
  const diff = computeLineDiff("f", old, next);
  expect(diff.removed).toBe(5000);
  expect(diff.added).toBe(5000);
  expect(diff.lines.length).toBeLessThanOrEqual(300);
  expect(diff.truncated).toBe(true);
});

test("a tool call and its updates merge into one card", () => {
  const first = readToolPatch(start(0).payload.update);
  const card = mergeToolCard(undefined, first ?? { id: "x" });
  expect(card).toMatchObject({ id: "t1", title: "Edit src/a.ts", kind: "edit", status: "in_progress", target: "…/src/a.ts" });
  expect(card.input).toContain("file_path");
  const done = mergeToolCard(card, readToolPatch(finish(1).payload.update) ?? { id: "x" });
  expect(done.status).toBe("completed");
  expect(done.title).toBe("Edit src/a.ts");
  expect(diffCounts(done)).toEqual({ added: 2, removed: 1 });
});

test("text output is capped and unknown kinds read as other", () => {
  const patch = readToolPatch({
    sessionUpdate: "tool_call",
    toolCallId: "t",
    kind: "weird",
    content: [{ type: "content", content: { type: "text", text: "x".repeat(MAX_OUTPUT_CHARS * 3) } }],
  });
  expect(patch?.kind).toBe("other");
  expect(patch?.status).toBe("pending");
  expect(patch?.output?.length).toBeLessThan(MAX_OUTPUT_CHARS + 100);
});

test("shortPath keeps the last two segments", () => {
  expect(shortPath("/Users/me/repo/src/a.ts")).toBe("…/src/a.ts");
  expect(shortPath("a.ts")).toBe("a.ts");
});

test("plan entries and session titles parse", () => {
  expect(readPlan(plan(0, ["completed", "in_progress", "bogus"]).payload.update)).toEqual([
    { content: "step 0", status: "completed", priority: "high" },
    { content: "step 1", status: "in_progress", priority: "high" },
    { content: "step 2", status: "pending", priority: "high" },
  ]);
  expect(readSessionTitle({ sessionUpdate: "session_info_update", title: "  Fix   login " })).toBe("Fix login");
  expect(isEmptyChunk(readChunk({ update: { sessionUpdate: "session_info_update", title: "T" } }))).toBe(false);
});

test("replay folds tool cards in stream order, merged by id", () => {
  const next = foldSessionEvents(state(), [prompt(0, "go"), say(1, "Editing."), start(2), finish(3), say(4, "Done.")]);
  expect(next.turns.map((t) => t.role)).toEqual(["user", "agent", "tool", "agent"]);
  expect(next.turns[2]).toMatchObject({ id: "s1:2", tool: { status: "completed" } });
  expect(next.busy).toBe(false);
});

test("live application produces the same transcript as replay", () => {
  const events = [prompt(0, "go"), start(1), plan(2, ["in_progress", "pending"]), finish(3), plan(4, ["completed", "in_progress"])];
  const live: Turn[] = [];
  for (const event of events) {
    const chunk = readChunk(event.payload);
    if (chunk && !isEmptyChunk(chunk)) applyChunk(live, `s1:${event.seq}`, chunk);
  }
  const replay = foldSessionEvents(state(), events);
  expect(replay.turns).toEqual(live);
  // The plan is rewritten in place within one exchange.
  expect(live.filter((t) => t.role === "plan")).toHaveLength(1);
  expect(live.find((t) => t.role === "plan")?.plan?.[0]?.status).toBe("completed");
});

test("after a new prompt the plan moves down to the current exchange", () => {
  const next = foldSessionEvents(state(), [prompt(0, "a"), plan(1, ["pending"]), prompt(2, "b"), plan(3, ["completed"])]);
  expect(next.turns.map((t) => t.role)).toEqual(["user", "user", "plan"]);
});

test("session_info_update titles the conversation and adds no row", () => {
  const next = foldBackgroundEvent(state(), "s1", "s1:0", { update: { sessionUpdate: "session_info_update", title: "Fix login" } });
  expect(next.sessions[0]?.title).toBe("Fix login");
  expect(next.sessions[0]?.turns).toEqual([]);
});

test("old agents without tool ids still render tool images as agent turns", () => {
  const chunk = readChunk({
    update: {
      sessionUpdate: "tool_call_update",
      content: [{ type: "content", content: { type: "resource_link", uri: "out/a.png", mimeType: "image/png" } }],
    },
  });
  expect(chunk?.role).toBe("agent");
});
