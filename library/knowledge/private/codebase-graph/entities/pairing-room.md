---
type: entity
title: PairingRoom routing boundary
entity_type: class
path: packages/relay/src/index.ts
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
  - transport
depends_on:
  - "[[library/knowledge/private/codebase-graph/entities/relay-admission]]"
used_by: []
related: []
sources:
  - packages/relay/src/index.ts:30-190
  - packages/relay/src/index.ts:202-330
  - packages/daemon/src/index.ts:2080-2117
---

# PairingRoom routing boundary

## Ownership
- The Worker/Durable Object boundary handles room WebSockets and applies [[library/knowledge/private/codebase-graph/entities/relay-admission]] before accepting/replacing connections. (`packages/relay/src/index.ts:30-190`)
- The room forwards application frames between daemon and app sockets. It handles routing/connection metadata but does not decrypt session contents or retain a transcript/event log for catch-up. (`packages/relay/src/index.ts:202-330`)
- Replay is served by the daemon's `catchUp`, including current working/config/permission state. A Durable Object transport does not make the session event log durable. (`packages/daemon/src/index.ts:2080-2117`, `packages/relay/src/index.ts:202-226`)

## Security boundary
Room membership must not be confused with E2E admission. The daemon relay client verifies the device proof and applies device admission before channel acceptance. (`packages/daemon/src/relay-client.ts:274-312`)

## Evidence limits
Manual source reading only. No Worker was deployed, relay server started, or hibernation/keepalive integration test run. Commit metadata describes committed primary-source history only.
