---
ai_description: >-
  Explain CLI/service startup, provider sessions, replay, resource bounds and shared-desktop specialization.
human_description: >-
  Operate the Bun daemon and understand what survives disconnects or restarts.
---

# Daemon and CLI lifecycle

**Category:** Engineering | **Version:** 1.0 | **Date:** 2026-10-12 | **Status:** Active

## Entry points

`packages/daemon/src/cli/index.ts` dispatches `setup`, `doctor`, `pair`, `relay`, `detect`, `registry`, `providers`, `service`, and `serve`. There is no `pew2 update` or `pew2 trace` CLI command; updating is scheduled internally, and tracing is environment-controlled. The server entry can run directly under Bun or inside the compiled `pew2` binary. Supported service backends are macOS launchd, Linux systemd user service, and Windows Task Scheduler.

```sh
pew2 setup                 # probe providers and install background service
pew2 doctor --json         # health/diagnostic output
pew2 service status
pew2 service install       # register/restart through the platform backend
pew2 service uninstall     # remove the background service, not agent accounts
pew2 serve                 # foreground daemon; stop with the terminal signal
```

Uninstalling the service does not remove pairing or provider data. Restarting the daemon ends its in-memory sessions; wait for active work to finish before doing it deliberately. A manually launched daemon is not automatically made durable by `serve`.

## Server startup and transports

The server installs shutdown handlers, sweeps recorded orphan children, loads pairing, creates the daemon and provider registry, and starts the LAN WebSocket/health server on `PEW2_PORT` (default 8787). A configured relay gets a separate reconnecting client. Both routes pass authenticated, decrypted application messages into `handleMessage()`.

Provider refresh occurs at startup and on hello. CLI enable/disable writes preferences read on the next refresh. Do not assume arbitrary manifest edits trigger an immediate file-watch refresh. Availability means more than schema validity: executable presence, required environment, user-disabled state, and ACP capability probing contribute. The app receives provider snapshots, cached capabilities/history, active sessions and session state. Probes and warm handles reduce latency but are not additional durable sessions.

## Session lifecycle

- New/resumed sessions resolve their cwd through `resolveWorkspace()` and the client's named-project validation. A daemon under launchd must never default an agent to `/`.
- `connectProvider()` launches a subprocess and initializes ACP, handling stdio, permissions, config/modes, session creation/load and provider-specific compatibility.
- `SessionLog` assigns monotonically increasing event sequences and has a **10,000-event target** per live session in memory, retaining up to **11,000** before batched trimming. `subscribe(sessionId, after)` replays from the daemon, then carries live state and pending permission requests. Disk transcript caches are a separate representation, not this replay ring.
- Session cleanup always uses `closeSession()`: clear replay timer, close handle, discard attachment temp files, and remove the live session. The caller batches the resulting provider snapshot.
- Idle expiry is **15 minutes**, examined every **2 minutes**. A session blocked on permission can expire after **1 hour** without answering the request. LRU trimming targets **4 live sessions**, but protects opening/running/permission-waiting sessions; it is not an absolute concurrency rejection threshold.
- Provider history and transcript caches allow reopening where supported; process restart does not promise to resume an interrupted tool execution exactly where it stopped.

## Shared desktop is a separate contract

`ggcoder-desktop` resolves `ggcoder-desktop-acp`. Its shared-desktop adapter reads `_meta.ggDesktopWorking`, `_meta.ggDesktopClosedAsks`, and `_meta.ggDesktopAskId` to coordinate desktop work and permission state. Apply this special behavior only to that integration, not all ACP providers.

## Updating safely

Automatic replacement requires an eligible compiled build and installed supervisor. The scheduler first checks after **5 minutes**, then every **6 hours**; restart waits for a quiet daemon (no working turn, pending permission, or session still opening). Source mode must never replace the developer's Bun executable. See [release operations](../operations/releases.md).

## Source evidence

- [packages/daemon/src/server.ts](../../../../packages/daemon/src/server.ts) — startup/orphan sweep; [packages/daemon/src/server.ts](../../../../packages/daemon/src/server.ts) — shutdown.
- [packages/daemon/src/cli/service.ts](../../../../packages/daemon/src/cli/service.ts) — platform dispatch.
- [packages/daemon/src/workspace.ts](../../../../packages/daemon/src/workspace.ts) and [packages/daemon/src/handler.ts](../../../../packages/daemon/src/handler.ts) — cwd rules.
- [packages/daemon/src/acp/connect.ts](../../../../packages/daemon/src/acp/connect.ts) — ACP connection; [packages/daemon/src/acp/launch.ts](../../../../packages/daemon/src/acp/launch.ts) — process launch; [packages/daemon/src/acp/sharedDesktop.ts](../../../../packages/daemon/src/acp/sharedDesktop.ts) — shared extensions.
- [packages/daemon/src/session/log.ts:30](../../../../packages/daemon/src/session/log.ts#L30) and [batched trimming:52](../../../../packages/daemon/src/session/log.ts#L52) — replay bound; [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — subscribe.
- [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — lifecycle constants; [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — centralized close.
- [packages/daemon/src/update/scheduler.ts](../../../../packages/daemon/src/update/scheduler.ts) — update gate.
