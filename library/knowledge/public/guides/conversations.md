---
ai_description: >-
  Explain current conversation, workspace, approval and shared-desktop behavior.
human_description: >-
  Start and resume work, select a project, and answer agent requests safely.
---

# Conversations and approvals

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## Start in the right project

Open **New conversation**, choose a provider, then choose the project you want it to work in. Projects come from provider history and folders the daemon discovers. Use **Browse folders** if your project is missing; **Use this folder** selects the current directory. These are folders on the computer, not the phone.

The folder browser normally starts within the computer user's home directory. An operator can explicitly configure additional roots. A client cannot simply request an arbitrary path: the daemon checks it against projects/history or paths it has offered while browsing. This is not an agent sandbox—agents still run with the computer user's privileges.

After selecting a folder, write your prompt and send it. Use model, mode, configuration, or slash-command controls only when offered by that provider. Missing selectors usually mean the agent did not advertise them, not that the phone can invent them.

## Return to existing work

Use the conversation drawer to switch between histories and projects. History depends on the agent's `session/list`/load support and the daemon's local caches. The daemon can show a cached transcript before reconnecting the agent; visible old messages do not by themselves mean the session is ready for a new prompt.

Idle agent processes may be closed to reclaim memory and resumed when you return. An actively running turn normally continues on the computer if the phone disconnects. Computer sleep, daemon termination, provider failure, or an approval waiting too long can still interrupt it.

## Answer an approval

Open the request and inspect the tool title, command/input, and affected content before selecting an answer. The sheet presents the choices supplied by the agent; options such as **Allow once**, **Allow always**, **Reject once**, or **Reject always** appear only when available. Persistent permission behavior is defined by the provider, not a universal pew2 policy.

If disconnected, reconnect before answering. Do not assume a tap delivered while the phone was offline. A pending request is reconstructed on reconnect while the daemon still holds that session. Closing a long-blocked session is not automatic approval.

## Shared GG Coder desktop

Choose **GG Coder Desktop** only if its `ggcoder-desktop-acp` bridge is installed and the desktop side is available. Unlike the ordinary GG Coder ACP process, this bridge can expose the desktop's shared workspace/conversation. Do not assume every provider mirrors a separately opened desktop app, or that selecting a folder creates an independent shared-desktop session.

Related: [attachments](attachments.md) · [offline behavior](connectivity-notifications.md).

## Source evidence

- [packages/app/src/ui/NewChatSheet.tsx](../../../../packages/app/src/ui/NewChatSheet.tsx) — provider/project selection; [packages/app/src/ui/NewChatSheet.tsx](../../../../packages/app/src/ui/NewChatSheet.tsx) — folder browser controls.
- [packages/daemon/src/handler.ts](../../../../packages/daemon/src/handler.ts) — project validation; [packages/daemon/src/workspaces.ts](../../../../packages/daemon/src/workspaces.ts) — browsing roots.
- [packages/app/src/ui/ApprovalSheet.tsx](../../../../packages/app/src/ui/ApprovalSheet.tsx) — options and tool details; [packages/app/src/approvalOptions.ts](../../../../packages/app/src/approvalOptions.ts) — provider option mapping.
- [packages/daemon/src/index.ts](../../../../packages/daemon/src/index.ts) — idle/blocked session limits.
- [packages/daemon/src/acp/sharedDesktop.ts](../../../../packages/daemon/src/acp/sharedDesktop.ts) and [providers/ggcoder-desktop.json](../../../../providers/ggcoder-desktop.json) — bridge contract.
