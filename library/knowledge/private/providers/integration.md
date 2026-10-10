---
ai_description: >-
  Explain manifest discovery, bundled providers and the boundary between validation and agent readiness.
human_description: >-
  Add or troubleshoot a provider without assuming every ACP agent behaves alike.
---

# Provider integration

**Category:** Engineering / Providers | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## Discover and diagnose

```sh
pew2 providers list
pew2 providers validate
pew2 providers verify
pew2 providers enable <id>
pew2 providers disable <id>
```

Validation checks manifest structure. Verification launches agents to probe ACP; it can require installed runtimes, vendor authentication and network access. Neither schema validity nor executable discovery proves a provider can complete a real task. Use `pew2 setup` for the interactive readiness workflow.

The default loader checks user manifests under `$PEW2_HOME/providers` (normally `~/.pew2/providers`), then checkout `providers/` if available, then compiled `BUNDLED_MANIFESTS`. Earlier sources win for the same id. The checkout path is resolved from the source module, not the shell's current directory; installed binaries rely on their embedded built-ins. Disabled providers are not offered for normal use; experimental fixtures such as echo are not ordinary production integrations.

## Add an integration

1. Start from an existing manifest with a similar distribution. Define its stable id, display metadata, command/distribution and ACP arguments. Runtime validation lives in `packages/protocol/src/manifest.ts`; `schemas/provider.schema.json` supports editor completion.
2. Test a local user manifest first. Verify executable resolution, required environment and authentication in the **daemon's** environment, not only your interactive terminal.
3. For a built-in integration, add `providers/<id>.json` **and** its import/list entry in `packages/daemon/src/providers/bundled.ts`. Bundled manifests are compiled into the executable: changing repository JSON does not update an already installed binary.
4. Validate, run focused tests, then exercise startup, prompt streaming, cancellation, approvals and resume against the actual agent. Only document capabilities observed or advertised by that integration.
5. Ship bundled changes through a [daemon release](../operations/releases.md).

`pty` is a reserved manifest transport, not an implemented alternative to ACP. Do not advertise it as working. Discovery and verification are distinct from transport support.

## Provider-specific boundaries

The bundled list currently has 13 entries, including the echo fixture. The manifests are the authority for required executables, package runners, arguments and environment variables; avoid copying a static vendor-install matrix into multiple guides.

GG Coder Desktop uses `ggcoder-desktop-acp` and shared-desktop state/ask metadata. It is not interchangeable with the ordinary GG Coder ACP process. Models, modes, commands, prompt capabilities and history support vary across providers; the phone cannot manufacture missing ACP capabilities.

See [configuration](../operations/configuration-data.md), [conversations](../../public/guides/conversations.md), and the existing [provider recipe](../../../../docs/ADDING_A_PROVIDER.md).

## Source evidence

- [Provider schema](../../../../packages/protocol/src/manifest.ts) — `ProviderManifest` and distribution/transport definitions.
- [Registry](../../../../packages/daemon/src/providers/registry.ts) — `userProvidersDir()`, executable resolution and `loadProviders()`.
- [Bundled manifests](../../../../packages/daemon/src/providers/bundled.ts) — explicit imports and `BUNDLED_MANIFESTS`.
- [CLI](../../../../packages/daemon/src/cli/index.ts) — provider command dispatch and enable/disable behavior.
- [ACP connection](../../../../packages/daemon/src/acp/connect.ts) — agent launch and initialization.
- [Shared desktop](../../../../packages/daemon/src/acp/sharedDesktop.ts) and [bridge manifest](../../../../providers/ggcoder-desktop.json) — specialized integration.
