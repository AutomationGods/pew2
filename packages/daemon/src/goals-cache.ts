/**
 * On-disk copy of the last goals list GG Coder returned.
 *
 * `_gg/goals/list` costs ~500 ms on every ask (an ext request to GG Coder, and
 * a boot when nothing is running). The daemon answers from this list at once
 * and refreshes behind it, so a restarted daemon answers instantly too. Stored
 * raw — live state (`running`, `sessionId`) is overlaid per answer, never
 * persisted.
 */
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { userProvidersDir } from "./providers/registry.js";
import { writeFileAtomic } from "./atomic-file.js";

function cachePath(env: NodeJS.ProcessEnv): string {
  return join(dirname(userProvidersDir(env)), "cache", "goals.json");
}

/** The raw entries of the last list, or undefined when none is stored. */
export async function readGoalsCache(env: NodeJS.ProcessEnv = process.env): Promise<unknown[] | undefined> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(env), "utf8"));
    return Array.isArray(parsed?.goals) ? parsed.goals : undefined;
  } catch {
    return undefined;
  }
}

export async function writeGoalsCache(goals: unknown[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const path = cachePath(env);
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, JSON.stringify({ goals }));
}
