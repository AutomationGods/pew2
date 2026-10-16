/**
 * Voice call transcripts, kept with the conversation they were about.
 *
 * A call is filed in the session log as `{ kind: "voice_call", ... }`, which is
 * enough while this daemon lives. But session ids die with the daemon, and a
 * conversation reopened later is rebuilt from the agent's own history, which
 * never contained the call. So each call is also written here, keyed by the
 * provider and the agent's own conversation id (the same key `session-prefs`
 * uses), and replayed onto the end of the log when that conversation is opened
 * again.
 *
 * These are the user's spoken words, so the file is owner-only (the
 * `writeFileAtomic` default) and capped: the newest calls per conversation,
 * the newest conversations overall.
 */
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { wire } from "@pew2/protocol";
import { writeFileAtomic } from "./atomic-file.js";
import { userProvidersDir } from "./providers/registry.js";

/** Newest calls kept per conversation. */
const MAX_CALLS_PER_CONVERSATION = 20;
/** Newest conversations kept overall. */
const MAX_CONVERSATIONS = 200;

export interface VoiceCallNote {
  kind: "voice_call";
  callId: string;
  startedAt: number;
  endedAt: number;
  lines: wire.VoiceCallLine[];
}

interface Record_ {
  calls: VoiceCallNote[];
  /** Epoch ms of the newest call, used only to decide what to evict. */
  updatedAt: number;
}

type Stored = Record<string, Record_>;

function callsPath(env: NodeJS.ProcessEnv): string {
  return join(dirname(userProvidersDir(env)), "voice-calls.json");
}

/** Provider *and* conversation: agents pick their own ids and could collide. */
function keyOf(providerId: string, agentSessionId: string): string {
  return `${providerId}\u0000${agentSessionId}`;
}

async function readAll(env: NodeJS.ProcessEnv): Promise<Stored> {
  try {
    const value: unknown = JSON.parse(await readFile(callsPath(env), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Stored) : {};
  } catch {
    // Missing or corrupt: no saved calls, never an error.
    return {};
  }
}

/** The note logged for a transcript the phone sent. */
export function voiceCallNote(message: wire.VoiceTranscript): VoiceCallNote {
  return {
    kind: "voice_call",
    callId: message.callId,
    startedAt: message.startedAt,
    endedAt: message.endedAt,
    lines: message.lines,
  };
}

/** Saved calls for one conversation, oldest first. */
export async function readVoiceCalls(
  providerId: string,
  agentSessionId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VoiceCallNote[]> {
  const record = (await readAll(env))[keyOf(providerId, agentSessionId)];
  if (!record || !Array.isArray(record.calls)) return [];
  return record.calls.filter(
    (call) => call && call.kind === "voice_call" && typeof call.callId === "string" && Array.isArray(call.lines),
  );
}

/** Remember a call against its conversation. A repeat of the same call replaces it. */
export async function saveVoiceCall(
  providerId: string,
  agentSessionId: string,
  note: VoiceCallNote,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const all = await readAll(env);
  const key = keyOf(providerId, agentSessionId);
  const calls = [...(all[key]?.calls ?? []).filter((call) => call.callId !== note.callId), note]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-MAX_CALLS_PER_CONVERSATION);
  all[key] = { calls, updatedAt: Math.max(Date.now(), note.endedAt) };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_CONVERSATIONS);
  const path = callsPath(env);
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, JSON.stringify(Object.fromEntries(kept)));
}
