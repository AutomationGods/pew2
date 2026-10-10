---
ai_description: >-
  Explain product scope and basic terminology without promising unsupported provider capabilities.
human_description: >-
  What runs on your phone, what runs on your computer, and what you need before starting.
---

# What is pew2?

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

pew2 lets you prompt desktop coding agents, read their streamed replies, and answer permission requests from a phone. It is a remote control, not an AI model, hosted development machine, or replacement for the agent's own account.

| Term | Meaning |
| --- | --- |
| Provider | An agent integration, such as Claude Code, Codex, or GG Coder. |
| Daemon | The `pew2` process on your computer that connects to agents and serves the phone. |
| Workspace / project | The folder on that computer where the agent works. |
| Session / conversation | An agent conversation; history and resumability depend on the provider. |
| Pairing | A shared secret established by scanning the computer's QR code. |
| Relay | An optional Cloudflare connection route when the phone cannot reach the computer directly. |
| ACP | Agent Client Protocol, used between the daemon and agent processes. |

## What you need

- A computer running the daemon, kept awake and online while you work remotely.
- At least one installed/configured provider. Authenticate with that provider on the computer first. Agents may need Node/npx, uvx, an installed executable, or provider-specific credentials.
- A pew2 phone build with camera access to scan the pairing code. This repository contains the Expo app; a native build is not supplied by `pew2 setup`.

pew2 offers controls an agent actually advertises: models, modes, configuration, commands, tool results, plans, and approvals vary by provider. A detected executable is not proof it is signed in or supports every feature. The GG Coder desktop bridge is a special shared-desktop integration; ordinary ACP providers run processes owned by the daemon.

Session frames are sealed between phone and daemon. That does **not** mean all data is hidden from every intermediary: routing metadata remains visible, agents receive prompts, local caches contain content, and optional remote notifications send readable snippets through Expo and the phone push service. Read [connectivity and notifications](../guides/connectivity-notifications.md) before enabling previews for sensitive work.

Next: [get started](../guides/getting-started.md).

## Source evidence

- [packages/daemon/src/acp/connect.ts](../../../../packages/daemon/src/acp/connect.ts) — process launch and ACP initialization.
- [packages/daemon/src/acp/sharedDesktop.ts](../../../../packages/daemon/src/acp/sharedDesktop.ts) — shared-desktop provider distinction.
- [packages/protocol/src/wire.ts](../../../../packages/protocol/src/wire.ts) — provider information supplied to clients.
- [packages/daemon/src/push.ts](../../../../packages/daemon/src/push.ts) — notification content leaves the sealed-session boundary.
