---
type: "entity"
title: "setRelay"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/daemon/src/pairing.ts:222-228"
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
path: "packages/daemon/src/pairing.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/daemon/src/pairing.ts:setRelay:function"
source_location: "L222-228"
source_sha256: "2e4f1ef2efdb221b212b60b1d4339449268f0711303c8a5455ae5bcc0dff93a1"
last_commit_hash: "402a3701f5c7e38c521fa16ccaf0468fdd8ef7ed"
last_commit_author: "kenkaiii"
last_commit_date: "2026-08-08T14:39:59+08:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# setRelay

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: true. (packages/daemon/src/pairing.ts:222-228)
- Extracted signature: async function setRelay(. (packages/daemon/src/pairing.ts:222-228)
- Source SHA-256: 2e4f1ef2efdb221b212b60b1d4339449268f0711303c8a5455ae5bcc0dff93a1. Verified against the local extraction cache.
- Last source commit: 402a3701f5c7e38c521fa16ccaf0468fdd8ef7ed; kenkaiii; 2026-08-08T14:39:59+08:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/202c88b8c210b18c92886e04899596e4e01dc2d55b3c3c458d1c7eed1ee20db5]] — cmdRelay; evidence: packages/daemon/src/cli/index.ts:401-449.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9ff1ecd18b898f72508de0966dac3b27bb001888e605d5e604df4b8fc7ea3579]] — writePairing; evidence: packages/daemon/src/pairing.ts:222-228.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e33f79fb0a971ea278d76df38f3dfb1b4d64ab975e674011c5d149b80a9d518f]] — loadPairing; evidence: packages/daemon/src/pairing.ts:222-228.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
