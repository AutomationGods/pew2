---
type: "entity"
title: "cmdToggle"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/daemon/src/cli/index.ts:168-206"
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
path: "packages/daemon/src/cli/index.ts"
language: "ts"
graph_language: "typescript"
graph_node_id: "packages/daemon/src/cli/index.ts:cmdToggle:function"
source_location: "L168-206"
source_sha256: "b35cb6d6efb0033709a259e00b14602484b4fd74f6b63f4ed50a7d8f9775de71"
last_commit_hash: "45a6de159f743a0468d19b6a3637de954bfb319b"
last_commit_author: "AutomationGod"
last_commit_date: "2026-10-01T21:47:49-04:00"
exported: false
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# cmdToggle

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: false. (packages/daemon/src/cli/index.ts:168-206)
- Extracted signature: async function cmdToggle(id: string &#124; undefined, enabled: boolean): Promise&#60;number&#62;. (packages/daemon/src/cli/index.ts:168-206)
- Source SHA-256: b35cb6d6efb0033709a259e00b14602484b4fd74f6b63f4ed50a7d8f9775de71. Verified against the local extraction cache.
- Last source commit: 45a6de159f743a0468d19b6a3637de954bfb319b; AutomationGod; 2026-10-01T21:47:49-04:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/24603af7ff914770c4a4b4fa3ccfadec00ec807a0b2d003c7367802acbb04097]] — main; evidence: packages/daemon/src/cli/index.ts:726-800.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/24603af7ff914770c4a4b4fa3ccfadec00ec807a0b2d003c7367802acbb04097]] — main; evidence: packages/daemon/src/cli/index.ts:726-800.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/1f4043e0092b020c1c89534285eaca06743683e0859d050b7cafa82e87d4ba11]] — colorLevel; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/28e1957a16687d4b87605633403a39b4cb74778479313319e66d643b04e2dc7b]] — rail; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/4416caebb4d2eae9e56c6a26b36490de2fb7f32ebe850178f7fb9316f5b0cf4d]] — loadProviders; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/66d765722947096a1ce1cf050cb84467c3210981da70c0fbf3cdf9a4afbf8d52]] — glyphs; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/74f3db67f0baaea9d1addf68f36683ce410c05de953fbe3b139dcb4088d2e5bc]] — setEnabled; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/76b406601681086f90b42b9863e804d62847f86ab99b2a8269f2eb2ed81c48af]] — styler; evidence: packages/daemon/src/cli/index.ts:168-206.
- outgoing calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9a223846b3fc7489cc037b6e330f623f6db232873e5c5684e5dbf6200c19e483]] — unicodeOk; evidence: packages/daemon/src/cli/index.ts:168-206.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
