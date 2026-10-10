---
type: entity
title: Mobile app shell
entity_type: module
path: packages/app/App.tsx
language: tsx
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
  - ui
depends_on:
  - "[[library/knowledge/private/codebase-graph/entities/use-daemon]]"
used_by: []
related: []
sources:
  - packages/app/App.tsx:459-475
  - packages/app/src/pairing.ts:55-81
  - packages/app/src/ui/ApprovalSheet.tsx:1-114
---

# Mobile app shell

## Boundary
- The app shell consumes [[library/knowledge/private/codebase-graph/entities/use-daemon]] rather than owning an ACP child process. The daemon-side ACP boundary performs process spawning. (`packages/app/App.tsx:459-475`, `packages/daemon/src/acp/connect.ts:563-591`)
- Pairing persistence stores the complete link in Expo SecureStore and re-parses it on load; missing or unreadable storage returns no pairing. (`packages/app/src/pairing.ts:55-81`)
- The approval UI renders the supplied permission options and delegates the chosen option to its callback; it is not an independent authorization policy for the agent. (`packages/app/src/ui/ApprovalSheet.tsx:1-114`)

## Scope
This page covers the app's composition boundary, not a visual inventory of every screen/helper. Pairing, state synchronization and offline delivery are documented separately in the linked hook and flow pages.

## Evidence limits
Source-read documentation only. No simulator, device, accessibility, notification-delivery or UI-render verification was performed. Primary-source commit metadata is not a working-tree content hash.
