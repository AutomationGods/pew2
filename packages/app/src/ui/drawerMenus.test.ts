import { expect, test } from "bun:test";
import type { Project } from "../projects";
import type { Provider } from "../useDaemon";
import { ALL_PROJECTS_ID, agentChoices, projectChoices, projectPathFromChoice } from "./drawerMenus";

const provider = (id: string, available = true, unavailableReason?: string): Provider => ({
  id,
  name: id.toUpperCase(),
  description: "",
  available,
  ...(unavailableReason ? { unavailableReason } : {}),
});

test("agents keep the order given and tick only the active one", () => {
  const choices = agentChoices([provider("b"), provider("a")], "a");
  expect(choices.map((choice) => [choice.id, choice.selected])).toEqual([
    ["b", false],
    ["a", true],
  ]);
});

test("an unavailable agent stays listed, disabled, with its reason", () => {
  const [missingKey, unexplained] = agentChoices(
    [provider("gemini", false, "Needs GEMINI_API_KEY"), provider("codex", false)],
    undefined,
  );
  expect(missingKey).toMatchObject({ disabled: true, subtitle: "Needs GEMINI_API_KEY" });
  expect(unexplained).toMatchObject({ disabled: true, subtitle: "Not available" });
});

test("an available agent has no subtitle line", () => {
  const [choice] = agentChoices([provider("claude")], "claude");
  expect(choice).not.toHaveProperty("subtitle");
  expect(choice?.disabled).toBe(false);
});

const projects: Project[] = [
  { path: "/work/pew2", name: "pew2", sessions: 1 },
  { path: "/work/site", name: "site" },
];

test("all projects comes first and is ticked when nothing is chosen", () => {
  const [all, ...rest] = projectChoices(projects, undefined);
  expect(all).toMatchObject({ id: ALL_PROJECTS_ID, selected: true, subtitle: "2 projects" });
  expect(rest.map((choice) => choice.selected)).toEqual([false, false]);
});

test("a chosen project is ticked and counted in the singular when it has one", () => {
  const choices = projectChoices(projects, "/work/pew2");
  expect(choices[0]?.selected).toBe(false);
  expect(choices[1]).toMatchObject({ selected: true, subtitle: "1 conversation" });
  // Not yet counted by the daemon: no subtitle rather than a misleading zero.
  expect(choices[2]).not.toHaveProperty("subtitle");
});

test("a choice id maps back to the project path", () => {
  expect(projectPathFromChoice(ALL_PROJECTS_ID)).toBeUndefined();
  expect(projectPathFromChoice("/work/pew2")).toBe("/work/pew2");
});
