---
type: entity
title: Provider registry
entity_type: module
path: packages/daemon/src/providers/registry.ts
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
  - providers
depends_on: []
used_by: []
related: []
sources:
  - packages/daemon/src/providers/registry.ts:213-387
  - packages/daemon/src/providers/bundled.ts:1-51
  - packages/protocol/src/manifest.ts:43-72
  - packages/protocol/src/manifest.ts:86-133
---

# Provider registry

## Boundary
- The registry validates provider definitions and resolves their launch command/availability before exposing them to daemon consumers. (`packages/daemon/src/providers/registry.ts:213-387`)
- Bundled definitions are imported into the daemon build; changing repository provider JSON alone does not update an already-shipped binary. (`packages/daemon/src/providers/bundled.ts:1-51`, `.github/workflows/release.yml:90-97`)

## Manifest contract
- Distribution is a discriminated union of `npx`, `uvx` and already-installed `command` forms. (`packages/protocol/src/manifest.ts:43-72`)
- Strict provider metadata includes ID, name, version, description and distribution; `pew` adds transport, label/color, environment requirements, workspace requirement, experimental flag and command-directory hints. (`packages/protocol/src/manifest.ts:86-133`)
- Agent runtime capabilities still come from the ACP initialize response, not merely the manifest. (`packages/daemon/src/acp/connect.ts:429-448`)

## Evidence limits
Manual boundary documentation, not per-provider extraction or certification. Individual JSON manifests receive no inferred function/class entities in this reduced scan; their per-file stub catalog is explicitly deferred. No provider installation or agent login was performed. Commit metadata is committed primary-source history only.
