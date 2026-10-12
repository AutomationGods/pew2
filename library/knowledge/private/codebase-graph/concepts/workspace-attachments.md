---
type: concept
title: Workspace and attachment delivery
status: developing
created: 2026-10-08
updated: 2026-10-12
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
git_metadata_scope: repository HEAD baseline, not a working-tree content hash
extraction: manual-source-read
partial_scan: true
tags:
  - concept
  - workspace
  - attachments
related: []
sources:
  - packages/daemon/src/workspace.ts:21-34
  - packages/protocol/src/wire.ts:447-475
  - packages/daemon/src/attachments.ts:70-106
  - packages/daemon/src/acp/connect.ts:429-448
  - packages/daemon/src/index.ts:1028-1037
---

# Workspace and attachment delivery

## Workspace default
`resolveWorkspace` gives precedence to an explicit request, then `PEW2_WORKSPACE`, then an existing non-root daemon cwd, and finally home. This avoids treating a launchd cwd of `/` as the implicit project. It is a default-selection rule, not a general filesystem sandbox or validation of every explicit path. (`packages/daemon/src/workspace.ts:21-34`)

## Attachment boundary
- The [[library/knowledge/private/codebase-graph/entities/wire-contract]] defines attachment shape and count/byte ceilings. The daemon checks attachment counts and estimates decoded sizes from base64 length and padding before storage. This limit calculation is not validation of decoded file contents. (`packages/protocol/src/wire.ts:447-475`, `packages/daemon/src/attachments.ts:70-106`)
- The [[library/knowledge/private/codebase-graph/entities/acp-connection]] reads negotiated prompt capabilities from initialization. Do not infer that every provider accepts the same image/resource representation. (`packages/daemon/src/acp/connect.ts:429-448`)
- [[library/knowledge/private/codebase-graph/entities/daemon]] discards temporary attachment files when closing the session handle. These files are delivery artifacts, not a durable user document store. (`packages/daemon/src/index.ts:1028-1037`)

## Evidence limits
This documents selected boundaries only, not all filesystem browsing, image retrieval, symlink or provider-specific conversion behavior. No attachment was uploaded, file browser exercised, or workspace changed.
