---
ai_description: >-
  Define narrative library ownership, metadata, source evidence and maintenance boundaries for pew2.
human_description: >-
  Keep documentation useful, linked and honest as the application changes.
---

# Documentation framework

**Category:** Engineering / Standards | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## Navigation and ownership

[Library home](../../../README.md) is the narrative entry point. Public pages explain user workflows; private pages explain engineering and operations. **Private is an audience label, not repository access control.** Never commit pairing links, credentials, local transcripts or unreviewed logs.

The wiki worker owns `library/knowledge/private/codebase-graph/`. Narrative maintainers must not modify it. Link its validated navigation from the library index rather than copying its code inventory into every guide.

## Page conventions

- Use focused Markdown pages with a clear task or topic, not one whole-app dump.
- Keep YAML `ai_description` and `human_description` concise and nonempty.
- Follow the title with a Category / Version / Date / Status line. The date records the documentation revision, not proof of a runtime test.
- Link repo-relative source files that actually implement the claim. Use a precise line anchor only when verified; a file link with a named function is preferable to a misleading line number.
- Explain limitations near the workflow they constrain. Distinguish availability, schema validity, probe success and end-to-end verification.
- Prefer additive/surgical edits and preserve existing changes. Update incoming links when moving a page.

## Lifecycle and protected areas

PRDs use repo-local sequential numbers checked across backlog, in-work and completed. IRDs use existing GitHub issue numbers; never invent them. Move the whole work folder when lifecycle changes. Do not create planning artifacts merely to fill empty scaffold directories.

QA findings/report content belongs to the quality worker, including `qa/` and `requirements/reports/`. Human `notes/` is never written by agents. Policies such as SECURITY.md and PRIVACY.md require separate authorized changes; narrative explanations do not silently replace those policies.

## Maintenance pass

1. Read the changed code/config and the affected narrative pages. Prefer executable behavior over stale comments.
2. Update workflows, defaults and security limits together. Important drift triggers include provider manifests/bundling, pairing commands, wire unions, attachment budgets, replay bounds and release guards.
3. Check relative links, Markdown anchors, frontmatter and required page headers. Check that every navigation destination exists.
4. State which checks actually ran. Do not convert prior caller-supplied results into a fresh verification claim, or unit tests into native/store/deployment evidence.
5. Report remaining gaps explicitly. Do not author QA reports as part of a documentation sync.

## Repository evidence anchors

- [CLI](../../../../packages/daemon/src/cli/index.ts) and [pair command](../../../../packages/daemon/src/cli/pair.ts) — user command truth.
- [Wire schema](../../../../packages/protocol/src/wire.ts) and [channel](../../../../packages/protocol/src/channel.ts) — endpoint contract.
- [Session log](../../../../packages/daemon/src/session/log.ts) — actual replay ownership and bounds, rather than stale relay-log comments.
- [Root scripts](../../../../package.json), [CI](../../../../.github/workflows/ci.yml), [release workflow](../../../../.github/workflows/release.yml) — current check/release behavior.
