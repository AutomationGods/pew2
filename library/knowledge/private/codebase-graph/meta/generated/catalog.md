---
type: "meta"
title: "Automated AST graph reference"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "meta"
  - "automated-graph"
related: []
sources: []
generated_by: "pew2-ast-reference-v1"
extraction: "hivemind-tree-sitter"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
graph_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
partial_scan: true
graph_reconciled: false
report_type: "graph-catalog"
node_count: 2253
edge_count: 2929
source_count: 333
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# Automated AST graph reference

2253 atomic node pages; 2929 graph edges; 333 current source files verified by SHA-256 against extraction caches.

## Catalog

- [Node catalog 1](catalog-1.md)
- [Node catalog 2](catalog-2.md)
- [Node catalog 3](catalog-3.md)
- [Node catalog 4](catalog-4.md)
- [Node catalog 5](catalog-5.md)
- [Node catalog 6](catalog-6.md)
- [Node catalog 7](catalog-7.md)
- [Node catalog 8](catalog-8.md)
- [Node catalog 9](catalog-9.md)
- [Node catalog 10](catalog-10.md)
- [Node catalog 11](catalog-11.md)
- [Node catalog 12](catalog-12.md)
- [Node catalog 13](catalog-13.md)
- [Node catalog 14](catalog-14.md)
- [Node catalog 15](catalog-15.md)
- [Node catalog 16](catalog-16.md)

## Source provenance

- [Source provenance 1](sources-1.md)
- [Source provenance 2](sources-2.md)
- [Source provenance 3](sources-3.md)
- [Source provenance 4](sources-4.md)

## Reproduce locally

Run from repository root; requires the real snapshot and its sibling extraction cache:

```sh
node library/knowledge/private/codebase-graph/tools/generate.mjs --snapshot .gg/wiki-graph/2b2f1b8b1d64a4ad/snapshots/e5d9db0b528545d143711a7be3a1ca49294cc42a.json --expect-sha256 c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d
```

Engine: @deeplake/hivemind 0.7.160; graph schema 1; canonical graph SHA-256 c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d. Snapshot file SHA-256 dcc477dae555f222535fb68d385dd6878872d26cbd278e7c5933a247908855f8. Build manifest: .gg/wiki-graph/input-manifest.json; SHA-256 d74f0ecb9e6c26741a0b78174925ab904737a4e0aecdeefcf2c27dadd17e9cda. Its exact source-file set and all current source hashes are verified before rendering.

The supplied expected graph hash pins extracted records, not an independent authenticity signature. Current source hashes and cached AST declarations must match before any writes.

## Limits

- Real Hivemind/tree-sitter extraction completed; this deterministic renderer is not the canonical wiki driver. Global reconciliation has not run; partial_scan remains true.
- No LLM, upload, install, shell, or source execution by this generator. No behavior narratives, domain-role inference, ADRs, or invented relationships.
- This catalog covers nodes emitted by the engine, not all possible language constructs or unsupported source formats. A generated node is not necessarily an exported API.
- Canonical entity types are assigned only where justified. Other nonexported declarations have a null entity_type and their actual graph_kind/symbol_kind; type_alias normalizes to type.
- Confidence is preserved exactly; unresolved/external endpoints remain plain text. Cross-file resolution is not invented.
- 1 parser warning(s): warn: parse issue in packages/app/src/ui/Sidebar.tsx L630: parse error at L630. Affected declarations may be incomplete.
- Last-source git metadata is distinct from verified current working-tree bytes. Source hashing covers the 333 extracted files, not the whole repository.
- Existing curated prose remains manually authored; see [curated coverage](../coverage.md).
- Removed outputs are never deleted; see [stale output report](stale-output.md).
