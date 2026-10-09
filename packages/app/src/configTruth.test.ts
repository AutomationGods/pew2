import { expect, test } from "bun:test";
import { recordSessionConfigs, rememberConfigs, visibleConfigs, withChoice } from "./configTruth";
import { configMenuSections } from "./ui/configMenu";
import type { ConfigOption, Session } from "./useDaemon";

const model = (currentValue: string): ConfigOption[] => [
  {
    id: "__acp_model",
    name: "Model",
    category: "model",
    type: "select",
    currentValue,
    options: [
      { value: "sonnet", name: "Sonnet" },
      { value: "opus", name: "Opus" },
    ],
  },
];

function conversation(id: string, configOptions: ConfigOption[] = []): Session {
  return { id, providerId: "claude-code", title: id, startedAt: 0, turns: [], configOptions };
}

const thinking: ConfigOption = {
  id: "effort",
  name: "Thinking",
  category: "thought_level",
  type: "select",
  currentValue: "high",
  options: [{ value: "high", name: "High" }, { value: "low", name: "Low" }],
};

test("settings arriving after switching chats are available when that chat reopens", () => {
  const foreground = model("sonnet");
  const state = {
    configOptions: foreground,
    sessions: [conversation("visible", foreground), conversation("resuming")],
  };
  const resumed = [...model("opus"), thinking];
  const next = recordSessionConfigs(state, "resuming", resumed, "visible");

  // Do not change the chat being read. Save the late reply on its own row.
  expect(next.configOptions).toBe(foreground);
  expect(next.sessions[0]).toBe(state.sessions[0]);
  const reopened = visibleConfigs({
    session: next.sessions[1]?.configOptions ?? [],
    provider: foreground,
    inConversation: true,
  });
  expect(reopened).toEqual(resumed);
  expect(configMenuSections(reopened).map((section) => section.id)).toEqual(["__acp_model", "effort"]);
});

test("a reconnect snapshot restores both visible controls and their current selections", () => {
  const state: { configOptions: ConfigOption[]; sessions: Session[] } = {
    configOptions: [],
    sessions: [conversation("live")],
  };
  const configOptions = [...model("opus"), thinking];
  const next = recordSessionConfigs(state, "live", configOptions, "live");

  expect(next.configOptions).toEqual(configOptions);
  expect(next.sessions[0]?.configOptions).toEqual(configOptions);
  expect(configMenuSections(next.configOptions).map((section) =>
    section.choices.find((choice) => choice.selected)?.title,
  )).toEqual(["Opus", "High"]);
});

test("an older daemon or incomplete snapshot cannot erase a chat's known settings", () => {
  const configOptions = [...model("opus"), thinking];
  const state = { configOptions, sessions: [conversation("live", configOptions)] };
  for (const incoming of [undefined, null, {}, [{ id: "model" }], [{ ...thinking, options: [null] }]]) {
    expect(recordSessionConfigs(state, "live", incoming, "live")).toBe(state);
  }
});

test("settings for an unknown session never overwrite the open chat", () => {
  const configOptions = model("sonnet");
  const state = { configOptions, sessions: [conversation("live", configOptions)] };
  expect(recordSessionConfigs(state, "unknown", model("opus"), "live")).toBe(state);
  expect(recordSessionConfigs(state, undefined, model("opus"), "live")).toBe(state);
});

test("an explicit snapshot removes options no longer offered by the agent", () => {
  const configOptions = [...model("opus"), thinking];
  const state = { configOptions, sessions: [conversation("live", configOptions)] };
  const next = recordSessionConfigs(state, "live", model("sonnet"), "live");
  expect(configMenuSections(next.configOptions).map((section) => section.id)).toEqual(["__acp_model"]);
  expect(recordSessionConfigs(next, "live", [], "live").configOptions).toEqual([]);
});

test("the open conversation's own selectors win over the provider's", () => {
  // While a conversation is running, its list is the only truth about it: the
  // provider record describes the *next* one.
  const shown = visibleConfigs({
    session: model("opus"),
    provider: model("sonnet"),
    inConversation: true,
  });

  expect(shown[0]?.currentValue).toBe("opus");
});

test("an open conversation that has not reported yet names nothing", () => {
  // A resumed conversation comes back at the selectors it was last used with,
  // which need not be the remembered ones — and they arrive a moment after the
  // session does. Showing the provider's in that window is how the pill claimed
  // one model while another was about to answer.
  expect(visibleConfigs({ session: [], provider: model("sonnet"), inConversation: true })).toEqual(
    [],
  );
});

test("with no conversation open, the provider's list is what the next prompt uses", () => {
  const shown = visibleConfigs({ session: [], provider: model("opus"), inConversation: false });

  expect(shown[0]?.currentValue).toBe("opus");
});

test("a provider with nothing known offers nothing rather than a guess", () => {
  expect(visibleConfigs({ session: [], provider: undefined, inConversation: false })).toEqual([]);
});

test("a choice is applied to the remembered list, and only to its own selector", () => {
  const known: ConfigOption[] = [
    ...model("sonnet"),
    { id: "effort", name: "Effort", type: "select", currentValue: "high" },
  ];

  const next = withChoice(known, "__acp_model", "opus");

  expect(next[0]?.currentValue).toBe("opus");
  expect(next[1]?.currentValue).toBe("high");
});

test("an empty announcement never erases what is known", () => {
  // Session stubs and older daemons both send empty lists; taking them would
  // blank the picker on an empty screen.
  const known = { "claude-code": model("opus") };

  expect(rememberConfigs(known, "claude-code", [])).toBe(known);
  expect(rememberConfigs(known, undefined, model("sonnet"))).toBe(known);
});
