/**
 * The latency fixes (LATENCY.md): answers served from cache while the slow
 * agent call runs behind them, spares joined instead of spawned beside, and a
 * prompt that cannot overtake the selector change sent before it.
 */
import { afterEach, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Daemon } from "./index.js";
import { handleMessage } from "./handler.js";
import { SessionLog } from "./session/log.js";
import { WorkspaceStatusCache, type WorkspaceStatus } from "./git.js";
import type { AcpSessionHandle } from "./acp/connect.js";
import { writeProbeCache } from "./probe-cache.js";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanups.splice(0)) undo();
});

async function isolatedHome(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pew2-latency-"));
  const previous = { home: process.env.PEW2_HOME, workspace: process.env.PEW2_WORKSPACE };
  process.env.PEW2_HOME = join(root, "home");
  process.env.PEW2_WORKSPACE = root;
  cleanups.push(() => {
    if (previous.home === undefined) delete process.env.PEW2_HOME;
    else process.env.PEW2_HOME = previous.home;
    if (previous.workspace === undefined) delete process.env.PEW2_WORKSPACE;
    else process.env.PEW2_WORKSPACE = previous.workspace;
  });
  return root;
}

function goal(id: string, root: string) {
  return { id, name: `Goal ${id}`, goal: "do it", path: join(root, "goals", id), status: "briefing", context: [], createdAt: "2026-10-15", lastActiveMs: 0 };
}

/** A daemon whose GG Coder answers `_gg/goals/list` from `state.goals`, counting calls. */
function goalsDaemon(state: { goals: unknown[]; calls: number; hold?: Promise<void> }) {
  const sent: any[] = [];
  const daemon = new Daemon({ id: "test", name: "test" });
  daemon.attach((m) => sent.push(m));
  cleanups.push(() => daemon.closeAll());
  (daemon as any).goalsConnection = async () => ({
    extRequest: async () => {
      state.calls++;
      await state.hold;
      return { goals: state.goals };
    },
  });
  return { daemon, sent };
}

test("goals: answered from cache at once, refreshed behind, broadcast only on change", async () => {
  const root = await isolatedHome();
  const state = { goals: [goal("a", root)], calls: 0 } as { goals: unknown[]; calls: number; hold?: Promise<void> };
  const { daemon, sent } = goalsDaemon(state);

  // Cold: nothing cached, so the first ask waits on GG Coder.
  expect((await daemon.goalsNow()).map((g) => g.id)).toEqual(["a"]);
  expect(state.calls).toBe(1);

  // Warm: answered while GG Coder is still holding the refresh.
  let release!: () => void;
  state.hold = new Promise((resolve) => (release = resolve));
  state.goals = [goal("a", root), goal("b", root)];
  expect((await daemon.goalsNow()).map((g) => g.id)).toEqual(["a"]);
  expect(sent.filter((m) => m.t === "goals")).toHaveLength(0);
  release();
  await (daemon as any).goalsRefreshing;
  expect(sent.filter((m) => m.t === "goals").at(-1).goals.map((g: any) => g.id)).toEqual(["a", "b"]);

  // An unchanged refresh says nothing.
  state.hold = undefined;
  await daemon.goalsNow();
  await (daemon as any).goalsRefreshing;
  expect(sent.filter((m) => m.t === "goals")).toHaveLength(1);
  expect((await daemon.goalsNow()).map((g) => g.id)).toEqual(["a", "b"]);
});

test("goals: a restarted daemon answers from disk without waiting on GG Coder", async () => {
  const root = await isolatedHome();
  const first = goalsDaemon({ goals: [goal("a", root)], calls: 0 });
  await first.daemon.goalsNow();
  // The disk write is fire-and-forget; give it a moment.
  await Bun.sleep(50);

  const state = { goals: [goal("a", root)], calls: 0, hold: new Promise<void>(() => {}) };
  const { daemon } = goalsDaemon(state);
  expect((await daemon.goalsNow()).map((g) => g.id)).toEqual(["a"]);
  // The folder is recognised as a goal straight away, too.
  expect(daemon.isGoalFolder(join(root, "goals", "a"))).toBe(true);
});

test("workspace status: concurrent asks share one git run, reused within the ttl", async () => {
  let clock = 1_000;
  let runs = 0;
  const cache = new WorkspaceStatusCache(3_000, () => clock, async (cwd): Promise<WorkspaceStatus> => {
    runs++;
    return { cwd, folder: "x", repo: true, uncommitted: runs };
  });
  const [a, b] = await Promise.all([cache.get("/r"), cache.get("/r")]);
  expect(runs).toBe(1);
  expect(a).toBe(b);
  clock += 2_999;
  expect((await cache.get("/r")).uncommitted).toBe(1);
  clock += 1;
  expect((await cache.get("/r")).uncommitted).toBe(2);
  await cache.get("/other");
  expect(runs).toBe(3);
});

