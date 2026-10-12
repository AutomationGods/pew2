/** Opt-in metadata diagnostics. Never serializes frames, argv, URLs, or errors. */
import { createHash } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, mkdirSync, openSync, renameSync, writeSync } from "node:fs";
import { dirname } from "node:path";

export type Trace = (event: string, fields?: Record<string, unknown>) => void;
export const noTrace: Trace = () => {};
export const TRACE_FILE_BYTES = 8 * 1024 * 1024;

const numbers = ["pid", "code", "seq", "count", "bytes", "ms", "attempt", "delayMs", "buffered", "connections", "events"] as const;
const booleans = ["authenticated", "working", "complete", "catchUp", "reused", "ok"] as const;
const identities = ["sessionId", "agentSessionId", "deviceId", "providerId", "connectionId"] as const;
const labels: ReadonlySet<string> = new Set([
  "lan", "relay", "initialize", "session/new", "session/load", "session/resume",
  "session.start", "session.resume", "session.prompt", "session.cancel", "session.end",
  "session.started", "session.event", "session.replay", "session.permission", "session.config",
  "provider.capabilities", "provider.sessions", "providers", "device.joined", "error", "ping", "pong",
  "agent_message_chunk", "agent_thought_chunk", "user_message_chunk", "tool_call", "tool_call_update",
  "plan", "available_commands_update", "config_option_update", "current_mode_update", "usage_update",
  "connecting", "online", "offline", "invalid-json", "invalid-message", "proof", "wire-version",
  "device-refused", "unproven", "decrypt-or-replay", "SIGTERM", "SIGKILL", "SIGINT", "SIGHUP",
  "exit", "user_message", "permission_request", "input", "session.idle", "session_info_update",
  "bad_json", "bad_message", "unknown_message", "command_failed", "resume_failed", "session_not_found",
  "workspace.status", "workspace", "start_failed", "session_error", "prompt_failed",
]);

/** Only explicitly allowed primitives leave this boundary, even if a caller passes a whole frame. */
export function createTrace({
  enabled = false,
  write,
  now = Date.now,
  limit = 500,
}: {
  enabled?: boolean;
  write: (line: string) => void;
  now?: () => number;
  limit?: number;
}): Trace {
  let window = -1;
  let written = 0;
  let suppressed = 0;
  let failed = false;
  return (event, fields = {}) => {
    if (!enabled || failed) return;
    try {
      const at = now();
      const second = Math.floor(at / 1000);
      if (second !== window) {
        if (suppressed) write(JSON.stringify({ at, level: "silly", event: "trace.suppressed", count: suppressed }) + "\n");
        window = second;
        written = 0;
        suppressed = 0;
      }
      if (written++ >= limit) { suppressed++; return; }
      const record: Record<string, unknown> = { at, level: "silly", event: /^[a-z.-]{1,64}$/.test(event) ? event : "other" };
      for (const key of numbers) {
        const value = fields[key];
        if (typeof value === "number" && Number.isFinite(value)) record[key] = value;
      }
      for (const key of booleans) if (typeof fields[key] === "boolean") record[key] = fields[key];
      for (const key of identities) {
        const value = fields[key];
        if (typeof value === "string" && value.length > 0 && value.length <= 4096) {
          record[`${key}Hash`] = createHash("sha256").update(value).digest("hex").slice(0, 16);
        }
      }
      for (const key of ["transport", "method", "type", "updateType", "reason", "status", "signal", "kind", "errorCode"] as const) {
        const value = fields[key];
        if (typeof value === "string") record[key] = labels.has(value) ? value : "other";
      }
      write(JSON.stringify(record) + "\n");
    } catch {
      // A full disk or closed diagnostic sink must never affect a conversation.
      failed = true;
    }
  };
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

/** Summarize routing/replay state without retaining message contents. */
export function traceMessage(trace: Trace, event: string, value: unknown, extra: Record<string, unknown> = {}): void {
  if (trace === noTrace) return;
  const message = object(value);
  const payload = object(message.payload);
  const update = object(payload.update ?? message.update);
  trace(event, {
    ...extra,
    type: message.t,
    sessionId: message.sessionId,
    providerId: message.providerId,
    seq: message.seq,
    working: message.working,
    complete: message.complete,
    catchUp: message.catchUp,
    events: Array.isArray(message.events) ? message.events.length : undefined,
    updateType: update.sessionUpdate,
    kind: payload.kind,
    code: payload.code,
    errorCode: message.code,
  });
}

/** Two bounded, owner-only files. Refuse symlinks and never alter normal daemon logs. */
export function openTraceFile(path: string, maxBytes = TRACE_FILE_BYTES): { write: (line: string) => void; close: () => void } {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const open = () => {
    const fd = openSync(path, constants.O_APPEND | constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || (process.getuid && stat.uid !== process.getuid())) throw new Error("Invalid trace file");
      fchmodSync(fd, 0o600);
      return fd;
    } catch (error) { closeSync(fd); throw error; }
  };
  let fd: number | undefined = open();
  let size = fstatSync(fd).size;
  return {
    write(line) {
      if (fd === undefined) throw new Error("Trace file is closed");
      const bytes = Buffer.from(line);
      if (bytes.length > maxBytes) return;
      if (size + bytes.length > maxBytes) {
        closeSync(fd);
        fd = undefined;
        renameSync(path, `${path}.1`);
        fd = open();
        size = 0;
      }
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
      size += bytes.length;
    },
    close() {
      if (fd !== undefined) closeSync(fd);
      fd = undefined;
    },
  };
}
