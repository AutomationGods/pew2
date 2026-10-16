/**
 * Goal check: walks the phone's GG Goals flow end to end over the relay (or
 * LAN) against a running daemon, the way the app does it: providers lists
 * gg-goals → goals → goal.create → session.start on the goal's folder →
 * first event from the goal → goal.action delete. Prints each step's time.
 *
 * Creates ONE real goal named "pew2 check" in GG Coder and
 * deletes it at the end (also on failure). Run against a scratch daemon:
 *
 *   export PEW2_TOKEN=$(openssl rand -hex 32) PEW2_HOME=$(mktemp -d) PEW2_PORT=8792 \
 *          PEW2_EXPERIMENTAL=1 PEW2_RELAY=wss://pew2-relay.gregory-baskin.workers.dev
 *   cp -R ~/.pew2/providers "$PEW2_HOME/"
 *   bun run packages/daemon/src/server.ts            # terminal 1
 *   bun run packages/daemon/src/testing/goal-check.mjs   # terminal 2
 *
 * Env: TRANSPORT ("relay" default, or "lan"); KEEP=1 skips the delete.
 */
import { loadPairing } from "../pairing.js";
import { CLI_DEVICE_PREFIX } from "../device-claim.js";
import { SecureChannel, e2e, wire } from "@pew2/protocol";

const pairing = await loadPairing();
const transport = process.env.TRANSPORT ?? (pairing.relay ? "relay" : "lan");
const now = () => performance.now();
let n = 0;
const rid = () => `goalcheck-${Date.now()}-${n++}`;
const log = (step, ms, extra = "") => console.log(`${step.padEnd(34)} ${ms === undefined ? "" : `${Math.round(ms)} ms`.padStart(9)}  ${extra}`);

const deviceId = `${CLI_DEVICE_PREFIX}goalcheck-${Math.random().toString(36).slice(2, 8)}`;
const channel = new SecureChannel(e2e.fromHex(pairing.key), "app");
const url =
  transport === "lan"
    ? `ws://127.0.0.1:${process.env.PEW2_PORT ?? "8787"}?token=${pairing.token}`
    : `${pairing.relay.replace(/\/$/, "")}/connect?${new URLSearchParams({ pairing: pairing.token, role: "app", deviceId })}`;
const ws = new WebSocket(url);
const waiters = new Set();
const seen = [];
ws.addEventListener("message", (e) => {
  const frame = JSON.parse(e.data);
  const m = e2e.isEnvelope(frame) ? channel.open(frame) : frame;
  if (m === undefined) return;
  seen.push(m);
  for (const w of waiters) if (w.pred(m)) (waiters.delete(w), w.resolve(m));
});
const waitFor = (pred, ms = 60_000) =>
  new Promise((resolve, reject) => {
    const hit = seen.find(pred);
    if (hit) return resolve(hit);
    const w = { pred, resolve };
    waiters.add(w);
    setTimeout(() => waiters.delete(w) && reject(new Error(`timeout after ${ms} ms`)), ms);
  });
const send = (m) => ws.send(JSON.stringify(channel.seal(m)));
async function time(step, msg, pred, ms) {
  const p = waitFor(pred, ms);
  const t = now();
  send(msg);
  const m = await p;
  log(step, now() - t);
  return m;
}

await new Promise((res, rej) => (ws.addEventListener("open", res), ws.addEventListener("error", () => rej(new Error("socket refused")))));
let t = now();
const providersP = waitFor((m) => m.t === "providers" || (m.t === "error" && m.code));
ws.send(JSON.stringify({ t: "hello", wire: wire.WIRE_VERSION, role: "app", deviceId, proof: channel.proof(deviceId), cursors: {} }));
let providers = await providersP;
if (providers.t === "error") throw new Error(`${providers.code} ${providers.message ?? ""}`);
log(`connect + hello (${transport})`, now() - t);
// The provider list may first arrive while still probing; wait for gg-goals.
t = now();
const hasGoals = (m) => m.t === "providers" && m.providers?.some((p) => p.id === "gg-goals");
providers = await waitFor(hasGoals, 30_000).catch(() => undefined);
if (!providers) {
  console.log("FAIL: daemon never announced the gg-goals provider (GG Goals hidden in the app).");
  console.log("providers seen:", seen.filter((m) => m.t === "providers").map((m) => m.providers.map((p) => p.id).join(",")));
  process.exit(1);
}
log("gg-goals announced", now() - t);

const goalsMsg = await time("goals list", { t: "goals", requestId: rid() }, (m) => m.t === "goals" && m.requestId !== undefined);
log("", undefined, `${goalsMsg.goals.length} goals${goalsMsg.error ? `, error: ${goalsMsg.error}` : ""}`);

const createId = rid();
const created = await time(
  "goal.create → goal.result",
  { t: "goal.create", requestId: createId, name: process.env.GOAL_NAME ?? "pew2 check", goal: "Reply with the single word OK and stop. Do not change any files.", context: [] },
  (m) => m.t === "goal.result" && m.requestId === createId,
);
if (!created.ok) {
  console.log("FAIL goal.create:", created.error);
  process.exit(1);
}
const goal = created.goal;
log("", undefined, `goal ${goal.id} at ${goal.path}`);

let failed;
try {
  const startId = rid();
  const started = await time(
    "session.start (open goal)",
    { t: "session.start", requestId: startId, providerId: "gg-goals", cwd: goal.path },
    (m) => (m.t === "session.started" && m.requestId === startId) || (m.t === "error" && m.requestId === startId),
  );
  if (started.t === "error") throw new Error(`session.start: ${started.message ?? started.code}`);
  const sessionId = started.sessionId;
  t = now();
  const first = await waitFor((m) => m.t === "session.event" && m.sessionId === sessionId, 90_000).catch((e) => e);
  if (first instanceof Error) throw new Error(`no event from the goal session: ${first.message}`);
  log("first event from goal", now() - t, JSON.stringify(first.event ?? first).slice(0, 140));
  const gs = seen.find((m) => m.t === "gg.goal_state" || m.t === "goal.state");
  if (gs) log("", undefined, `goal state: ${JSON.stringify(gs).slice(0, 140)}`);
} catch (error) {
  failed = error;
  console.log("FAIL:", error.message);
  const errs = seen.filter((m) => m.t === "error" || m.t === "daemon.fatal");
  if (errs.length) console.log("errors seen:", JSON.stringify(errs).slice(0, 800));
} finally {
  if (process.env.KEEP !== "1") {
    // Pause first: a working goal refuses delete.
    const pauseId = rid();
    await time("goal.action pause", { t: "goal.action", requestId: pauseId, goalId: goal.id, action: "pause" }, (m) => m.t === "goal.result" && m.requestId === pauseId, 20_000).catch(() => {});
    const delId = rid();
    const del = await time("goal.action delete", { t: "goal.action", requestId: delId, goalId: goal.id, action: "delete" }, (m) => m.t === "goal.result" && m.requestId === delId, 20_000).catch((e) => ({ ok: false, error: e.message }));
    if (!del.ok) console.log(`WARN: test goal ${goal.id} not deleted: ${del.error}`);
  }
  ws.close();
}
process.exit(failed ? 1 : 0);
