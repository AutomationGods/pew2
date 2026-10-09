import { test, expect } from "bun:test";
import { mkdtemp, mkdir, readdir, stat, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfigPrefs, writeConfigPref } from "./config-prefs.js";
import { POSIX_MODES } from "./testing/platform.js";
import { readSessionPrefs, writeSessionPrefs } from "./session-prefs.js";
import { withFileLock } from "./atomic-file.js";

async function tempEnv() {
  const home = await mkdtemp(join(tmpdir(), "pew2-prefs-"));
  return { PEW2_HOME: home } as NodeJS.ProcessEnv;
}

test("concurrent choices retain every provider and conversation update", async () => {
  const env = await tempEnv();
  const ids = Array.from({ length: 12 }, (_, index) => `choice_${index}`);
  await Promise.all(ids.flatMap((id) => [
    writeConfigPref("claude-code", id, id, env),
    writeConfigPref("ggcoder", id, true, env),
    writeSessionPrefs("claude-code", id, { model: id }, env),
    writeSessionPrefs("claude-code", "shared-session", { [id]: true }, env),
  ]));
  expect(await readConfigPrefs("claude-code", env)).toEqual(Object.fromEntries(ids.map(id => [id, id])));
  expect(await readConfigPrefs("ggcoder", env)).toEqual(Object.fromEntries(ids.map(id => [id, true])));
  expect(await readSessionPrefs("claude-code", "shared-session", env)).toEqual(Object.fromEntries(ids.map(id => [id, true])));
  for (const id of ids) expect(await readSessionPrefs("claude-code", id, env)).toEqual({ model: id });
  const home = env.PEW2_HOME;
  if (!home) throw new Error("Missing test home");
  expect((await readdir(home)).filter(name => name.endsWith(".lock") || name.endsWith(".tmp"))).toEqual([]);
});

test("separate processes merge settings without stale-file replacement", async () => {
  const env = await tempEnv();
  const configModule = new URL("./config-prefs.ts", import.meta.url).href;
  const sessionModule = new URL("./session-prefs.ts", import.meta.url).href;
  const children = Array.from({ length: 4 }, (_, worker) => Bun.spawn([
    process.execPath, "-e", `
      import { writeConfigPref } from ${JSON.stringify(configModule)};
      import { writeSessionPrefs } from ${JSON.stringify(sessionModule)};
      await Promise.all(Array.from({ length: 6 }, (_, index) => {
        const id = ${worker} + ':' + index;
        return Promise.all([
          writeConfigPref('shared', id, id),
          writeSessionPrefs('shared', id, { model: id }),
        ]);
      }));
    `,
  ], { env: { ...process.env, ...env }, stdout: "ignore", stderr: "pipe" }));
  const results = await Promise.all(children.map(async (child) => {
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    return { exitCode, stderr };
  }));
  expect(results).toEqual(Array.from({ length: 4 }, () => ({ exitCode: 0, stderr: "" })));
  const stored = await readConfigPrefs("shared", env);
  expect(Object.keys(stored)).toHaveLength(24);
  for (const [id, value] of Object.entries(stored)) {
    expect(value).toBe(id);
    expect(await readSessionPrefs("shared", id, env)).toEqual({ model: id });
  }
}, 20_000);

test("file locks release on failure, allow unrelated files, and never steal an existing lock", async () => {
  const env = await tempEnv();
  const home = env.PEW2_HOME;
  if (!home) throw new Error("Missing test home");
  const path = join(home, "settings.json");
  await expect(withFileLock(path, async () => { throw new Error("fixture failure"); })).rejects.toThrow("fixture failure");
  await expect(withFileLock(path, () => withFileLock(join(home, "other.json"), async () => "ok"))).resolves.toBe("ok");
  const lock = `${path}.lock`;
  await mkdir(lock);
  let entered = false;
  try {
    await expect(withFileLock(path, async () => { entered = true; }, { timeoutMs: 0 })).rejects.toThrow("No update was made");
    expect(entered).toBe(false);
    expect((await stat(lock)).isDirectory()).toBe(true);
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
});

test("a chosen selector reads back for that provider", async () => {
  const env = await tempEnv();
  await writeConfigPref("claude-code", "__acp_model", "opus", env);

  expect(await readConfigPrefs("claude-code", env)).toEqual({
    __acp_model: "opus",
  });
});

test("a second choice merges instead of replacing the first", async () => {
  const env = await tempEnv();
  await writeConfigPref("claude-code", "__acp_model", "opus", env);
  await writeConfigPref("claude-code", "__acp_mode", "plan", env);

  // Picking a mode must not forget the model: they are separate pills, and the
  // user set both deliberately.
  expect(await readConfigPrefs("claude-code", env)).toEqual({
    __acp_model: "opus",
    __acp_mode: "plan",
  });
});

test("providers keep their own settings", async () => {
  const env = await tempEnv();
  await writeConfigPref("claude-code", "__acp_model", "opus", env);
  await writeConfigPref("ggcoder", "__acp_model", "sonnet", env);

  expect(await readConfigPrefs("claude-code", env)).toEqual({
    __acp_model: "opus",
  });
  expect(await readConfigPrefs("ggcoder", env)).toEqual({
    __acp_model: "sonnet",
  });
});

test("re-choosing overwrites rather than accumulating", async () => {
  const env = await tempEnv();
  await writeConfigPref("claude-code", "__acp_model", "opus", env);
  await writeConfigPref("claude-code", "__acp_model", "haiku", env);

  expect(await readConfigPrefs("claude-code", env)).toEqual({
    __acp_model: "haiku",
  });
});

test("booleans survive the round trip", async () => {
  const env = await tempEnv();
  await writeConfigPref("claude-code", "fast", true, env);

  expect(await readConfigPrefs("claude-code", env)).toEqual({ fast: true });
});

test("an unknown provider has no preferences, not an error", async () => {
  expect(await readConfigPrefs("nobody", await tempEnv())).toEqual({});
});

test("a corrupt file is a miss, so a session still starts", async () => {
  const env = await tempEnv();
  await mkdir(env.PEW2_HOME!, { recursive: true });
  await writeFile(join(env.PEW2_HOME!, "config-prefs.json"), "{not json");

  expect(await readConfigPrefs("claude-code", env)).toEqual({});
  // And it recovers: the next write replaces the unreadable file.
  await writeConfigPref("claude-code", "__acp_model", "opus", env);
  expect(await readConfigPrefs("claude-code", env)).toEqual({
    __acp_model: "opus",
  });
});

test("the file is written whole, and readable only by its owner", async () => {
  // Two things at once, because they share a cause: this is a document rewritten
  // from scratch on every change, so a `writeFile` interrupted between truncate
  // and fill loses every provider's settings rather than one, and the process
  // umask decides who else on the machine gets to read the result.
  const env = await tempEnv();
  await writeConfigPref("claude-code", "__acp_model", "opus", env);

  const path = join(env.PEW2_HOME!, "config-prefs.json");
  // Windows has no permission bits to check - see POSIX_MODES.
  if (POSIX_MODES) expect((await stat(path)).mode & 0o077).toBe(0);

  // Nothing left behind: a temp file that survives is a file the next reader
  // may find instead of the real one.
  const stray = (await readdir(env.PEW2_HOME!)).filter((name) => name.endsWith(".tmp"));
  expect(stray).toEqual([]);
});
