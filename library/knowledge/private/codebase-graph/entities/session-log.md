---
type: entity
title: SessionLog
entity_type: class
path: packages/daemon/src/session/log.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e038f376f175e96d6760d775b3669056bd8bcfba
last_commit_author: kenkaiii
last_commit_date: 2026-08-06
extraction: manual-source-read
partial_scan: true
tags:
  - entity
  - daemon
  - replay
depends_on: []
used_by:
  - "[[library/knowledge/private/codebase-graph/entities/daemon]]"
related: []
sources:
  - packages/daemon/src/session/log.ts:30-81
  - packages/daemon/src/index.ts:1246-1256
  - packages/daemon/src/index.ts:2080-2117
---

# SessionLog

## Contract
- One log holds one session's events in an in-memory array. Appending allocates a sequence number starting at zero and records timestamp and payload in a `session.event`. (`packages/daemon/src/session/log.ts:32-49`)
- Retention is block-trimmed: after the array exceeds the retention limit plus trim batch, it retains the newest 10,000 events. Sequence allocation is separate from array trimming. (`packages/daemon/src/session/log.ts:30-54`)
- `since(cursor)` uses binary search to return retained events strictly after the cursor; `latestSeq` returns the last allocated sequence. (`packages/daemon/src/session/log.ts:65-81`)

## Owner and durability
[[library/knowledge/private/codebase-graph/entities/daemon]] appends updates and assembles reconnect frames. This array is not a persistent journal: daemon restart and retention trimming cannot be repaired by asking the relay for an older event. (`packages/daemon/src/index.ts:1246-1256`, `packages/daemon/src/index.ts:2080-2117`, `packages/daemon/src/session/log.ts:34-54`, `packages/relay/src/index.ts:202-226`)

## Evidence limits
Manual source reading; no AST or runtime verification. The commit identifies the primary source's last committed change, not uncommitted content.
