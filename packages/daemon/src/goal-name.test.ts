import { expect, test } from "bun:test";
import { fitGoalName, GOAL_NAME_MAX } from "./goal-name.js";

test("a name within the limit is kept as typed, whitespace tidied", () => {
  expect(fitGoalName("Pew2 polish")).toBe("Pew2 polish");
  expect(fitGoalName("  Pew2   polish ")).toBe("Pew2 polish");
  expect(fitGoalName("exactly15chars!")).toBe("exactly15chars!");
});

test("a long name is cut at a word boundary when one is near", () => {
  expect(fitGoalName("Make every screen feel alive")).toBe("Make every");
  expect(fitGoalName("Make every screen feel alive").length).toBeLessThanOrEqual(GOAL_NAME_MAX);
});

test("a long single word is cut hard", () => {
  expect(fitGoalName("Supercalifragilisticexpialidocious")).toBe("Supercalifragil");
});

test("no result ever exceeds GG Coder's limit", () => {
  for (const name of ["a b c d e f g h i j k l m n o p", "Hello wonderful world of goals", "x".repeat(80), "Ünïcödé näme thät is löng"]) {
    expect([...fitGoalName(name)].length).toBeLessThanOrEqual(GOAL_NAME_MAX);
  }
});
