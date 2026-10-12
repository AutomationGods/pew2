---
type: entity
title: SecureChannel
entity_type: class
path: packages/protocol/src/channel.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: 3c45b499b7ead50a22cda93bfcaac60df3dc9b13
last_commit_author: kenkaiii
last_commit_date: 2026-08-07
extraction: manual-source-read
partial_scan: true
tags:
  - entity
  - protocol
  - security
depends_on: []
used_by: []
related: []
sources:
  - packages/protocol/src/channel.ts:122-174
  - packages/protocol/src/channel.ts:185-251
  - packages/protocol/src/channel.ts:269-287
  - packages/daemon/src/server.ts:292-330
---

# SecureChannel

## Contract
- Constructor selects distinct directional send/receive keys. `seal` owns the outbound counter and increments it per envelope. (`packages/protocol/src/channel.ts:122-139`)
- `open` selects an already-admitted sender window, authenticates/decrypts, then applies that sender's replay counter. Unknown senders, decryption failures and replay failures return `undefined`. (`packages/protocol/src/channel.ts:153-174`)
- A proof carries device identity and timestamp. `verifyProof` checks decrypted shape, finite time within skew, matching identity, and a timestamp newer than the last accepted proof for that device. (`packages/protocol/src/channel.ts:185-223`)
- `acceptHandshake` consumes proof state before resetting a sender window; accepting an identified device removes the unlabelled sender bucket. (`packages/protocol/src/channel.ts:241-251`)

## Separate ownership gate
Cryptographic proof does not itself implement persistent first-device ownership. LAN handling verifies proof, checks `admitDevice`, then accepts the channel handshake. (`packages/daemon/src/server.ts:292-330`)

## Stale rationale
The relay-owned replay explanation beside `envelopeHeader` and in the crypto envelope comments is stale. Actual replay is assembled by the daemon; the relay forwards frames without retaining the event log. (`packages/protocol/src/channel.ts:269-287`, `packages/protocol/src/crypto.ts:127-139`, `packages/daemon/src/index.ts:2080-2117`, `packages/relay/src/index.ts:202-226`)

## Evidence limits
Manual source reading, not a cryptographic audit or AST extraction. Commit metadata describes committed primary-source history only.
