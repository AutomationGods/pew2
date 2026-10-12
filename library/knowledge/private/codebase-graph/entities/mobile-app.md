---
type: entity
title: Mobile app shell
entity_type: module
path: packages/app/App.tsx
language: tsx
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
  - app
  - ui
depends_on:
  - "[[library/knowledge/private/codebase-graph/entities/use-daemon]]"
used_by: []
related: []
sources:
  - packages/app/App.tsx:217-228
  - packages/app/src/ui/PairingGate.tsx:20-103
  - packages/app/src/ui/useKeyboardLift.ts:55-147
  - packages/app/src/ui/appStyles.ts:5-175
  - packages/app/src/untyped.ts:8-15
  - packages/app/src/pairing.ts:55-81
  - packages/app/src/ui/ApprovalSheet.tsx:1-114
---

# Mobile app shell

## Boundary
- The app shell consumes [[library/knowledge/private/codebase-graph/entities/use-daemon]] rather than owning an ACP child process. The daemon-side ACP boundary performs process spawning. (`packages/app/App.tsx:217-228`, `packages/daemon/src/acp/connect.ts:150-208`)
- Pairing persistence stores the complete link in Expo SecureStore and re-parses it on load; missing or unreadable storage returns no pairing. (`packages/app/src/pairing.ts:55-81`)
- The approval UI renders the supplied permission options and delegates the chosen option to its callback; it is not an independent authorization policy for the agent. (`packages/app/src/ui/ApprovalSheet.tsx:1-114`)

## Split modules (2026-10-12, uncommitted)
`App.tsx` now imports these rather than defining them (`packages/app/App.tsx:69-71`):
- `PairingGate` — `packages/app/src/ui/PairingGate.tsx:20-103`, rendered at `packages/app/App.tsx:143`.
- `useKeyboardLift` (with its orb constants) — `packages/app/src/ui/useKeyboardLift.ts:55-147`, used at `packages/app/App.tsx:315`.
- `makeStyles` — `packages/app/src/ui/appStyles.ts:5-175`, used at `packages/app/App.tsx:171`.
- Sidebar conversation row — `packages/app/src/ui/SessionRow.tsx:103-211`; sidebar styles — `packages/app/src/ui/sidebarStyles.ts:5-283`.
- `packages/app/src/untyped.ts:8-15` — `isRecord`/`field`; the app's payload parsers take `unknown`. Not behaviour-preserving in one place: `chunks.ts` now reads a non-string text field as empty text (regression test in `packages/app/src/chunks.test.ts`).

## Scope
This page covers the app's composition boundary, not a visual inventory of every screen/helper. Pairing, state synchronization and offline delivery are documented separately in the linked hook and flow pages.

## Evidence limits
Source-read documentation only. No simulator, device, accessibility, notification-delivery or UI-render verification was performed. Primary-source commit metadata is not a working-tree content hash.
