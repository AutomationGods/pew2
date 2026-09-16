# pew2 app design

## Native command center

### Design read

- **Surface:** iPhone-first native command center for supervising desktop coding sessions.
- **Audience:** developers checking active work one-handed, briefly, and under interruption.
- **Single job:** find the session needing attention, enter it, and act safely.
- **Risk:** approvals may authorize consequential tools; agent, project, session, and status stay explicit.
- **Constraints:** preserve drawer gestures, composer behavior, session lifecycle, offline queueing, accessibility labels, and daemon protocol.

### Direction

The app is a native session console: transcript-first, compact, and calm under interruption. Conversation identity and live state lead; configuration and machine actions remain one obvious action away.

**Visual reference:** the user supplied a Refero collection and described its feel as Duolingo-like. We translate that into tactile geometry, warm high-contrast surfaces, confident type, and progress-led status. We do not copy Duolingo branding, mascots, illustrations, sounds, colors, or interaction wording.

A compact status rail is the memorable device. Hairline-separated controls respond through tone and opacity; provider colors remain small identity markers. The aperture remains launch and app-icon branding, never empty-state decoration.

### Semantic system

- **Canvas:** neutral graphite or soft gray background.
- **Grouped surface:** related rows share one bounded surface.
- **Selected row:** neutral emphasis plus explicit selected state.
- **Separator:** structure between repeated rows instead of isolated cards.
- **Control fill:** restrained native control background with visible pressed state.
- **Accent:** user-selected focus, selection, and primary-action color.
- **Status:** marker or icon plus words; color never carries status alone.
- **Type:** platform sans-serif; monospace only for commands, paths, and code.
- **Geometry:** 10–26pt rounded surfaces; controls use native proportions and hairline edges.
- **Material:** tonal opaque surfaces; blur only for transient raised overlays.
- **Motion:** state continuity only, with reduced-motion equivalents.

Stored accent keys remain unchanged so existing SecureStore preferences continue loading.

### Screen anatomy

- **Conversation:** stable top navigation, compact configuration, workspace context near the composer.
- **Drawer:** machine status, agent filters, activity row, project row, recent sessions.
- **Activity:** grouped lists ordered Needs you, Working, Ready, Recent.
- **Sheets:** shared native header and grouped rows; approvals keep explicit Allow and Deny actions.
- **Appearance:** segmented mode selection and named accent rows.

### Anti-default decisions

No generic glass cards, decorative orbs, provider-filled controls, oversized empty states, ambient glow, sheen, floating animation, or status conveyed only through color. Real command styling remains for `pew2 pair` because it is selectable operational content.

### Accessibility and state contract

- Preserve or improve labels, roles, selected/expanded/disabled states, focus, and modal behavior.
- Keep touch targets at least 44pt and reserve trailing space for chevrons.
- Support Dynamic Type, long labels, VoiceOver reading order, and native Back behavior.
- Preserve reduced motion, Reduce Transparency, offline, loading, empty, working, unread, permission, and fatal states.
- Normal text targets 4.5:1 contrast; meaningful controls and indicators target 3:1.
- Automated and simulator checks do not establish WCAG, ADA, or legal conformance.

### Slice 1 checkpoint

Shared controls now use tonal fills, hairline separators, and opacity feedback without pressed translation. Persistent rails use the active theme's opaque canvas; raised overlays alone may blur, with an opaque Reduce Transparency fallback. Existing appearance keys, touch targets, labels, haptics, and primitive APIs remain unchanged.

### Slice 2 checkpoint

The session header now leads with the conversation title and a concise agent/connection line. One settings control exposes every advertised selector, while menu and new-conversation actions remain stable and labelled. Empty, connecting, offline, fatal, and active copy continue to use the existing daemon state.

### Slice 3 checkpoint

The transcript keeps FlashList anchoring, session remounting, and grow-only bottom catch-up unchanged. Agent output remains full-width; trailing user prompts now use a quiet tonal surface, hairline edge, and tighter native rhythm. Markdown, tools, images, replay, and streaming retain their existing render paths.

### Slice 4 checkpoint

The grounded composer keeps its existing draft owner, height reporting, keyboard lift, offline outbox, and send-clear timing. Send, stop, attachment, dictation, and context actions retain labelled 44pt targets and restrained fill/opacity feedback.

### Slice 5 checkpoint

Navigation uses subdued section labels, hairline session rows, and one tonal selected state. Activity, launch, pairing, project, and machine surfaces continue sharing native type, spacing, and grouped-row tokens without changing persistence or navigation.

### Slice 6 checkpoint

All secondary surfaces continue through the shared native sheet anatomy: grabber, balanced header, grouped body, backdrop dismissal where allowed, keyboard avoidance, reduced motion, and blocking approval behavior. No sheet implementation or focus ownership changed.

## Project creation

Project creation remains inside the shared new-conversation flow. Name and parent folder survive navigation and recoverable errors. Blank and pending states prevent duplicate submission. Errors are announced, controls remain at least 44pt, and success selects the new project without changing protocol behavior.
