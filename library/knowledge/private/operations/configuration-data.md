---
ai_description: >-
  Identify verified configuration inputs and data owners without reading local credentials or promising at-rest encryption.
human_description: >-
  Find daemon settings, caches and logs, and understand what restarting or rotating changes.
---

# Configuration and data locations

**Category:** Engineering / Operations | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## Configuration

| Input | Behavior |
| --- | --- |
| `PEW2_HOME` | Daemon data root; defaults to `~/.pew2`. It is not the agent's workspace. |
| `PEW2_PORT` | LAN daemon port, default 8787. |
| `PEW2_RELAY` | Overrides the relay saved in pairing state. Use `pew2 relay <url>` or `pew2 relay off` for stored configuration, then restart and re-pair. |
| `PEW2_WORKSPACE` | Default workspace when a request does not supply one; `resolveWorkspace()` owns fallback behavior. |
| `PEW2_BROWSE_ROOTS` | Opt-in additional browser roots; current parser splits on `:`. Do not assume Windows drive-list syntax works unchanged. |
| `PEW2_IMAGE_ROOTS` | Opt-in image-access roots; filesystem containment is not an agent sandbox. |
| `PEW2_EXPERIMENTAL` | Exposes experimental provider fixtures; CLI setup/service installation also accepts `--experimental`. |
| `PEW2_LOG_LEVEL=silly` | Enables allowlisted metadata tracing. This is not a raw transcript tracing switch. |
| `PEW2_TOKEN` | Operator/test override deriving pairing keys from a supplied value. Normal pairing-file claim persistence does not apply. Never use a weak password or put this value into documentation. |

Services do not necessarily inherit your shell environment. For example, the launchd definition explicitly builds PATH, HOME, port and selected pew2 settings; it does not copy arbitrary vendor API-key variables. Diagnose an agent that works only in a terminal by comparing its runtime environment, without publishing credentials.

## Data owners

Paths below are relative to the daemon data root unless otherwise noted.

| Location / owner | Contents and caution |
| --- | --- |
| `pairing.json` | Root key, derived routing token, relay and claimed-device state. Treat as credentials. |
| `providers/` | User-written provider manifests, which can direct executable launch. Review changes as trusted configuration. |
| `config-prefs.json`, `session-prefs.json` | Agent configuration/session preferences. Not an event log. |
| `cache/<providerId>.json` | Probe/capability/history snapshot cache. Stale cache is not evidence an agent is currently available. |
| `cache/transcripts/<providerId>/…json` | Cached conversation content for reconstruction. Transport sealing does not encrypt these local files. |
| `logs/daemon.log`, `logs/daemon.error.log` | Service logs; inspect and redact before sharing. |
| OS temporary directory, `pew2-attachments/<session>/` | Materialized prompt files. Normal session close removes session attachments; do not rely on this as secure erasure or backup. |
| Agent-owned storage | Vendor credentials and conversation history remain controlled by that agent. Removing pew2 state does not remove them. |
| Phone SecureStore | Pairing/device identity and local provider/project/appearance preferences. This is separate from the volatile outbox. |
| Daemon/phone memory | Bounded daemon event replay and phone outbox. Neither is a durable delivery database. |

The relay retains transport bookkeeping for sockets/hibernation, not a session transcript archive. Optional push sends readable snippets to Expo/APNs/FCM; see [notification limits](../../public/guides/connectivity-notifications.md).

## Change safely

Do not delete the data root as a generic troubleshooting step: it can discard pairing and cached history. Use [pairing rotation](../../public/guides/getting-started.md) to replace a key and [diagnostics](../../public/faqs/troubleshooting.md) to narrow a failure. Stop/restart deliberately around manual configuration changes and confirm the running process actually loaded the intended settings.

## Source evidence

- [Pairing](../../../../packages/daemon/src/pairing.ts) — `pairingPath()`, `loadPairing()`, environment precedence and claim persistence.
- [Registry](../../../../packages/daemon/src/providers/registry.ts), [workspace resolution](../../../../packages/daemon/src/workspace.ts), [browser roots](../../../../packages/daemon/src/workspaces.ts), [image access](../../../../packages/daemon/src/images.ts).
- [Configuration preferences](../../../../packages/daemon/src/config-prefs.ts), [session preferences](../../../../packages/daemon/src/session-prefs.ts), [probe cache](../../../../packages/daemon/src/probe-cache.ts), [transcript cache](../../../../packages/daemon/src/transcript-cache.ts) — path constructors.
- [Logs](../../../../packages/daemon/src/logs.ts), [trace](../../../../packages/daemon/src/trace.ts), [attachments](../../../../packages/daemon/src/attachments.ts) — storage/diagnostic boundaries.
- [Service environment](../../../../packages/daemon/src/cli/service.ts) — `buildPlist()`.
- [Phone pairing](../../../../packages/app/src/pairing.ts), [preferences](../../../../packages/app/src/preferences.ts), [outbox](../../../../packages/app/src/outbox.ts) — persistent versus volatile state.
