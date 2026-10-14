import { expect, test } from "bun:test";
import { mkdtemp, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wire } from "@pew2/protocol";
import { readVoiceCalls, saveVoiceCall, voiceCallNote } from "./voice-calls.js";

async function env(): Promise<NodeJS.ProcessEnv> {
  return { PEW2_HOME: await mkdtemp(join(tmpdir(), "pew2-calls-")) } as NodeJS.ProcessEnv;
}

const transcript = (callId: string, startedAt: number): wire.VoiceTranscript => ({
  t: "voice.transcript",
  sessionId: "s1",
  callId,
  startedAt,
  endedAt: startedAt + 60_000,
  lines: [
    { who: "user", text: "How's the build going?" },
    { who: "assistant", text: "Tests pass; it's writing the README." },
  ],
});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("a call comes back for the same conversation only, owner-readable", async () => {
  const e = await env();
  await saveVoiceCall("ggcoder", "agent-1", voiceCallNote(transcript(id(1), 1000)), e);
  const calls = await readVoiceCalls("ggcoder", "agent-1", e);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ kind: "voice_call", callId: id(1), lines: [{ who: "user" }, { who: "assistant" }] });
  expect(await readVoiceCalls("ggcoder", "agent-2", e)).toEqual([]);
  expect(await readVoiceCalls("codex", "agent-1", e)).toEqual([]);
  expect((await stat(join(e.PEW2_HOME!, "voice-calls.json"))).mode & 0o777).toBe(0o600);
});

test("calls stay in order, a resend replaces, and only the newest are kept", async () => {
  const e = await env();
  for (let n = 25; n >= 1; n--) await saveVoiceCall("ggcoder", "a", voiceCallNote(transcript(id(n), n * 1000)), e);
  await saveVoiceCall("ggcoder", "a", voiceCallNote(transcript(id(25), 25_000)), e);
  const calls = await readVoiceCalls("ggcoder", "a", e);
  expect(calls).toHaveLength(20);
  expect(calls.map((c) => c.startedAt)).toEqual(Array.from({ length: 20 }, (_, i) => (i + 6) * 1000));
});

test("a corrupt file is no saved calls, never an error", async () => {
  const e = await env();
  await mkdir(e.PEW2_HOME!, { recursive: true });
  await writeFile(join(e.PEW2_HOME!, "voice-calls.json"), "{not json");
  expect(await readVoiceCalls("ggcoder", "a", e)).toEqual([]);
});

test("the wire refuses an empty or oversized transcript", () => {
  expect(wire.ClientMessage.safeParse({ ...transcript(id(1), 1), lines: [] }).success).toBe(false);
  const many = Array.from({ length: wire.MAX_VOICE_CALL_LINES + 1 }, () => ({ who: "user", text: "hi" }));
  expect(wire.ClientMessage.safeParse({ ...transcript(id(1), 1), lines: many }).success).toBe(false);
  expect(wire.ClientMessage.safeParse(transcript(id(1), 1)).success).toBe(true);
});
