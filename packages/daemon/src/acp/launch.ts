/**
 * Turning a provider manifest's command into something that can be spawned
 * safely on every platform, without the agent's bootstrapper reading the
 * user's repository.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, win32 } from "node:path";
import { findOnPath } from "../providers/registry.js";

/**
 * Characters cmd.exe treats as syntax rather than text — including the space,
 * which is why a path can be escaped instead of quoted.
 *
 * Taken from cross-spawn, which is the de-facto implementation of this problem
 * and has had a decade of Windows bug reports filed against it.
 */
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/**
 * One argument, as the target program's C runtime will parse it back.
 *
 * Two layers, and they are not the same layer. First MSVCRT quoting, which is
 * what the receiving program applies: a backslash is literal *except* directly
 * before a quote, so those runs are doubled and the quote escaped. Then cmd's
 * own layer on top, since with `windowsVerbatimArguments` this text reaches
 * cmd.exe unaltered — including the quotes we just added, which have to be
 * `^`-escaped or cmd eats them as delimiters.
 */
function escapeArgument(arg: string): string {
  const quoted = `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`;
  return quoted.replace(CMD_META, "^$1");
}

/**
 * How to actually launch what `findOnPath` found.
 *
 * On POSIX, unchanged: the command is spawned as given.
 *
 * On Windows, two things are true that are not true anywhere else. The command
 * has to be resolved to a real file first — libuv only ever appends `.com` and
 * `.exe`, so a bare `npx` never finds the `npx.cmd` that npm actually installed.
 * And since CVE-2024-27980 (Node 18.20.2 / 20.12.2 / 21.7.3) spawning a `.cmd`
 * or `.bat` without a shell is refused outright with EINVAL, because argument
 * quoting for those is a command-injection surface.
 *
 * So a batch shim goes through `cmd.exe` explicitly — never `shell: true`, which
 * hands an unescaped line to a parser and is the vulnerability itself.
 *
 * The escaping is not optional decoration. Passing the parts as ordinary argv
 * entries looks right and is wrong: Node quotes them MSVCRT-style, then `/s`
 * strips the *first and last* quote of everything after `/c` — which unquotes
 * the program path. `C:\Program Files\nodejs\npx.cmd`, the default location of
 * the launcher five bundled providers run through, would split at the space and
 * fail with a syntax error nobody could act on. So the line is built here,
 * escaped for both parsers, and handed over verbatim — the same shape npm,
 * nodemon and cross-spawn all settled on.
 */
export function launchSpec(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): { command: string; args: string[]; windowsVerbatimArguments?: boolean } {
  // Same override the resolver honours, so the Windows path is reachable from a
  // Linux CI run — the only reason this behaviour is testable at all.
  const windows = env.PEW2_FAKE_PLATFORM
    ? env.PEW2_FAKE_PLATFORM === "win32"
    : process.platform === "win32";
  if (!windows) return { command, args };

  // Never fall back to a bare name: Windows would search the repository again.
  const resolved = findOnPath(command, env);
  if (!resolved) {
    throw new Error(`'${command}' was not found on PATH. Install it, or point the manifest at an absolute path.`);
  }
  const lower = resolved.toLowerCase();
  if (!lower.endsWith(".cmd") && !lower.endsWith(".bat")) {
    return { command: resolved, args };
  }

  // The program is `^`-escaped rather than quoted, so a space in the path is
  // literal without opening a quote that `/s` would later strip.
  const line = [resolved.replace(CMD_META, "^$1"), ...args.map(escapeArgument)].join(" ");

  // `/d` skips AutoRun commands from the registry — without it, whatever a user
  // or their IT department set there runs before every agent. `/s` makes the
  // outer quotes mean exactly "strip these two", which is what the line is
  // built to expect.
  return {
    command: env.COMSPEC && win32.isAbsolute(env.COMSPEC)
      ? env.COMSPEC
      : win32.join(env.SystemRoot ?? env.WINDIR ?? "C:\\Windows", "System32", "cmd.exe"),
    args: ["/d", "/s", "/c", `"${line}"`],
    windowsVerbatimArguments: true,
  };
}

/** Keep a Windows batch shim's own interpreter lookup out of the workspace too. */
export function providerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const windows = env.PEW2_FAKE_PLATFORM
    ? env.PEW2_FAKE_PLATFORM === "win32"
    : process.platform === "win32";
  if (!windows) return { ...env };
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  const absolutePath = path.split(";")
    .map((dir) => dir.replace(/^"(.*)"$/, "$1"))
    .filter((dir) => isAbsolute(dir) || win32.isAbsolute(dir))
    .join(";");
  // Windows environment names are case-insensitive. Drop aliases so Node cannot
  // select an older value, and force cmd's documented no-implicit-cwd policy.
  const inherited = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !["path", "nodefaultcurrentdirectoryinexepath"].includes(key.toLowerCase()),
  ));
  return { ...inherited, PATH: absolutePath, NoDefaultCurrentDirectoryInExePath: "1" };
}

/**
 * npx is a bootstrapper, not the agent. Starting it in a repository lets npm
 * consume that repository's .npmrc, script-shell and local executable entries
 * before ACP has even started. Keep bootstrap in a private empty directory;
 * the real project still reaches the agent through session/new and load.
 */
export async function prepareProviderLaunch(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const name = basename(command.replaceAll("\\", "/")).toLowerCase();
  if (!["npx", "npx.cmd", "npx.bat", "npx.exe"].includes(name)) {
    return { ...launchSpec(command, args, env), cwd, cleanup: async () => {} };
  }
  const executable = findOnPath(command, env);
  if (!executable) throw new Error(`'${command}' was not found on PATH. Install it, or point the manifest at an absolute path.`);
  const bootstrap = await mkdtemp(join(tmpdir(), "pew2-bootstrap-"));
  const cleanup = () => rm(bootstrap, { recursive: true, force: true });
  try {
    // Explicit prefix prevents npm walking into any ancestor project's config.
    return { ...launchSpec(executable, ["--prefix", bootstrap, ...args], env), cwd: bootstrap, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
