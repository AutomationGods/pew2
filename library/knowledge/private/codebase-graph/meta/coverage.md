---
type: meta
title: Pew2 automated graph reference and curated wiki coverage
status: developing
report_type: coverage
date: 2026-10-08
curated_page_count_including_coverage: 19
automated_entity_count: 2253
automated_meta_page_count: 22
automated_source_count: 333
automated_edge_count: 2929
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
created: 2026-10-08
updated: 2026-10-08
last_commit_hash: e5d9db0b528545d143711a7be3a1ca49294cc42a
git_metadata_scope: repository HEAD baseline, not a working-tree content hash
extraction: automated-tree-sitter-reference-plus-preserved-curated-prose
partial_scan: true
graph_reconciled: false
tags:
  - meta
  - coverage
related: []
sources:
  - packages/app/App.tsx:459-475
  - packages/app/src/useDaemon.ts:599-716
  - packages/daemon/src/index.ts:2080-2117
  - packages/protocol/src/channel.ts:122-174
  - packages/relay/src/index.ts:202-226
  - .github/workflows/release.yml:5-37
---

# Pew2 automated graph reference and curated wiki

## Start here: automated AST reference

- [Automated graph catalog](generated/catalog.md) — **2,253 atomic node pages, 2,929 graph edges, 333 extracted source files**; zero skipped files. All current source SHA-256 hashes were checked against the real extraction cache before rendering.
- [Verified source provenance](generated/sources-1.md) — paginated source hashes and actual per-source git metadata.
- [Stale output report](generated/stale-output.md) — removed graph records are reported, never silently deleted.
- [Deterministic renderer](../tools/generate.mjs) — built-ins-only Node tooling; no LLM, source execution, installs, or uploads.
- [Local-only extraction wrapper](../tools/build-graph.mjs) — isolated installed-engine extraction, owned separately from this renderer.

The installed Hivemind 0.7.160 tree-sitter engine completed real extraction. Snapshot: `.gg/wiki-graph/2b2f1b8b1d64a4ad/snapshots/e5d9db0b528545d143711a7be3a1ca49294cc42a.json`. Canonical graph SHA-256: `c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d`.

### Repeat locally

From the repository root, set `HIVEMIND_ROOT` to the already installed `@deeplake/hivemind` package directory (no installation):

```sh
node library/knowledge/private/codebase-graph/tools/build-graph.mjs --hivemind-root "$HIVEMIND_ROOT"
node library/knowledge/private/codebase-graph/tools/generate.mjs --snapshot .gg/wiki-graph/2b2f1b8b1d64a4ad/snapshots/e5d9db0b528545d143711a7be3a1ca49294cc42a.json --expect-sha256 c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d
```

After extraction changes, use the new snapshot path; the optional `--expect-sha256` pins the canonical graph hash. The default `.gg/wiki-graph/input-manifest.json` is mandatory: its raw snapshot SHA-256, exact source-file set, all 333 current source hashes, engine version, and local-only flags must match. Renderer validation also rejects mismatched HEAD, worktree, source cache, or non-owned output. Warnings come from that build manifest. Generated pages contain ownership markers. Documentation/tooling is excluded from extraction to prevent self-indexing.

### Limits of automation

- One parser warning: `packages/app/src/ui/Sidebar.tsx:630`. Relevant extracted declarations may be incomplete; no completeness claim beyond emitted graph nodes is made.
- Edges retain their actual confidence (`EXTRACTED` in this snapshot). External/unresolved endpoints are plain text, not invented wiki targets. Citations locate declarations; they do not promise exact call-expression coordinates.
- No behavior inference, ADR generation, or domain-role classification. `type_alias` normalizes to `type`; nonexported declarations without an exact canonical entity subtype retain a null `entity_type` and explicit graph kind.
- Real extraction and deterministic rendering are completed operations, **not canonical wiki-driver orchestration/global reconciliation**. `partial_scan: true` and `graph_reconciled: false` remain intentional. No reserved global index/hash state was changed.
- Sources excluded by the engine, unsupported formats, dependencies, and runtime/device behavior are outside this reference. Source hashes describe current bytes; last-source git metadata separately describes committed history.

## Preserved curated navigation — manually source-read

The original boundary map contains **14 curated entity pages, four concept pages, and this updated coverage page (19 original paths)**. The 18 entity/concept prose pages are preserved unchanged, not relabeled as automatically extracted. The references below remain curated interpretation, distinct from the generated factual catalog.

### Mobile app
- [Mobile app shell](../entities/mobile-app.md) — composition boundary and pairing/approval delegation.
- [useDaemon](../entities/use-daemon.md) — client state and connection boundary.
- [Outbox](../entities/outbox.md) — bounded, memory-only unsent work.

