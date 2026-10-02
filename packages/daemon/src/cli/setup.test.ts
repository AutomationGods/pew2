/**
 * Tests for the agent-facing setup loop.
 *
 * The property under test is not "setup prints nicely" — it is that `ok` and
 * `problems[].fix` form a loop a coding agent can actually run to completion:
 * every blocking problem names a fix, applying the fix clears the problem, and
 * `ok` only flips to true when nothing blocking is left.
 */
import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctor } from "./doctor.js";
import { setup } from "./setup.js";
import { fakeExecutable } from "../testing/platform.js";
import { isCompiled, type ServiceStatus } from "./service.js";

/** An isolated machine: empty PATH, empty home, no daemon. */
async function sandbox() {
  const root = await mkdtemp(join(tmpdir(), "pew2-setup-"));
  const bin = join(root, "bin");
  await mkdir(bin, { recursive: true });
  await mkdir(join(root, "home", "providers"), { recursive: true });
  return {
    root,
    bin,
    providersDir: join(root, "home", "providers"),
    env: { PATH: bin, PEW2_HOME: join(root, "home") } as NodeJS.ProcessEnv,
  };
}

/** Shared, so "installed" means the same thing here as it does on Windows. */
const install = fakeExecutable;

const noDaemon = async () => false;
const daemonUp = async () => true;

test("a bare machine reports blocking problems, each with a fix", async () => {
  const { providersDir, env } = await sandbox();

  const report = await doctor({ env, searchDirs: [providersDir], probeDaemon: noDaemon });

  expect(report.ok).toBe(false);
  const ids = report.problems.map((p) => p.id).sort();
  expect(ids).toEqual(["daemon-unreachable", "local-only", "no-providers"]);
  // The whole contract: an agent can act on every problem without parsing prose.
  for (const problem of report.problems) expect(problem.fix.length).toBeGreaterThan(0);
  expect(report.problems.find((p) => p.id === "no-providers")!.fix).toBe("pew2 detect");
});

test("setup configures what is installed and stops blocking once it can run", async () => {
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  // The Claude adapter is distributed via npx, so npx is what actually gets
  // spawned and what must be present for the provider to count as usable.
  await install(bin, "npx");

  // Verification is skipped: spawning a real agent needs the network, and what
  // is under test here is the decision loop, not the ACP handshake.
  const first = await setup({ env, searchDirs: [providersDir], verify: false, probeDaemon: noDaemon });

  expect(first.detect.detected.map((d) => d.id)).toEqual(["claude-code"]);
  expect(first.ok).toBe(false);
  // Only the daemon is still blocking; the provider problem resolved itself.
  expect(first.doctor.problems.map((p) => p.id)).toEqual(["daemon-unreachable", "local-only"]);
  expect(first.nextSteps).toHaveLength(1);

  // Start the daemon — the one remaining fix — and the loop terminates.
  const second = await setup({ env, searchDirs: [providersDir], verify: false, probeDaemon: daemonUp, pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }), service: async () => ({ state: "running" }) });
  expect(second.ok).toBe(true);
  expect(second.nextSteps).toEqual([]);
  // Re-running never re-configures what is already there.
  expect(second.detect.detected[0]!.action).toBe("already-configured");
});

test("a missing optional API key warns without blocking", async () => {
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "my-agent");
  await writeFile(
    join(providersDir, "my-agent.json"),
    JSON.stringify({
      id: "my-agent",
      name: "My Agent",
      version: "1.0.0",
      description: "Test agent.",
      distribution: { type: "command", command: "my-agent", args: [] },
      pew: { env: [{ name: "OPTIONAL_KEY", required: false }] },
    }),
  );

  const report = await doctor({ env, searchDirs: [providersDir], probeDaemon: daemonUp, pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }), service: async () => ({ state: "running" }) });

  // An agent with its own login flow must not trap the setup loop.
  expect(report.ok).toBe(true);
  expect(report.problems).toEqual([]);
});

