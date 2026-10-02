/**
 * `pew2 setup` — the whole A-to-Z, in one call.
 *
 * The premise of pew2 is that a user asks the coding agent they already have to
 * connect their phone, and the agent does it. That only works if there is a
 * single entry point that is safe to run repeatedly, never destroys existing
 * configuration, and ends by saying — in machine-readable form — exactly what is
 * still wrong and what command fixes it.
 *
 * So setup is: detect what is installed, prove it really speaks ACP, keep the
 * daemon running in the background, then diagnose. Each stage is a function
 * elsewhere; this only sequences them.
 */
import { detectProviders, type DetectResult } from "../providers/detect.js";
import { verifyAll, type VerifyReport } from "../providers/verify.js";
import { loadProviders, providerDirs, isAvailable } from "../providers/registry.js";
import { readDisabled, retireLegacyDisabled } from "../providers/enabled.js";
import { daemonUrl, doctor, probeDaemonHealth, type DoctorReport } from "./doctor.js";
import {
  installService,
  isCompiled,
  serviceStatus,
  uninstallService,
  type ServiceStatus,
} from "./service.js";
import { CATALOG } from "../providers/detect.js";
import type { AgentState, ServiceOutcome } from "./setup-view.js";

export interface SetupResult {
  /** True when nothing blocking remains. The agent's stop condition. */
  ok: boolean;
  detect: DetectResult;
  /** Empty when verification was skipped. */
  verify: VerifyReport[];
  doctor: DoctorReport;
  /**
   * Every agent pew2 knows about, and what state it is in on this machine.
   *
   * The presentation layer groups these; assembling the list here keeps the
   * command from having to re-derive it from three separate result shapes.
   */
  agents: AgentState[];
  /** Commands to run next, in order. Empty when setup is complete. */
  nextSteps: string[];
  /**
   * Agents turned back on by retiring a version 1 `disabled.json`.
   *
   * Reported rather than done quietly: an earlier setup wrote agents into that
   * file on the user's behalf whenever a check failed, so the list cannot be
   * read as their decision. Undoing it silently would be the same mistake in
   * the other direction — they get told, once, and choose again.
   */
  restored: string[];
  /**
   * The background service this run installed, and whether it started.
   *
   * Absent when setup left the service alone: one already existed, something
   * was already serving, or this is a source checkout. An install that did not
   * start is reported here and removed again, so it is never left on disk;
   * `removed` says whether that worked.
   */
  serviceInstall?: ServiceOutcome;
}

export interface SetupOptions {
  env?: NodeJS.ProcessEnv;
  /**
   * Directories scanned for manifests, highest precedence first. New manifests
   * are written to the first one. Defaults to `providerDirs(env)`.
   */
  searchDirs?: string[];
  /**
   * Verification spawns every agent and prompts it for real, which costs
   * seconds and may hit the network. Skippable so a re-run after a small fix is
   * fast, but it is on by default: a manifest that has not been verified has
   * proven nothing.
   */
  verify?: boolean;
  probeDaemon?: (url: string) => Promise<boolean>;
  /** Read the stored pairing. Injectable so tests need no real home directory. */
  pairing?: (env: NodeJS.ProcessEnv) => Promise<{ token?: string; relay?: string } | undefined>;
  /** Read service state. Injectable so tests never inspect real launchd. */
  service?: () => Promise<{ state: string }>;
  /**
   * A released binary rather than a source checkout. Only a release gets the
   * background service: from a checkout it would be a login item pointing at a
   * working tree, holding the port the dev server needs.
   */
  compiled?: boolean;
  /** Install the background service. Injectable so tests never touch a real supervisor. */
  installService?: () => Promise<ServiceStatus>;
  /** Remove it again. Injectable for the same reason. */
  uninstallService?: () => Promise<unknown>;
  /**
   * How long a service this run installed has to answer before it counts as not
   * started. Injectable so a test of a failed start does not sit out the wait.
   */
  startTimeoutMs?: number;
  /**
   * Run verification. Injectable so a test can describe a mix of working and
   * unconfigured agents without spawning any, which is the only way to cover
   * the rule that one working agent is enough.
   */
  verifyProviders?: typeof verifyAll;
  onProgress?: (stage: "detect" | "verify" | "service" | "doctor", note?: string) => void;
}

