import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTrace, openTraceFile, traceMessage } from "./trace.js";

test("tracing is off by default", () => {
  const lines: string[] = [];
  createTrace({ write: (line) => lines.push(line) })("wire.in", { type: "session.prompt" });
  expect(lines).toEqual([]);
});

test("silly records routing metadata, never credentials, text, paths or raw identities", () => {
  const lines: string[] = [];
  const trace = createTrace({ enabled: true, now: () => 1000, write: (line) => lines.push(line) });
  const secret = "do-not-log-this-secret";
  traceMessage(trace, "wire.in", {
    t: "session.prompt", sessionId: secret, text: secret, token: secret, key: secret,
    seq: 12, working: true, payload: { update: { sessionUpdate: "agent_message_chunk", content: { text: secret } } },
  }, { url: secret, argv: [secret], error: new Error(secret), reason: secret, pid: 42 });
  const record = JSON.parse(lines[0] ?? "null");
  expect(record).toMatchObject({ level: "silly", at: 1000, event: "wire.in", type: "session.prompt", seq: 12, working: true, pid: 42, reason: "other", updateType: "agent_message_chunk" });
  expect(record.sessionIdHash).toMatch(/^[a-f0-9]{16}$/);
  expect(lines.join("")).not.toContain(secret);
});

test("rate limiting is shared by the injected trace and reports suppression", () => {
  let now = 1000;
  const lines: string[] = [];
  const trace = createTrace({ enabled: true, now: () => now, limit: 2, write: (line) => lines.push(line) });
  trace("acp.update"); trace("wire.out"); trace("wire.out"); trace("wire.out");
  expect(lines).toHaveLength(2);
  now = 2000;
  trace("transport.close");
  expect(lines.map((line) => JSON.parse(line))).toMatchObject([
    { event: "acp.update" }, { event: "wire.out" }, { event: "trace.suppressed", count: 2 }, { event: "transport.close" },
  ]);
});

test("sink failure never throws into a connection", () => {
  let attempts = 0;
  const trace = createTrace({ enabled: true, write: () => { attempts++; throw new Error("disk full"); } });
  expect(() => { trace("wire.in"); trace("wire.in"); }).not.toThrow();
  expect(attempts).toBe(1);
});

test("trace files rotate within the byte limit, retain complete lines, and are private", () => {
  const dir = mkdtempSync(join(tmpdir(), "pew-trace-"));
  const path = join(dir, "trace.log");
  const sink = openTraceFile(path, 12);
  try {
    sink.write("first\n"); sink.write("second\n"); sink.write("third\n");
    expect(statSync(path).size).toBeLessThanOrEqual(12);
    expect(statSync(`${path}.1`).size).toBeLessThanOrEqual(12);
    expect(readFileSync(path, "utf8")).toBe("third\n");
    expect(readFileSync(`${path}.1`, "utf8")).toBe("second\n");
    expect(statSync(path).mode & 0o777).toBe(0o600);
    sink.close();
    expect(() => sink.write("closed\n")).toThrow();
  } finally { sink.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("trace refuses to follow a symlink", () => {
  const dir = mkdtempSync(join(tmpdir(), "pew-trace-link-"));
  try {
    const target = join(dir, "unrelated");
    writeFileSync(target, "unchanged");
    symlinkSync(target, join(dir, "trace.log"));
    expect(() => openTraceFile(join(dir, "trace.log"))).toThrow();
    expect(readFileSync(target, "utf8")).toBe("unchanged");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