test("a required API key is reported but never blocks the loop", async () => {
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "my-agent");
  await writeFile(
    join(providersDir, "my-agent.json"),
    JSON.stringify({
      id: "my-agent",
      name: "My Agent",
      version: "1.0.0",
      description: "Test agent.",
      distribution: { type: "command", command: "my-agent", args: [] },
      pew: { env: [{ name: "NEEDED_KEY", required: true }] },
    }),
  );

  const report = await doctor({ env, searchDirs: [providersDir], probeDaemon: daemonUp, pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }), service: async () => ({ state: "running" }) });

  const problem = report.problems.find((p) => p.id === "provider-missing-env");
  expect(problem).toBeDefined();
  expect(problem!.provider).toBe("my-agent");
  expect(problem!.fix).toContain("NEEDED_KEY");
  // A secret is a human decision, so it is a warning: an agent cannot supply it
  // and must not loop forever waiting for one.
  expect(problem!.severity).toBe("warning");
  expect(report.ok).toBe(true);
});

test("a broken manifest blocks, and names the file to fix", async () => {
  const { providersDir, env } = await sandbox();
  await writeFile(join(providersDir, "broken.json"), "{ not json");

  const report = await doctor({ env, searchDirs: [providersDir], probeDaemon: daemonUp, pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }), service: async () => ({ state: "running" }) });

  const problem = report.problems.find((p) => p.id === "manifest-invalid");
  expect(problem).toBeDefined();
  expect(problem!.severity).toBe("error");
  expect(problem!.fix).toContain("broken.json");
  expect(report.ok).toBe(false);
});

test("one working agent is enough, whatever the others are doing", async () => {
  // Nobody signs in to all thirteen: you use the one or two you pay for and the
  // rest sit unconfigured forever. `setup` used to treat any failed verification
  // as blocking, so a machine with Claude Code working and Cline never signed
  // into exited non-zero - telling someone who was completely set up that they
  // were not.
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  await install(bin, "npx");

  const ready = {
    env,
    searchDirs: [providersDir],
    probeDaemon: daemonUp,
    pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }),
    service: async () => ({ state: "running" }),
  };

  const mixed = await setup({
    ...ready,
    verifyProviders: async (providers) =>
      providers.map((p, i) =>
        i === 0
          ? { id: p.manifest.id, status: "ok" as const, updates: 4 }
          : { id: p.manifest.id, status: "failed" as const, detail: "Authentication required" },
      ),
  });

  expect(mixed.ok).toBe(true);
  // And an unconfigured agent is never offered as a chore when something works.
  expect(mixed.nextSteps).toEqual([]);

  // With nothing working at all, it does block - and says what to look at.
  const none = await setup({
    ...ready,
    verifyProviders: async (providers) =>
      providers.map((p) => ({
        id: p.manifest.id,
        status: "failed" as const,
        detail: "Authentication required",
      })),
  });

  expect(none.ok).toBe(false);
  expect(none.nextSteps.join(" ")).toContain("pew2 providers verify");
});

/** Long enough to clear the 32-character floor the pairing token must meet. */
const FAKE_TOKEN = "t".repeat(40);