/**
 * How long to wait for a service this run installed to answer.
 *
 * A supervisor reports the process before it has bound its port, and a
 * diagnosis taken in that gap says "nothing serving" about a daemon a second
 * away from working.
 */
const START_TIMEOUT_MS = 10_000;
const START_POLL_MS = 250;

/** Does the daemon answer within `timeoutMs`? Always asks at least once. */
async function answersWithin(
  probe: (url: string) => Promise<boolean>,
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe(url)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, START_POLL_MS));
  }
}

/**
 * Take a service that did not start off the machine again.
 *
 * A service file that never ran is worse than none. The updater reads its
 * presence as "something will restart me", and would swap the binary and exit a
 * daemon nothing brings back.
 */
async function removeAgain(
  status: ServiceStatus,
  uninstall: () => Promise<unknown>,
): Promise<ServiceOutcome> {
  const removed = await uninstall().then(
    () => true,
    () => false,
  );
  return { ...status, removed };
}

/**
 * Install the background service, and take it off again if it does not start.
 *
 * Whether the daemon answers decides, not the supervisor's word for it. Task
 * Scheduler's status is translated on a non-English Windows, so a task that is
 * running there reads as merely "installed", and removing it on that word would
 * take a working service away.
 *
 * Never throws. A home folder that cannot be written to is a reason not to run
 * in the background, not a reason for the whole of setup to fail.
 */
async function startInBackground(
  install: () => Promise<ServiceStatus>,
  uninstall: () => Promise<unknown>,
  answers: () => Promise<boolean>,
): Promise<ServiceOutcome> {
  let status: ServiceStatus;
  try {
    status = await install();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Cleaned up all the same: the install may have written the file first.
    return removeAgain({ state: "not-installed", detail: `Could not write the service: ${reason}` }, uninstall);
  }

  // Nothing answered before the install, so a daemon that answers now is the
  // one this service started.
  if (await answers()) return { ...status, state: "running" };
  // Running by the supervisor's own account, only slow to answer: a busy
  // machine, not a failed install. Doctor says so if it never comes up.
  if (status.state === "running") return status;
  return removeAgain(status, uninstall);
}

