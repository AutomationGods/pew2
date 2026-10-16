import { expect, test } from "bun:test";
import { applyConfigChoice, revertConfigChoice, settleConfigChoice, type ConfigHolder } from "./configTruth";
import {
  applyGoalMessage,
  EMPTY_GG,
  goalsRequested,
  optimisticGoalAction,
  withCachedGoals,
  type GoalState,
  type GoalSummary,
} from "./ggState";
import { fromLastKnown, historyFromSessions, keepKnownProjects, toLastKnown, withCachedProjects } from "./lastKnown";
import { pendingSession, pendingSessionKey, startingConversation } from "./pendingSession";
import type { ConfigOption, Session } from "./useDaemon";

const model = (currentValue: string): ConfigOption[] => [
  { id: "m", name: "Model", type: "select", currentValue, options: [{ value: "a", name: "A" }, { value: "b", name: "B" }] },
];
const row = (id: string, extra: Partial<Session> = {}): Session => ({
  id, providerId: "p", title: id, startedAt: 1, turns: [], configOptions: model("a"), ...extra,
});
const holder = (): ConfigHolder => ({ sessionId: "s1", configOptions: model("a"), sessions: [row("s1"), row("s2")] });

test("a pill tap changes the open session's list and its row at once", () => {
  const next = applyConfigChoice(holder(), "s1", "m", "b");
  expect(next.configOptions[0]?.currentValue).toBe("b");
  expect(next.sessions[0]?.configOptions[0]?.currentValue).toBe("b");
  expect(next.sessions[1]?.configOptions[0]?.currentValue).toBe("a");
  expect(next.pendingConfig?.previous[0]?.currentValue).toBe("a");
});

test("a refusal undoes to what the daemon last confirmed, even after two taps", () => {
  const twice = applyConfigChoice(applyConfigChoice(holder(), "s1", "m", "b"), "s1", "m", "a");
  const reverted = revertConfigChoice(applyConfigChoice(twice, "s1", "m", "b"));
  expect(reverted.configOptions[0]?.currentValue).toBe("a");
  expect(reverted.sessions[0]?.configOptions[0]?.currentValue).toBe("a");
  expect(reverted.pendingConfig).toBeUndefined();
});

test("session.config settles the pending change; no pending change means no revert", () => {
  const settled = settleConfigChoice(applyConfigChoice(holder(), "s1", "m", "b"), "s1");
  expect(settled.pendingConfig).toBeUndefined();
  expect(revertConfigChoice(settled)).toBe(settled);
});

const goal = (id: string, extra: Partial<GoalSummary> = {}): GoalSummary => ({
  id, name: id, goal: "g", context: [{ kind: "file", path: "/a" }], path: `/${id}`, createdAt: "t", lastActiveMs: 1, status: "running", ...extra,
});
const liveState = (paused: boolean): GoalState =>
  ({ t: "goal.state", sessionId: "s1", goalId: "g1", phase: "active", paused, workers: [] }) as GoalState;

test("pause flips the listed goal and its live state at once; ok settles it", () => {
  const start = { ...EMPTY_GG, goals: [goal("g1"), goal("g2")], goalStates: { s1: liveState(false) } };
  const paused = optimisticGoalAction(start, "r1", "g1", "pause");
  expect(paused.goals?.[0]?.status).toBe("paused");
  expect(paused.goalStates.s1?.paused).toBe(true);
  const settled = applyGoalMessage(paused, { t: "goal.result", requestId: "r1", ok: true });
  expect(settled.goalPending).toEqual({});
  expect(settled.goals?.[0]?.status).toBe("paused");
});

test("a refused action is undone, delete goes back in place", () => {
  const start = { ...EMPTY_GG, goals: [goal("g1"), goal("g2")], goalStates: { s1: liveState(false) } };
  const paused = applyGoalMessage(optimisticGoalAction(start, "r1", "g1", "pause"), { t: "goal.result", requestId: "r1", ok: false, error: "no" });
  expect(paused.goals?.[0]?.status).toBe("running");
  expect(paused.goalStates.s1?.paused).toBe(false);
  const deleted = optimisticGoalAction(start, "r2", "g1", "delete");
  expect(deleted.goals?.map((g) => g.id)).toEqual(["g2"]);
  const back = applyGoalMessage(deleted, { t: "goal.result", requestId: "r2", ok: false });
  expect(back.goals?.map((g) => g.id)).toEqual(["g1", "g2"]);
});

test("update patches context and instructions, keeping known item kinds", () => {
  const next = optimisticGoalAction({ ...EMPTY_GG, goals: [goal("g1")] }, "r", "g1", "update", { context: ["/a", "/b"], instructions: "x" });
  expect(next.goals?.[0]?.context).toEqual([{ kind: "file", path: "/a" }, { kind: "folder", path: "/b" }]);
  expect(next.goals?.[0]?.instructions).toBe("x");
});

test("a stale list landing before the result keeps the tap on screen", () => {
  const paused = optimisticGoalAction({ ...EMPTY_GG, goals: [goal("g1")] }, "r1", "g1", "pause");
  const listed = applyGoalMessage(paused, { t: "goals", goals: [goal("g1")] });
  expect(listed.goals?.[0]?.status).toBe("paused");
});

test("refreshing a known list is silent; a cached list never overwrites a live one", () => {
  expect(goalsRequested(EMPTY_GG).goalsLoading).toBe(true);
  const known = { ...EMPTY_GG, goals: [goal("g1")] };
  expect(goalsRequested(known)).toBe(known);
  expect(withCachedGoals(EMPTY_GG, [goal("c")]).goals?.[0]?.id).toBe("c");
  expect(withCachedGoals(known, [goal("c")])).toBe(known);
});

test("last-known lists round-trip; junk and empty read as nothing", () => {
  const sessions = [row("agent:p:x", { agentSessionId: "x", cwd: "/r", startedAt: 5 }), row("s1")];
  const raw = toLastKnown({ goals: [goal("g1")], history: historyFromSessions(sessions), projects: { p: [{ path: "/r", name: "r" }] } });
  const back = fromLastKnown(raw);
  expect(back.goals?.[0]?.id).toBe("g1");
  expect(back.history.p?.map((s) => s.sessionId)).toEqual(["x"]);
  expect(back.projects.p?.[0]?.path).toBe("/r");
  expect(toLastKnown({ goals: [], history: {}, projects: { p: [] } })).toBeUndefined();
  expect(fromLastKnown("{nope").history).toEqual({});
  expect(fromLastKnown(JSON.stringify({ v: 1, goals: [{ id: 1 }] })).goals).toBeUndefined();
});

test("an empty projects answer never blanks a known list; absent says nothing", () => {
  const known = { p: [{ path: "/r", name: "r" }] };
  expect(keepKnownProjects(known, "p", [])).toBe(known);
  expect(keepKnownProjects(known, "p", undefined)).toBe(known);
  expect(keepKnownProjects({}, "p", [])).toEqual({ p: [] });
  expect(withCachedProjects(known, { p: [{ path: "/x", name: "x" }] })).toBe(known);
  expect(withCachedProjects({}, known)).toEqual(known);
});

test("an empty new conversation is on screen while pending and after adoption", () => {
  const key = pendingSessionKey("req");
  const pending = pendingSession("req", "p", undefined, 1);
  expect(startingConversation(key, undefined, [pending])?.id).toBe(key);
  expect(startingConversation(key, undefined, [])).toBeUndefined();
  expect(startingConversation("s9", "s9", [row("s9")])?.id).toBe("s9");
  expect(startingConversation("s9", "other", [row("s9")])).toBeUndefined();
});
