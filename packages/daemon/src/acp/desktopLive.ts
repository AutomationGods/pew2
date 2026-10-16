/**
 * "Is this goal open in GG Coder desktop right now?"
 *
 * Read from the desktop's own window list (`gg-app-workspace.json`), an
 * internal format that may be stale or change shape at any time: parsed
 * defensively, capped in size, and any doubt answers "no", which keeps the
 * ordinary `ggcoder acp` path. Re-read on every open, never cached.
 */
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { z } from "zod";

const MAX_BYTES = 1024 * 1024;

const workspaceFile = z.object({
  windows: z
    .array(z.unknown())
    .max(256)
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = z.object({ cwd: z.string().min(1).max(4096), sessionPath: z.string().min(1).max(4096) }).safeParse(row);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});

/** Where GG Coder desktop records its open windows. */
export function desktopWorkspaceFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.GG_AGENT_DIR || join(homedir(), ".gg"), "gg-app-workspace.json");
}

/** An open desktop window on `cwd`: the 8-char id prefix its session file ends with. */
export interface OpenDesktopConversation {
  idPrefix: string;
}

async function readCapped(file: string): Promise<string | undefined> {
  const handle = await open(file, "r").catch(() => undefined);
  if (!handle) return undefined;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_BYTES) return undefined;
    const buffer = Buffer.alloc(info.size);
    await handle.read(buffer, 0, info.size, 0);
    return buffer.toString("utf8");
  } catch {
    return undefined;
  } finally {
    await handle.close().catch(() => {});
  }
}

/**
 * The desktop conversation open on `cwd`, if exactly one is. With an
 * `agentSessionId` (a resume) the window must hold *that* conversation.
 */
export async function findOpenDesktopConversation(
  file: string,
  cwd: string,
  agentSessionId?: string,
): Promise<OpenDesktopConversation | undefined> {
  const text = await readCapped(file);
  if (text === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = workspaceFile.safeParse(json);
  if (!parsed.success) return undefined;
  const want = resolve(cwd);
  const prefixes = new Set(
    parsed.data.windows
      .filter((w) => resolve(w.cwd) === want)
      .flatMap((w) => {
        const match = /_([0-9a-f]{8})\.jsonl$/i.exec(basename(w.sessionPath));
        return match?.[1] ? [match[1].toLowerCase()] : [];
      }),
  );
  if (agentSessionId) {
    const prefix = agentSessionId.slice(0, 8).toLowerCase();
    return prefixes.has(prefix) ? { idPrefix: prefix } : undefined;
  }
  const [only, ...rest] = [...prefixes];
  return only && rest.length === 0 ? { idPrefix: only } : undefined;
}

/** The bridge's full id for the open window, from its own `session/list`. */
export function pickDesktopConversation(
  listed: { sessionId: string; cwd?: string }[],
  open: OpenDesktopConversation,
  cwd: string,
  agentSessionId?: string,
): string | undefined {
  if (agentSessionId) return listed.some((row) => row.sessionId === agentSessionId) ? agentSessionId : undefined;
  const want = resolve(cwd);
  const matches = listed.filter(
    (row) => row.sessionId.toLowerCase().startsWith(open.idPrefix) && row.cwd !== undefined && resolve(row.cwd) === want,
  );
  return matches.length === 1 ? matches[0]?.sessionId : undefined;
}
