# pew2 app design

## Native command center

### Design read

- **Surface:** iPhone-first native command center for supervising desktop coding sessions.
- **Audience:** developers checking active work one-handed, briefly, and under interruption.
- **Single job:** find the session needing attention, enter it, and act safely.
- **Risk:** approvals may authorize consequential tools; agent, project, session, and status stay explicit.
- **Constraints:** preserve drawer gestures, composer behavior, session lifecycle, offline queueing, accessibility labels, and daemon protocol.

### Direction

The app is a playful command center: bold hierarchy, chunky rounded controls, and visible progress make consequential work easy to scan without turning the agent into a character. Current project, active agent, and attention state appear first. Recent sessions and metadata come second.

**Visual reference:** the user supplied a Refero collection and described its feel as Duolingo-like. We translate that into tactile geometry, warm high-contrast surfaces, confident type, and progress-led status. We do not copy Duolingo branding, mascots, illustrations, sounds, colors, or interaction wording.

A tactile status rail is the memorable device. Raised controls compress on press, active conversations read as completed steps, and provider colors remain small identity markers. The aperture remains launch and app-icon branding, never empty-state decoration.

### Semantic system

- **Canvas:** neutral graphite or soft gray background.
- **Grouped surface:** related rows share one bounded surface.
- **Selected row:** neutral emphasis plus explicit selected state.
- **Separator:** structure between repeated rows instead of isolated cards.
- **Control fill:** restrained native control background with visible pressed state.
- **Accent:** user-selected focus, selection, and primary-action color.
- **Status:** marker or icon plus words; color never carries status alone.
- **Type:** platform sans-serif; monospace only for commands, paths, and code.
- **Geometry:** 10–26pt rounded surfaces; controls use a restrained bottom edge for tactile depth.
- **Material:** bright flat surfaces; blur only for transient overlays and the composer.
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

## Project creation

Project creation remains inside the shared new-conversation flow. Name and parent folder survive navigation and recoverable errors. Blank and pending states prevent duplicate submission. Errors are announced, controls remain at least 44pt, and success selects the new project without changing protocol behavior.
