---
type: entity
title: Push delivery boundary
entity_type: module
path: packages/daemon/src/push.ts
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
  - notifications
  - privacy
depends_on: []
used_by: []
related: []
sources:
  - packages/daemon/src/push.ts:130-160
  - packages/daemon/src/push.ts:169-215
  - packages/daemon/src/index.ts:1240-1243
---

# Push delivery boundary

## Payload and transport
- `pushMessages` constructs Expo messages per registered target, including token, title, body, session ID, notice kind, sound/category and Android channel when applicable. Bodies can contain summarized agent/error text. (`packages/daemon/src/push.ts:130-160`)
- Delivery posts JSON directly to the push service with a timeout. This path does not seal its payload through `SecureChannel`. Notification content/metadata are therefore plaintext at the push-service application layer, even though transport uses HTTPS. (`packages/daemon/src/push.ts:200-210`)
- Ticket handling reports failures and forgets tokens marked `DeviceNotRegistered`; it avoids logging server-provided notification details. (`packages/daemon/src/push.ts:169-193`)

## Lifecycle integration
The daemon's completed shared-desktop turn path sends `session.idle` and invokes `pushFinishedTurn`. Push is a separate delivery path from the session event channel. (`packages/daemon/src/index.ts:1240-1243`)

## Evidence limits
Manual source reading only. No notification was transmitted; Expo/APNs/FCM delivery and device behavior were not verified. Commit metadata identifies committed primary-source history only.
