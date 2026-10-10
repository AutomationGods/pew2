---
type: entity
title: Mobile outbox
entity_type: module
path: packages/app/src/outbox.ts
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
  - offline
depends_on: []
used_by:
  - "[[library/knowledge/private/codebase-graph/entities/use-daemon]]"
related: []
sources:
  - packages/app/src/outbox.ts:31-123
  - packages/app/src/useDaemon.ts:716
---

# Mobile outbox

## Data contract
- Entries are either queued prompts or queued session starts. A prompt keeps its optimistic turn key, target session, text and attachments; a start keeps request/provider identity and optional cwd. (`packages/app/src/outbox.ts:31-64`)
- Starts address a pending-session key; prompts can initially address that pending session before the daemon assigns the real ID. (`packages/app/src/outbox.ts:35-40`, `packages/app/src/outbox.ts:88-95`)

## Capacity and durability
- The queue allows 25 entries and 24 MiB of encoded attachment string data. The byte accounting sums attachment `data.length`; it is not a cap on every byte of JS heap usage or queued text. (`packages/app/src/outbox.ts:66-104`)
- `enqueue` returns `undefined` rather than evicting older work when limits would be exceeded. (`packages/app/src/outbox.ts:114-123`)
- The queue lives in [[library/knowledge/private/codebase-graph/entities/use-daemon]] memory. It can bridge socket downtime while that state survives, but does not promise delivery after app termination/reload, nor exactly-once execution. (`packages/app/src/useDaemon.ts:716`, `packages/app/src/outbox.ts:66-123`)

## Evidence limits
Manual source reading, not an exercised offline-delivery test. Commit metadata identifies committed primary-source history only.
