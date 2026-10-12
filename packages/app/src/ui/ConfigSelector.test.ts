import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withChoice } from "../configTruth";
import type { ConfigOption } from "../useDaemon";
import { configMenuSections, parseChoiceId } from "./configMenu";

const source = (file: string) => readFileSync(join(import.meta.dir, file), "utf8");

// These guards cover the platform wiring; scrolling and taps need the harness.
test("Android config uses the sheet while iOS keeps the native menu", () => {
  const selector = source("ConfigSelector.tsx");
  expect(selector).toContain('Platform.OS !== "android"');
  expect(selector).toContain("<NativeMenu {...props}");
  expect(selector).toContain("<Sheet");
  expect(selector).toContain("<ConfigSelectorList");
  expect(source("../../App.tsx")).toContain("<ConfigSelector");
});

test("choice lists scroll and expose selection without checkbox controls", () => {
  const list = source("ConfigSelectorList.tsx");
  expect(list).toContain("<ScrollView");
  expect(list).toContain("nestedScrollEnabled");
  expect(list).toContain("accessibilityState={{ selected: choice.selected }}");
  expect(list).toContain("styles.selected");
  expect(list).toContain(">Current</Text>");
  expect(list).not.toMatch(/checkbox|checkmark|<NativeMenu|numberOfLines=/i);
});

test("long model lists keep every choice and model/thinking selections independent", () => {
  const options: ConfigOption[] = [
    {
      id: "model", name: "Model", type: "select", category: "model", currentValue: "model-0",
      options: Array.from({ length: 120 }, (_, index) => ({ value: `model-${index}`, name: `Model ${index}` })),
    },
    {
      id: "thinking", name: "Thinking", type: "select", category: "thought_level", currentValue: "low",
      options: [{ value: "low", name: "Low" }, { value: "high", name: "High" }],
    },
  ];
  const sections = configMenuSections(options);
  expect(sections[0]?.choices).toHaveLength(120);
  const last = sections[0]?.choices.at(-1);
  expect(last).toBeDefined();
  const choice = parseChoiceId(last?.id ?? "");
  expect(choice).toEqual({ configId: "model", value: "model-119" });
  if (!choice) throw new Error("Last model must be selectable");
  const changedModel = withChoice(options, choice.configId, choice.value);
  const changedThinking = withChoice(changedModel, "thinking", "high");
  const selected = (values: ConfigOption[]) => configMenuSections(values).map((section) => section.choices.filter((entry) => entry.selected).map((entry) => entry.title));
  expect(selected(options)).toEqual([["Model 0"], ["Low"]]);
  expect(selected(changedModel)).toEqual([["Model 119"], ["Low"]]);
  expect(selected(changedThinking)).toEqual([["Model 119"], ["High"]]);
});
