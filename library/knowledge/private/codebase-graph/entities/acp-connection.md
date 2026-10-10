---
type: entity
title: ACP connection boundary
entity_type: module
path: packages/daemon/src/acp/connect.ts
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
  - acp
depends_on: []
used_by:
  - "[[library/knowledge/private/codebase-graph/entities/daemon]]"
related: []
sources:
  - packages/daemon/src/acp/connect.ts:563-655
  - packages/daemon/src/acp/connect.ts:663-784
  - packages/daemon/src/acp/connect.ts:800-861
  - packages/daemon/src/acp/connect.ts:876-904
  - packages/daemon/src/index.ts:1666-1692
---

# ACP connection boundary

## Process and protocol
- `connectProvider` prepares launch arguments/environment and spawns a child with piped stdio. Spawn failures reject this connection rather than becoming an unhandled process error. (`packages/daemon/src/acp/connect.ts:563-621`)
- Child registration supports later cleanup; shutdown delegates process termination to `terminateChild`. Stderr is continuously drained and its retained tail is bounded. (`packages/daemon/src/acp/connect.ts:623-677`)
- ACP runs over newline-delimited JSON streams. Updates and permission callbacks are routed by agent session ID, with a pending route covering session creation. (`packages/daemon/src/acp/connect.ts:681-760`)

## Capability boundary
- Initialization explicitly advertises no client filesystem read/write or terminal capability. It opts into boolean config selectors and bounds the handshake with a timeout that stops a wedged child. (`packages/daemon/src/acp/connect.ts:800-824`)
- Load, resume, session-list and prompt capabilities are read from the agent response. Legacy model/mode information is normalized alongside config options, with explicit config categories taking precedence. (`packages/daemon/src/acp/connect.ts:834-861`, `packages/daemon/src/acp/connect.ts:876-904`)
- Permission resolvers are registered before callbacks fire; a null answer becomes ACP cancellation, otherwise the selected option is returned. (`packages/daemon/src/acp/connect.ts:762-783`)

## Caller
[[library/knowledge/private/codebase-graph/entities/daemon]] uses this boundary for provider probing and retains a booted spare for adoption. (`packages/daemon/src/index.ts:1666-1692`)

## Evidence limits
Source-read documentation, not provider certification. No agents were spawned or platform-specific launch paths exercised. Commit metadata is committed history only.
