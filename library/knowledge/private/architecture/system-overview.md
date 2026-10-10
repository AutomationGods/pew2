---
ai_description: >-
  Describe package ownership and verified trust boundaries; prefer executable behavior over stale comments.
human_description: >-
  How phone, daemon, protocol, agents, relay, and push fit together.
---

# System architecture

**Category:** Engineering | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

```text
Expo phone -- sealed WebSocket frames --> Bun daemon -- ACP stdio --> agent
     |                                      |
     +---- Cloudflare relay (optional) ------+
                                            +-- Expo Push --> APNs / FCM --> phone
```

The relay is an alternative transport, not an agent runtime, history database, or cryptographic endpoint. Push is a separate notification path and does not inherit session-frame encryption.

## Ownership

| Package | Responsibility | Read next |
| --- | --- | --- |
| `packages/app` | Pairing, connection recovery, volatile outbox, conversation projection, approvals, attachments, native notifications and UI. | [Client architecture](../app/client-architecture.md) |
| `packages/daemon` | CLI/service lifecycle, provider discovery, ACP processes, workspace checks, event sequencing/replay, history/cache, relay connection and push sending. | [Daemon lifecycle](../daemon/lifecycle.md) |
| `packages/protocol` | Zod manifest/wire contracts, crypto and SecureChannel shared by endpoints, common notification wording. | [Wire and encryption](../protocol/wire-and-encryption.md) |
| `packages/relay` | Cloudflare Worker route and hibernating `PairingRoom` Durable Object: admission, forwarding, keepalives and stale-peer cleanup. | [Relay operations](../relay/operations.md) |

## One prompt, end to end

1. Phone loads the pairing and its locally generated device id, opens LAN or relay, and proves possession of the root key in a handshake.
2. Daemon enforces first-claim identity and seals its provider/session snapshot back to the phone.
3. Client selects a known project; daemon validates the request and starts or resumes the provider's ACP session.
4. Prompt/attachments become ACP blocks or temporary file references. Agent notifications and permission requests become sequenced daemon events.
5. The daemon keeps a bounded in-memory event log. The phone reduces received/replayed events into transcript state and requests more history/resume when needed.
6. A completed turn or attention request may also produce an Expo push with a readable snippet. Tapping it routes the phone back to a session; it is not session replay.

## Boundaries and limits

- **Pairing is first claim, not account authentication.** A stolen root key plus the claimed device id defeats the identity distinction. Leakage before first use requires rotation. The legacy `phone` claim is not considered a real device claim.
- **Payload confidentiality is not metadata anonymity.** Relay room, role/device routing, envelope session/sequence/counter fields, traffic timing and sizes remain observable. The relay can drop/delay traffic even though it cannot decrypt or alter authenticated content successfully.
- **Daemon is trusted.** It sees plaintext, starts agents with user privileges, writes caches/temp files, and exposes selected filesystem operations. Browser/path containment is not process sandboxing.
- **Persistence has multiple owners.** Agent history and daemon transcript caches support resume; the live event log and phone outbox are in memory. The relay stores no session event log. An old rationale in `crypto.ts` describing relay replay is stale; `session/log.ts`, `subscribe()` and relay forwarding are the operative behavior.
- **Push leaves the E2E boundary.** Expo/APNs/FCM receive notification payloads. Do not describe all traffic as end-to-end encrypted.
- **Audience labels are not permissions.** `library/knowledge/private` is engineering documentation in the repository, not a protected vault.

## Source evidence

- [packages/daemon/src/handler.ts](../../../../packages/daemon/src/handler.ts) — shared validated message handler.
- [packages/daemon/src/acp/connect.ts](../../../../packages/daemon/src/acp/connect.ts) — ACP process lifecycle.
- [packages/daemon/src/session/log.ts:30](../../../../packages/daemon/src/session/log.ts#L30) and [batched trimming:52](../../../../packages/daemon/src/session/log.ts#L52) and [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — event storage and subscription.
- [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — forwarding without event persistence.
- [packages/daemon/src/device-claim.ts](../../../../packages/daemon/src/device-claim.ts) — identity gate.
- [packages/daemon/src/push.ts](../../../../packages/daemon/src/push.ts) — external notification request.
