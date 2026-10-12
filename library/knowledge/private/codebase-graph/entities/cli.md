---
type: entity
title: Daemon CLI entrypoint
entity_type: module
path: packages/daemon/src/cli/index.ts
language: ts
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: 45a6de159f743a0468d19b6a3637de954bfb319b
last_commit_author: AutomationGod
last_commit_date: 2026-10-01
extraction: manual-source-read
partial_scan: true
tags:
  - entity
  - daemon
  - cli
depends_on: []
used_by: []
related: []
sources:
  - packages/daemon/src/cli/index.ts:715-804
  - packages/daemon/src/device-claim.ts:95-98
  - .github/workflows/release.yml:77-97
---

# Daemon CLI entrypoint

## Boundary
- CLI dispatch selects local operational commands, including setup, pairing, service management and the daemon's `serve` entrypoint. (`packages/daemon/src/cli/index.ts:715-804`)
- The release workflow compiles this entrypoint into the platform binary; it checks tag/package version agreement before compilation on tag runs. (`.github/workflows/release.yml:77-97`)

## Pairing recovery
A device-refused response points users to `pew2 pair --rotate`. Rotation, rather than reusing a leaked link, is the recovery for compromised pairing material; first claim does not defeat an attacker who arrives first or knows both key and claimed identity. (`packages/daemon/src/device-claim.ts:18-27`, `packages/daemon/src/device-claim.ts:95-98`)

## Evidence limits
Manual source reading only. No CLI command that changes pairing, services, installation or deployment was executed. The primary-source commit hash does not identify the uncommitted release workflow fixes.
