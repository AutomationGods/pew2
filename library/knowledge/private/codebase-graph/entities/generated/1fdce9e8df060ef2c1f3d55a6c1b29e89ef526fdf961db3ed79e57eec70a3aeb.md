---
type: "entity"
title: "verifyProof"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/protocol/src/channel.ts:204-224"
generated_by: "pew2-ast-reference-v1"
extraction: "hivemind-tree-sitter"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
graph_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
partial_scan: true
graph_reconciled: false
entity_type: "exported-symbol"
graph_kind: "method"
symbol_kind: "method"
classification_note: "Graph declaration classification only; no domain-role inference"
path: "packages/protocol/src/channel.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/protocol/src/channel.ts:SecureChannel.verifyProof:method"
source_location: "L204-224"
source_sha256: "6c87274bc99d9affcdaec2ca5feb46c65300e8629c4ed2c0ca6126d44bc4a222"
last_commit_hash: "3c45b499b7ead50a22cda93bfcaac60df3dc9b13"
last_commit_author: "kenkaiii"
last_commit_date: "2026-08-07T06:06:46+08:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# verifyProof

## Extracted declaration

- Graph kind: method; normalized symbol kind: method; exported: true. (packages/protocol/src/channel.ts:204-224)
- Extracted signature: verifyProof(envelope: unknown, deviceId: string, now = Date.now()): boolean. (packages/protocol/src/channel.ts:204-224)
- Source SHA-256: 6c87274bc99d9affcdaec2ca5feb46c65300e8629c4ed2c0ca6126d44bc4a222. Verified against the local extraction cache.
- Last source commit: 3c45b499b7ead50a22cda93bfcaac60df3dc9b13; kenkaiii; 2026-08-07T06:06:46+08:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming method&#95;of [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c5944e6023a4d9e420249112305538fd2d641e58657d024941eead4beff6dacf]] — SecureChannel; evidence: packages/protocol/src/channel.ts:70-267.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c11d883a38ded02287c582a114cfd7192d451005f317da4c626ce4358ea83f09]] — trim; evidence: packages/protocol/src/channel.ts:204-224.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c4826efb6c09ab022ce4fea6b882f2065f64c795fd3e4a905f358dca2e63d967]] — open; evidence: packages/protocol/src/channel.ts:204-224.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
