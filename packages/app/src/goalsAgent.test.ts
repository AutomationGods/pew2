import { describe, expect, test } from "bun:test";
import { clampGoalName, GOAL_NAME_MAX, ggStrips, goalDrawerRow, goalsEntryLabel, isGoalsProvider, launchCaption, runningGoalCount, suggestGoalName } from "./goalsAgent";

describe("ggStrips", () => {
  test("never shows autopilot/checklist/plan for gg-goals", () => {
    expect(ggStrips("gg-goals", { autopilot: true, checklist: true }, true)).toEqual({
      autopilot: false,
      checklist: false,
      plan: false,
    });
  });
  test("follows extensions for ggcoder", () => {
    expect(ggStrips("ggcoder", { autopilot: true }, true)).toEqual({ autopilot: true, checklist: false, plan: true });
    expect(ggStrips("ggcoder", undefined, true).autopilot).toBe(false);
  });
  test("nothing without a session", () => {
    expect(ggStrips("ggcoder", { autopilot: true, checklist: true }, false).autopilot).toBe(false);
  });
  test("isGoalsProvider", () => {
    expect(isGoalsProvider("gg-goals")).toBe(true);
    expect(isGoalsProvider("ggcoder")).toBe(false);
    expect(isGoalsProvider(undefined)).toBe(false);
  });
});

describe("suggestGoalName", () => {
  test("first words, capitalised, punctuation trimmed", () => {
    expect(suggestGoalName("get checkout loading under one second, please")).toBe("Get checkout");
    expect(suggestGoalName("  ship the docs!\nthen more")).toBe("Ship the docs");
  });
  test("caps length and handles empty", () => {
    expect(suggestGoalName("")).toBe("");
    expect(suggestGoalName("a".repeat(60)).length).toBe(GOAL_NAME_MAX);
    expect(suggestGoalName("a".repeat(60), 4, 40).length).toBe(40);
  });
});

describe("goalDrawerRow", () => {
  const goal = { id: "g1", name: "Pew2-gg", status: "interrupted", path: "/goals/g1", lastActiveMs: 5 };
  test("reads like a chat row: title, then status · when", () => {
    const { row, meta } = goalDrawerRow(goal, "11m ago");
    expect(row.title).toBe("Pew2-gg");
    expect(row.busy).toBe(false);
    expect(meta).toBe("Interrupted · 11m ago");
  });
  test("an idle goal shows only when it was last active", () => {
    expect(goalDrawerRow({ ...goal, status: "idle" }, "5h ago").meta).toBe("5h ago");
  });
  test("a running goal gets the busy dot", () => {
    expect(goalDrawerRow({ ...goal, status: "running" }, "just now").row.busy).toBe(true);
  });
});

describe("goal name limit", () => {
  test("suggestions never exceed what GG Coder accepts", () => {
    for (const text of ["internationalisation everywhere now", "make the onboarding flow faster", "x y z w v u"]) {
      expect(suggestGoalName(text).length).toBeLessThanOrEqual(GOAL_NAME_MAX);
    }
    expect(suggestGoalName("internationalisation everywhere")).toBe("Internationalis");
  });
  test("clampGoalName trims and hard-cuts", () => {
    expect(clampGoalName("  short  ")).toBe("short");
    expect(clampGoalName("a very long goal name here")).toBe("a very long goa");
    expect(clampGoalName("abcdefghijklmn opq")).toBe("abcdefghijklmn");
  });
});

describe("goals entry", () => {
  test("counts running goals; absent stays absent", () => {
    expect(runningGoalCount(undefined)).toBeUndefined();
    expect(runningGoalCount([{ status: "running" }, { status: "idle" }, { status: "running" }])).toBe(2);
    expect(goalsEntryLabel(undefined)).toBe("Goals");
    expect(goalsEntryLabel(0)).toBe("Goals");
    expect(goalsEntryLabel(2)).toBe("Goals · 2 running");
  });
});

describe("launchCaption", () => {
  const base = { pending: false, ready: true, plain: false, holding: false, short: false };
  test("each state", () => {
    expect(launchCaption(base)).toBe("Hold anywhere here");
    expect(launchCaption({ ...base, plain: true })).toBe("Tap to launch goal");
    expect(launchCaption({ ...base, holding: true })).toBe("Keep holding");
    expect(launchCaption({ ...base, short: true })).toBe("Hold until the ring fills");
    expect(launchCaption({ ...base, ready: false, plain: true })).toBe("Name and goal first");
    expect(launchCaption({ ...base, pending: true })).toBe("Launching");
  });
});
