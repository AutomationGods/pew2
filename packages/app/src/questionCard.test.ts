import { expect, test } from "bun:test";
import { allowsTyping, choicesOf, completeAnswers, toggled, valueOf } from "./questionCard";
import type { DesktopQuestion } from "./permissions";

const choice: DesktopQuestion = { id: "fix", question: "Fix?", kind: "choice", options: [{ label: "All", value: "all" }, { label: "Some" }] };
const multi: DesktopQuestion = { id: "parts", question: "Parts?", kind: "multi", options: [{ label: "App", value: "app" }] };
const typed: DesktopQuestion = { id: "note", question: "Note?", kind: "text" };

test("a yes/no question without options still offers Yes and No", () => {
  expect(choicesOf({ id: "ok", question: "Ok?", kind: "confirm" }).map(valueOf)).toEqual(["yes", "no"]);
  expect(choicesOf(choice).map(valueOf)).toEqual(["all", "Some"]);
  expect(choicesOf(typed)).toEqual([]);
});

test("typing is offered unless the agent opted out", () => {
  expect(allowsTyping(choice)).toBe(true);
  expect(allowsTyping({ ...choice, allowOther: false })).toBe(false);
  expect(allowsTyping(typed)).toBe(true);
});

test("the card goes back only once every question is answered", () => {
  const questions = [choice, multi, typed];
  expect(completeAnswers(questions, { fix: "all", parts: ["app"] })).toBeUndefined();
  expect(completeAnswers(questions, { fix: "all", parts: [], note: "x" })).toBeUndefined();
  expect(completeAnswers(questions, { fix: "all", parts: ["app"], note: "   " })).toBeUndefined();
  expect(completeAnswers(questions, { fix: "all", parts: ["app"], note: " ship it ", stale: "x" })).toEqual({
    fix: "all",
    parts: ["app"],
    note: "ship it",
  });
});

test("tapping a multi-select choice twice takes it back out", () => {
  expect(toggled(toggled([], "app"), "app")).toEqual([]);
  expect(toggled(["a"], "b")).toEqual(["a", "b"]);
});