### Daemon and CLI
- [Daemon lifecycle](../entities/daemon.md) — lifecycle, replay and session closure.
- [SessionLog](../entities/session-log.md) — bounded event retention.
- [ACP connection](../entities/acp-connection.md) — subprocess and ACP capability boundary.
- [CLI](../entities/cli.md) — operational entrypoint and binary compilation.
- [Provider registry](../entities/provider-registry.md) — manifest validation and bundled providers.
- [Update scheduler](../entities/updates.md) — staged updates and idle restart.
- [Push delivery](../entities/push.md) — notification payload and privacy exception.

### Protocol and relay
- [Wire contract](../entities/wire-contract.md) — shared message schemas.
- [SecureChannel](../entities/secure-channel.md) — proof, admission and replay counters.
- [Relay admission](../entities/relay-admission.md) — stale-daemon replacement policy.
- [PairingRoom](../entities/pairing-room.md) — opaque forwarding, not transcript storage.

### Cross-package flows
- [Pairing and E2E](../concepts/pairing-e2e.md) — first claim, rotation, metadata exposure and push exception.
- [Replay and offline recovery](../concepts/replay-offline.md) — catch-up versus unsent work and durability limits.
- [Build and release ownership](../concepts/build-release-ownership.md) — CI, binary/app/relay boundaries and working-tree caveat.
- [Workspace and attachments](../concepts/workspace-attachments.md) — cwd selection and attachment lifecycle.
- [Coverage](./coverage.md) — this navigation and coverage report.

## Curated-pass ownership and history
- The original curated pass was manual. Its earlier tooling-unavailable assertion was incorrect: installed Hivemind and a working native tree-sitter parser were subsequently verified, and the generated catalog now uses their real extraction.
- Curated pages remain `developing`, manually source-read, and `partial_scan: true`; generated pages are separately labeled. Neither path claims canonical global reconciliation.
- Writes belong only to `library/knowledge/private/codebase-graph/`. Narrative documentation, source, tests, workflows, manifests, ADR directories and global driver-owned state are outside this pass's write ownership.
- No ADR or speculative relationship was inferred. This first documentation pass has no prior wiki contract to supersede; stale source comments are recorded as interpretation warnings, not fabricated historical decisions.
- `private/` is an audience convention, not access control. No credentials, actual pairing links or runtime user transcripts were copied here.

## Curated coverage exclusions
The original curated prose is not a per-helper catalog; the new automated catalog separately covers every emitted graph node. Neither provides per-provider certification, dependency internals, generated/native asset inventory or non-JS per-file stub inventory. JSON/YAML/shell sources are cited only for selected curated provider/build boundaries; they were not AST-extracted. Detailed runtime, device and provider-specific behavior remains unverified.

## Evidence caveats
- Entity `last_commit_hash` values identify the last committed change to their primary source, with author/date fetched read-only from git. Concept/report hashes identify the repository HEAD baseline. Neither identifies uncommitted working-tree content.
- Approved uncommitted CI/release fixes are present: Bun 1.3.14, release quality gating and manual-run nonpublication. Documentation cites current working-tree source; it does not claim those changes are committed or remotely deployed. (`.github/workflows/ci.yml:23-56`, `.github/workflows/release.yml:5-37`, `.github/workflows/release.yml:168-240`)
- Comments claiming relay-owned replay are stale. Actual catch-up is daemon-owned; relay code forwards frames. (`packages/protocol/src/crypto.ts:127-139`, `packages/protocol/src/channel.ts:269-287`, `packages/daemon/src/index.ts:2080-2117`, `packages/relay/src/index.ts:202-226`)
- Outbox memory is not durable delivery; push content is outside the E2E session envelope. (`packages/app/src/useDaemon.ts:716`, `packages/app/src/outbox.ts:66-123`, `packages/daemon/src/push.ts:140-160`, `packages/daemon/src/push.ts:200-210`)
- First claim has key/identity and first-arrival limitations; relay replacement retains the 90-second stale safeguard. (`packages/daemon/src/device-claim.ts:18-27`, `packages/relay/src/admission.ts:30-161`)

## Verification status
The renderer validates the build manifest/raw snapshot hash and exact source hashes, snapshot provenance, optional canonical graph hash, HEAD, all 333 source hashes against extraction caches, cached declaration agreement, source ranges, unique node IDs, graph confidence, output ownership, link targets and the 300-line page limit before writing. Verification completed: two repeated runs made zero page writes; all 2,253 entity pages and 5,231 outgoing/incoming relationship occurrences were checked; all catalog Markdown links and canonical wikilinks resolved; maximum generated page length was 178 lines. Negative checks rejected a wrong canonical graph hash, wrong manifest snapshot hash, wrong manifest source hash, and a non-owned output fixture without changing generated output. Both tooling scripts passed `node --check`.

Repeat structural verification:

```sh
node library/knowledge/private/codebase-graph/tools/verify.mjs --snapshot .gg/wiki-graph/2b2f1b8b1d64a4ad/snapshots/e5d9db0b528545d143711a7be3a1ca49294cc42a.json --expect-sha256 c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d
```

These are structural documentation checks, not application or behavior certification. No application tests, UI/device checks, live notifications, host-agent spawning, remote CI verification, deployment or publication were performed by this renderer.
