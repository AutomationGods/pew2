---
ai_description: >-
  Document supported setup and first-claim pairing, including rotation and remote-route limits.
human_description: >-
  Install the desktop daemon, scan its QR code, and know how to recover or revoke a pairing.
---

# Install and pair

**Category:** User guide | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

## 1. Prepare the computer

Use the platform installer in the [project README](../../../../README.md), then open a new terminal if `pew2` is not on your PATH. The installer downloads a published binary; a source checkout is a separate [development workflow](../../private/operations/development-testing.md).

Install and sign into the coding agent you want to use on the computer. Then run:

```sh
pew2 setup
```

Setup discovers agents, checks whether they can start, offers an interactive selection, and installs the background service. Review any agent-specific errors rather than assuming everything is ready. Use `pew2 providers list` to review agents and `pew2 doctor` to inspect daemon/service health. `pew2 setup --json` is useful for diagnostics without the interactive picker.

## 2. Scan the computer's code

```sh
pew2 pair
```

Keep the code private. In the phone app, choose **Scan code** and allow camera access. Scan the QR shown on your own computer. The app's pairing screen is camera-based; it is not a general-purpose login or account sync screen.

The code selects **one route**: the configured relay, or a LAN address when no relay is configured. The app reconnects to that saved route; it does not automatically switch between LAN and relay. Inspect the current setting with `pew2 relay`. To change it:

```sh
pew2 relay wss://your-relay.workers.dev  # use your configured relay
# Or: pew2 relay off                   # same-network only
pew2 service restart                  # restart a background daemon
pew2 pair                             # scan the new code
```

If you run the daemon in the foreground, restart that process instead. An environment-supplied `PEW2_RELAY` overrides the stored setting.

Local-only use needs the phone to reach the computer's LAN address and daemon port (8787 by default). Guest Wi-Fi isolation, VPN routing, or firewall rules can block this. Do not expose the port publicly just to fix a local pairing failure.

## 3. Start a conversation

Once connected, select a provider and a project, then send a small test prompt. See [conversations and approvals](conversations.md). Pairing does not install an agent or authenticate its vendor account.

## Replacing a phone or revoking a link

The first device to complete the handshake claims a pairing. A second phone using its own device identity is refused. If you reinstall and lose that identity, replace your phone, or suspect the link leaked, run:

```sh
pew2 pair --rotate
```

**Every `pew2 pair` invocation already rotates the key**, even without `--rotate`; the flag remains accepted for compatibility. It preserves the relay setting. Scan the newest code, not a previous screenshot. The running server watches the pairing file: it swaps the LAN key/token, rekeys the relay connection and disconnects clients using the old key. This is an in-process reload, not a required daemon exit. If reload fails, restart the daemon and inspect its logs. Confirm the daemon is running with the new key before relying on revocation. A fixed `PEW2_TOKEN` environment override is a separate operator-managed case.

**Limits:** first claim is not proof of the human's identity. An attacker who gets the link before you can claim it first. Someone with both the root key and claimed device id can impersonate that identity. Rotate a leaked link; rescanning the old one is not revocation. The legacy literal device id `phone` is treated as unclaimed for upgrade compatibility.

## Source evidence

- [packages/daemon/src/cli/index.ts](../../../../packages/daemon/src/cli/index.ts) — agent picker and service reporting.
- [packages/daemon/src/cli/pair.ts](../../../../packages/daemon/src/cli/pair.ts) — rotation and QR workflow.
- [packages/app/src/ui/PairingScreen.tsx](../../../../packages/app/src/ui/PairingScreen.tsx) — camera-only pairing UI.
- [packages/daemon/src/device-claim.ts](../../../../packages/daemon/src/device-claim.ts) — claim decision.
- [packages/daemon/src/pairing.ts](../../../../packages/daemon/src/pairing.ts) — key rotation; [packages/daemon/src/pairing-watch.ts](../../../../packages/daemon/src/pairing-watch.ts) — running-key change detection; [packages/daemon/src/pairing.ts](../../../../packages/daemon/src/pairing.ts) — route selection.

If connection fails, use [troubleshooting](../faqs/troubleshooting.md), not repeated rotation as a first step.
