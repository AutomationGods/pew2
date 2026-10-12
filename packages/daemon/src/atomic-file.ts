/**
 * Writing a file so that a reader never sees half of one.
 *
 * `writeFile` truncates first and then fills, so a daemon killed mid-write — or
 * killed by the machine going to sleep — leaves a file that parses as corrupt
 * and is read as "no preferences at all". Every store here is read-modify-write
 * over a whole document, so that is not one lost setting but all of them.
 *
 * Renaming is atomic within a filesystem: a reader sees either the old file or
 * the new one. This does not serialize read-modify-write: callers that merge
 * shared state must hold withFileLock across both the read and the replacement.
 */
import { mkdir, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Serialize cooperating writers, including separate daemon/CLI processes.
 * Lock directories are created exclusively; timestamps are never grounds for
 * stealing one from a slow live writer. After a crash, fail closed with an
 * actionable error rather than risk silently replacing another writer's data.
 */
export async function withFileLock<T>(
  path: string,
  work: () => Promise<T>,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  options.signal?.throwIfAborted();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // Resolve directory aliases so two spellings of PEW2_HOME share one lock.
  const lock = join(await realpath(dirname(path)), `${basename(path)}.lock`);
  const deadline = performance.now() + (options.timeoutMs ?? 10_000);
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      await mkdir(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if (!isFileError(error, "EEXIST")) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        throw new Error(`Timed out waiting for ${lock}. No update was made. If a writer crashed, stop all pew2 processes before removing this lock directory.`, { cause: error });
      }
      await delay(Math.min(25, remaining), undefined, { signal: options.signal });
    }
  }
  try {
    options.signal?.throwIfAborted();
    return await work();
  } finally {
    // Only remove the empty directory we acquired, never recursively delete it.
    await rmdir(lock);
  }
}

export function isFileError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

/**
 * Distinguishes two writes racing inside one process.
 *
 * The pid alone is not enough: `session.config` and a session opening can be
 * writing at the same moment, and sharing a temp path would put both documents
 * into one file.
 */
let sequence = 0;

/**
 * Write `data` to `path` via a temporary file in the same directory.
 *
 * Same directory because rename is only atomic within a filesystem, and a temp
 * directory is often a different one.
 *
 * @param mode Permissions for the finished file. Defaults to owner-only: these
 * hold conversation state and user choices, and the process umask would
 * otherwise decide who else on the machine can read them.
 */
export async function writeFileAtomic(
  path: string,
  data: string,
  mode = 0o600,
): Promise<void> {
  const temp = `${path}.${process.pid}.${sequence++}.tmp`;
  try {
    await writeFile(temp, data, { encoding: "utf8", mode });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}
