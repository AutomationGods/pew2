---
ai_description: >-
  Give practical diagnosis tied to CLI, relay and app implementation; avoid destructive reset advice.
human_description: >-
  Find the cause of pairing, provider, session, attachment, or notification problems.
---

# Troubleshooting

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

Start on the computer:

```sh
pew2 --version
pew2 doctor
pew2 providers list
pew2 service status
```

`pew2 doctor --json` produces structured diagnostics. Review/redact output before posting it: machine paths, agent names, and error messages can reveal private information. Never post a pairing QR/URL, token, or a full unreviewed log.

| Symptom | Check and next step |
| --- | --- |
| Phone cannot connect | Confirm the computer is awake and `pew2 doctor` can reach the daemon. On LAN, verify both devices can reach the same network and port; guest Wi-Fi/VPN/firewall isolation may block it. For remote use configure `pew2 relay <url>`, restart the daemon, and pair again. |
| Pairing already in use | It is claimed by another device identity. If this is a replacement/reinstalled phone, run `pew2 pair --rotate`, restart any manually launched daemon, and scan the new code. Do not reuse a leaked old code. |
| Relay refuses the restarted daemon | The previous socket may still be considered live. Allow the **90-second stale-daemon window** to expire and let reconnect retry. Starting more daemon processes or shortening the window is not a safe fix. |
| Provider absent | Check `pew2 providers list`, install/authenticate that agent on the computer, and use `pew2 providers enable <id>` if intentionally disabled. Run `pew2 setup` to probe readiness. The experimental echo fixture is hidden unless enabled. |
| Works in a terminal, not in the service | The background service's PATH/environment may differ from your interactive shell. See [configuration](../../private/operations/configuration-data.md); setup does not copy arbitrary API-key variables into all service definitions. |
| Gemini refuses to start | The current manifest requires `GEMINI_API_KEY` in the daemon environment. Treat the actual manifest and agent error as the authority, not an old OAuth-only setup recipe. |
| Old transcript visible, send still waiting | A cache can render before agent resume completes. Wait for reconnect and inspect the conversation before retrying a prompt; avoid duplicate work. |
| Approval no longer visible | Reconnect to request the current snapshot. A daemon restart or an hour-long blocked-session cleanup can end the original session; reopen it and inspect the agent's state rather than assuming approval happened. |
| Project missing | Use **Browse folders**. Only advertised/history paths and permitted browser roots can be selected. External locations may need operator configuration. |
| Attachment rejected | Remove files until within the decoded-byte size/count limits, or export a smaller image. Check camera/file permissions. See [attachments](../guides/attachments.md). |
| No push notification | Check permission, build EAS configuration, connectivity and successful push registration. An open conversation intentionally suppresses duplicate notices. Do not infer task failure from a missing banner. |
| Update does not apply | Check `pew2 --version` and daemon logs. Automatic apply needs an eligible compiled binary and installed supervisor; running turns/open approvals defer restart. Source installs are not self-replaced. Re-running the installer is the manual update path; there is no `pew2 update` command. |

## Logs and escalation

Daemon logs live under `$PEW2_HOME/logs` or `~/.pew2/logs`. Opt-in `PEW2_LOG_LEVEL=silly` tracing records allowlisted metadata, not raw frame bodies. There is no `pew2 trace` command. Ordinary logs and provider errors still need review before sharing. Use a minimal reproduction with no credentials or customer data.

Share the command that failed, versions, OS, chosen provider, whether LAN or relay was used, and a small redacted error excerpt. Pairing and provider authentication are separate: rotating a QR will not fix a vendor login failure.

## Source evidence

- [packages/daemon/src/cli/index.ts](../../../../packages/daemon/src/cli/index.ts) — CLI dispatch.
- [packages/daemon/src/device-claim.ts](../../../../packages/daemon/src/device-claim.ts) — refusal and recovery message.
- [packages/relay/src/admission.ts](../../../../packages/relay/src/admission.ts) — stale threshold.
- [packages/daemon/src/cli/service.ts](../../../../packages/daemon/src/cli/service.ts) — service environment selection.
- [packages/daemon/src/trace.ts](../../../../packages/daemon/src/trace.ts) — trace options.
- [packages/daemon/src/update/scheduler.ts](../../../../packages/daemon/src/update/scheduler.ts) — automatic update gate.

[Documentation home](../../../README.md)
