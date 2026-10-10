---
type: "entity"
title: "packages/app/App.tsx"
status: "developing"
created: "2026-10-09"
updated: "2026-10-09"
tags:
  - "entity"
  - "automated-graph"
related: []
sources:
  - "packages/app/App.tsx:1"
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
path: "packages/app/App.tsx"
language: "tsx"
graph_language: "typescript"
graph_node_id: "packages/app/App.tsx::module"
source_location: "L1"
source_sha256: "f569d12b0f9316ea830528d4d7a62aab47d4e10ec7128b75d2883de1cf9bfe8e"
last_commit_hash: "e5d9db0b528545d143711a7be3a1ca49294cc42a"
last_commit_author: "AutomationGod"
last_commit_date: "2026-10-08T20:10:31-04:00"
exported: false
depends_on: []
used_by: []
tested_by: []
---
<!-- generated-by: pew2-ast-reference-v1; do not edit -->

# packages/app/App.tsx

## Extracted declaration

- Graph kind: module; normalized symbol kind: module; exported: false. (packages/app/App.tsx:1)
- Source SHA-256: f569d12b0f9316ea830528d4d7a62aab47d4e10ec7128b75d2883de1cf9bfe8e. Verified against the local extraction cache.
- Last source commit: e5d9db0b528545d143711a7be3a1ca49294cc42a; AutomationGod; 2026-10-08T20:10:31-04:00. Git metadata does not imply current bytes are committed.

## Graph relationships

Relations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.

- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/088d332b7601b90d93d899373ddb488960fb83417097b85985f0c1009945efa7]] — packages/app/index.ts; evidence: packages/app/index.ts:1.
- incoming imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/2fcb49df5894c32ec7b36b535f6e540daa0424c76b0b53d1fcdccddf863603aa]] — packages/app/src/ui/Reconnect.harness.tsx; evidence: packages/app/src/ui/Reconnect.harness.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/036f585e89ab6639616ca32d4dfc5e2c98f84a98cb5d6db42973c852085e309d]] — packages/app/src/greeting.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/18592f02864f740c0fb5969ea276273954d2bb6ad07f5158db54a6cb3d9f9c18]] — packages/app/src/ui/controls.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/286ec52a997e6dc20e35a011e9752e450c6d93b2d4c91e874074f1503ad8f43a]] — packages/app/src/ui/ChatThread.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/2dbf9cc91051798931e8a7729bdfa11dace249801b0f61c06fd106157710487c]] — packages/app/src/ui/configSlots.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/37c6ca4138324693cca8c4a5af051b5f86d28d3f40da5f91d29682cff7c8df7c]] — packages/app/src/composerState.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/3f9438ebecfab054678321df92d19ca0b64874ea09d5c73a4bb1f296de168b96]] — packages/app/src/appearance.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/41f91aff9f6fd4e04a3c257759fc74b7e4f1a96a5e5e47a720d11266ddbfe805]] — packages/app/src/ui/CommandSheet.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/4cbfb232a8df885841606dc5d5f8a8bedb9deea5f5b5ceb2f6533b2aa1365c85]] — packages/app/src/ui/ConfigSelector.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/602171bea5bd73eb1af80c7c72a24c18de0de3a55de646680278eb95b76cf0ce]] — packages/app/src/ui/NewChatSheet.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/61ec227cf09a6c9941e527a1a34d8e11135c06cf72c1806ac7a8eae84793f18d]] — packages/app/src/ui/ErrorBoundary.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/62e373c5f6a6edd1a7f3958dd686a7feb1324a2d9ca3e54ff1ccf91147fc0d2b]] — packages/app/src/crashLog.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/630e0f844814618c556efdc8b386cf238f29477e3a6d6e9e183496869af5ce81]] — packages/app/src/preferences.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/66ca4a3202cbe47c1e8b0eaf0e54b3f3abd9bbedde313ca85f539a9c0e156aee]] — packages/app/src/ui/haptics.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/6d93126e92371cfb37324c227c7e57d3733fb94199cb765030c133806b62fdc7]] — packages/app/src/ui/useDictation.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/78f89ca1cd5299358c5f9b22847b94e7a3fe35b66e2672b70e9b27b33e1a9f35]] — packages/app/src/ui/ChatImage.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/812fc4932885422de7d445436837088867b532a6d411257fbaf800e5abff1a9a]] — packages/app/src/ui/push.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/840fae9d3b03f7d2b113fbd18723cbe0319689bb6ac5c8e404e01670ac274c21]] — packages/app/src/slashCommands.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/8a493e25afe59011fbd0d37281033d8e1f7f6a0cb748c13611dd7e0a3b8e8752]] — packages/app/src/ui/ComposerDock.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/908de930294187d7c619b8a7770d2e6742a50fed3560dbaf03bf9cb91c4fb95d]] — packages/app/src/ui/ActivityScreen.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/92f2758e113127d5ceaa72f6664fc14ead84e2557ea87abb8387b780fae7bff5]] — packages/app/src/ui/Sidebar.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9ee77b95a4aa050997168e56e9df7b9eefa53e460e4d32b849020465cd888e6f]] — packages/app/src/notificationPolicy.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/9f0653baff752ab3958c4428d8bad8c5f88b7707ace4b2a7096c203c44ffb46e]] — packages/app/src/attachments.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/a12c4f65816b4c4ece9b0e8bfa5afed8613f1166ea9637d9a0ba869fa7dec5b8]] — packages/app/src/connectionRecovery.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/a6f6c641d390836cbf06b2c6c58b751265b3269c6b3541d64a3d6e017c8edb0c]] — packages/app/src/reconnect.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/ae4fb9cfaa403e9f387ab346603db67ae70524a308139fea5f5f1295d9b4adcb]] — packages/app/src/ui/CanvasCover.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b18930f0057ad7689302b20a064b498d8c4c00469f689dbf42c1215f0de17218]] — packages/app/src/ui/useReducedMotion.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b513b68c915c76fc0cb53c54afc12e34d76a4522b1e70d9076c461fa22dbe75c]] — packages/app/src/ui/PairingScreen.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b6a4aa2b9e8ae45fc5c9a58a0e39fcd4c89eea60fc1e92182ef1de4834de4049]] — packages/app/src/pairing.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/b853bad7914fe8d2ec6ff9de8a910f6f7586c1bcff6e1c5136cf219b3d3eeb5b]] — packages/app/src/projects.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/bc3b73d8869dddc6a6f7ca806583c4326ac57e51016ca91d8260f39818594dc0]] — packages/app/src/theme.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c1fc5cfdb6e2f0f267b099834dba75c1d8c8489ae46e4d4715e659a750c34d1b]] — packages/app/src/ui/ApprovalSheet.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c452835326cf7d32f4582173a51daef168e9883801e5818d2312ce72969172bb]] — packages/app/src/ui/configMenu.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/c93289c0b82de8b7fdfec910ce7d333db09745533dd9f2fb53de43522375fcfb]] — packages/app/src/activity.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/cacdae5bc96f3675236560f4e5836ed00534bbc83e0107eb28951bbd0581ed29]] — packages/app/src/ui/Icon.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/cb4f6c7dc46f00b78ba361ef8f331ebc502eff9ad0504ff581573a33a4da62a5]] — packages/app/src/useDaemon.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/cd71da340ab186bc591a7f95316f9f85c8c5b6b33500be55a63da1bb519b78f6]] — packages/app/src/ui/attachmentPicker.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e2d8e55f65403ddbede8ddd4762dec1dcd2ead13c382800cd8bec339ea33450e]] — packages/app/src/dockHeight.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/e66b3467ce4cc8b7f2939a769a7920a8a70ae23ddcf912c6bcfc5bb0f67e2ebb]] — packages/app/src/ui/LaunchScreen.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/ed3d6bd367a2df24fd049c5391b84e4917f839be7d5383e253ee267f7bead4df]] — packages/app/src/ui/notifier.ts; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/f8090d08fd68111fe7331ba3ec4d0058581bcc450878f94f047f156d5fed3990]] — packages/app/src/ui/ThoughtSheet.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: [[library/knowledge/private/codebase-graph/entities/generated/fb3aaffd4c478cda63c44d35744aaad38348916dffb972698aa77cdee230f626]] — packages/app/src/ui/AttachmentSheet.tsx; evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:expo-clipboard (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:expo-splash-screen (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:expo-status-bar (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react-native (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react-native-gesture-handler (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react-native-keyboard-controller (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react-native-reanimated (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.
- outgoing imports [EXTRACTED]: external:react-native-safe-area-context (external/unresolved; no wiki target); evidence: packages/app/App.tsx:1.

## Provenance

[[library/knowledge/private/codebase-graph/meta/generated/catalog]] records engine version, graph hash, limitations and reproduction instructions.
