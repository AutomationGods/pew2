---
type: "entity"
title: "useAppTheme"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/app/src/appearance.tsx:82-86"
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
path: "packages/app/src/appearance.tsx"
language: "tsx"
graph_language: "typescript"
graph_node_id: "packages/app/src/appearance.tsx:useAppTheme:function"
source_location: "L82-86"
source_sha256: "abc21eba9ca40e654e63998f62a7a685f0d72910d809fe9fad3ab9b75898955a"
last_commit_hash: "680532d507b0ff367185aa02967824af9e2823a8"
last_commit_author: "AutomationGod"
last_commit_date: "2026-09-03T18:10:22-04:00"
exported: true
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# useAppTheme

## Extracted declaration

- Graph kind: function; normalized symbol kind: function; exported: true. (packages/app/src/appearance.tsx:82-86)
- Extracted signature: function useAppTheme(): AppearanceContextValue. (packages/app/src/appearance.tsx:82-86)
- Source SHA-256: abc21eba9ca40e654e63998f62a7a685f0d72910d809fe9fad3ab9b75898955a. Verified against the local extraction cache.
- Last source commit: 680532d507b0ff367185aa02967824af9e2823a8; AutomationGod; 2026-09-03T18:10:22-04:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/0328161e1aa46b6d48b16f4d8b8627b4c3bec703f68809787632c3e15ec985bc]] — CircleButton; evidence: packages/app/src/ui/controls.tsx:48-107.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/12f2429147f849ac9882016abe58b0d210ee0ec7b7f73bca6e87a7fba54cca86]] — CommandSheetView; evidence: packages/app/src/ui/CommandSheet.tsx:31-77.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/177502d8ebb39739f84ab06bcbc5b44f023aa8315d42af637d6dd648630e8c92]] — Row; evidence: packages/app/src/ui/NewChatSheet.tsx:601-668.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/21004584206f710fb8143674f42239106bf28a7544361053bb72583922ccb226]] — PairingScreen; evidence: packages/app/src/ui/PairingScreen.tsx:43-240.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/27e265eef69ba67bd92aa4a56f1a385a15afdd699f01aa313896d904fe443a79]] — NewChatSheetView; evidence: packages/app/src/ui/NewChatSheet.tsx:97-572.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/2f4536f83730b43772f464250341dc86f747874383ec3503da81e5c4ab1ccd57]] — ContextBarView; evidence: packages/app/src/ui/ContextBar.tsx:55-185.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/32bbd902189466b6d5752652a3142ba90793606596d476af030a05769550802e]] — AttachmentSheetView; evidence: packages/app/src/ui/AttachmentSheet.tsx:41-77.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/3401224e99b8f4852e04aa4c198e15f82842767946a050c4155dfa82773720be]] — WorkingCard; evidence: packages/app/src/ui/ActivityScreen.tsx:72-110.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/36207dc7f051565567d9d3b89d746d8733de6ae2826b46a4e46e814a1ea6e8f4]] — QrScanner; evidence: packages/app/src/ui/QrScanner.tsx:40-194.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/3de9875a6181eeda14cc23c7aa07bb17a466ee12a3bd7bc9ab88514232fdeb59]] — CanvasCoverView; evidence: packages/app/src/ui/CanvasCover.tsx:19-32.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/47c32aeaa6789ae5aa7a350af458b4730c272217ff88a56f22f96c73227b3dd1]] — Glass; evidence: packages/app/src/ui/Glass.tsx:17-34.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/5ab8b8972c59a500dec805091825f8e5c83b8f1342ae34047a510987722b417c]] — OrbView; evidence: packages/app/src/ui/Orb.tsx:13-49.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/655c6178c6a213b4e01fa204ac8c1b6bb636d8d5bb4bfbf83d11744fe517f9e0]] — AppearanceSheetView; evidence: packages/app/src/ui/AppearanceSheet.tsx:35-136.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6b0727d2a33a50cac30a38bc67865511cd4d9e1e7bddaabedd2781a5edcde6ed]] — ImageViewer; evidence: packages/app/src/ui/ImageViewer.tsx:44-192.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6c5d65a9cb8906d5471877c568615ea00f898783720cde470c3312ebf2256c9c]] — SidebarView; evidence: packages/app/src/ui/Sidebar.tsx:302-702.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6c68c5f619386e3ed8e34d5d45717bc9f0bf8f10b045948b1c59420ccd1c7617]] — MarkdownTextView; evidence: packages/app/src/ui/MarkdownText.tsx:407-425.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6e9a43d96f1ef14677e61849208a64d29664ac9fd896cf3bfaaa9a9a8e2e92d1]] — ChatThreadView; evidence: packages/app/src/ui/ChatThread.tsx:73-308.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/711a00ccf2c96632f1142d69ca1be73a6071870ef628bc2dc67c33d580969500]] — AppWithAppearance; evidence: packages/app/App.tsx:95-152.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/77f14b41fe5eecf5f84cc0b74af6d5cc52e765309125002128ca6cf4db130391]] — ShimmerTextView; evidence: packages/app/src/ui/ShimmerText.tsx:67-188.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/7c91000af47445be7ffe016489c5a0a895fb03aafcb5e73373ec7ec3f4c5ad45]] — useThemeStyles; evidence: packages/app/src/appearance.tsx:88-91.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/8217f7abeee7d9c2ebd3f19112db8720248969ebe085b15536deaaffec1aff67]] — ActivityScreenView; evidence: packages/app/src/ui/ActivityScreen.tsx:280-472.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/86c8e6eb882493bb89f0c2c665e17c196d9de2158f70b9b136a6c8588b9da6c3]] — CommandTokenView; evidence: packages/app/src/ui/CommandToken.tsx:25-49.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/8fcc5e112efc2062ed80dea7fa222a87afbdc67c53cef0690bdc393681646a9f]] — PairingGate; evidence: packages/app/App.tsx:163-246.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/90a09a976dae202dc679b97d9dedd8e84385a6e707f3c30bf06ef46a824286f8]] — Logo; evidence: packages/app/src/ui/Logo.tsx:39-111.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9c828d969b89bac993bdc456f5a3cb5beedc9701ea9c76a4ce866716e878215b]] — CopyButton; evidence: packages/app/src/ui/CopyButton.tsx:68-137.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9ca8f1774264e31ffd3e9ff58cf6cd20dbfdfc77855c028e2e1981ba1413cbc8]] — LaunchScreen; evidence: packages/app/src/ui/LaunchScreen.tsx:23-72.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/a142645f644e2fe701d7a1eb8249779f99edaf4b4ac76eb861290935f92e45ac]] — Pew2; evidence: packages/app/App.tsx:411-1641.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/ae4c1a667ad1e884d0f3f680a0cf0bed5f29be5dd8165cbfff65dcd3d9221941]] — MenuRowView; evidence: packages/app/src/ui/MenuRow.tsx:32-64.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b024ec384125eae3fc2d8c2f6e2902f7c20ca3f666a9346945cb5d85efeb48a4]] — SessionIdentity; evidence: packages/app/src/ui/ActivityScreen.tsx:60-70.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b2a18311d39ea6be90dc012e978a2691ba52ac06a747c7bb1edc4c267c4deeb5]] — HistorySkeleton; evidence: packages/app/src/ui/Skeleton.tsx:45-59.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/bc2038c81dcef7abca6cf76411c6d7c093e00a3dc1c8453f88dd0acf0977c3fc]] — ReadyCard; evidence: packages/app/src/ui/ActivityScreen.tsx:112-140.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/bf65ef0274fa53b52b70f229c4707d2e39ea17513139b93617a2841be38c9669]] — CrossfadeIcon; evidence: packages/app/src/ui/Sheet.tsx:273-281.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d24757f1c60e8986460f85e30bd665b39cb723fd0fe18e333cca257814c8469b]] — NewChatChip; evidence: packages/app/src/ui/Sidebar.tsx:715-765.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d31c6085d8643a0ab3796ce963a22059ae64df4b8ae2fe4a20763d6c82b15add]] — NativeMenuView; evidence: packages/app/src/ui/NativeMenu.tsx:72-115.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d3b285757550bb1dc32b76f8a14ec00b3b62d83153b6791bc41e414b6337de40]] — Fixture; evidence: packages/app/src/ui/ConfigSelector.harness.tsx:26-51.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/d7012b75290ad055daffabb6eb087316b8bb7b38738759d3b9edbea60171e603]] — AttachmentChipsView; evidence: packages/app/src/ui/AttachmentChips.tsx:40-95.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/dca411eca2eeae4515c4ef832db82afb3afdf73cba692fbd8396d228724ff10b]] — ComposerView; evidence: packages/app/src/ui/Composer.tsx:118-512.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/dfef15f9c9790ffef073a7e810ca112a2b95c0b306d64e50cd7e92cb31caaf03]] — TurnView; evidence: packages/app/src/ui/Turn.tsx:90-240.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e0e4404a47ddc3665eff71931b9d347c73a2b3422495033393c80869c2dc7de7]] — ConfigSelectorList; evidence: packages/app/src/ui/ConfigSelectorList.tsx:16-74.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e19d07a402bad937caf2394d55f54754755044c68d34d4294328c44017f5741b]] — ActivityLineView; evidence: packages/app/src/ui/ActivityLine.tsx:51-122.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e7a2d0486bed2bfdaf5fa78e0ca5b3c4f99bb9cb60e3e183051f74769131c9a7]] — RecentRow; evidence: packages/app/src/ui/ActivityScreen.tsx:142-168.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e8d4b14a1629165ca86538ba65427f4905c05b12838550b2c9d40add27f6a69d]] — TurnReceiptView; evidence: packages/app/src/ui/TurnReceipt.tsx:24-65.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f5fcb38fac3828697cb37c25f76b06e31f22c2c5fbd848aac3e05c4f240e53a5]] — ApprovalSheetView; evidence: packages/app/src/ui/ApprovalSheet.tsx:29-72.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f8389da1dad1ddfa68c856717ee9793b54890090787c174f8b01ad756fa017ec]] — ChatImageView; evidence: packages/app/src/ui/ChatImage.tsx:102-210.
- incoming calls [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/fa317acf546ddc70f3f32cc46e722379b37356a2b4939fc3424c334ac7950466]] — SheetView; evidence: packages/app/src/ui/Sheet.tsx:79-209.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
