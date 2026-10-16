/**
 * What the session is working on, as a phone-sized fact: which project folder,
 * and how much work is uncommitted in it.
 *
 * The path an agent runs in is the one piece of context the phone cannot see
 * for itself, and "am I about to prompt against a dirty tree?" is the question
 * that decides whether the next instruction is safe. Only this machine has the
 * repository, so the answer is computed here and shipped as two numbers.
 *
 * Git is asked, never reimplemented, and a failure is an answer: a directory
 * that is not a repository is normal (an agent opened on a scratch folder) and
 * must read as "no repo", not as an error the user has to dismiss.
 */
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface WorkspaceStatus {
  cwd: string;
  /** Last path segment — what people call the project. */
  folder: string;
  /** False when `cwd` is not inside a git working tree. */
  repo: boolean;
  /** Entries `git status` reports as changed, staged or untracked. */
  uncommitted: number;
}

/**
 * Count porcelain entries.
 *
 * One line per path, and untracked directories are already collapsed to a
 * single entry by git itself, so a fresh `node_modules` counts once rather
 * than fifty thousand times.
 */
export function countPorcelain(stdout: string): number {
  return stdout.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * Status of the working tree an agent session is running in.
 *
 * Never throws. `git` may be missing, the directory may not be a repository, or
 * the repo may be enormous — all of which produce "not a repo" rather than a
 * failed request, because this is decoration beside a text field.
 */
export async function workspaceStatus(cwd: string): Promise<WorkspaceStatus> {
  const folder = basename(cwd) || cwd;
  try {
    const { stdout } = await run("git", ["status", "--porcelain"], {
      cwd,
      // A pathological repo must not hold the socket open; the bar simply says
      // nothing about git in that case.
      timeout: 5_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { cwd, folder, repo: true, uncommitted: countPorcelain(stdout) };
  } catch {
    return { cwd, folder, repo: false, uncommitted: 0 };
  }
}

/**
 * `workspaceStatus` with a short per-directory memory.
 *
 * The composer asks on every project pick, session switch and reconnect, and
 * each ask was a `git status` (~50 ms, far more in a big repo). Concurrent asks
 * for one directory share one run, and an answer is reused for `ttlMs` — a
 * count a few seconds old is fine for a decoration beside a text field.
 */
export class WorkspaceStatusCache {
  private readonly entries = new Map<string, { at: number; status: Promise<WorkspaceStatus> }>();

  constructor(
    private readonly ttlMs = 3_000,
    private readonly now: () => number = Date.now,
    private readonly read: (cwd: string) => Promise<WorkspaceStatus> = workspaceStatus,
  ) {}

  get(cwd: string): Promise<WorkspaceStatus> {
    const at = this.now();
    const hit = this.entries.get(cwd);
    if (hit && at - hit.at < this.ttlMs) return hit.status;
    // Expired entries go as they are replaced; sweep the rest so a long-lived
    // daemon does not hold every directory it was ever asked about.
    for (const [key, entry] of this.entries) if (at - entry.at >= this.ttlMs) this.entries.delete(key);
    const status = this.read(cwd);
    this.entries.set(cwd, { at, status });
    return status;
  }
}
