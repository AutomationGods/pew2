---
type: entity
title: Update scheduler
entity_type: module
path: packages/daemon/src/update/scheduler.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: 0b184c25584ad2d2c05d6c0e1abe33f8c04a2188
last_commit_author: kenkaiii
last_commit_date: 2026-08-12
extraction: manual-source-read
partial_scan: true
tags:
  - entity
  - daemon
  - updates
depends_on: []
used_by: []
related: []
sources:
  - packages/daemon/src/update/scheduler.ts:188-258
  - packages/daemon/src/update/check.ts:45-48
  - packages/daemon/src/update/apply.ts:344-432
---

# Update scheduler

## State transitions
- A staged update waits until `busyReason()` is absent before exiting for restart. A failed/unknown release check does not establish that the daemon is current. (`packages/daemon/src/update/scheduler.ts:188-207`)
- A genuinely current result clears the update notice. A newer result publishes a notice, but automatic application is skipped when the scheduler has no eligible supervisor path. (`packages/daemon/src/update/scheduler.ts:208-229`)
- Apply failure leaves a manual-update notice. Successful application marks the version staged and waits for an idle gap before exit. (`packages/daemon/src/update/scheduler.ts:231-258`)

## Download boundary
The apply layer downloads a checksum, verifies SHA-256, stages beside the binary, and renames into place; Windows handling parks the old executable and attempts recovery on failure. Application reports restart required rather than itself exiting the process. (`packages/daemon/src/update/apply.ts:344-432`)

## Release identity
The running version comes from daemon package metadata; the checker targets the repository's latest GitHub release. Tag/package equality is therefore a release concern, not just display copy. (`packages/daemon/src/update/check.ts:45-48`, `.github/workflows/release.yml:77-87`)

## Evidence limits
No update was downloaded, installed or exercised. Primary-source commit metadata does not identify uncommitted release-workflow changes cited above.
