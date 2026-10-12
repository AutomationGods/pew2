# Adding a provider

> Read this file top to bottom before adding a provider. It is written to be
> followed exactly, by a person or a coding agent, with no other context.

A **provider** is an agent exposed through pew2's mobile app. Today it must
speak ACP, directly or through an adapter.

For a **local integration**, add a user manifest under `~/.pew2/providers`
(or `$PEW2_HOME/providers`); no daemon rebuild is needed. To **ship a built-in
provider**, add `providers/<id>.json` and its import/list entry in
[`bundled.ts`](../packages/daemon/src/providers/bundled.ts), then release a new
daemon binary. Editing checkout JSON alone does not change installed binaries.
See the [integration guide](../library/knowledge/private/providers/integration.md)
for package ownership and capability limits.

---

## The 60-second version

Most of the time you do not need this file at all:

```bash
pew2 setup            # detect what is installed, configure it, verify it, diagnose
```

Read on only when `setup` reports an agent it does not know about.

```bash
bun run packages/daemon/src/cli/index.ts providers add my-agent   # scaffold
$EDITOR ~/.pew2/providers/my-agent.json                            # point it at your binary
bun run packages/daemon/src/cli/index.ts providers verify my-agent # prove it works
```

(`npm run providers:verify my-agent` is the same thing, if you prefer scripts.)

When `verify` prints `ok`, the ACP smoke check passed—not every capability.
Test the provider's real prompt, cancellation, approval and resume behavior as
applicable. The daemon refreshes providers on startup and client hello; reconnect
the phone after a manifest change. Availability also depends on the daemon's
own environment and provider enable/disable preferences.

The default loader considers these sources in precedence order:

| Source | What lives there |
| --- | --- |
| `~/.pew2/providers` | User manifests and detected integrations. Override the root with `PEW2_HOME`. |
| Checkout `providers/` | Files resolved relative to the source module, not the shell's current directory. These may exist in development, not in the installed binary. |
| Compiled `BUNDLED_MANIFESTS` | Built-in manifests embedded in the daemon executable. |

An earlier source shadows a later source with the same id. Same id twice in
**one** directory is an error. The executable must carry each built-in manifest
in `BUNDLED_MANIFESTS`; the bundled-manifest regression test checks that it
matches the repository's JSON files.

---

## Decide the transport first

This is the only decision that really matters.

| Your app… | Use | You get |
| --- | --- | --- |
| speaks ACP, or has an ACP adapter | `acp` | Streamed messages, tool calls, diffs, plans, **approve/deny from the phone** |
| does not speak ACP | no supported direct transport | Supply an ACP adapter; `pty` is reserved, not implemented. |

> **`pty` is reserved, not yet implemented.** The manifest accepts it, and
> `verify` will skip it rather than pretend it passed. Today, use `acp`.

**Always prefer `acp`.** Before reaching for a fallback, check whether an adapter
already exists — the [ACP agent list](https://agentclientprotocol.com/get-started/agents)
lists available integrations. See
[`echo-agent.ts`](../packages/daemon/src/testing/echo-agent.ts) for a minimal
local test agent; a production adapter also needs cancellation, error handling,
permissions and lifecycle behavior appropriate to the tool.

---

## Choose a distribution

Exactly one of these. It tells the daemon how to launch the process.

**`npx`** — a published Node package:

```json
"distribution": { "type": "npx", "package": "@agentclientprotocol/claude-agent-acp", "version": "latest" }
```

**`uvx`** — a published Python package:

```json
"distribution": { "type": "uvx", "package": "my-agent-acp", "version": "latest" }
```

**`command`** — anything already on `PATH`, or an absolute path. This is the
escape hatch for your own app; nothing needs to be published:

```json
"distribution": { "type": "command", "command": "my-agent", "args": ["--acp"] }
```

---

## Declare the environment it needs

Do **not** hardcode secrets in the manifest. Declare the variable names; the
daemon forwards them from its own environment and refuses to start a provider
whose `required` variables are missing, so failures are loud and early instead
of a confusing mid-session crash.

```json
"pew": {
  "env": [
    { "name": "MY_API_KEY", "description": "Get one at example.com", "required": true }
  ]
}
```

Mark a key `required: false` when the underlying CLI can also authenticate via
its own login flow (this is why `claude-code` and `codex` do not force one).

---

## Full example

```json
{
  "$schema": "../schemas/provider.schema.json",
  "id": "my-agent",
  "name": "My Agent",
  "version": "1.0.0",
  "description": "One sentence on what it does.",
  "distribution": { "type": "command", "command": "my-agent", "args": ["--acp"] },
  "repository": "https://github.com/me/my-agent",
  "license": "MIT",
  "pew": {
    "transport": "acp",
    "color": "#4285f4",
    "env": [{ "name": "MY_API_KEY", "required": true }]
  }
}
```

For a manifest in repository `providers/`, that relative `$schema` points to the
editor schema. A user manifest outside the checkout needs an appropriate schema
path or can omit this optional field. Runtime validation comes from
[`ProviderManifest`](../packages/protocol/src/manifest.ts), not the editor setting.

---

## Verify

`verify` is not a lint. It spawns the process, performs the ACP `initialize`
handshake, opens a session, sends a real prompt, auto-approves any permission
request, and counts the updates that came back.

```
$ bun run packages/daemon/src/cli/index.ts providers verify my-agent
my-agent … ok session=sess_abc updates=7
```

`updates=0` means the process started but streamed nothing — usually a wrong
subcommand, or an agent that is not actually in ACP mode.

---

## Rules

1. **One provider per file**, named `<id>.json`, where `<id>` matches the `id` field.
2. **Ids are `^[a-z][a-z0-9-]*$`.** Duplicates are rejected — the whole file is skipped, not silently merged.
3. **Use the runtime schema.** The manifest, `pew` and environment-variable objects reject unknown fields. Do not assume every nested distribution object has the same strictness; keep only documented keys.
4. **Never put a secret in a manifest.** These files are committed.
5. **A broken manifest never takes the daemon down.** It is reported and skipped so other providers keep working.
6. **Always finish with `verify`.** A manifest that only passes `validate` has proven nothing except that it is well-formed JSON.
7. **Never write a secret into a manifest**, including one generated by `detect`. Manifests declare variable names; the daemon supplies the values from its own environment.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Missing required environment variables` | Export the variable, or set `required: false` if the CLI has its own login. |
| `timed out after 60s` | The process starts but never completes `initialize` — it is probably not in ACP mode. Check the adapter's flags. |
| `Not valid JSON` | Trailing comma, or a comment. Manifests are strict JSON. |
| `Duplicate provider id` | Two files declare the same `id`. |
| Command not found | `command` is not on `PATH`. Use an absolute path to confirm, then fix `PATH`. |
