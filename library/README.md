---
ai_description: >-
  Navigation for pew2 narrative documentation. Follow linked source evidence; codebase-graph is maintained separately.
human_description: >-
  Start here for using pew2, understanding its architecture, or developing and releasing it.
---

# pew2 documentation

**Category:** Navigation | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

pew2 is a phone remote for coding agents running on your computer. The computer must stay awake and its daemon must remain running; the relay does not run your agents.

## Use pew2

1. [What pew2 does](knowledge/public/overview/what-is-pew2.md)
2. [Install, pair, and reconnect safely](knowledge/public/guides/getting-started.md)
3. [Conversations, workspaces, and approvals](knowledge/public/guides/conversations.md)
4. [Photos, files, and dictation](knowledge/public/guides/attachments.md)
5. [Offline behavior and notifications](knowledge/public/guides/connectivity-notifications.md)
6. [Appearance and accessibility](knowledge/public/guides/appearance-accessibility.md)
7. [Troubleshooting](knowledge/public/faqs/troubleshooting.md)

## Understand and operate it

- [System architecture and trust boundaries](knowledge/private/architecture/system-overview.md)
- [Daemon, CLI, and session lifecycle](knowledge/private/daemon/lifecycle.md)
- [Phone app state and rendering](knowledge/private/app/client-architecture.md)
- [Protocol and E2E session contract](knowledge/private/protocol/wire-and-encryption.md)
- [Relay admission and deployment](knowledge/private/relay/operations.md)
- [Provider integration and discovery](knowledge/private/providers/integration.md)
- [Configuration and data locations](knowledge/private/operations/configuration-data.md)
- [Development and verification](knowledge/private/operations/development-testing.md)
- [Build, release, and update operations](knowledge/private/operations/releases.md)
- [Documentation conventions](knowledge/private/standards/documentation-framework.md)

## Source wiki

Open the [source wiki navigation and coverage map](knowledge/private/codebase-graph/meta/coverage.md)
for entity references and cross-package flows covering the phone app, daemon/CLI,
protocol and relay. Narrative pages explain workflows and limits; the wiki provides
source-cited implementation details.

The reference catalog is **generated from Hivemind's tree-sitter code graph**.
The wiki coverage map links the generated pages, current extraction counts,
repeatable local commands, parser warnings and the retained curated explanations.
Static extraction is not proof of runtime behavior. Cloud upload and external
agent spawning are disabled for this workflow.

## Scope and evidence

These pages describe source inspected on **2026-10-08**, not a promise that every provider, phone OS, or store distribution has been exercised. Each focused page links to repository source. `private` means **engineering audience**, not access control: these files are visible wherever the repository is visible. Never put credentials, pairing URLs, or private transcripts here.

Schema v2 reserves `requirements/{backlog,in-work,completed}` for PRDs and `issues/{backlog,in-work,completed}` for GitHub-numbered IRDs. No plans or findings were invented to populate them. QA authors own `qa/` content and `requirements/reports/`. Human-only `notes/` is not read or written by agents. Empty reserved directories may not survive a Git checkout; create them when actual work needs them.

[Project README](../README.md) · [Contributing](../CONTRIBUTING.md) · [Provider recipe](../docs/ADDING_A_PROVIDER.md) · [Security policy](../SECURITY.md) · [Privacy policy](../PRIVACY.md)
