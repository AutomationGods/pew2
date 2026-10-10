---
ai_description: >-
  Explain volatile outbox, daemon replay, reconnect behavior, and unsealed push snippets.
human_description: >-
  What happens when the phone goes offline, and what notifications do and do not guarantee.
---

# Offline, reconnect, and notifications

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## When the connection drops

The daemon runs on the computer, so putting the phone in your pocket does not itself stop the agent. The app retries connections with a delay using the route saved in its pairing: LAN or relay. It does not automatically fall back from one to the other. Returning from the background refreshes a socket that may look open locally but no longer reach the daemon.

On reconnect, the phone asks the **daemon**, not the relay, to replay session events after its last sequence. The daemon also announces current sessions and pending approvals. Replay is bounded: its live event log has a 10,000-event target per session in memory, retaining up to 11,000 before batched trimming. A restarted daemon or a gap beyond that window requires provider resume/history and transcript reconstruction; this is not an unlimited remote archive.

A computer that sleeps, loses its network, or stops the daemon cannot serve live work. Leave it awake for remote use. The relay cannot keep the agent running for it.

## Queued does not mean delivered

The phone can queue selected actions while disconnected or while a resumed session is still opening. Its outbox is **memory-only**: at most **25 entries**, with at most **24 MiB of encoded attachment characters** across entries. It is not a durable delivery log, and may be lost when the app process exits. It does not promise exactly-once delivery.

Queued prompts retain their intended conversation/project; they are not silently retargeted to whichever conversation you later open. Cancellation/control traffic is deliberately not replayed as ordinary delayed prompts. A full queue or a lost volatile draft needs your attention.

After an ambiguous disconnect, inspect the recovered conversation before resending. The agent may already have received a prompt even if the phone missed the reply. Do not force-quit the app expecting pending sends to survive.

## Notifications

With notification permission, the app can show local notices for finished turns or agent requests while its JavaScript is awake. Remote pushes require a native build configured with an EAS project and a successfully registered Expo push token. Fresh clones, simulators, denied permissions, and token/network failures may have no remote delivery. Notifications are best-effort, not a completion guarantee.

A notice for the conversation already on screen is suppressed. When a remote push is expected while backgrounded, the app avoids a duplicate local notice; a lost remote push is not necessarily backfilled. Tap a notice to open its conversation. Notification reply actions still need a working connection; they do not run the agent inside the push service.

**Privacy limit:** remote notifications send a readable title/body snippet and session id to **Expo**, which passes the notification through **APNs or FCM**. This path is separate from pew2's E2E-sealed session frames. Content can appear on the lock screen according to phone settings. Disable notification permission or previews if this is unsuitable for your work; hiding a lock-screen preview alone does not encrypt the payload sent to the push service.

## Source evidence

- [packages/app/src/reconnect.ts](../../../../packages/app/src/reconnect.ts) and [packages/app/src/connectionRecovery.ts](../../../../packages/app/src/connectionRecovery.ts) — retry and foreground refresh.
- [packages/app/src/outbox.ts](../../../../packages/app/src/outbox.ts) — memory budget; [packages/app/src/useDaemon.ts](../../../../packages/app/src/useDaemon.ts) — connection/subscribe flow.
- [packages/daemon/src/session/log.ts:30](../../../../packages/daemon/src/session/log.ts#L30) and [batched trimming:52](../../../../packages/daemon/src/session/log.ts#L52) — bounded in-memory replay.
- [packages/app/src/ui/push.ts](../../../../packages/app/src/ui/push.ts) — push prerequisites and failure fallback.
- [packages/daemon/src/push.ts](../../../../packages/daemon/src/push.ts) and [packages/daemon/src/push.ts](../../../../packages/daemon/src/push.ts) — plaintext push content and Expo request.
- [packages/app/src/notificationPolicy.ts](../../../../packages/app/src/notificationPolicy.ts) — local/remote deduplication policy.
