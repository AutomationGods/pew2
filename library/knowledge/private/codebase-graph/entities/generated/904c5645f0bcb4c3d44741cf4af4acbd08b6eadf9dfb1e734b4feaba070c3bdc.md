---
type: "entity"
title: "send"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/app/src/verifyPairing.test.ts:38-40"
generated_by: "pew2-ast-reference-v1"
extraction: "hivemind-tree-sitter"
graph_snapshot_sha256: "c010a51a5f79351284c36fcf9be5fd035a4dee2c22220af04506def96336cc5d"
graph_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
engine: "@deeplake/hivemind"
engine_version: "0.7.160"
partial_scan: true
graph_reconciled: false
entity_type: null
graph_kind: "method"
symbol_kind: "method"
classification_note: "No exact canonical entity subtype; retain actual graph kind"
path: "packages/app/src/verifyPairing.test.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/app/src/verifyPairing.test.ts:FakeSocket.send:method"
source_location: "L38-40"
source_sha256: "fcb7473abed526e0f0f1dbffb949658b7e36a7cf3bddc085e0f566a093e5af9c"
last_commit_hash: "09a6ffbc88406c188bb77753e7ef18875cd599d9"
last_commit_author: "kenkaiii"
last_commit_date: "2026-08-08T14:34:28+08:00"
exported: false
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# send

## Extracted declaration

- Graph kind: method; normalized symbol kind: method; exported: false. (packages/app/src/verifyPairing.test.ts:38-40)
- Extracted signature: send(raw: string). (packages/app/src/verifyPairing.test.ts:38-40)
- Source SHA-256: fcb7473abed526e0f0f1dbffb949658b7e36a7cf3bddc085e0f566a093e5af9c. Verified against the local extraction cache.
- Last source commit: 09a6ffbc88406c188bb77753e7ef18875cd599d9; kenkaiii; 2026-08-08T14:34:28+08:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming method&#95;of [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/8be7eadcf1b7e5d93b7038aa386faf567954437ea25f2222a2b8206376225077]] — FakeSocket; evidence: packages/app/src/verifyPairing.test.ts:26-48.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