test("capabilities refresh with a cached answer replies at once and reprobes behind it", async () => {
  await isolatedHome();
  const daemon = new Daemon({ id: "test", name: "test" }, true);
  cleanups.push(() => daemon.closeAll());
  await daemon.refreshProviders();
  const cached = { configOptions: [], sessions: [], canResume: false, projects: [], commands: [] };
  (daemon as any).probes.set("echo", Promise.resolve(cached));
  (daemon as any).probedAt.set("echo", Date.now());
  let refreshed = 0;
  (daemon as any).refreshCapabilities = () => {
    refreshed++;
    return new Promise(() => {});
  };
  const answer = await daemon.capabilitiesNow("echo", { refresh: true });
  expect(answer.sessions).toEqual([]);
  expect(refreshed).toBe(1);
});

test("back-to-back starts in one project join the refill instead of spawning cold", async () => {
  await isolatedHome();
  // The repo itself as the project, as the pipeline tests do: the echo agent
  // is started with `bun run`, which needs this tree around it.
  const root = process.cwd();
  const daemon = new Daemon({ id: "test", name: "test" }, true);
  cleanups.push(() => daemon.closeAll());
  await daemon.refreshProviders();
  const stashed: AcpSessionHandle[] = [];
  const stash = (daemon as any).stashSpare.bind(daemon);
  (daemon as any).stashSpare = (id: string, handle: AcpSessionHandle, cwd: string) => {
    stashed.push(handle);
    return stash(id, handle, cwd);
  };
  const key = `echo\u0000${root}`;

  await daemon.startSession("echo", root);
  // The refill is already booting by the time the first start is answered.
  expect((daemon as any).spareBoots.has(key) || daemon.spareDirs("echo").includes(root)).toBe(true);

  const second = await daemon.startSession("echo", root);
  const handle = (daemon as any).sessions.get(second).handle;
  expect(stashed).toContain(handle);
  // Consuming it started the next refill straight away.
  expect((daemon as any).spareBoots.has(key) || daemon.spareDirs("echo").includes(root)).toBe(true);
  await (daemon as any).spareBoots.get(key);
});

test("a prompt sent right behind a config change reaches the agent after it", async () => {
  await isolatedHome();
  const daemon = new Daemon({ id: "test", name: "test" });
  cleanups.push(() => daemon.closeAll());
  daemon.attach(() => {});
  const order: string[] = [];
  let accept!: () => void;
  const handle = {
    sessionId: "agent-1",
    configOptions: [],
    setConfigOption: async () => {
      await new Promise<void>((resolve) => (accept = resolve));
      order.push("config");
      return [];
    },
    prompt: async () => {
      order.push("prompt");
    },
    cancel: async () => {},
    close: () => {},
  } as unknown as AcpSessionHandle;
  (daemon as any).sessions.set("s1", {
    handle,
    log: new SessionLog("s1"),
    providerId: "test",
    cwd: tmpdir(),
    live: false,
    lastUsedAt: Date.now(),
    ready: Promise.resolve(),
  });
  daemon.markLive("s1");
  const ctx = { daemon, reply: () => {}, broadcast: () => {}, cwd: tmpdir() };
  // As the relay delivers them: neither awaited before the next starts.
  const config = handleMessage(JSON.stringify({ t: "session.config", sessionId: "s1", configId: "model", value: "big" }), ctx);
  const prompt = handleMessage(JSON.stringify({ t: "session.prompt", sessionId: "s1", text: "hi" }), ctx);
  await Bun.sleep(20);
  expect(order).toEqual([]);
  accept();
  await Promise.all([config, prompt]);
  await Bun.sleep(20);
  expect(order).toEqual(["config", "prompt"]);
});

test("boot prewarm probes only providers with a cache, and installs the answer at once", async () => {
  await isolatedHome();
  const daemon = new Daemon({ id: "test", name: "test" }, true);
  cleanups.push(() => daemon.closeAll());
  await daemon.refreshProviders();
  // Nothing cached: a fresh install boots nothing.
  expect(await daemon.prewarm()).toEqual([]);

  await writeProbeCache("echo", { configOptions: [], sessions: [], canResume: true, projects: [], commands: [] });
  const warmed: string[] = [];
  (daemon as any).warmProvider = async (id: string) => void warmed.push(id);
  (daemon as any).revalidateIfStale = () => {};
  expect(await daemon.prewarm()).toEqual(["echo"]);
  // The first ask is answered from memory, and a spare boot was started.
  expect((daemon as any).probes.has("echo")).toBe(true);
  expect((await daemon.capabilitiesFor("echo")).canResume).toBe(true);
  expect(warmed).toEqual(["echo"]);
  // Already probed: a second prewarm does nothing.
  expect(await daemon.prewarm()).toEqual([]);
});