test("an agent the user turned off is never started again", async () => {
  // Verification is not a read: it spawns the agent for real. Running it against
  // an agent that has been switched off means booting a process on someone's
  // machine, every single run, for something they have already said they do not
  // want — and then reporting on it, which invites them to go and fix it.
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  await install(bin, "npx");
  await install(bin, "opencode");

  // Version 2: a choice the user actually made in the fixed picker. A version 1
  // file means the opposite — that an older setup may have written this entry
  // on their behalf — and is retired rather than obeyed, which is its own test.
  await writeFile(
    join(providersDir, "..", "disabled.json"),
    JSON.stringify({ version: 2, disabled: ["opencode"] }),
  );

  const started: string[] = [];
  const result = await setup({
    env,
    searchDirs: [providersDir],
    probeDaemon: daemonUp,
    pairing: async () => ({ token: FAKE_TOKEN, relay: "wss://relay.test" }),
    service: async () => ({ state: "running" }),
    verifyProviders: async (providers) => {
      for (const p of providers) started.push(p.manifest.id);
      return providers.map((p) => ({ id: p.manifest.id, status: "ok" as const, updates: 1 }));
    },
  });

  expect(started).not.toContain("opencode");
  expect(started).toContain("claude-code");
  // It is still listed — as a choice the user made, not a gap in the report.
  expect(result.agents.find((a) => a.id === "opencode")?.disabled).toBe(true);
});

test("the first run still checks everything", async () => {
  // The rule is "already off", not "off by default". A machine with no
  // disabled.json is someone's first run, and that run exists precisely to find
  // out what works — skipping anything there would leave the picker guessing.
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  await install(bin, "npx");
  await install(bin, "opencode");

  const started: string[] = [];
  await setup({
    env,
    searchDirs: [providersDir],
    probeDaemon: daemonUp,
    pairing: async () => ({ token: FAKE_TOKEN, relay: "wss://relay.test" }),
    service: async () => ({ state: "running" }),
    verifyProviders: async (providers) => {
      for (const p of providers) started.push(p.manifest.id);
      return providers.map((p) => ({ id: p.manifest.id, status: "ok" as const, updates: 1 }));
    },
  });

  expect(started).toContain("opencode");
  expect(started).toContain("claude-code");
});

test("a legacy disabled list is retired, and every agent re-checked once", async () => {
  // The end-to-end shape of the migration. An older setup made an agent
  // unselectable whenever verification failed — including "not signed in yet"
  // and a first `npx` download that outran a too-short timeout — and then wrote
  // every unselected row to disabled.json. Those entries were never choices, so
  // the whole list is retired and the agents are checked again.
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  await install(bin, "npx");
  await install(bin, "opencode");

  await writeFile(
    join(providersDir, "..", "disabled.json"),
    JSON.stringify({ version: 1, disabled: ["opencode"] }),
  );

  const started: string[] = [];
  const result = await setup({
    env,
    searchDirs: [providersDir],
    probeDaemon: daemonUp,
    pairing: async () => ({ token: FAKE_TOKEN, relay: "wss://relay.test" }),
    service: async () => ({ state: "running" }),
    verifyProviders: async (providers) => {
      for (const p of providers) started.push(p.manifest.id);
      return providers.map((p) => ({ id: p.manifest.id, status: "ok" as const, updates: 1 }));
    },
  });

  // Checked again rather than skipped on the strength of a list we wrote.
  expect(started).toContain("opencode");
  // And reported, because a setting that changes itself without saying so is
  // exactly the bug being undone.
  expect(result.restored).toEqual(["opencode"]);
  expect(result.agents.find((a) => a.id === "opencode")?.disabled).toBe(false);
});

test("a daemon that starts and dies is named as that, not as 'not started'", async () => {
  // Every binary install was in this state: the plist named `pew2 run
  // /$bunfs/server.ts` - a subcommand that did not exist, pointed at a path
  // inside the executable - so pew2 printed its help and exited 1, KeepAlive
  // restarted it for ever, and doctor said only "nothing serving on ...",
  // which reads as "you have not started it yet".
  const { providersDir, env } = await sandbox();

  const report = await doctor({
    env,
    searchDirs: [providersDir],
    probeDaemon: noDaemon,
    service: async () => ({ state: "installed", lastExitCode: 1 }),
  });

  const problem = report.problems.find((p) => p.id === "daemon-unreachable")!;
  expect(problem.detail).toContain("keeps exiting");
  // Reinstalling rewrites the plist, which is what repairs a bad one.
  expect(problem.fix).toBe("pew2 service install");
});

