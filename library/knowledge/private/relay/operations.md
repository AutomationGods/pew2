---
ai_description: >-
  Document current relay route, admission, hibernation and independent deploy/check commands.
human_description: >-
  Run or deploy the forwarding relay without weakening admission or confusing it with history storage.
---

# Cloudflare relay operations

**Category:** Engineering | **Version:** 1.0 | **Date:** 2026-10-08 | **Status:** Active

The Worker accepts `/connect?pairing=<room>&role=<app|daemon>&deviceId=<id>` WebSocket connections and routes them to a `PairingRoom` Durable Object. The room id is derived from the pairing root key; the relay never receives that key through normal session setup. Possessing a room id can reach transport admission but does not authorize decrypted daemon requests.

## Admission and forwarding

- URL room ids must match the expected hex shape; role is `app` or `daemon`; a nonempty device id is required.
- A room has a **16-socket cap**, at most one live daemon, and no arbitrary newest-daemon-wins takeover.
- The existing daemon must be silent for **more than 90 seconds** before replacement. A reconnecting legitimate daemon can therefore be refused until the old connection is stale. Do not shorten this to hide a reconnect symptom: anyone holding the room id could otherwise evict a live daemon.
- App admission requires a daemon already in the room. Device identity here is routing, not the daemon's authenticated first-claim decision; admission does not implement same-device seat replacement.
- Forwarding is role-directed: daemon to apps, apps to daemon. Envelopes carry a relay-added `from` stamp; the receiver must still verify the cryptographic channel.
- Session event payloads are not written to a relay replay database. Do not infer an application frame-size limit from the socket-count cap.

## Keepalive and hibernation

The daemon's keepalive must be exactly `{"t":"ping"}`; the Durable Object hibernation auto-response pairs it with `{"t":"pong"}`. Byte-different whitespace defeats that fast path. Hibernation timestamps feed stale admission; alarm cleanup closes stale daemons and stops scheduling after the room empties. Cleanup also drops the obsolete `events` table from older deployments—it is not a current history feature.

`wrangler.toml` uses a SQLite-backed Durable Object and `compatibility_date = "2026-04-07"`. The date enables automatic Close-frame replies assumed by the empty close handler. Do not casually backdate it or change the migration binding/class names.

## Local development

From the repository root:

```sh
npm run relay:dev      # terminal 1: local Worker, port 8799
npm run relay:check    # terminal 2: integration checks against that Worker
```

For an automatically managed ephemeral loopback Worker, use `npm run relay:test`. It does not deploy. App-facing pairing URLs use `ws://` locally and `wss://` for a hosted relay. Set the stored relay with `pew2 relay <url>`, restart the daemon (`pew2 service restart` for a service), then run `pew2 pair`. An environment-supplied `PEW2_RELAY` overrides the stored setting. A phone with an old saved route must scan the updated pairing link.

## Deployment

```sh
npm run relay:deploy
```

This is a **manual Cloudflare deployment**, independent of app and binary releases, requiring your own authorized Cloudflare context. Review bindings/migrations and run local tests first. Publishing a daemon tag does not deploy this Worker. No deployment was performed for this documentation update.

## Source evidence

- [packages/relay/src/admission.ts](../../../../packages/relay/src/admission.ts) — caps, device validation, stale threshold and decisions.
- [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — Worker route; [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — hibernation auto-response.
- [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — forwarding; [packages/relay/src/index.ts](../../../../packages/relay/src/index.ts) — obsolete table cleanup.
- [packages/daemon/src/relay-client.ts](../../../../packages/daemon/src/relay-client.ts) — relay connection and keepalive.
- [packages/relay/wrangler.toml](../../../../packages/relay/wrangler.toml) — bindings/date/migration; [package.json](../../../../package.json) — dev/check/test/deploy scripts.
