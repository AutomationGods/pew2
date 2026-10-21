import { describe, expect, test } from "bun:test";
import { VOICE_TOOLS } from "./tools";
import {
  effectiveVoiceMode,
  MAX_TOOL_ROUNDS,
  readRespondEvent,
  runWalkieTurn,
  speakable,
  trimHistory,
  walkieTools,
  type InputItem,
  type RespondEvent,
} from "./walkie";

const script = (rounds: RespondEvent[][]) => {
  const inputs: InputItem[][] = [];
  let i = 0;
  return {
    inputs,
    respond: async (input: InputItem[], onEvent: (e: RespondEvent) => void) => {
      inputs.push(input.map((x) => ({ ...x })));
      for (const e of rounds[Math.min(i, rounds.length - 1)] ?? []) onEvent(e);
      i++;
    },
  };
};

describe("walkieTools", () => {
  test("every live-call tool, as functions inside one namespace", () => {
    const [ns] = walkieTools();
    expect(ns?.type).toBe("namespace");
    expect(ns?.tools.map((t) => t.name)).toEqual(VOICE_TOOLS.map((t) => t.name));
    expect(ns?.tools.every((t) => t.type === "function" && t.parameters)).toBe(true);
  });
});

describe("runWalkieTurn", () => {
  test("a plain answer extends the history with the user and assistant lines", async () => {
    const s = script([[{ kind: "delta", text: "All " }, { kind: "delta", text: "quiet." }, { kind: "done", model: "m" }]]);
    const texts: string[] = [];
    const result = await runWalkieTurn([], "status?", { respond: s.respond, runTool: () => ({}), onText: (t) => texts.push(t) });
    expect(result.reply).toBe("All quiet.");
    expect(result.history).toEqual([{ role: "user", content: "status?" }, { role: "assistant", content: "All quiet." }]);
    expect(texts.at(-1)).toBe("All quiet.");
  });

  test("tool calls run locally and go back as function_call_output, then the model answers", async () => {
    const s = script([
      [{ kind: "call", callId: "c1", name: "list_sessions", namespace: "pew2", arguments: "{}" }, { kind: "done", model: "m" }],
      [{ kind: "delta", text: "Two agents." }, { kind: "done", model: "m" }],
    ]);
    const ran: string[] = [];
    const result = await runWalkieTurn([], "what's running", { respond: s.respond, runTool: (name) => (ran.push(name), { sessions: [] }) });
    expect(ran).toEqual(["list_sessions"]);
    expect(s.inputs[1]?.slice(1)).toEqual([
      { type: "function_call", call_id: "c1", name: "list_sessions", namespace: "pew2", arguments: "{}" },
      { type: "function_call_output", call_id: "c1", output: JSON.stringify({ sessions: [] }) },
    ]);
    expect(result.reply).toBe("Two agents.");
  });

  test("an error keeps the old history and carries the reason", async () => {
    const s = script([[{ kind: "error", error: "usage_limit", message: "limit", manageUrl: "https://chatgpt.com/settings/usage" }]]);
    const prior = [{ role: "user", content: "a" }];
    const result = await runWalkieTurn(prior, "b", { respond: s.respond, runTool: () => ({}) });
    expect(result.history).toEqual(prior);
    expect(result.error).toEqual({ error: "usage_limit", message: "limit", manageUrl: "https://chatgpt.com/settings/usage" });
  });

  test("no terminal event (old daemon, timeout) reads as outdated", async () => {
    const result = await runWalkieTurn([], "x", { respond: async () => {}, runTool: () => ({}) });
    expect(result.error?.error).toBe("outdated");
  });

  test("a superseded turn is cancelled", async () => {
    const s = script([[{ kind: "delta", text: "hi" }, { kind: "done", model: "m" }]]);
    const result = await runWalkieTurn([], "x", { respond: s.respond, runTool: () => ({}), isCurrent: () => false });
    expect(result.cancelled).toBe(true);
  });

  test("a model that only calls tools is cut off", async () => {
    const s = script([[{ kind: "call", callId: "c", name: "list_sessions", arguments: "{}" }, { kind: "done", model: "m" }]]);
    const result = await runWalkieTurn([], "x", { respond: s.respond, runTool: () => ({}) });
    expect(s.inputs).toHaveLength(MAX_TOOL_ROUNDS);
    expect(result.reply).toMatch(/couldn't finish/);
  });
});

describe("helpers", () => {
  test("trimHistory starts at a user turn", () => {
    const items = [
      { role: "user", content: "1" },
      { type: "function_call", call_id: "a" },
      { type: "function_call_output", call_id: "a" },
      { role: "user", content: "2" },
      { role: "assistant", content: "x" },
    ];
    expect(trimHistory(items, 3)).toEqual(items.slice(3));
  });
  test("readRespondEvent tolerates junk and unknown error codes", () => {
    expect(readRespondEvent(null)).toBeUndefined();
    expect(readRespondEvent({ kind: "call", callId: "c" })).toBeUndefined();
    expect(readRespondEvent({ kind: "error", error: "mystery" })).toEqual({ kind: "error", error: "failed", message: "" });
  });
  test("speakable strips markdown", () => {
    expect(speakable("**Done.** See `foo` and [docs](http://x).")).toBe("Done. See foo and docs.");
  });
  test("voice mode: choice wins, else Gemini means live, else walkie", () => {
    expect(effectiveVoiceMode("walkie", ["gemini"])).toBe("walkie");
    expect(effectiveVoiceMode(undefined, ["openai", "gemini"])).toBe("live");
    expect(effectiveVoiceMode(undefined, ["openai"])).toBe("walkie");
    expect(effectiveVoiceMode(undefined, undefined)).toBe("walkie");
  });
});
