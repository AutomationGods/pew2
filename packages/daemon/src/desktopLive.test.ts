/**
 * GG Goals attaching live to a goal open in GG Coder desktop, against a fake
 * desktop bridge (`testing/desktop-bridge-agent.ts`) and a temp window list.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Daemon } from "./index.js";
import type { LoadedProvider } from "./providers/registry.js";
import { findOpenDesktopConversation } from "./acp/desktopLive.js";

setDefaultTimeout(30_000);

const DESK_ID = "f4df83dd-4659-42c3-b162-a43c95b88e1b";

const provider = (id: string, script: string): LoadedProvider => ({
  manifest: {
    id,
    name: id,
    description: "",
    pew: { transport: "acp", requiresWorkspace: false, commandDirs: [] },
  } as unknown as LoadedProvider["manifest"],
  source: "<test>",
  command: "bun",
  args: ["run", fileURLToPath(new URL(`./testing/${script}`, import.meta.url))],
  missingEnv: [],
  commandMissing: false,
});

const restoreEnv: (() => void)[] = [];
const daemons: Daemon[] = [];
afterEach(() => {
  for (const daemon of daemons.splice(0)) daemon.closeAll();
  for (const restore of restoreEnv.splice(0).reverse()) restore();
});
function setEnv(key: string, value: string | undefined) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  restoreEnv.push(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

async function until<T>(read: () => T | undefined | false, what: string, ms = 8000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined && value !== false) return value;
    await Bun.sleep(5);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function setup(options: { /** File contents, or "open" for a window on the goal. */ workspace?: string; down?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), "pew2-desklive-"));
  const goal = join(root, "goals", "ship-it");
  await mkdir(goal, { recursive: true });
  const callsFile = join(root, "calls.log");
  await writeFile(callsFile, "");
  setEnv("PEW2_HOME", join(root, "home"));
  setEnv("GG_AGENT_DIR", root);
  setEnv("PEW2_TEST_GOALS_ROOT", join(root, "goals"));
  setEnv("PEW2_TEST_DESKTOP_CALLS", callsFile);
  setEnv("PEW2_TEST_DESKTOP_DOWN", options.down ? "1" : undefined);
  setEnv("PEW2_TEST_DESKTOP_SESSIONS", JSON.stringify([{ sessionId: DESK_ID, cwd: goal }]));
  const workspace =
    options.workspace === "open"
      ? JSON.stringify({ windows: [{ cwd: "/elsewhere", sessionPath: "/x/a_00000000.jsonl" }, { cwd: goal, sessionPath: join(root, "sessions", `2026-10-16T02-53-22-864Z_${DESK_ID.slice(0, 8)}.jsonl`) }] })
      : options.workspace;
  if (workspace !== undefined) await writeFile(join(root, "gg-app-workspace.json"), workspace);
  const sent: any[] = [];
  const daemon = new Daemon({ id: "test", name: "test" });
  daemon.attach((message) => sent.push(message));
  (daemon as any).providers = [provider("gg-goals", "gg-agent.ts"), provider("ggcoder-desktop", "desktop-bridge-agent.ts")];
  daemons.push(daemon);
  const calls = async () => (await readFile(callsFile, "utf8")).split("\n").filter(Boolean);
  return { daemon, sent, goal, calls };
}

const texts = (sent: any[], sessionId: string) =>
  sent
    .flatMap((m) => (m.sessionId !== sessionId ? [] : m.t === "session.event" ? [m] : m.t === "session.replay" ? m.events : []))
    .map((e: any) => e.payload?.update?.content?.text)
    .filter(Boolean);