export async function setup(options: SetupOptions = {}): Promise<SetupResult> {
  const env = options.env ?? process.env;
  const progress = options.onProgress ?? (() => {});
  const searchDirs = options.searchDirs ?? providerDirs(env);
  // The built-in agents come from the array compiled into this binary, and are
  // included only when the caller did not name its own directories — a test
  // pointing at a sandbox means that sandbox and nothing else.
  const bundled = options.searchDirs === undefined;

  progress("detect");
  const detected = await detectProviders({ env, searchDirs, targetDir: searchDirs[0] });

  // Agents the user has explicitly turned off.
  //
  // Verification is not a read: it starts the agent for real. Checking one that
  // has been switched off means spawning a process on someone's machine, on
  // every run of setup, for an agent they have already said they do not want —
  // and then reporting on it, which invites them to fix something they were
  // never going to use.
  //
  // Only what is *already* off, so the first run still checks everything: that
  // is the run whose whole purpose is to find out what works.
  //
  // Retired first, so a list this tool wrote on the user's behalf is not then
  // used as grounds for skipping the very agents it wrongly recorded.
  const restored = await retireLegacyDisabled(env);
  const disabled = await readDisabled(env);

  let verify: VerifyReport[] = [];
  if (options.verify !== false) {
    const { providers } = await loadProviders(searchDirs, env, { bundled });
    // Only verify what could possibly run. Spawning a provider whose command is
    // missing produces a failure that says nothing `doctor` has not already said
    // more precisely.
    const runnable = providers.filter(
      (p) =>
        isAvailable(p) &&
        p.manifest.pew.transport === "acp" &&
        !disabled.has(p.manifest.id),
    );
    for (const provider of runnable) progress("verify", provider.manifest.id);
    verify = await (options.verifyProviders ?? verifyAll)(runnable);
  }

  // Keep the daemon running once this terminal closes. Setup used to end by
  // suggesting `pew2 serve`, which stops with the window, and the separate
  // `pew2 service install` was the step people missed.
  //
  // Left alone, in the order checked:
  // - a source checkout, which would get a login item pointing at a working
  //   tree, holding the port the dev server needs;
  // - an existing service, which may be a daemon someone is using right now;
  // - a daemon already answering, which is `pew2 serve` in a terminal. A
  //   supervised second copy would crash-loop on the port until that one
  //   stopped; doctor's `not-autostarted` warning names the command instead.
  const url = daemonUrl(env);
  const probe = options.probeDaemon ?? probeDaemonHealth;
  let serviceInstall: ServiceOutcome | undefined;
  if (
    (options.compiled ?? isCompiled()) &&
    (await (options.service ?? serviceStatus)()).state === "not-installed" &&
    !(await probe(url))
  ) {
    progress("service");
    serviceInstall = await startInBackground(
      options.installService ?? (() => installService({ env })),
      options.uninstallService ?? (() => uninstallService()),
      () => answersWithin(probe, url, options.startTimeoutMs ?? START_TIMEOUT_MS),
    );
  }

  progress("doctor");
  const report = await doctor({
    env,
    searchDirs,
    probeDaemon: probe,
    pairing: options.pairing,
    service: options.service,
  });

  // Agents are alternatives, not requirements.
  //
  // Nobody signs in to all thirteen: you use the one or two you pay for, and the
  // rest sit there unconfigured forever. Treating an unconfigured agent as a
  // failure made `pew2 setup` exit non-zero on a machine that was completely
  // working, which is both wrong and the thing that makes people think they have
  // broken something.
  //
  // So: setup succeeds when at least one agent can actually run. Everything else
  // is an option the user has not taken.
  const brokenProviders = verify.filter((r) => r.status === "failed");

  // Verification is the strong signal, but it is skippable. With `--skip-verify`
  // there are no reports at all, and treating that as "nothing works" would make
  // the fast path permanently report failure — so fall back to what the registry
  // can see: an agent that is installed and has the environment it declared.
  const usable =
    verify.length > 0
      ? verify.some((r) => r.status === "ok")
      : (await loadProviders(searchDirs, env, { bundled })).providers.some(isAvailable);

  const ok = report.ok && usable;

  const nextSteps: string[] = [];
  if (!ok) {
    for (const problem of report.problems) {
      if (problem.severity === "error" && !nextSteps.includes(problem.fix)) {
        nextSteps.push(problem.fix);
      }
    }
    // Only worth suggesting when nothing works at all. With a working agent in
    // hand, these are optional extras and listing them as "next steps" reads as
    // a list of chores.
    if (!usable) {
      for (const broken of brokenProviders) {
        nextSteps.push(`pew2 providers verify ${broken.id}   # ${broken.detail ?? "failed"}`);
      }
    }
  }

  // One row per agent, from the three sources that each know part of it: the
  // registry knows what is installed, verification knows what actually ran, and
  // the catalog knows where to get the rest.
  const { providers: allProviders } = await loadProviders(searchDirs, env, { bundled });
  const verifyById = new Map(verify.map((r) => [r.id, r]));
  const installById = new Map(CATALOG.map((c) => [c.manifest.id, c.install]));

  const agents: AgentState[] = allProviders.map((provider) => {
    const report = verifyById.get(provider.manifest.id);
    return {
      id: provider.manifest.id,
      name: provider.manifest.name,
      experimental: provider.manifest.pew.experimental,
      install: installById.get(provider.manifest.id),
      command: provider.command,
      missingEnv: provider.missingEnv,
      notInstalled: provider.commandMissing,
      // Carried so the screen can say "off" rather than silently showing an
      // agent as untested — which is what a skipped verification looks like.
      disabled: disabled.has(provider.manifest.id),
      verify: report
        ? { status: report.status, detail: report.detail }
        : undefined,
    };
  });

  return { ok, detect: detected, verify, doctor: report, agents, nextSteps, restored, serviceInstall };
}
