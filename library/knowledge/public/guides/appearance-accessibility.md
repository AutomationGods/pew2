---
ai_description: >-
  Describe implemented appearance and accessibility accommodations without claiming conformance.
human_description: >-
  Choose a theme and use phone accessibility settings with pew2.
---

# Appearance and accessibility

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

Open the app's appearance settings. The app offers **System**, **Light**, and **Dark**, with color schemes **Coral**, **Ocean**, **Violet**, and **Mint**. System follows the phone's light/dark setting. Your selection is stored locally on the phone; it does not change the agent or a shared desktop theme.

The app listens for the phone's **Reduce Motion** and screen-reader settings and uses those signals in parts of the UI. Controls such as provider selection and approval options have accessibility labels. These accommodations are not a claim of a completed VoiceOver/TalkBack, large-text, contrast, or WCAG audit.

For approval requests, read the tool details as well as the button label. If enlarged text, focus order, or a modal prevents you from understanding the action, do not approve blindly; switch to the computer and report the screen and phone accessibility settings involved.

Pairing currently requires scanning a QR code with the camera. There is no manual URL-entry alternative in the current pairing screen. This can be a practical barrier for users who cannot aim the camera; get assistance from someone you trust without sharing the pairing code publicly.

Trouble with a theme or inaccessible control? Include the screen name, phone OS, selected appearance, and enabled accessibility settings in a report. Avoid screenshots that expose pairing codes or private conversation text.

## Source evidence

- [packages/app/src/ui/AppearanceSheet.tsx](../../../../packages/app/src/ui/AppearanceSheet.tsx) — displayed modes and schemes.
- [packages/app/src/appearancePreference.ts](../../../../packages/app/src/appearancePreference.ts) — preference values and defaults.
- [packages/app/src/preferences.ts](../../../../packages/app/src/preferences.ts) — local persistence.
- [packages/app/src/ui/accessibilityState.ts](../../../../packages/app/src/ui/accessibilityState.ts) — OS accessibility state listeners.
- [packages/app/src/ui/ApprovalSheet.tsx](../../../../packages/app/src/ui/ApprovalSheet.tsx) — approval accessibility labels.
- [packages/app/src/ui/PairingScreen.tsx](../../../../packages/app/src/ui/PairingScreen.tsx) — camera-only entry.

[Back to conversations](conversations.md)
