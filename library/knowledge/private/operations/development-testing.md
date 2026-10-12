---
ai_description: >-
  Document current check entry points and distinguish source checks from native, provider and release verification.
human_description: >-
  Develop pew2 and choose the checks relevant to your change.
---

# Development and verification

**Category:** Engineering / Operations | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

The workspace requires Bun >=1.2; current CI pins Bun **1.3.14**. Follow [Contributing](../../../../CONTRIBUTING.md) for checkout setup. From a checkout with dependencies already available:

```sh
npm run typecheck
npm run lint
npm test
npm run providers:validate
```

## What these check

- `typecheck` runs the root daemon/protocol configuration, the relay's separate configuration, and the app's configuration. Root `tsc` alone omits relay and app.
- `lint` runs the repository ESLint configuration.
- `npm test` invokes Bun against explicit source roots plus `packages/app/app.config.test.js`. Preserve that list: scanning all of `packages/` can exhaust file descriptors and break spawned-child output (Bun #32067).
- `bunfig.toml` preloads `scripts/test-setup.ts` to redirect test temporary files. Do not interpret a temporary-path difference as production storage behavior.
- Manifest validation does not launch/authenticate every agent. `npm run providers:verify` is a separate runtime probe and may require external runtimes/accounts/network.

## Local daemon, phone and relay

Run the CLI directly for source-mode development:

```sh
bun run packages/daemon/src/cli/index.ts serve
```

Avoid conflicting with an installed service on port 8787 or inadvertently replacing your real pairing. Choose an isolated `PEW2_HOME` when experimenting. Pair with the daemon you actually started; the computer, not Metro, owns agent sessions.

The app package exposes `start`, `ios`, `android`, `web`, and `harness` scripts. Its native dependencies mean a browser preview is not proof that camera, dictation, push, sheets or signing work on a phone. Preserve the monorepo Metro resolution/transform configuration; duplicate React/Reanimated copies can fail at runtime.

Relay integration has two entry points:

```sh
npm run relay:test     # managed local Worker lifecycle; no deployment
# Or, in separate terminals:
npm run relay:dev      # leave running on port 8799
npm run relay:check    # check that running Worker
```

See [relay operations](../relay/operations.md) and [release operations](releases.md).

## Evidence limits

This documentation pass did **not** rerun runtime checks or build native applications. The caller supplied earlier results: Bun 1.3.14, typecheck passed, lint 0 errors/9 warnings, 1,314 tests passed, 8 relay checks passed, and 13 valid manifests. These are attributed prior results, not fresh evidence for this documentation or proof of native/release execution.

Still verify changed native workflows on devices, provider behavior against real agents, platform service installation where relevant, and signed artifacts before shipping. Unit tests and local relay checks cannot establish production push delivery, App Store acceptance, or a successful deployment.

## Source evidence

- [Root scripts](../../../../package.json), [root TypeScript config](../../../../tsconfig.json), [relay TypeScript config](../../../../packages/relay/tsconfig.json), [Bun test preload](../../../../bunfig.toml).
- [CI workflow](../../../../.github/workflows/ci.yml) — configured checks and runtime version.
- [App scripts](../../../../packages/app/package.json), [Metro configuration](../../../../packages/app/metro.config.js).
- [Managed relay test](../../../../packages/relay/src/relay-test.mjs), [relay checks](../../../../packages/relay/src/relay-check.mjs).
