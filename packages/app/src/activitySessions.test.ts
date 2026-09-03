import { describe, expect, test } from "bun:test";
import { activitySummary, groupActivitySessions, receiptSummary } from "./activitySessions";
import type { Session } from "./useDaemon";

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    providerId: "echo",
    title: id,
    startedAt: Number(id.replace(/\D/g, "")) || 0,
    turns: [],
    configOptions: [],
    ...overrides,
  };
}

describe("activity sessions", () => {
  test("puts each conversation in its most urgent section", () => {
    const groups = groupActivitySessions([
      session("recent-1"),
      session("ready-2", { unread: true }),
      session("working-3", { busy: true }),
      session("permission-4", {
        busy: true,
        unread: true,
        permission: { requestId: "request", title: "Run tests", options: [] },
      }),
    ]);

    expect(groups.needsYou.map(({ id }) => id)).toEqual(["permission-4"]);
    expect(groups.working.map(({ id }) => id)).toEqual(["working-3"]);
    expect(groups.ready.map(({ id }) => id)).toEqual(["ready-2"]);
    expect(groups.recent.map(({ id }) => id)).toEqual(["recent-1"]);
    expect(activitySummary(groups)).toBe("2 working · 1 needs you");
  });

  test("summarises ready and idle states without fake progress", () => {
    expect(activitySummary(groupActivitySessions([session("ready", { unread: true })]))).toBe(
      "1 result ready",
    );
    expect(activitySummary(groupActivitySessions([]))).toBe("Nothing active");
    expect(receiptSummary(session("plain"))).toBe("New reply");
    expect(
      receiptSummary(
        session("finished", {
          receipt: { verb: "Edited & ran", duration: "2m 4s", tools: 3, failed: 0 },
        }),
      ),
    ).toBe("Edited & ran in 2m 4s");
  });
});
