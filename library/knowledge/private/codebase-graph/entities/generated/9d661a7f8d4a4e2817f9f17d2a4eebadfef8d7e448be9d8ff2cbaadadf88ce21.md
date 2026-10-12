---
type: "entity"
title: "startUpdateScheduler"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/daemon/src/update/scheduler.ts:119-283"
generated_by: "pew2-ast-reference-v1"
extraction: "hivemind-tree-sitter"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
graph_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
partial_scan: true
graph_reconciled: false
entity_type: "function"
graph_kind: "function"
symbol_kind: "function"
classification_note: "Graph declaration classification only; no domain-role inference"
path: "packages/daemon/src/update/scheduler.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/daemon/src/update/scheduler.ts:startUpdateScheduler:function"
source_location: "L119-283"
source_sha256: "9eb354aa9d78515d2c5dbb4cb1bd3ad3b2a17e5caf97caf8203df262c5c90754"
last_commit_hash: "0b184c25584ad2d2c05d6c0e1abe33f8c04a2188"
last_commit_author: "kenkaiii"
last_commit_date: "2026-08-12T01:38:08+08:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# startUpdateScheduler

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: true. (packages/daemon/src/update/scheduler.ts:119-283)
- Extracted signature: function startUpdateScheduler(deps: SchedulerDeps): UpdateScheduler &#124; undefined. (packages/daemon/src/update/scheduler.ts:119-283)
- Source SHA-256: 9eb354aa9d78515d2c5dbb4cb1bd3ad3b2a17e5caf97caf8203df262c5c90754. Verified against the local extraction cache.
- Last source commit: 0b184c25584ad2d2c05d6c0e1abe33f8c04a2188; kenkaiii; 2026-08-12T01:38:08+08:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/0709a9658c8c9729f66b6cea34266728f8a03142d8594f0df2ec7c1529c89fb8]] — harness; evidence: packages/daemon/src/update/scheduler.test.ts:34-78.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
