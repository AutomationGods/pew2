# pew2 app design

## Activity command center

### Design read

- **Surface:** native, data-dense mobile developer tool.
- **Audience:** developers supervising several coding agents away from their desk.
- **Single job:** identify which session needs attention, then enter it in one tap.
- **Risk:** approval mistakes can execute destructive tools; status and actions must be explicit.
- **Constraints:** Android leads; use platform sans-serif type, compact geometry, clear navigation, restrained color, and the existing four-point grid.

### Direction

Activity is a compact Android command center, not a themed dashboard. Strong sans-serif hierarchy, flat neutral surfaces, and simple provider status marks keep approvals and active work immediately scannable. Color is reserved for actions and state; it never replaces text or icons.

### Theme system

The app supports light/dark mode and four restrained accent choices. Existing coral preferences resolve to the new Android-blue primary so current installations receive the redesign immediately.

- **`appearancePreference.ts`** — pure parse/serialize for stored mode and accent preferences.
- **`appearance.tsx`** — `AppearanceProvider` resolves system mode via `useColorScheme`, applies explicit mode via `Appearance.setColorScheme`, and exposes `useAppTheme()` / `useThemeStyles()` hooks.
- **`theme.ts`** — `createTheme(mode, accent)` returns the full token set. The static `theme` export remains for module-level code that cannot use hooks.
- **`preferences.ts`** — fail-soft SecureStore load/save for the appearance preference.
- **`AppearanceSheet.tsx`** — mode segmented control and accent swatch picker, opened from the drawer header.

Every production UI component uses `useAppTheme()` for runtime values and `useThemeStyles(makeStyles)` for themed styles. Module-level constants that need theme values use factory functions (e.g. `composerMetrics(theme)`, `sheetCardStyle(theme)`).

### Reused system

- `theme.ts` remains the token source for neutral surfaces, Android sans-serif typography, compact radii, spacing, and motion.
- `Orb` is now a simple solid provider mark with an explicit working-state ring, replacing the decorative dot matrix.
- `CircleButton`, Ionicons, safe-area insets, haptics, and reduced-motion behavior remain shared across screens.
- Session, permission, receipt, connection, and provider data come from `useDaemon`; the screen invents no progress values.

### Component and state contract

- **Activity shortcut:** global status in the drawer, independent of project/provider filters.
- **Permission card:** request text plus deny and allow actions; approval is routed to the card's session, even when it is not the open conversation.
- **Working card:** task, provider, project, and a truthful indeterminate working label.
- **Ready card:** unread result with the real turn receipt when available.
- **Recent row:** compact navigation only.
- **Offline:** persistent connection banner; session data stays visible and approval actions stay disabled until reconnect.
- **Empty:** one explanation and one New conversation action.

### Interaction and accessibility

- The screen is a native full-screen modal so underlying conversation controls leave the accessibility tree while it is open.
- Android Back and the visible back control return to the conversation; session state and scroll position remain mounted underneath.
- All controls are at least 44pt on iOS and 48dp for primary Android actions.
- Status always uses words and icons in addition to color. Dynamic text can wrap or truncate without displacing actions.
- The entrance runs once over the shared 200ms motion token; reduced-motion users receive a static screen and static working glyph.

### Visual verification

The representative Android-width render is verified from `ActivityScreen.harness.tsx` after each broad visual revision.

## Project creation

### Design read

- **Surface:** native, task-focused mobile developer tool.
- **Audience:** developers starting desktop-agent work one-handed and away from the filesystem.
- **Single job:** name a project and return to a ready new conversation.
- **Risk:** invalid and duplicate names must never overwrite a directory; offline and old-daemon states must be explicit.
- **Constraints:** extend `NewChatSheet`; reuse its glass card, compact rows, Ionicons, four-point spacing, haptics, and reduced-motion push.

### Direction

Create project is the first choice only when the daemon advertises support. The form keeps one persistent label, one location row, and one full-width action visible in reading order. `~/gg-projects` is explained as **gg-projects in your home folder** instead of exposing shell syntax; advanced location choice stays one tap away.

### State and interaction contract

- The project-name draft and chosen parent survive Back, location browsing, recoverable errors, and sheet dismissal; success clears them.
- Return submits. Blank and pending states disable duplicate submission. Pending keeps the form visible, and every stable daemon failure maps to actionable inline text.
- Location browsing has a distinct intent: folder rows descend consistently, while **Use this folder** selects the directory currently shown.
- Success selects the returned zero-session project, closes the sheet, and leaves a fresh composer targeted at its absolute path.
- Old daemons omit the support flag, so no create control appears and no incompatible request is guessed.

### Accessibility contract

- Inputs keep persistent visible and programmatic labels; help text explains the one-folder-name format.
- Every action is at least 44pt, pressed/disabled/busy states are exposed, and status never relies on color.
- Create errors and success are announced without moving focus. Returning from location browsing restores focus to the name field.
- Long names and absolute paths truncate inside their text rail without covering icons or controls; the primary action stays above the keyboard.
- The existing reduced-motion sheet path remains authoritative; project creation adds no ambient motion.