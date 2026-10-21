/* global URLSearchParams */
/**
 * Ring every paired phone from this computer, through the running daemon:
 * the same `voice.call` the app sends for "call me", but from the computer's
 * own identity, which the daemon treats as "ring them all".
 *
 *   bun run packages/daemon/src/testing/ring-check.mjs
 *
 * Env: TRANSPORT ("lan" default when the daemon listens locally, or "relay");
 * PEW2_PORT (default 8787); SESSION=<id> to focus the call on a conversation.
 * Prints the incoming-call frame the daemon broadcast, then exits.
 */
import { hostname } from "node:os";
import { loadPairing } from "../pairing.js";
import { CLI_DEVICE_PREFIX } from "../device-claim.js";
import { SecureChannel, e2e, wire } from "@pew2/protocol";

const pairing = await loadPairing();
const transport = process.env.TRANSPORT ?? "lan";
const deviceId = `${CLI_DEVICE_PREFIX}${hostname()}`;
const channel = new SecureChannel(e2e.fromHex(pairing.key), "app");
const url =
  transport === "lan"
    ? `ws://127.0.0.1:${process.env.PEW2_PORT ?? "8787"}?token=${pairing.token}`
    : `${pairing.relay.replace(/\/$/, "")}/connect?${new URLSearchParams({ pairing: pairing.token, role: "app", deviceId })}`;

const ws = new WebSocket(url);
const done = (code, text) => {
  console.log(text);
  ws.close();
  process.exit(code);
};
setTimeout(() => done(1, "No ring was broadcast within 15 seconds."), 15_000);
ws.addEventListener("error", () => done(1, `Could not reach the daemon (${transport}).`));
ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ t: "hello", wire: wire.WIRE_VERSION, role: "app", deviceId, proof: channel.proof(deviceId), cursors: {} }));
});
let asked = false;
ws.addEventListener("message", (event) => {
  const frame = JSON.parse(event.data);
  const message = e2e.isEnvelope(frame) ? channel.open(frame) : frame;
  if (!message) return;
  if (message.t === "error" || message.t === "daemon.fatal") done(1, `Daemon said: ${message.code ?? ""} ${message.message ?? ""}`);
  if (!asked && message.t === "providers") {
    asked = true;
    const call = { t: "voice.call", ...(process.env.SESSION ? { sessionId: process.env.SESSION } : {}) };
    ws.send(JSON.stringify(channel.seal(call)));
  }
  if (message.t === "voice.incoming") done(0, `Ringing: ${message.summary} (call ${message.callId.slice(0, 8)})`);
});
