---
type: concept
title: Replay and offline recovery
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
git_metadata_scope: repository HEAD baseline, not a working-tree content hash
extraction: manual-source-read
partial_scan: true
tags:
  - concept
  - replay
  - offline
related: []
sources:
  - packages/app/src/useDaemon.ts:1123-1136
  - packages/daemon/src/index.ts:2080-2117
  - packages/daemon/src/session/log.ts:30-81
  - packages/app/src/replayFold.ts:15-132
  - packages/app/src/outbox.ts:31-123
---

# Replay and offline recovery

## Reconnect flow
1. [[library/knowledge/private/codebase-graph/entities/use-daemon]] reconnects with device proof and remembered session cursors. (`packages/app/src/useDaemon.ts:1123-1136`)
2. [[library/knowledge/private/codebase-graph/entities/daemon]] returns events newer than those cursors for known live sessions, plus current working/config/permission state. An empty permission list actively clears obsolete approvals. (`packages/daemon/src/index.ts:2080-2117`)
3. The app's shared chunk fold adopts matching optimistic user turns and coalesces consecutive non-user chunks. The replay schema distinguishes history completion and reconnect catch-up. (`packages/app/src/replayFold.ts:72-94`, `packages/protocol/src/wire.ts:594-652`)

## Two distinct bounded memories
- [[library/knowledge/private/codebase-graph/entities/session-log]] retains a bounded in-memory suffix of received events. Sequence numbers survive trimming within the log, but the array is not a persistent journal. (`packages/daemon/src/session/log.ts:30-81`)
- [[library/knowledge/private/codebase-graph/entities/outbox]] retains unsent starts/prompts in app memory with entry/attachment limits. It bridges a connection outage only while that in-memory state survives; it does not guarantee delivery after process termination. (`packages/app/src/useDaemon.ts:716`, `packages/app/src/outbox.ts:31-123`)

The daemon also has a separate transcript cache on disk; that should not be confused with durable storage of this mobile outbox or unlimited preservation of the live session log. (`packages/daemon/src/transcript-cache.ts:82-145`, `packages/app/src/useDaemon.ts:716`, `packages/daemon/src/session/log.ts:30-54`)

## Stale source rationale
Comments suggesting relay-owned replay/logging are stale. The authoritative implementation is daemon `catchUp` and relay forwarding, not those comments. No source was changed by this documentation pass. (`packages/protocol/src/crypto.ts:127-139`, `packages/protocol/src/channel.ts:269-287`, `packages/daemon/src/index.ts:2080-2117`, `packages/relay/src/index.ts:202-226`)

## Evidence limits
Manual source reading only. No offline/reconnect, restart, deduplication or durability scenario was executed. No exactly-once guarantee is asserted.