test("a goal open on the Mac attaches live: desk turns stream, phone prompts reach the desk", async () => {
  const { daemon, sent, goal, calls } = await setup({ workspace: "open" });
  const sessionId = await daemon.startSession("gg-goals", goal);
  const session = (daemon as any).sessions.get(sessionId);
  expect(session.desktopLive).toBe(true);
  expect(session.providerId).toBe("gg-goals");
  expect(daemon.agentSessionId(sessionId)).toBe(DESK_ID);
  expect(daemon.isSharedDesktop(sessionId)).toBe(true);
  daemon.markLive(sessionId);
  await until(() => texts(sent, sessionId).includes("typed live at desk"), "live desk turn");
  expect(texts(sent, sessionId)).toContain("snapshot from desk");
  await until(() => sent.some((m) => m.t === "session.idle" && m.sessionId === sessionId), "desk idle");

  await daemon.prompt(sessionId, "from the phone");
  expect(await calls()).toContain("session/prompt from the phone");
  await until(() => texts(sent, sessionId).includes("desk heard: from the phone"), "desk answer");
  // The desk's echo is the only copy of the phone's message.
  expect(texts(sent, sessionId).filter((t: string) => t === "from the phone")).toHaveLength(1);
  // `_gg/*` turns are refused rather than posted into the desk.
  await expect(daemon.prompt(sessionId, "", [], { goalTurn: "resume" })).rejects.toThrow("GG Coder desktop");
  expect(await calls()).not.toContain("session/new");
});

test("a resume attaches only to the conversation the window holds", async () => {
  const { daemon, goal, calls } = await setup({ workspace: "open" });
  const live = daemon.beginResumeSession("gg-goals", DESK_ID, goal);
  await live.ready;
  expect((daemon as any).sessions.get(live.sessionId).desktopLive).toBe(true);
  expect(await calls()).toContain(`session/load ${DESK_ID}`);

  const other = daemon.beginResumeSession("gg-goals", "abcdef12-0000-0000-0000-000000000000", goal);
  await other.ready;
  expect((daemon as any).sessions.get(other.sessionId).desktopLive).toBeFalsy();
  expect((await calls()).filter((c) => c.startsWith("session/load"))).toHaveLength(1);
});

test("the desk closing ends the session through closeSession", async () => {
  const { daemon, goal } = await setup({ workspace: "open" });
  const sessionId = await daemon.startSession("gg-goals", goal);
  const session = (daemon as any).sessions.get(sessionId);
  session.handle.child.kill();
  await until(() => !(daemon as any).sessions.has(sessionId), "session closed");
});

for (const [name, options] of [
  ["not open on the Mac", { workspace: JSON.stringify({ windows: [{ cwd: "/elsewhere", sessionPath: "/x/a_f4df83dd.jsonl" }] }) }],
  ["no workspace file", {}],
  ["a malformed workspace file", { workspace: "{ not json" }],
  ["a workspace file of the wrong shape", { workspace: JSON.stringify({ windows: "nope" }) }],
  ["the desktop app not running", { workspace: "open", down: true }],
] as const) {
  test(`${name}: opens with ggcoder acp as before`, async () => {
    const { daemon, sent, goal, calls } = await setup(options);
    const sessionId = await daemon.startSession("gg-goals", goal);
    const session = (daemon as any).sessions.get(sessionId);
    expect(session.desktopLive).toBeFalsy();
    expect(daemon.isSharedDesktop(sessionId)).toBe(false);
    daemon.markLive(sessionId);
    await daemon.prompt(sessionId, "hi");
    expect(texts(sent, sessionId)).toContain("heard: hi");
    expect((await calls()).some((c) => c.startsWith("session/load") || c.startsWith("session/prompt"))).toBe(false);
  });
}

test("the window list is size-capped and needs exactly one window on a goal", async () => {
  const root = await mkdtemp(join(tmpdir(), "pew2-desklive-file-"));
  const file = join(root, "w.json");
  await writeFile(file, JSON.stringify({ windows: [{ cwd: "/g", sessionPath: "/s/x_aaaaaaaa.jsonl" }, { cwd: "/g", sessionPath: "/s/y_bbbbbbbb.jsonl" }] }));
  expect(await findOpenDesktopConversation(file, "/g")).toBeUndefined();
  expect(await findOpenDesktopConversation(file, "/g", "bbbbbbbb-1")).toEqual({ idPrefix: "bbbbbbbb" });
  await writeFile(file, " ".repeat(1024 * 1024 + 1));
  expect(await findOpenDesktopConversation(file, "/g")).toBeUndefined();
});
