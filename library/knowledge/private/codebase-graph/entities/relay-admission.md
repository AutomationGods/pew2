---
type: entity
title: Relay admission policy
entity_type: module
path: packages/relay/src/admission.ts
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
  - relay
  - admission
depends_on: []
used_by:
  - "[[library/knowledge/private/codebase-graph/entities/pairing-room]]"
related: []
sources:
  - packages/relay/src/admission.ts:30-161
  - packages/relay/src/index.ts:30-190
---

# Relay admission policy

## Contract
- A newer daemon connection does not automatically evict an existing live daemon. When a last-seen timestamp exists, the newcomer is refused through the 90-second stale window; an older or missing timestamp permits replacement, subject to the other admission checks. (`packages/relay/src/admission.ts:88-145`)
- This favors protecting the current daemon over immediate reconnect replacement: a reconnecting machine may be refused until the stale window expires. Room identity alone is not proof of possession of the E2E key. (`packages/relay/src/admission.ts:30-161`, `packages/protocol/src/channel.ts:177-186`)
- [[library/knowledge/private/codebase-graph/entities/pairing-room]] applies admission at the WebSocket boundary; end-to-end device proof and persistent first-claim ownership are checked by the daemon, not inferred from relay admission. (`packages/relay/src/index.ts:30-190`, `packages/daemon/src/server.ts:292-330`, `packages/daemon/src/relay-client.ts:274-312`)

## Evidence limits
Manual source reading, not an exercised replacement/hibernation test. No production relay was contacted. Commit metadata describes committed primary-source history only.
