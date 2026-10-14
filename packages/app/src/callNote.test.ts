import { expect, test } from "bun:test";
import { readChunk, readCallNote } from "./chunks";
import { callDuration, callHeading } from "./callNote";
import { applyChunk } from "./replayFold";
import { sessionActedOn, transcriptOf, type VoiceToolContext } from "./voice/tools";
import type { Turn } from "./useDaemon";

const event = {
  kind: "voice_call",
  callId: "c1",
  startedAt: Date.UTC(2026, 9, 14, 14, 0),
  endedAt: Date.UTC(2026, 9, 14, 14, 3),
  lines: [
    { who: "user", text: "How's it going?" },
    { who: "assistant", text: "Tests pass." },
    { who: "robot", text: "dropped" },
    { who: "user", text: "   " },
  ],
};

test("a logged call becomes a note carrying its transcript, never agent output", () => {
  const chunk = readChunk(event);
  expect(chunk?.role).toBe("note");
  expect(chunk?.call?.lines).toEqual([
    { who: "user", text: "How's it going?" },
    { who: "assistant", text: "Tests pass." },
  ]);
  expect(readCallNote({ kind: "voice_call", callId: "c", lines: [] })).toBeUndefined();
  expect(readCallNote({ kind: "user_message", text: "x" })).toBeUndefined();
});

test("two calls in a row stay two cards, and the transcript survives the fold", () => {
  const turns: Turn[] = [];
  applyChunk(turns, "s:1", readChunk(event)!);
  applyChunk(turns, "s:2", readChunk({ ...event, callId: "c2" })!);
  expect(turns).toHaveLength(2);
  expect(turns[1]!.call?.callId).toBe("c2");
});

test("the heading names the time and a whole-minute duration", () => {
  expect(callDuration(event)).toBe("3 min");
  expect(callDuration({ startedAt: 0, endedAt: 5_000 })).toBe("1 min");
  expect(callHeading(event, "en-US")).toMatch(/^Voice call · \d{1,2}:00\s?[AP]M · 3 min$/);
});

test("a call is filed where it acted, not where it only looked", () => {
  const ctx = { goals: () => [{ id: "g1", name: "n", goal: "x", status: "running", sessionId: "coord" }] } as unknown as VoiceToolContext;
  expect(sessionActedOn("send_prompt", '{"sessionId":"s1","text":"hi"}', { ok: true }, ctx)).toBe("s1");
  expect(sessionActedOn("send_prompt", '{"sessionId":"s1"}', { error: "x" }, ctx)).toBeUndefined();
  expect(sessionActedOn("get_session_status", '{"sessionId":"s1"}', { ok: true }, ctx)).toBeUndefined();
  expect(sessionActedOn("pause_goal", '{"goalId":"g1"}', { ok: true }, ctx)).toBe("coord");
});

test("silent calls file nothing; long ones keep within the wire's limits", () => {
  expect(transcriptOf("c", 1, [{ who: "user", text: "  " }], 2)).toBeUndefined();
  const many = Array.from({ length: 450 }, (_, i) => ({ who: "user" as const, text: `line ${i} ${"x".repeat(5000)}` }));
  const t = transcriptOf("c", 1, many, 2)!;
  expect(t.lines).toHaveLength(400);
  expect(t.lines[0]!.text.startsWith("line 50 ")).toBe(true);
  expect(t.lines[0]!.text.length).toBe(4000);
});
