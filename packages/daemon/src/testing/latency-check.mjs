/**
 * Latency check: times every request/reply the app makes, as the app makes
 * them, over the relay and (optionally) the LAN socket, and prints p50/p95.
 *
 * Run against a scratch daemon so the user's paired one is untouched:
 *
 *   export PEW2_TOKEN=$(openssl rand -hex 32) PEW2_HOME=$(mktemp -d) \
 *          PEW2_PORT=8791 PEW2_EXPERIMENTAL=1 \
 *          PEW2_RELAY=wss://pew2-relay.gregory-baskin.workers.dev
 *   bun run packages/daemon/src/server.ts &          # the daemon
 *   bun run packages/daemon/src/testing/latency-check.mjs
 *
 * Env: RUNS (default 7), TRANSPORTS ("lan,relay"), SLOW_RUNS (default 3, for
 * spawn-heavy GG Coder paths), GG (provider id, default "ggcoder"; "" skips),
 * JSON=1 prints the raw samples too.
 *
 * Times exclude agent thinking only where the agent has none: `echo` answers
 * instantly, so its numbers are pure pipeline. GG Coder paths include the
 * agent's own spawn/load time, which is what the user actually waits through.
 */
import { loadPairing } from "../pairing.js";
import { CLI_DEVICE_PREFIX } from "../device-claim.js";
import { SecureChannel, e2e, wire } from "@pew2/protocol";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const RUNS = Number(process.env.RUNS ?? 7);
const SLOW_RUNS = Number(process.env.SLOW_RUNS ?? 3);
const GG = process.env.GG ?? "ggcoder";
const TIMEOUT = 30_000;
const pairing = await loadPairing();
const transports = (process.env.TRANSPORTS ?? "lan,relay").split(",").filter((t) =>
  t === "relay" ? !!pairing.relay : t === "lan",
);
const now = () => performance.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const rid = () => `lat-${Date.now()}-${seq++}`;

function endpoint(transport, deviceId) {
  if (transport === "lan") return `ws://127.0.0.1:${process.env.PEW2_PORT ?? "8787"}?token=${pairing.token}`;
  const params = new URLSearchParams({ pairing: pairing.token, role: "app", deviceId });
  return `${pairing.relay.replace(/\/$/, "")}/connect?${params}`;
}

/** One app connection: the same sealing and hello the app does. */
async function connect(transport) {
  const deviceId = `${CLI_DEVICE_PREFIX}latency-${Math.random().toString(36).slice(2, 8)}`;
  const channel = new SecureChannel(e2e.fromHex(pairing.key), "app");
  const t0 = now();
  const ws = new WebSocket(endpoint(transport, deviceId));
  const waiters = new Set();
  ws.addEventListener("message", (e) => {
    const frame = JSON.parse(e.data);
    const m = e2e.isEnvelope(frame) ? channel.open(frame) : frame;
    if (m === undefined) return;
    for (const w of waiters) if (w.pred(m)) (waiters.delete(w), w.resolve(m));
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error(`${transport}: socket refused`)));
  });
  const opened = now();
  const c = {
    ws,
    send: (m) => ws.send(JSON.stringify(channel.seal(m))),
    raw: (s) => ws.send(s),
    waitFor(pred, ms = TIMEOUT) {
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.add(w);
        setTimeout(() => waiters.delete(w) && reject(new Error("timeout")), ms);
      });
    },
    /** Send and time until the predicate matches. */
    async time(msg, pred, ms) {
      const p = c.waitFor(pred, ms);
      const t = now();
      typeof msg === "string" ? c.raw(msg) : c.send(msg);
      const m = await p;
      return { ms: now() - t, m };
    },
    close: () => ws.close(),
  };
  const announced = c.waitFor((m) => m.t === "providers" || (m.t === "error" && m.code));
  ws.send(
    JSON.stringify({ t: "hello", wire: wire.WIRE_VERSION, role: "app", deviceId, proof: channel.proof(deviceId), cursors: {} }),
  );
  const first = await announced;
  if (first.t === "error") throw new Error(`${transport}: ${first.code} ${first.message ?? ""}`);
  c.timing = { open: opened - t0, handshake: now() - t0, providers: first };
  return c;
}

