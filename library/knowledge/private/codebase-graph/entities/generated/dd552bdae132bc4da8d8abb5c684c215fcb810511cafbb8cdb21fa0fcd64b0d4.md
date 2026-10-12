---
type: "entity"
title: "touchSlop"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/app/src/ui/controls.tsx:30-33"
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
path: "packages/app/src/ui/controls.tsx"
language: "tsx"
graph_language: "typescript"
graph_node_id: "packages/app/src/ui/controls.tsx:touchSlop:function"
source_location: "L30-33"
source_sha256: "818f22eceecfa8fad23eb77427772826ea3c045c9bd239d6a78dec24b0082536"
last_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
last_commit_author: "AutomationGod"
last_commit_date: "2026-10-08T20:10:31-04:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# touchSlop

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: true. (packages/app/src/ui/controls.tsx:30-33)
- Extracted signature: function touchSlop(size: number, touchMin = 44). (packages/app/src/ui/controls.tsx:30-33)
- Source SHA-256: 818f22eceecfa8fad23eb77427772826ea3c045c9bd239d6a78dec24b0082536. Verified against the local extraction cache.
- Last source commit: e5d9db0b528545d143711a7be3a1ca49294cc42a; AutomationGod; 2026-10-08T20:10:31-04:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/0328161e1aa46b6d48b16f4d8b8627b4c3bec703f68809787632c3e15ec985bc]] — CircleButton; evidence: packages/app/src/ui/controls.tsx:48-107.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/0328161e1aa46b6d48b16f4d8b8627b4c3bec703f68809787632c3e15ec985bc]] — CircleButton; evidence: packages/app/src/ui/controls.tsx:48-107.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/12f2429147f849ac9882016abe58b0d210ee0ec7b7f73bca6e87a7fba54cca86]] — CommandSheetView; evidence: packages/app/src/ui/CommandSheet.tsx:31-77.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/177502d8ebb39739f84ab06bcbc5b44f023aa8315d42af637d6dd648630e8c92]] — Row; evidence: packages/app/src/ui/NewChatSheet.tsx:601-668.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/2f4536f83730b43772f464250341dc86f747874383ec3503da81e5c4ab1ccd57]] — ContextBarView; evidence: packages/app/src/ui/ContextBar.tsx:55-185.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/32bbd902189466b6d5752652a3142ba90793606596d476af030a05769550802e]] — AttachmentSheetView; evidence: packages/app/src/ui/AttachmentSheet.tsx:41-77.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6c5d65a9cb8906d5471877c568615ea00f898783720cde470c3312ebf2256c9c]] — SidebarView; evidence: packages/app/src/ui/Sidebar.tsx:302-702.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9c828d969b89bac993bdc456f5a3cb5beedc9701ea9c76a4ce866716e878215b]] — CopyButton; evidence: packages/app/src/ui/CopyButton.tsx:68-137.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d24757f1c60e8986460f85e30bd665b39cb723fd0fe18e333cca257814c8469b]] — NewChatChip; evidence: packages/app/src/ui/Sidebar.tsx:715-765.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d7012b75290ad055daffabb6eb087316b8bb7b38738759d3b9edbea60171e603]] — AttachmentChipsView; evidence: packages/app/src/ui/AttachmentChips.tsx:40-95.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/dca411eca2eeae4515c4ef832db82afb3afdf73cba692fbd8396d228724ff10b]] — ComposerView; evidence: packages/app/src/ui/Composer.tsx:118-512.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/dfef15f9c9790ffef073a7e810ca112a2b95c0b306d64e50cd7e92cb31caaf03]] — TurnView; evidence: packages/app/src/ui/Turn.tsx:90-240.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f1b9393edab46d25182b5d58532a73d4eb03c6c52d094f739db3a97358f3ba59]] — PermissionCard; evidence: packages/app/src/ui/ActivityScreen.tsx:202-256.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f5fcb38fac3828697cb37c25f76b06e31f22c2c5fbd848aac3e05c4f240e53a5]] — ApprovalSheetView; evidence: packages/app/src/ui/ApprovalSheet.tsx:29-72.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
