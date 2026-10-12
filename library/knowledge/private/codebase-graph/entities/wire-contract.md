---
type: entity
title: Wire contract
entity_type: module
path: packages/protocol/src/wire.ts
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
  - protocol
  - contracts
depends_on: []
used_by: []
related: []
sources:
  - packages/protocol/src/wire.ts:26
  - packages/protocol/src/wire.ts:76-114
  - packages/protocol/src/wire.ts:419-475
  - packages/protocol/src/wire.ts:585-652
  - packages/protocol/src/wire.ts:750-797
---

# Wire contract

## Boundary
- Wire version is `2`. Hello/ready frames establish connection state; Zod discriminated unions define accepted client/server message variants. (`packages/protocol/src/wire.ts:26`, `packages/protocol/src/wire.ts:76-114`, `packages/protocol/src/wire.ts:750-797`)
- Session start names a provider, optional workspace and optional request ID. A prompt targets a session and carries text plus optional attachments. (`packages/protocol/src/wire.ts:419-475`)
- Attachment limits are five items, 8 MiB per decoded file and 12 MiB total. The daemon also checks counts and estimates decoded sizes from base64 length and padding; this is not validation of the file's decoded contents. (`packages/protocol/src/wire.ts:447-475`, `packages/daemon/src/attachments.ts:70-106`)
- A replay frame carries events plus optional completion, catch-up, working, config and permission state. Missing permission state differs from an explicitly empty permission list. (`packages/protocol/src/wire.ts:585-652`)

## Runtime use
The shared daemon handler validates `ClientMessage` before dispatch. The daemon's catch-up producer supplies live state alongside replay events. (`packages/daemon/src/handler.ts:96-116`, `packages/daemon/src/index.ts:2080-2117`)

## Evidence limits
Manual source reading; no schema generation or runtime compatibility test performed. Commit metadata describes committed primary-source history, not the current working tree as a whole.
