import { expect, test } from "bun:test";
import type { ConfigOption } from "../useDaemon";
import { choiceId, configMenuSections, parseChoiceId } from "./configMenu";

const model: ConfigOption = {
  id: "model",
  name: "Model",
  category: "model",
  type: "select",
  currentValue: "sonnet",
  options: [
    { value: "sonnet", name: "Sonnet 4.5", description: "Everyday tasks" },
    { value: "opus", name: "Opus 4.1", description: "" },
  ],
};

const mode: ConfigOption = {
  id: "mode",
  name: "Mode",
  category: "mode",
  type: "select",
  currentValue: "accept",
  options: [
    { value: "ask", name: "Ask" },
    { value: "accept", name: "Accept edits" },
  ],
};

test("sections put the model first whatever order the agent sends", () => {
  const sections = configMenuSections([mode, model]);
  expect(sections.map((section) => section.id)).toEqual(["model", "mode"]);
});

test("unranked categories keep the agent's own order after ranked ones", () => {
  const extra = (id: string): ConfigOption => ({ ...mode, id, name: id, category: "custom" });
  const sections = configMenuSections([extra("b"), model, extra("a")]);
  expect(sections.map((section) => section.id)).toEqual(["model", "b", "a"]);
});

test("the current value is the one selected row", () => {
  const [section] = configMenuSections([model]);
  expect(section?.choices.map((choice) => choice.selected)).toEqual([true, false]);
});

test("an empty description adds no subtitle line", () => {
  const [section] = configMenuSections([model]);
  expect(section?.choices[0]?.subtitle).toBe("Everyday tasks");
  expect(section?.choices[1]).not.toHaveProperty("subtitle");
});

test("non-select and empty options offer nothing to choose", () => {
  const toggle: ConfigOption = { id: "fast", name: "Fast", type: "boolean", currentValue: true };
  const empty: ConfigOption = { ...mode, id: "empty", options: [] };
  expect(configMenuSections([toggle, empty])).toEqual([]);
});

test("a choice id round-trips values a separator would break", () => {
  for (const value of ["a:b", "with\u0000nul", "quote\"d", ""]) {
    expect(parseChoiceId(choiceId("model", value))).toEqual({ configId: "model", value });
  }
});

test("a foreign or malformed id decodes to nothing", () => {
  for (const id of ["", "model", "[1,2]", "[\"only\"]", "{\"a\":1}", "not json"]) {
    expect(parseChoiceId(id)).toBeUndefined();
  }
});