test("a daemon that was simply never started still says so plainly", async () => {
  const { providersDir, env } = await sandbox();

  const report = await doctor({
    env,
    searchDirs: [providersDir],
    probeDaemon: noDaemon,
    service: async () => ({ state: "not-installed" }),
  });

  const problem = report.problems.find((p) => p.id === "daemon-unreachable")!;
  expect(problem.detail).not.toContain("keeps exiting");
  // And never a path from a source checkout when this is a compiled binary:
  // someone who ran the installer has no such directory.
  if (isCompiled()) expect(problem.fix).toBe("pew2 serve");
});

interface ServiceSituation {
  /** A released binary rather than a source checkout. */
  compiled: boolean;
  /** What the supervisor reports before setup touches anything. */
  existing: string;
  /** Whether something already answers on the daemon's port. */
  serving: boolean;
  /** What installing reports. A started service unless a test says otherwise. */
  installs?: ServiceStatus;
}

/**
 * Every service dependency of setup, faked.
 *
 * A test that reached the real installer would put a login item on the machine
 * running the suite, so nothing here is left to its default.
 */
function serviceFakes(situation: ServiceSituation) {
  const installs: ServiceStatus = situation.installs ?? { state: "running", pid: 4242 };
  const calls = { install: 0, uninstall: 0 };
  let installed = false;
  return {
    calls,
    options: {
      compiled: situation.compiled,
      // Answers like the real daemon: up if something was already serving, or
      // once a service this run installed has actually started.
      probeDaemon: async () => situation.serving || (installed && installs.state === "running"),
      // A failed start is the case under test, not something to sit through.
      startTimeoutMs: 0,
      service: async () => ({ state: installed ? installs.state : situation.existing }),
      installService: async () => {
        calls.install++;
        installed = true;
        return installs;
      },
      uninstallService: async () => {
        calls.uninstall++;
        installed = false;
      },
      pairing: async () => ({ token: "t".repeat(48), relay: "wss://relay.test" }),
    },
  };
}

test("setup starts pew2 in the background on a released binary with no service", async () => {
  // `pew2 serve` stops when its terminal closes, and the separate `pew2 service
  // install` was the step people missed. Setup is the command everyone runs.
  const { bin, providersDir, env } = await sandbox();
  await install(bin, "claude");
  await install(bin, "npx");
  const fakes = serviceFakes({ compiled: true, existing: "not-installed", serving: false });

  const result = await setup({ env, searchDirs: [providersDir], verify: false, ...fakes.options });

  expect(fakes.calls.install).toBe(1);
  expect(result.serviceInstall?.state).toBe("running");
  // Diagnosed after the daemon answered, so nothing says it is down or will
  // not come back after a reboot.
  const ids = result.doctor.problems.map((p) => p.id);
  expect(ids).not.toContain("daemon-unreachable");
  expect(ids).not.toContain("not-autostarted");
  expect(result.ok).toBe(true);
});

test.each([
  // A login item pointing at a working tree, holding the dev server's port.
  ["a source checkout", { compiled: false, existing: "not-installed", serving: false }],
  // Reinstalling restarts a daemon someone may be using, on every run.
  ["a service that is already installed", { compiled: true, existing: "installed", serving: false }],
  ["a service that is already running", { compiled: true, existing: "running", serving: true }],
  // `pew2 serve` in a terminal. A supervised second copy would crash-loop on
  // the port until that one stopped; doctor says what to run instead.
  ["a daemon running in a terminal", { compiled: true, existing: "not-installed", serving: true }],
  ["a platform with no supervisor", { compiled: true, existing: "unsupported", serving: false }],
] satisfies [string, ServiceSituation][])("setup leaves the service alone on %s", async (_name, situation) => {
  const { providersDir, env } = await sandbox();
  const fakes = serviceFakes(situation);

  const result = await setup({ env, searchDirs: [providersDir], verify: false, ...fakes.options });

  expect(fakes.calls.install).toBe(0);
  expect(result.serviceInstall).toBeUndefined();
});

