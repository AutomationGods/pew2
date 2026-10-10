---
type: "entity"
title: "packages/daemon/src/trace.ts"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/daemon/src/trace.ts:1"
generated_by: "pew2-ast-reference-v1"
extraction: "hivemind-tree-sitter"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
graph_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
partial_scan: true
graph_reconciled: false
entity_type: "module"
graph_kind: "module"
symbol_kind: "module"
classification_note: "Graph declaration classification only; no domain-role inference"
path: "packages/daemon/src/trace.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/daemon/src/trace.ts::module"
source_location: "L1"
source_sha256: "675e3f2faf7df7f8cc229a6ae4f17c881e8ff2372a868423f7905a2f62497958"
last_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
last_commit_author: "AutomationGod"
last_commit_date: "2026-10-08T20:10:31-04:00"
exported: false
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# packages/daemon/src/trace.ts

## Extracted declaration

- Graph kind: module; normalized symbol kind: module; exported: false. (packages/daemon/src/trace.ts:1)
- Source SHA-256: 675e3f2faf7df7f8cc229a6ae4f17c881e8ff2372a868423f7905a2f62497958. Verified against the local extraction cache.
- Last source commit: e5d9db0b528545d143711a7be3a1ca49294cc42a; AutomationGod; 2026-10-08T20:10:31-04:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/438ea99c916478aa5f83d46e15c2b724c76d2861777f73c3220bb58da6b115c4]] — packages/daemon/src/acp/connect.ts; evidence: packages/daemon/src/acp/connect.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/4f4dcb49ef53f95b34340e2cb4d22d2248c546606bfae115bc9c7d306462405b]] — packages/daemon/src/relay-client.ts; evidence: packages/daemon/src/relay-client.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/510e15e28244435c4cbfda4da7061cf5c0d5a010417e7685aadd98db55ef03d7]] — packages/daemon/src/server.ts; evidence: packages/daemon/src/server.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/615ad5593fd02701da336d20a41d2ef09b3b5e87436b4f0e937c1afa31bea2f9]] — packages/daemon/src/handler.ts; evidence: packages/daemon/src/handler.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c6f05f4d2316c8b72fb5464b094b1096be816e3a3d6759a7d01f82e8b2638230]] — packages/daemon/src/index.ts; evidence: packages/daemon/src/index.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f45cf27a58f80ae3e0f5d88425a9635b07375d6baa3bcebfee4cbb607b46f651]] — packages/daemon/src/trace.test.ts; evidence: packages/daemon/src/trace.test.ts:1.
- outgoing imports [EXTRACTED]: external:node:crypto (external/unresolved; no wiki target); evidence: packages/daemon/src/trace.ts:1.
- outgoing imports [EXTRACTED]: external:node:fs (external/unresolved; no wiki target); evidence: packages/daemon/src/trace.ts:1.
- outgoing imports [EXTRACTED]: external:node:path (external/unresolved; no wiki target); evidence: packages/daemon/src/trace.ts:1.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