const results = {}; // op -> transport -> ms[]
const notes = {};
const record = (op, transport, ms) => ((results[op] ??= {})[transport] ??= []).push(ms);
async function sample(op, transport, runs, fn) {
  for (let i = 0; i < runs; i++) {
    try {
      const ms = await fn(i);
      if (typeof ms === "number") record(op, transport, ms);
    } catch (error) {
      (notes[op] ??= new Set()).add(`${transport}: ${error.message}`);
      break;
    }
  }
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const imageDir = mkdtempSync(join(tmpdir(), "pew2-latency-"));
writeFileSync(join(imageDir, "plot.png"), PNG);
const bigImage = join(imageDir, "big.bin.png");
writeFileSync(bigImage, Buffer.concat([PNG, Buffer.alloc(1_000_000, 7)])); // ~1.3MB as base64

for (const transport of transports) {
  console.error(`\n== ${transport} ==`);
  // Floor: the relay's hibernation auto-response, no daemon involved.
  if (transport === "relay") {
    const c = await connect(transport);
    await sample("network floor (relay ping→pong)", transport, RUNS, async () =>
      (await c.time('{"t":"ping"}', (m) => m.t === "pong", 5000)).ms,
    );
    c.close();
  }
  await sample("socket open", transport, RUNS, async () => {
    const c = await connect(transport);
    c.close();
    record("connect + hello → providers", transport, c.timing.handshake);
    return c.timing.open;
  });

  const c = await connect(transport);
  const isMine = (t, id) => (m) => m.t === t && m.requestId === id;

  await sample("provider.capabilities echo (cached)", transport, RUNS, async () =>
    (await c.time({ t: "provider.capabilities", providerId: "echo" }, (m) => m.t === "provider.capabilities" && m.providerId === "echo")).ms,
  );
  let caps;
  if (GG) {
    await sample(`provider.capabilities ${GG} (cached)`, transport, RUNS, async () => {
      const r = await c.time({ t: "provider.capabilities", providerId: GG }, (m) => m.t === "provider.capabilities" && m.providerId === GG, 60_000);
      caps = r.m;
      return r.ms;
    });
    await sample(`provider.capabilities ${GG} refresh (re-probe)`, transport, SLOW_RUNS, async () =>
      (await c.time({ t: "provider.capabilities", providerId: GG, refresh: true }, (m) => m.t === "provider.capabilities" && m.providerId === GG, 60_000)).ms,
    );
    const project = caps?.projects?.[0]?.path;
    if (project) {
      await sample(`provider.sessions ${GG} (project history)`, transport, RUNS, async () =>
        (await c.time({ t: "provider.sessions", providerId: GG, cwd: project }, (m) => m.t === "provider.sessions" && m.providerId === GG)).ms,
      );
      await sample("workspace.status (chosen project)", transport, RUNS, async () =>
        (await c.time({ t: "workspace.status", providerId: GG, cwd: project }, (m) => m.t === "workspace")).ms,
      );
    } else (notes["provider.sessions"] ??= new Set()).add(`${transport}: ${GG} reported no projects`);
  }
  await sample("workspaces (suggestions)", transport, RUNS, async () => {
    const id = rid();
    return (await c.time({ t: "workspaces", requestId: id }, isMine("workspaces", id))).ms;
  });
  await sample("goals list", transport, RUNS, async () => {
    const id = rid();
    const r = await c.time({ t: "goals", requestId: id }, isMine("goals", id));
    if (r.m.error) (notes["goals list"] ??= new Set()).add(`${transport}: ${r.m.error}`);
    return r.ms;
  });

  // Echo session: pure pipeline.
  let sid;
  let echoModels = [];
  await sample("session.start echo → session.started", transport, RUNS, async () => {
    const id = rid();
    const r = await c.time({ t: "session.start", providerId: "echo", requestId: id }, isMine("session.started", id));
    sid = r.m.sessionId;
    echoModels = r.m.configOptions?.find((o) => o.id === "model")?.options?.map((o) => o.value) ?? [];
    return r.ms;
  });
  if (sid) {
    await sample("prompt → first event (echo)", transport, RUNS, async () => {
      const idle = c.waitFor((m) => m.t === "session.idle" && m.sessionId === sid);
      const r = await c.time({ t: "session.prompt", sessionId: sid, text: "ping" }, (m) => m.t === "session.event" && m.sessionId === sid);
      const t = now() - r.ms;
      await idle;
      record("prompt → session.idle (echo)", transport, now() - t);
      return r.ms;
    });
    await sample("session.config model change (echo)", transport, RUNS, async (i) =>
      (await c.time(
        { t: "session.config", sessionId: sid, configId: "model", value: echoModels[i % echoModels.length] ?? "echo-max" },
        (m) => m.t === "session.config" && m.sessionId === sid,
      )).ms,
    );
    await sample("permission answer → agent resumes (echo)", transport, RUNS, async () => {
      const isReq = (m) => m.t === "session.event" && m.sessionId === sid && m.payload?.kind === "permission_request";
      const req = c.waitFor(isReq);
      const first = await c.time({ t: "session.prompt", sessionId: sid, text: "ask permission please" }, isReq);
      record("prompt → permission sheet (echo)", transport, first.ms);
      await req;
      const idle = c.waitFor((m) => m.t === "session.idle" && m.sessionId === sid);
      const r = await c.time(
        { t: "session.permission", sessionId: sid, requestId: first.m.payload.requestId, optionId: "allow" },
        (m) => m.t === "session.event" && m.sessionId === sid,
      );
      await idle;
      return r.ms;
    });
    await sample("image.fetch (1px png)", transport, RUNS, async () => {
      const id = rid();
      return (await c.time({ t: "image.fetch", requestId: id, sessionId: sid, uri: join(imageDir, "plot.png") }, (m) => m.t === "image" && m.requestId === id)).ms;
    });
    await sample("image.fetch (1MB)", transport, RUNS, async () => {
      const id = rid();
      return (await c.time({ t: "image.fetch", requestId: id, sessionId: sid, uri: bigImage }, (m) => m.t === "image" && m.requestId === id)).ms;
    });
    await sample("workspace.status (session)", transport, RUNS, async () =>
      (await c.time({ t: "workspace.status", sessionId: sid }, (m) => m.t === "workspace" && m.sessionId === sid)).ms,
    );
    await sample("checklist (echo session)", transport, RUNS, async () => {
      const id = rid();
      return (await c.time({ t: "checklist", requestId: id, sessionId: sid }, isMine("checklist", id))).ms;
    });
  }

  // GG Coder: what the user actually feels when opening a conversation.
  if (GG) {
    const project = caps?.projects?.[0]?.path;
    await sample(`session.start ${GG} → session.started`, transport, SLOW_RUNS, async () => {
      const id = rid();
      const isCmds = (m) => m.t === "session.event" && m.payload?.update?.sessionUpdate === "available_commands_update";
      const cmds = c.waitFor(isCmds, 20_000).catch(() => null);
      const t = now();
      const r = await c.time({ t: "session.start", providerId: GG, requestId: id, ...(project ? { cwd: project } : {}) }, isMine("session.started", id), 90_000);
      if (await cmds) record(`session.start ${GG} → slash commands event`, transport, now() - t);
      return r.ms;
    });
    const agentSessionId = caps?.sessions?.[0]?.sessionId ?? caps?.sessions?.[0]?.agentSessionId;
    if (agentSessionId) {
      // Watched from before the resume is sent: the first batch can land in
      // the same instant as session.started.
      const firstReplay = new Map();
      c.waitFor((m) => {
        if (m.t === "session.replay" && (m.events?.length > 0 || m.complete) && !firstReplay.has(m.sessionId)) firstReplay.set(m.sessionId, now());
        return false;
      }, 600_000).catch(() => {});
      await sample(`session.resume ${GG} → session.started`, transport, SLOW_RUNS, async () => {
        const r = await c.time(
          { t: "session.resume", providerId: GG, agentSessionId, ...(project ? { cwd: project } : {}) },
          (m) => m.t === "session.started" && m.resumed && m.agentSessionId === agentSessionId,
          90_000,
        );
        const t = now() - r.ms;
        // What the user sees first: the transcript, painted from disk while
        // the agent attaches behind it.
        const seen = firstReplay.get(r.m.sessionId);
        const history = (seen !== undefined ? Promise.resolve(seen) : c.waitFor((m) => m.t === "session.replay" && m.sessionId === r.m.sessionId && (m.events?.length > 0 || m.complete), 90_000).then(() => now()))
          .then((at) => record(`session.resume ${GG} → history visible (first replay)`, transport, at - t), () => {});
        const loaded = await c.waitFor((m) => m.t === "session.config" && m.sessionId === r.m.sessionId || (m.t === "error" && m.sessionId === r.m.sessionId), 90_000);
        record(`session.resume ${GG} → history loaded (session.config)`, transport, now() - t);
        await history;
        if (loaded.t === "error") throw new Error(loaded.message);
        return r.ms;
      });
    } else (notes[`session.resume ${GG}`] ??= new Set()).add(`${transport}: no stored sessions in capabilities`);
  }
  c.close();
  await wait(300);
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const fmt = (xs) => (xs?.length ? `${pct(xs, 50).toFixed(0)} / ${pct(xs, 95).toFixed(0)} (n=${xs.length})` : "—");
console.log(`\n| operation | ${transports.map((t) => `${t} p50/p95 ms`).join(" | ")} |`);
console.log(`|---|${transports.map(() => "---").join("|")}|`);
for (const [op, by] of Object.entries(results)) console.log(`| ${op} | ${transports.map((t) => fmt(by[t])).join(" | ")} |`);
for (const [op, set] of Object.entries(notes)) console.log(`note: ${op}: ${[...set].join("; ")}`);
if (process.env.JSON === "1") console.log(JSON.stringify(results));
process.exit(0);
