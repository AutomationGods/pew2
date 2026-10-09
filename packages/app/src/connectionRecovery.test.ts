import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foregroundState, prepareReconnect } from "./connectionRecovery";

for (const states of [["background", "active"], ["background", "inactive", "active"]]) {
  test(`foreground recovery refreshes an apparently open socket: ${states.join(" → ")}`, () => {
    let backgrounded = false;
    let closes = 0;
    const socket: { readyState: number; onclose: (() => void) | null; close(): void } = {
      readyState: WebSocket.OPEN,
      onclose: null,
      close: () => { closes++; expect(socket.onclose).toBeNull(); },
    };
    // The old handler must not schedule another reconnect after replacement.
    socket.onclose = () => { throw new Error("Retired socket reconnected"); };
    for (const state of states) {
      const next = foregroundState(backgrounded, state);
      backgrounded = next.backgrounded;
      if (state === "active") expect(prepareReconnect(socket, next.refresh)).toBe(true);
    }
    expect(closes).toBe(1);
    expect(backgrounded).toBe(false);
  });
}

test("retired socket callbacks are detached before closing", () => {
  const handler = () => { throw new Error("Retired callback ran"); };
  const socket = {
    readyState: WebSocket.OPEN,
    onopen: handler, onmessage: handler, onclose: handler, onerror: handler,
    close: (): void => {
      expect(socket.onopen).toBeNull();
      expect(socket.onmessage).toBeNull();
      expect(socket.onclose).toBeNull();
      expect(socket.onerror).toBeNull();
    },
  };
  expect(prepareReconnect(socket, true)).toBe(true);
});

test("a native picker or notification does not replace a healthy foreground socket", () => {
  let backgrounded = false;
  for (const state of ["inactive", "active"]) {
    const next = foregroundState(backgrounded, state);
    backgrounded = next.backgrounded;
    expect(next.refresh).toBe(false);
  }
  const socket = { readyState: WebSocket.OPEN, onclose: null, close: () => { throw new Error("Closed healthy socket"); } };
  expect(prepareReconnect(socket, false)).toBe(false);
});

test("a stalled connecting socket and a missing socket can be retried", () => {
  let closes = 0;
  const socket = { readyState: WebSocket.CONNECTING, onclose: null, close: () => { closes++; } };
  expect(prepareReconnect(socket, false)).toBe(false);
  expect(closes).toBe(0);
  expect(prepareReconnect(socket, true)).toBe(true);
  expect(closes).toBe(1);
  expect(prepareReconnect(null, false)).toBe(true);
});

// Policy tests above do not execute React Native's AppState. Check that the
// hook uses this policy, without treating source wiring as a native reboot test.
test("the daemon hook uses the foreground policy before reconnecting", () => {
  const hook = readFileSync(join(import.meta.dir, "useDaemon.ts"), "utf8");
  const app = readFileSync(join(import.meta.dir, "../App.tsx"), "utf8");
  expect(app).toContain("foregroundState(backgrounded, state)");
  expect(app).toContain("resumeDaemon(next.refresh)");
  expect(hook).toContain("if (!prepareReconnect(ws, refreshOpen)) return;");
});
