/**
 * Tool-call cards and the agent's plan, read from ACP `session/update`.
 *
 * Pure and Expo-free so the merge rules are testable under `bun test`. A tool
 * call is one `tool_call` followed by any number of `tool_call_update`s for the
 * same `toolCallId`; "all fields except toolCallId are optional in updates", so
 * an update is a patch, and `content` — when present — replaces the previous
 * content wholesale. Everything stored here is capped: these arrive many per
 * second and each card lives in every transcript copy for the session.
 */
import { asRecord, asString } from "@pew2/protocol";
import type { ToolKind, ToolStatus } from "./activity";
import { computeLineDiff, type DiffSummary } from "./lineDiff";

export interface ToolCard {
  id: string;
  title: string;
  kind: ToolKind;
  status: ToolStatus;
  /** The file it works on, from `locations` — shown beside the title. */
  target?: string;
  /** Arguments, pretty-printed and capped. */
  input?: string;
  /** Text output, capped. */
  output?: string;
  diffs?: DiffSummary[];
}

/** A tool update: only `id` is guaranteed; absent means "unchanged". */
export type ToolPatch = { id: string } & Partial<Omit<ToolCard, "id">>;

export type PlanStatus = "pending" | "in_progress" | "completed";

export interface PlanEntry {
  content: string;
  status: PlanStatus;
  priority?: string;
}

export const MAX_INPUT_CHARS = 2_000;
export const MAX_OUTPUT_CHARS = 4_000;
const MAX_PLAN_ENTRIES = 100;

const KINDS = new Set<ToolKind>(["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "other"]);
const STATUSES = new Set<ToolStatus>(["pending", "in_progress", "completed", "failed"]);

function cap(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text;
}

function stringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return undefined;
  }
}

/** The last path segment or two: the card is one line on a phone. */
export function shortPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length <= 2 ? parts.join("/") || path : `…/${parts.slice(-2).join("/")}`;
}

function readContent(content: unknown[]): { output?: string; diffs?: DiffSummary[] } {
  const texts: string[] = [];
  const diffs: DiffSummary[] = [];
  for (const raw of content) {
    const item = asRecord(raw);
    if (!item) continue;
    if (item.type === "diff") {
      const path = asString(item.path);
      const newText = asString(item.newText);
      if (path !== undefined && newText !== undefined) {
        diffs.push(computeLineDiff(path, asString(item.oldText) ?? "", newText));
      }
      continue;
    }
    if (item.type === "content") {
      const inner = asRecord(item.content);
      const text = inner?.type === "text" ? asString(inner.text) : undefined;
      if (text) texts.push(text);
    }
  }
  return {
    ...(texts.length > 0 ? { output: cap(texts.join("\n"), MAX_OUTPUT_CHARS) } : {}),
    ...(diffs.length > 0 ? { diffs } : {}),
  };
}

/** A patch from a `tool_call` / `tool_call_update`, or undefined for anything else. */
export function readToolPatch(update: Record<string, unknown>): ToolPatch | undefined {
  const sessionUpdate = update.sessionUpdate;
  if (sessionUpdate !== "tool_call" && sessionUpdate !== "tool_call_update") return undefined;
  const id = asString(update.toolCallId);
  if (!id) return undefined;
  const patch: ToolPatch = { id };
  const title = asString(update.title);
  if (title) patch.title = title;
  if (typeof update.kind === "string") patch.kind = KINDS.has(update.kind as ToolKind) ? (update.kind as ToolKind) : "other";
  if (typeof update.status === "string" && STATUSES.has(update.status as ToolStatus)) patch.status = update.status as ToolStatus;
  if (Array.isArray(update.locations)) {
    const path = asString(asRecord(update.locations[0])?.path);
    if (path) patch.target = shortPath(path);
  }
  const input = stringify(update.rawInput);
  if (input !== undefined) patch.input = cap(input, MAX_INPUT_CHARS);
  if (Array.isArray(update.content)) {
    // Content replaces content: clear what this update does not restate.
    const { output, diffs } = readContent(update.content);
    patch.output = output;
    patch.diffs = diffs;
  }
  if (patch.output === undefined && update.rawOutput !== undefined) {
    const raw = stringify(update.rawOutput);
    if (raw !== undefined) patch.output = cap(raw, MAX_OUTPUT_CHARS);
  }
  if (sessionUpdate === "tool_call") {
    patch.title ??= "Tool";
    patch.kind ??= "other";
    patch.status ??= "pending";
  }
  return patch;
}

/** Apply a patch to a card (or create it). Explicit `undefined` keys clear a field. */
export function mergeToolCard(previous: ToolCard | undefined, patch: ToolPatch): ToolCard {
  const base: ToolCard = previous ?? { id: patch.id, title: "Tool", kind: "other", status: "pending" };
  const next: ToolCard = { ...base };
  for (const key of Object.keys(patch) as (keyof ToolPatch)[]) {
    const value = patch[key];
    if (value === undefined) delete next[key as keyof ToolCard];
    else (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

/** Total +/- across a card's diffs, or undefined when it has none. */
export function diffCounts(card: ToolCard): { added: number; removed: number } | undefined {
  if (!card.diffs?.length) return undefined;
  return card.diffs.reduce(
    (sum, diff) => ({ added: sum.added + diff.added, removed: sum.removed + diff.removed }),
    { added: 0, removed: 0 },
  );
}

/** The whole plan from a `plan` update (each one replaces the list), or undefined. */
export function readPlan(update: Record<string, unknown>): PlanEntry[] | undefined {
  if (update.sessionUpdate !== "plan" || !Array.isArray(update.entries)) return undefined;
  return update.entries.slice(0, MAX_PLAN_ENTRIES).flatMap((raw): PlanEntry[] => {
    const entry = asRecord(raw);
    const content = asString(entry?.content)?.trim();
    if (!entry || !content) return [];
    const status: PlanStatus =
      entry.status === "in_progress" || entry.status === "completed" ? entry.status : "pending";
    const priority = asString(entry.priority);
    return [priority ? { content, status, priority } : { content, status }];
  });
}

/** The title from a `session_info_update`, or undefined. */
export function readSessionTitle(update: Record<string, unknown>): string | undefined {
  if (update.sessionUpdate !== "session_info_update") return undefined;
  const title = asString(update.title)?.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 80) : undefined;
}
