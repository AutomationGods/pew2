---
ai_description: >-
  Explain live Zod contract, sealed channel, handshake, replay ownership and security limits.
human_description: >-
  The shared phone-daemon protocol and what its encryption does not conceal.
---

# Protocol and E2E contract

**Category:** Engineering | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

`@pew2/protocol` is the shared endpoint dependency. `manifest.ts` validates provider definitions; `wire.ts` defines application requests/events; `crypto.ts` supplies key derivation, proofs, sealing and replay counters; `channel.ts` binds the handshake and bidirectional frame state. Add wire contracts here rather than copying types into app and daemon.

## Application families

The client union covers hello/envelopes, provider capabilities/history/configuration, session start/resume/prompt/cancel/configuration, permission replies, image fetches, workspace status/browsing/creation, and push registration. Reconnect cursors travel in hello; `subscribe()` is a daemon method, not a standalone client request. Inspect the current union for exact required fields; a TypeScript assertion on incoming JSON is not validation.

`handleMessage()` parses and validates once before dispatch. Invalid JSON, malformed known messages, and unknown message types are distinct errors. Filesystem and project authorization remain daemon checks after schema validation. A valid string is not automatically an authorized path.

## Sealed connection flow

1. Pairing provides a 32-byte root key; HKDF-SHA256 derives direction keys and a separate room id. The QR/link holds credentials and must be treated as secret.
2. `SecureChannel` derives directional keys from the pairing root key. The phone's hello carries a sealed proof containing a timestamp and device id; verification checks its identity, clock skew and newer proof timestamp before accepting a sender's replay-window reset. This is not a fresh challenge exchange or per-connection key negotiation.
3. Frames are JSON envelopes with ciphertext under XChaCha20-Poly1305. Associated data binds `sid`, `seq`, and `ctr`; mutation of those headers breaks authentication.
4. A counter rejects non-advancing frames within each tracked sender's replay window. Application event `seq` is a different concept: it selects the daemon's session replay position, not transport key freshness.

The relay sees the room id, roles/device routing, `sid`/`seq`/`ctr` headers where present, nonce/ciphertext, and traffic timing/size. It adds a `from` routing stamp so daemon-side channels can be selected. That stamp alone is not authentication; a valid sealed frame and handshake are still required.

## Claim and recovery limits

The daemon persists the first real device claim. A second identity holding the link is refused; the literal legacy `phone` id remains unclaimed. Someone with both the root key and claimed id can generate valid proofs. A pre-use leak can win the first claim. Rotation, plus reloading the running daemon key, is the revocation path.

`PEW2_TOKEN` derives a root key for controlled tests/containers. It has the entropy of the supplied value, is not a password-hardening mechanism, and does not persist the normal device claim across runs. Do not use a weak human password as a token.

Directional keys remain rooted in the pairing key across connections: there is **no forward secrecy**. Counter/proof state is not a durable, cross-restart anti-replay archive. Rotate a leaked key; do not treat reconnecting as key renewal.

## Replay and persistence

**Daemon-owned replay:** `SessionLog` stores events in memory with a 10,000-event target, retaining up to 11,000 before batched trimming and `subscribe()` sends those after the requested sequence. Provider history and daemon transcript caches separately support restoring conversations. The relay only forwards; it has no current event-log write path. The relay-log rationale in the comment at `crypto.ts:127` is outdated and must not be used as an architecture contract.

The phone's outbox is likewise memory-only (25 entries, 24 MiB encoded attachment characters). Encryption and counters do not turn it into durable/exactly-once delivery.

## Out-of-band content

Notification snippets are posted in plaintext-within-HTTPS to Expo for APNs/FCM delivery, not as pew2 sealed envelopes. Local transcript/cache/attachment files and agent-owned histories are also outside the transport-encryption claim. See [data locations](../operations/configuration-data.md).

## Source evidence

- [packages/protocol/src/wire.ts](../../../../packages/protocol/src/wire.ts) — envelope and client union.
- [packages/protocol/src/crypto.ts](../../../../packages/protocol/src/crypto.ts) — token derivation; [packages/protocol/src/crypto.ts](../../../../packages/protocol/src/crypto.ts) — associated data/seal.
- [packages/protocol/src/channel.ts](../../../../packages/protocol/src/channel.ts) — handshake/channel implementation.
- [packages/daemon/src/handler.ts](../../../../packages/daemon/src/handler.ts) — validation and dispatch.
- [packages/daemon/src/device-claim.ts](../../../../packages/daemon/src/device-claim.ts) and [packages/daemon/src/pairing.ts](../../../../packages/daemon/src/pairing.ts) — claim enforcement/persistence.
- [packages/daemon/src/session/log.ts:30](../../../../packages/daemon/src/session/log.ts#L30) and [batched trimming:52](../../../../packages/daemon/src/session/log.ts#L52), [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts), [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — actual replay ownership.
- [packages/daemon/src/push.ts](../../../../packages/daemon/src/push.ts) — separate push path.
