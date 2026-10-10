---
type: entity
title: useDaemon client state boundary
entity_type: module
path: packages/app/src/useDaemon.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
last_commit_author: AutomationGod
last_commit_date: 2026-10-08
extraction: manual-source-read
partial_scan: true
tags:
  - entity
  - app
  - state
  - transport
depends_on:
  - "[[library/knowledge/private/codebase-graph/entities/outbox]]"
used_by:
  - "[[library/knowledge/private/codebase-graph/entities/mobile-app]]"
related: []
sources:
  - packages/app/src/useDaemon.ts:599-716
  - packages/app/src/useDaemon.ts:1123-1195
  - packages/app/App.tsx:459-475
---

# useDaemon client state boundary

## Ownership
- `useDaemon` owns the mobile-side session/transport state and an in-memory outbox reference. It is the app's synchronization boundary, not the process owner. (`packages/app/src/useDaemon.ts:599-716`, `packages/daemon/src/acp/connect.ts:563-591`)
- Connection handling sends the device identity, cryptographic proof and replay cursors in the hello exchange, then processes received frames through the client channel. (`packages/app/src/useDaemon.ts:1123-1195`)
- Offline work uses [[library/knowledge/private/codebase-graph/entities/outbox]] entries held by the hook. This queue is not persisted across process termination. (`packages/app/src/useDaemon.ts:716`, `packages/app/src/outbox.ts:66-123`)

## Consumer
[[library/knowledge/private/codebase-graph/entities/mobile-app]] consumes the hook's state/actions. Agent execution remains in the daemon. (`packages/app/App.tsx:459-475`, `packages/daemon/src/acp/connect.ts:563-591`)

## Evidence limits
Manual source reading only; no reconnection, background suspension or state-race test was run for this documentation. Commit metadata denotes committed primary-source history only.
