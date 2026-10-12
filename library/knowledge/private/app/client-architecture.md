---
ai_description: >-
  Map app ownership and state boundaries, including volatile queue, native dependencies, and UI constraints.
human_description: >-
  Where to change app behavior without confusing session truth, cached state, or native build capabilities.
---

# Phone client architecture

**Category:** Engineering | **Version:** 1.0 | **Date:** 2026-10-12 | **Status:** Active

`App.tsx` composes pairing (`src/ui/PairingGate.tsx`), drawer, conversation/composer, sheets, appearance, and native event handlers. `src/useDaemon.ts` owns the long-lived connection and session-facing state. Protocol data is transformed into renderable messages rather than rendering raw ACP directly.

## State ownership

| Concern | Owner / rule |
| --- | --- |
| Pairing and device identity | `pairing.ts` and `pairingLink.ts`; saved in Expo SecureStore, with a generated device id replacing the QR placeholder. |
| Connect/foreground recovery | `useDaemon.ts`, `reconnect.ts`, `connectionRecovery.ts`; saved-route reconnection, handshake timeout, reconnect backoff and stale socket reset. |
| Offline sends | `outbox.ts`; memory-only, 25 entries and 24 MiB of encoded attachment characters. Not persisted and not exactly-once delivery. |
| Session projection | `useDaemon.ts` with `replayFold.ts`, `pendingSession.ts` and `sessionHistory.ts`; session mapping and replay/history projection. |
| Provider/project presentation | `providerCache.ts`, `projects.ts`, `projectPreferences.ts`, `preferences.ts`; local cached choices are not proof the daemon is reachable. |
| Transcript UI | `ui/ChatThread.tsx` and its message/code/tool presentation components. |
| Input and native services | Composer, attachment picker, dictation, image saving, local notifications and push registration bind Expo/React Native APIs. |

Network snapshots announce active sessions. If a session id disappears after reaping/restart, the client must load/resume rather than prompt the dead id. Cached transcripts and provider lists intentionally render early, but should not be mistaken for confirmed readiness. Pending approvals are restored from daemon snapshots, not guessed from old transcript rows.

## Platform-sensitive behavior

- Pairing is camera-only in the current UI. A registered `pew2://` scheme is not proof that arbitrary incoming links can pair the app.
- Attachments are picked natively, validated against protocol limits, and sent as base64 payloads; camera photos may be resized/recompressed.
- Native push needs permission and configured EAS identity. Successful local rendering or a unit test cannot prove APNs/FCM registration.
- Appearance is local System/Light/Dark plus color-scheme state. AccessibilityInfo tracks reduce-motion and screen-reader state; this is implementation support, not an accessibility certification.

## Build boundaries

The app has its own TypeScript config. Metro watches the workspace root, resolves dependencies through app/root `node_modules`, and disables hierarchical lookup to avoid duplicate React/Reanimated instances. Its replacement transform options explicitly retain `experimentalImportSupport: true` and `inlineRequires: true`. A relative `.js` resolution fallback supports shared TypeScript imports. Preserve these details when changing Metro rather than replacing it with a generic monorepo recipe.

Component harnesses (`npm run harness` from the app package, with the harness selected through Metro's environment configuration) substitute a UI entry at bundle time. They bypass pairing to isolate behavior; they do not validate daemon connectivity, release signing, or production push.

See [development tests](../operations/development-testing.md), [release operations](../operations/releases.md), and the [user workflows](../../public/guides/conversations.md).

## Source evidence

- [packages/app/App.tsx](../../../../packages/app/App.tsx) — composition entry; [src/ui/PairingGate.tsx](../../../../packages/app/src/ui/PairingGate.tsx), [src/ui/useKeyboardLift.ts](../../../../packages/app/src/ui/useKeyboardLift.ts), [src/ui/appStyles.ts](../../../../packages/app/src/ui/appStyles.ts) — extracted gate, keyboard lift and styles; [src/ui/Sidebar.tsx](../../../../packages/app/src/ui/Sidebar.tsx) with [SessionRow.tsx](../../../../packages/app/src/ui/SessionRow.tsx) and [sidebarStyles.ts](../../../../packages/app/src/ui/sidebarStyles.ts) — drawer.
- [packages/app/src/useDaemon.ts](../../../../packages/app/src/useDaemon.ts) — connection/session hook; [packages/app/src/outbox.ts](../../../../packages/app/src/outbox.ts) — queue limits.
- [packages/app/src/pairing.ts](../../../../packages/app/src/pairing.ts) — generated identity and persistence.
- [packages/app/src/ui/push.ts](../../../../packages/app/src/ui/push.ts) — registration; [packages/app/src/ui/accessibilityState.ts](../../../../packages/app/src/ui/accessibilityState.ts) — accessibility signals.
- [packages/app/metro.config.js](../../../../packages/app/metro.config.js) — resolution, transform defaults and harness substitution.
- [packages/app/package.json](../../../../packages/app/package.json) — development/harness scripts.
