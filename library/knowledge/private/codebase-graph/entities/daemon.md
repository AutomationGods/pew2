---
type: entity
title: Daemon session lifecycle
entity_type: class
path: packages/daemon/src/index.ts
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
  - daemon
  - lifecycle
depends_on:
  - "[[library/knowledge/private/codebase-graph/entities/acp-connection]]"
  - "[[library/knowledge/private/codebase-graph/entities/session-log]]"
used_by: []
related: []
sources:
  - packages/daemon/src/index.ts:1028-1106
  - packages/daemon/src/index.ts:1246-1308
  - packages/daemon/src/index.ts:1666-1692
  - packages/daemon/src/index.ts:2080-2133
---

# Daemon session lifecycle

## Ownership
- The daemon appends agent updates to its per-session log. Live delivery either sends individual events or batches streaming replay; this is daemon-owned state, not relay storage. (`packages/daemon/src/index.ts:1246-1273`)
- `markLive` publishes retained history after the session is introduced; `markStreaming` and `finishStreaming` bracket a streamed resume. (`packages/daemon/src/index.ts:1276-1308`)
- Provider probing calls [[library/knowledge/private/codebase-graph/entities/acp-connection]], retains a booted spare, and gathers provider history. (`packages/daemon/src/index.ts:1666-1692`)

## Lifecycle boundaries
- Central `closeSession` clears replay timers, closes the ACP handle, discards temporary attachments, and deletes the session. (`packages/daemon/src/index.ts:1028-1037`)
- Idle reaping skips working sessions unless blocked on permission and skips sessions without an agent resume ID. Capacity eviction selects least-recently-used nonworking resumable sessions, excluding the newly opening session. (`packages/daemon/src/index.ts:1058-1106`)
- `closeAll` uses the same close path and also closes spare handles. (`packages/daemon/src/index.ts:2120-2133`)

## Reconnect contract
`catchUp` serves only known live sessions named by client cursors. Each reply carries retained events, working state, optional handle configuration and an explicit permissions array, even when empty. [[library/knowledge/private/codebase-graph/entities/session-log]] is the event source; this is not a guarantee of unlimited or disk-durable replay. (`packages/daemon/src/index.ts:2080-2117`, `packages/daemon/src/session/log.ts:30-54`)

## Evidence limits
Manual source reading, not AST extraction or runtime verification. `last_commit_hash` identifies committed history of the primary source, not a working-tree snapshot.
