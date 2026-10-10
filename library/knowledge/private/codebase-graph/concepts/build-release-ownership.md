---
type: concept
title: Build, testing and release ownership
status: developing
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
git_metadata_scope: repository HEAD baseline, not a working-tree content hash
extraction: manual-source-read
partial_scan: true
tags:
  - concept
  - testing
  - release
related: []
sources:
  - .github/workflows/ci.yml:23-56
  - .github/workflows/release.yml:5-37
  - .github/workflows/release.yml:46-97
  - .github/workflows/release.yml:168-240
  - package.json:5-29
  - packages/app/scripts/build-ipa.sh:1-101
---

# Build, testing and release ownership

## CI versus binary publication
- CI installs the frozen lockfile with Bun 1.3.14 and runs typecheck, lint, tests and relay integration. These are declared jobs, not checks executed by this documentation pass. (`.github/workflows/ci.yml:23-56`)
- The release workflow supports `v*` tags and manual dispatch. Its quality job includes the same checks; publication waits for quality/build completion, requires successful quality checks and a pushed tag, and excludes manual dispatch even when it targets a tag. (`.github/workflows/release.yml:5-37`, `.github/workflows/release.yml:168-240`)
- Binary targets include macOS arm64/x64, Linux x64/arm64 and Windows x64. Tag version must match daemon package version before compiling the [[library/knowledge/private/codebase-graph/entities/cli]] entrypoint. (`.github/workflows/release.yml:46-97`)
- Publication requires macOS arm64/x64, Linux x64 and Windows x64 binaries with checksums; Linux arm64 is built but optional for publication. (`.github/workflows/release.yml:206-225`)
- Provider definitions are bundled into that binary, so shipped provider changes follow the daemon release boundary. (`packages/daemon/src/providers/bundled.ts:1-51`, `.github/workflows/release.yml:106-127`)

## Separate deliverables
- Relay deployment is a separate root script, not equivalent to publishing a daemon binary. App build tooling uses its own EAS configuration and IPA script. (`package.json:5-29`, `packages/app/eas.json:1-35`, `packages/app/scripts/build-ipa.sh:1-101`)
- Source versions at this pass are daemon `0.9.19` and app `1.0.0`; no claim is made about versions installed on a device or deployed remotely. (`packages/daemon/package.json:1-8`, `packages/app/package.json:1-8`)

## Test boundaries
Root scripts define the test source roots and separate typecheck commands. The root TypeScript config excludes app and relay; invoking only root `tsc` is not equivalent to the full scripted check. (`package.json:5-29`, `tsconfig.json:23-25`)

Bun's test preload redirects temporary directories and cleans the test-run root after completion. This is test infrastructure, not production persistence. (`bunfig.toml:1-8`, `scripts/test-setup.ts:21-58`)

## Working-tree caveat
The cited CI/release workflows include approved uncommitted changes, including the Bun pin and release quality/tag publication safeguards. Git hashes in this wiki describe committed history only and do not identify these working-tree changes. Source was read; no CI run, test, build, signing, publication or deployment was performed by this pass.
