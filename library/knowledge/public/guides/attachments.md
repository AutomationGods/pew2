---
ai_description: >-
  Describe attachment and dictation workflows with actual client and daemon limits.
human_description: >-
  Send photos and files, understand the size limits, and avoid surprising conversions.
---

# Photos, files, and dictation

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## Attach something

Use the composer's attachment control and choose **Photo Library**, **Take Photo**, or **Files**. Grant only the permissions needed for that action. You can remove a selected attachment before sending; a cancelled picker does not send anything.

The current limits are **5 attachments per prompt**, **8 MiB per attachment**, and **12 MiB combined**, measured in decoded file bytes. Base64 makes the transmitted representation larger. Oversized selections must be removed or reduced before sending.

Photos may be resized to a 1568-pixel long edge and recompressed; files selected through Files do not get the same automatic image optimization. Do not use this workflow when preserving an original photograph's bytes is required. Pick a smaller export if a file exceeds the limit.

## What the agent receives

- For an image-capable agent, the daemon can send an ACP image block.
- Otherwise an image is materialized as a temporary file and a local path is included in the prompt.
- Depending on advertised capabilities, supported text files can become embedded ACP resources; other files use resource links with a prompt note naming the local path. The daemon validates attachment metadata, base64 and size before writing. A MIME label is not proof that a file is safe.

This transfers content to your computer and agent. A file-path fallback does not guarantee that a provider/model can understand that format. Attachments are delivery files, not a durable file-storage service; the daemon removes its temporary session files on close. The agent may separately retain content or incorporate it into its own history.

## Dictate a prompt

The composer has a microphone/dictation control. Microphone and speech-recognition permissions are separate from pairing-camera access. Review the resulting text before sending; dictation is text input, not a guaranteed audio conversation with the agent.

If a permission was denied, open the phone's app settings and enable the relevant permission, then try again. A missing or unsupported native speech service can still prevent dictation.

Related: [offline queue limits](connectivity-notifications.md).

## Source evidence

- [packages/app/src/ui/AttachmentSheet.tsx](../../../../packages/app/src/ui/AttachmentSheet.tsx) — sources.
- [packages/protocol/src/wire.ts](../../../../packages/protocol/src/wire.ts) — payload limits.
- [packages/app/src/ui/attachmentPicker.ts](../../../../packages/app/src/ui/attachmentPicker.ts) — image processing thresholds.
- [packages/daemon/src/acp/promptBlocks.ts](../../../../packages/daemon/src/acp/promptBlocks.ts) — image versus file-path handling.
- [packages/daemon/src/attachments.ts](../../../../packages/daemon/src/attachments.ts) — validation and temporary materialization.
- [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — attachment cleanup on close.
- [packages/app/src/ui/useDictation.ts](../../../../packages/app/src/ui/useDictation.ts) and [packages/app/app.json](../../../../packages/app/app.json) — dictation binding and permissions.