test("a service that cannot start is removed again, and reported", async () => {
  // The updater reads a service file on disk as "something will restart me".
  // Keeping one that never ran — a Linux machine with no user systemd, say —
  // would let it swap the binary and exit a daemon nothing brings back.
  const { providersDir, env } = await sandbox();
  const fakes = serviceFakes({
    compiled: true,
    existing: "not-installed",
    serving: false,
    installs: { state: "installed", detail: "Written, but systemctl enable failed: no user bus" },
  });

  const result = await setup({ env, searchDirs: [providersDir], verify: false, ...fakes.options });

  expect(fakes.calls.install).toBe(1);
  expect(fakes.calls.uninstall).toBe(1);
  expect(result.serviceInstall?.removed).toBe(true);
  expect(result.serviceInstall?.detail).toContain("systemctl enable failed");
  // The fix is the one for no daemon at all. Rerunning the install that just
  // failed would be a loop an agent can never leave.
  const problem = result.doctor.problems.find((p) => p.id === "daemon-unreachable");
  expect(problem).toBeDefined();
  expect(problem?.fix).not.toBe("pew2 service install");
});

test("a service whose daemon answers is kept, however slow and whatever the supervisor calls it", async () => {
  // Task Scheduler's status text is translated on a non-English Windows, so a
  // task that is running reads as merely "installed". And a supervisor reports
  // the process before it has bound its port. Removing the service on either
  // would take a working one away: whether the daemon answers is what decides.
  const { providersDir, env } = await sandbox();
  const fakes = serviceFakes({
    compiled: true,
    existing: "not-installed",
    serving: false,
    installs: { state: "installed" },
  });
  // Silent for the first two asks after the install, then up.
  let asked = 0;
  const probeDaemon = async () => fakes.calls.install > 0 && ++asked > 2;

  const result = await setup({
    env,
    searchDirs: [providersDir],
    verify: false,
    ...fakes.options,
    probeDaemon,
    startTimeoutMs: 5_000,
  });

  expect(asked).toBeGreaterThan(2);
  expect(fakes.calls.uninstall).toBe(0);
  expect(result.serviceInstall?.state).toBe("running");
  expect(result.serviceInstall?.removed).toBeUndefined();
});

test("an install that throws is reported, and setup still finishes", async () => {
  // A home folder that cannot be written to is a reason not to run in the
  // background, not a reason for the whole of setup to fail.
  const { providersDir, env } = await sandbox();
  const fakes = serviceFakes({ compiled: true, existing: "not-installed", serving: false });

  const result = await setup({
    env,
    searchDirs: [providersDir],
    verify: false,
    ...fakes.options,
    installService: async () => {
      throw new Error("EACCES: permission denied, mkdir '/home/alice/.config/systemd/user'");
    },
  });

  expect(result.serviceInstall?.state).not.toBe("running");
  expect(result.serviceInstall?.detail).toContain("permission denied");
  // Whatever it managed to write before failing is cleaned up all the same.
  expect(fakes.calls.uninstall).toBe(1);
  expect(result.serviceInstall?.removed).toBe(true);
});

test("a failed install that cannot be removed says so", async () => {
  // Setup must not claim it cleaned up when it could not.
  const { providersDir, env } = await sandbox();
  const fakes = serviceFakes({
    compiled: true,
    existing: "not-installed",
    serving: false,
    installs: { state: "installed", detail: "Written, but schtasks /create failed: access denied" },
  });

  const result = await setup({
    env,
    searchDirs: [providersDir],
    verify: false,
    ...fakes.options,
    uninstallService: async () => {
      throw new Error("EPERM: operation not permitted");
    },
  });

  expect(result.serviceInstall?.removed).toBe(false);
});
