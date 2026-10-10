---
ai_description: >-
  Explain independent binary, relay and native-app release paths and manual build-only dispatch semantics.
human_description: >-
  Build and release the right component without confusing a successful check with a published artifact.
---

# Build, release and update operations

**Category:** Engineering / Operations | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

These are operator instructions, not a record of execution. No artifact was built, published, submitted or deployed during this documentation pass.

## Daemon binaries

1. Complete the relevant [verification](development-testing.md) and review the intended release diff.
2. Set `packages/daemon/package.json` to the intended release version. The `vX.Y.Z` tag must exactly match that version: self-update compares the release tag with the compiled-in version.
3. A deliberate push of a `v*` tag triggers `.github/workflows/release.yml`. Its quality job runs typecheck, lint, tests and managed relay integration against that revision.
4. The build matrix produces Darwin arm64/x64, Linux x64/arm64 and Windows x64 executables with checksums. Publication requires the quality job to succeed and all installer-required assets/checksums to exist.
5. Required names are `pew2-darwin-arm64`, `pew2-darwin-x64`, `pew2-linux-x64`, and `pew2-windows-x64.exe`, each with `.sha256`. Linux arm64 is an additional build, not in that required publication set. Asset names are an installer API; do not rename them casually.

**Manual `workflow_dispatch` is build-only**, including dispatch against a tag. It does not publish a GitHub release. Do not treat a manual build artifact as an installed/public release or bypass the tag/version match.

## Installed daemon updates

The internal scheduler first checks after **5 minutes**, then every **6 hours**. Automatic replacement requires an eligible compiled executable and an installed supervisor. Restart is deferred while work, opening sessions or permission requests remain active. Source checkouts must not self-replace the Bun runtime.

Use `pew2 --version` and logs to diagnose the installed version. There is no `pew2 update` CLI command. Re-running the platform installer is the manual update path. Checksums protect download integrity relative to the fetched checksum; do not describe them as an independent release signature.

## Relay

`npm run relay:deploy` is a separate **manual** Cloudflare deployment. It is not triggered by daemon tags or app builds. Review the Worker bindings/migrations and run local relay checks first. See [relay operations](../relay/operations.md).

## iOS app

The repository's store-build helper is `packages/app/scripts/build-ipa.sh`. It uses pinned `eas-cli@21.7.0`, performs a **local** production iOS build and writes `~/Desktop/pew2-build<N>.ipa` for manual Transporter upload. Before using it, authenticate the intended EAS account (`npx -y eas-cli@21.7.0 login`) and configure authorized signing credentials.

The script checks entitlements and refuses development-signing (`get-task-allow`) output. It replaces older matching Desktop IPA outputs, so preserve any artifact you need before running it. A successful script does not mean upload, processing, review or release has happened.

`eas.json` keeps build numbers remote (`appVersionSource: remote`), production auto-increment enabled, and the production iOS image pinned to `macos-tahoe-26.4-xcode-26.4`. Do not casually change that pin to `auto` or `latest`.

`release-to-device.sh` is a separate **development-signed Release build** for a connected device. It cannot be uploaded as a store build.

## Android and remaining verification

`eas.json` defines internal APK profiles and a production app-bundle profile. This documentation does not establish a tested Android store submission procedure or successful native build. Validate signing, permissions, camera/dictation, notification registration, reconnect behavior and accessibility on the actual target devices before distribution.

## Source evidence

- [Release workflow](../../../../.github/workflows/release.yml) — triggers, version gate, matrix, quality and publish guard.
- [Daemon version](../../../../packages/daemon/package.json), [Unix installer](../../../../install.sh), [Windows installer](../../../../install.ps1).
- [Update scheduler](../../../../packages/daemon/src/update/scheduler.ts), [update apply](../../../../packages/daemon/src/update/apply.ts), [CLI dispatch](../../../../packages/daemon/src/cli/index.ts).
- [Store IPA helper](../../../../packages/app/scripts/build-ipa.sh), [device helper](../../../../packages/app/scripts/release-to-device.sh), [EAS profiles](../../../../packages/app/eas.json).
