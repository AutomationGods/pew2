---
type: "entity"
title: "statusLine"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/daemon/src/cli/ui.ts:313-382"
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
path: "packages/daemon/src/cli/ui.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/daemon/src/cli/ui.ts:statusLine:function"
source_location: "L313-382"
source_sha256: "cd8f207af8f69e0d273e8f4d8d852f7bd5a08461d55fcbdbe37c465ad26432c6"
last_commit_hash: "bd06d997d43ae4dc1e7c6008af947b1e66ec5e70"
last_commit_author: "kenkaiii"
last_commit_date: "2026-08-05T13:48:20+08:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# statusLine

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: true. (packages/daemon/src/cli/ui.ts:313-382)
- Extracted signature: function statusLine(. (packages/daemon/src/cli/ui.ts:313-382)
- Source SHA-256: cd8f207af8f69e0d273e8f4d8d852f7bd5a08461d55fcbdbe37c465ad26432c6. Verified against the local extraction cache.
- Last source commit: bd06d997d43ae4dc1e7c6008af947b1e66ec5e70; kenkaiii; 2026-08-05T13:48:20+08:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/bb9e966e702896d34cb5ef7a035bae3be7cf5b47653e70ebf169f9e5fa8351c0]] — waitInteractively; evidence: packages/daemon/src/cli/pair.ts:358-426.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/cd66b3b99a09befe68b78669630d7f0c1487c0de8271b9425778548ba62763a6]] — cmdSetup; evidence: packages/daemon/src/cli/index.ts:248-396.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/66d765722947096a1ce1cf050cb84467c3210981da70c0fbf3cdf9a4afbf8d52]] — glyphs; evidence: packages/daemon/src/cli/ui.ts:313-382.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/76b406601681086f90b42b9863e804d62847f86ab99b2a8269f2eb2ed81c48af]] — styler; evidence: packages/daemon/src/cli/ui.ts:313-382.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e8d4e0f36dc3f66d3363e1d7539807b13201c88279d8c7874796d71870fb1671]] — hideCursor; evidence: packages/daemon/src/cli/ui.ts:313-382.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
