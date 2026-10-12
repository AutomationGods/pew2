---
type: entity
title: ACP connection boundary
entity_type: module
path: packages/daemon/src/acp/connect.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-12
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
  - packages/daemon/src/acp/connect.ts:150-266
  - packages/daemon/src/acp/connect.ts:279-370
  - packages/daemon/src/acp/connect.ts:382-448
  - packages/daemon/src/acp/connect.ts:463-492
  - packages/daemon/src/acp/config-options.ts:13-161
  - packages/daemon/src/acp/launch.ts:18-144
  - packages/daemon/src/acp/session-types.ts:21-166
  - packages/daemon/src/untyped.ts:8-15
  - packages/daemon/src/index.ts:1666-1692
---

# ACP connection boundary

## Process and protocol
- `connectProvider` prepares launch arguments/environment and spawns a child with piped stdio. Spawn failures reject this connection rather than becoming an unhandled process error. (`packages/daemon/src/acp/connect.ts:150-208`)
- Child registration supports later cleanup; shutdown delegates process termination to `terminateChild`. Stderr is continuously drained and its retained tail is bounded. (`packages/daemon/src/acp/connect.ts:210-266`)
- ACP runs over newline-delimited JSON streams. Updates and permission callbacks are routed by agent session ID, with a pending route covering session creation. (`packages/daemon/src/acp/connect.ts:279-347`)

## Capability boundary
- Initialization explicitly advertises no client filesystem read/write or terminal capability. It opts into boolean config selectors and bounds the handshake with a timeout that stops a wedged child. (`packages/daemon/src/acp/connect.ts:382-411`)
- Load, resume, session-list and prompt capabilities are read from the agent response. Legacy model/mode information is normalized alongside config options, with explicit config categories taking precedence. (`packages/daemon/src/acp/connect.ts:429-448`, `packages/daemon/src/acp/connect.ts:463-492`)
- Permission resolvers are registered before callbacks fire; a null answer becomes ACP cancellation, otherwise the selected option is returned. (`packages/daemon/src/acp/connect.ts:349-370`)

## Split modules (2026-10-12, uncommitted)
`connect.ts` keeps `connectProvider` (`packages/daemon/src/acp/connect.ts:150-753`) and re-exports the moved API (`packages/daemon/src/acp/connect.ts:41-43`):
- `packages/daemon/src/acp/config-options.ts` — `ConfigOption` (13), `normaliseConfigOptions` (28), `SessionModelState` (56), `modelsAsConfigOption` (62), `MODEL_CONFIG_ID` (87), `MODE_CONFIG_ID` (97), `AvailableCommand` (100), `readAvailableCommands` (113), `applyConfigUpdate` (140). Parsers take `unknown`.
- `packages/daemon/src/acp/launch.ts` — Windows cmd escaping (`CMD_META`/`escapeArgument`, 18-30), `launchSpec` (59), `providerEnvironment` (99), `prepareProviderLaunch` (123-144).
- `packages/daemon/src/acp/session-types.ts` — `AgentSession` (21), `AgentSessionList` (40), `AcpSessionHandle` (46), `AdoptOptions` (95), `ConnectOptions` (116).
- `packages/daemon/src/untyped.ts:8-15` — `isRecord`/`field` helpers for unvalidated input; also imported by `packages/daemon/src/errors.ts:14`.

## Caller
[[library/knowledge/private/codebase-graph/entities/daemon]] uses this boundary for provider probing and retains a booted spare for adoption. (`packages/daemon/src/index.ts:1666-1692`)

## Evidence limits
Source-read documentation, not provider certification. No agents were spawned or platform-specific launch paths exercised. Commit metadata is committed history only.
