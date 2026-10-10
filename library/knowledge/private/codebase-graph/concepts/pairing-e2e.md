---
type: concept
title: Pairing and E2E boundaries
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
git_metadata_scope: repository HEAD baseline, not a working-tree content hash
extraction: manual-source-read
partial_scan: true
tags:
  - concept
  - pairing
  - security
related: []
sources:
  - packages/app/src/pairing.ts:30-81
  - packages/daemon/src/device-claim.ts:18-27
  - packages/daemon/src/device-claim.ts:107-137
  - packages/daemon/src/server.ts:292-330
  - packages/protocol/src/crypto.ts:89-121
  - packages/protocol/src/crypto.ts:133-196
  - packages/daemon/src/push.ts:140-160
---

# Pairing and E2E boundaries

## Identity and first claim
1. The app creates a random install ID and stores pairing material in SecureStore. Stored pairing links retain their key fragment; loading re-parses them. (`packages/app/src/pairing.ts:30-81`)
2. A daemon transport verifies cryptographic proof, applies device admission, then admits the [[library/knowledge/private/codebase-graph/entities/secure-channel]] sender. (`packages/daemon/src/server.ts:292-330`, `packages/daemon/src/relay-client.ts:274-312`)
3. `decideClaim` admits the first real identity and later matching identities. Legacy `phone` and CLI watcher identities are admitted without taking ownership; the watcher prefix is not a separate security boundary. (`packages/daemon/src/device-claim.ts:67-78`, `packages/daemon/src/device-claim.ts:107-137`)

First claim is trust-on-first-use, not a device-bound asymmetric credential. A leaked key plus claimed ID can impersonate that identity; an attacker arriving first can win the claim. Rotate leaked material with `pew2 pair --rotate`, rather than merely rescanning the same link. (`packages/daemon/src/device-claim.ts:18-27`, `packages/daemon/src/device-claim.ts:95-98`)

## Encryption boundary
- Room identity and traffic keys are derived separately; traffic directions use separate keys. (`packages/protocol/src/crypto.ts:89-121`)
- Session payloads are sealed using XChaCha20-Poly1305. Session ID, sequence and counter are visible authenticated envelope metadata, not encrypted transcript content. (`packages/protocol/src/crypto.ts:133-196`)
- [[library/knowledge/private/codebase-graph/entities/pairing-room]] forwards frames, while daemon admission checks the proof. Knowing a room identifier is not equivalent to proving the E2E key. (`packages/relay/src/index.ts:202-330`, `packages/daemon/src/relay-client.ts:274-312`)

## Explicit exception
[[library/knowledge/private/codebase-graph/entities/push]] submits notification title/body, token and session metadata as ordinary JSON to the push service. This is outside the sealed session channel; HTTPS does not make that payload end-to-end encrypted against the push service. (`packages/daemon/src/push.ts:140-160`, `packages/daemon/src/push.ts:200-210`)

## Documentation audience
`private/` is this documentation's audience convention, not an access-control mechanism. Do not place pairing secrets or runtime credentials here. This page is source-read documentation, not a security audit or evidence of platform verification.
