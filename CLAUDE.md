<!-- gg:init:start -->
# pew2

Mobile remote control for desktop coding agents. A daemon on the user's machine spawns agents over ACP and owns the session log; a Cloudflare relay forwards sealed frames; the Expo app watches and prompts. Transport and UI, not an agent.

## Packages (what each owns)
- `packages/daemon` — the `pew2` CLI and daemon: agent processes, ACP connection (`src/acp/connect.ts`), per-session event log, LAN WebSocket server (`src/server.ts`, port 8787), relay client (`src/relay-client.ts`). Runs under Bun (`engines.bun >=1.2`).
- `packages/protocol` — shared Zod contract: provider manifest, wire envelope, E2E crypto, `SecureChannel`. The only code both sides import.
- `packages/relay` — Cloudflare Worker and Durable Object (`PairingRoom`) routing opaque frames. Stores no state. Admission rules in `src/admission.ts`.
- `packages/app` — Expo/React Native client.
- `providers/*.json` — one manifest per agent (13), compiled into the daemon. `schemas/provider.schema.json` is for editor autocomplete only.

## Gotchas and invariants
- Provider manifests are compiled into `src/providers/bundled.ts`, so any `providers/*.json` change needs a daemon release to reach users.
- Pairing is first-claim (`src/device-claim.ts`). The first device to handshake is persisted and a copy of the link on another phone is refused. A link that leaked before first use can only be revoked with `pew2 pair --rotate`. The placeholder claim `phone` counts as unclaimed (`isRealClaim`).
- The relay evicts a daemon only after `DAEMON_STALE_MS` (90s) of silence, not when a newer one arrives (`admission.ts`). Newest-wins let anyone holding the room id evict the real daemon. Cost: a reconnecting machine can be refused for up to 90s. Don't shorten that window without re-reading the trade-off.
- Relay keepalive is the exact string `{"t":"ping"}` (`KEEPALIVE_FRAME` in `relay-client.ts`). The relay answers it with a hibernation auto-response, so it must match byte for byte.
- Relay `wrangler.toml` needs `compatibility_date` at or after 2026-04-07 for automatic Close-frame replies. The Durable Object uses SQLite storage, which the Free plan requires.
- Every session close goes through `closeSession()` in `packages/daemon/src/index.ts`. Don't close sessions ad hoc.
- `resolveWorkspace()` (`src/workspace.ts`) is the only cwd default. Under launchd the cwd is `/`.
- Metro: a replacement `getTransformOptions` must restate Expo's defaults (`experimentalImportSupport`, `inlineRequires`), or ESM handling silently changes (`packages/app/metro.config.js`). Duplicate React or Reanimated copies across `node_modules` paths cause hook-order crashes rather than build errors.
- The `.js`→`.ts` suffix shim in metro exists only for `@pew2/protocol`.
- Root `tsconfig.json` excludes `packages/app` and `packages/relay`. The relay has its own tsconfig because `@cloudflare/workers-types` conflicts with Node globals, so root `tsc` never checks it.
- Tests: `npm test` lists source roots explicitly. Don't collapse them into `bun test ./packages`, which exhausts file descriptors and makes spawned children read back empty (Bun #32067). `bunfig.toml` preloads a TMPDIR redirect for test runs.

## Workflows
- **Daemon binary release:** bump `version` in `packages/daemon/package.json` (currently 0.9.19) and commit. Tag `vX.Y.Z` with the same number. CI fails on a mismatch because self-update compares the tag with the compiled-in version. Pushing a `v*` tag runs `.github/workflows/release.yml`, and publish requires darwin-arm64, darwin-x64, linux-x64, and windows-x64.exe with checksums. Asset names are an API that `install.sh` resolves by name, so don't rename them. `workflow_dispatch` builds without publishing.
- **Relay:** `npm run relay:deploy` is manual. It ships independently of the binary and the app. To check locally, run `npm run relay:dev` (port 8799) and keep it running, then `npm run relay:check`.
- **iOS app:** one-time `npx -y eas-cli@21.7.0 login`, then `packages/app/scripts/build-ipa.sh`. It writes `~/Desktop/pew2-build<N>.ipa` for upload with Transporter, and refuses `get-task-allow` builds. The build number is server-side (`appVersionSource: remote`). The image is pinned to `macos-tahoe-26.4-xcode-26.4` in `packages/app/eas.json`, so don't change it to `auto` or `latest`.
- **Device-only Release build:** `packages/app/scripts/release-to-device.sh` is dev-signed and cannot be uploaded.
- Nothing deploys automatically except binaries. CI (`.github/workflows/ci.yml`) runs typecheck, lint, and tests on push and PR.
<!-- gg:init:end -->
