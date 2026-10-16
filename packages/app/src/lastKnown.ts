/**
 * What the drawer last showed, remembered between launches: the goal list,
 * each agent's past conversations and its projects.
 *
 * Every one of those is a round trip away on a cold start — a probe, a
 * `goals` request — and over the relay that is a visible skeleton under a
 * thumb that already knows what it wants. The last list stands in until the
 * daemon answers, and the answer replaces it; nothing here is trusted once
 * the machine speaks. Same contract as `providerCache.ts`: an empty answer is
 * "still probing", never written, and a malformed record reads as nothing.
 *
 * Pure and Expo-free; `lastKnownStore.ts` owns the file.
 */
import type { WireAgentSession } from "./agentHistory";
import type { Session } from "./daemonTypes";
import type { GoalSummary } from "./ggState";
import type { WireProject } from "./projects";

export const MAX_CACHED_GOALS = 40;
export const MAX_CACHED_SESSIONS_PER_PROVIDER = 150;
export const MAX_CACHED_PROJECTS_PER_PROVIDER = 60;

export interface LastKnown {
  goals?: GoalSummary[];
  /** Agent-owned conversations per provider, newest first, as the wire names them. */
  history: Record<string, WireAgentSession[]>;
  projects: Record<string, WireProject[]>;
}

export const EMPTY_LAST_KNOWN: LastKnown = { history: {}, projects: {} };

/**
 * The drawer's agent history, in the shape `mergeAgentSessions` reads back.
 * Only rows with an agent id: a session this app started has no way back
 * after a daemon restart except through the agent's own history anyway.
 */
export function historyFromSessions(sessions: readonly Session[]): Record<string, WireAgentSession[]> {
  const byProvider: Record<string, WireAgentSession[]> = {};
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id));
  for (const session of sorted) {
    if (!session.agentSessionId || !session.cwd) continue;
    const list = (byProvider[session.providerId] ??= []);
    if (list.length >= MAX_CACHED_SESSIONS_PER_PROVIDER) continue;
    list.push({
      sessionId: session.agentSessionId,
      cwd: session.cwd,
      title: session.title,
      updatedAt: new Date(session.startedAt).toISOString(),
      ...(session.messageCount !== undefined ? { messageCount: session.messageCount } : {}),
    });
  }
  return byProvider;
}

/** Serialise for storage; undefined when there is nothing worth writing. */
export function toLastKnown(value: LastKnown): string | undefined {
  const projects: Record<string, WireProject[]> = {};
  for (const [id, list] of Object.entries(value.projects).sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length > 0) projects[id] = list.slice(0, MAX_CACHED_PROJECTS_PER_PROVIDER);
  }
  const history: Record<string, WireAgentSession[]> = {};
  for (const [id, list] of Object.entries(value.history).sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length > 0) history[id] = list.slice(0, MAX_CACHED_SESSIONS_PER_PROVIDER);
  }
  const goals = value.goals && value.goals.length > 0 ? value.goals.slice(0, MAX_CACHED_GOALS) : undefined;
  if (!goals && Object.keys(projects).length === 0 && Object.keys(history).length === 0) return undefined;
  return JSON.stringify({ v: 1, ...(goals ? { goals } : {}), history, projects });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGoal(value: unknown): GoalSummary | undefined {
  if (!isRecord(value)) return undefined;
  const { id, name, goal, path, createdAt, lastActiveMs, status, context } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof goal !== "string") return undefined;
  if (typeof path !== "string" || typeof createdAt !== "string" || typeof lastActiveMs !== "number") return undefined;
  if (!["briefing", "running", "paused", "interrupted", "idle"].includes(status as string)) return undefined;
  if (!Array.isArray(context)) return undefined;
  return value as unknown as GoalSummary;
}

function readList<T>(value: unknown, read: (entry: unknown) => T | undefined, cap: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const entry of value.slice(0, cap)) {
    const item = read(entry);
    if (item) out.push(item);
  }
  return out;
}

function readSession(value: unknown): WireAgentSession | undefined {
  if (!isRecord(value) || typeof value.sessionId !== "string" || !value.sessionId) return undefined;
  if (typeof value.cwd !== "string") return undefined;
  return {
    sessionId: value.sessionId,
    cwd: value.cwd,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
    ...(typeof value.messageCount === "number" ? { messageCount: value.messageCount } : {}),
  };
}

function readProject(value: unknown): WireProject | undefined {
  if (!isRecord(value) || typeof value.path !== "string" || typeof value.name !== "string") return undefined;
  if (!value.path || !value.name) return undefined;
  return {
    path: value.path,
    name: value.name,
    ...(typeof value.sessions === "number" ? { sessions: value.sessions } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
  };
}

function readByProvider<T>(value: unknown, read: (entry: unknown) => T | undefined, cap: number): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  if (!isRecord(value)) return out;
  for (const [id, list] of Object.entries(value)) {
    const items = readList(list, read, cap);
    if (id && items.length > 0) out[id] = items;
  }
  return out;
}

/** Read a stored record back, defensively. Junk reads as nothing known. */
export function fromLastKnown(raw: string | null | undefined): LastKnown {
  if (!raw) return EMPTY_LAST_KNOWN;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_LAST_KNOWN;
  }
  if (!isRecord(parsed) || parsed.v !== 1) return EMPTY_LAST_KNOWN;
  const goals = readList(parsed.goals, readGoal, MAX_CACHED_GOALS);
  return {
    ...(goals.length > 0 ? { goals } : {}),
    history: readByProvider(parsed.history, readSession, MAX_CACHED_SESSIONS_PER_PROVIDER),
    projects: readByProvider(parsed.projects, readProject, MAX_CACHED_PROJECTS_PER_PROVIDER),
  };
}

/**
 * A provider's projects from a capability reply. Absent means the daemon said
 * nothing; empty from a daemon still probing must not blank a list already on
 * screen — the fuller answer follows.
 */
export function keepKnownProjects(
  known: Record<string, WireProject[]>,
  providerId: string,
  incoming: WireProject[] | undefined,
): Record<string, WireProject[]> {
  if (!incoming) return known;
  if (incoming.length === 0 && (known[providerId]?.length ?? 0) > 0) return known;
  return { ...known, [providerId]: incoming };
}

/** Remembered projects, only where the daemon has not answered yet. */
export function withCachedProjects(
  known: Record<string, WireProject[]>,
  cached: Record<string, WireProject[]>,
): Record<string, WireProject[]> {
  let next = known;
  for (const [id, list] of Object.entries(cached)) {
    if ((next[id]?.length ?? 0) > 0) continue;
    next = { ...next, [id]: list };
  }
  return next;
}
