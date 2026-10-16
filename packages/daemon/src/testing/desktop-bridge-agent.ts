#!/usr/bin/env bun
/**
 * A test-only stand-in for GG Coder desktop's ACP bridge (`desktop-acp.mjs`).
 *
 * Env:
 *  - `PEW2_TEST_DESKTOP_SESSIONS`: JSON `[{ sessionId, cwd }]` it lists.
 *  - `PEW2_TEST_DESKTOP_DOWN=1`: the desktop app is not running.
 *  - `PEW2_TEST_DESKTOP_CALLS`: file each ACP method is appended to.
 *
 * `session/load` replays a snapshot, then the desk "types" a live turn; a
 * phone prompt is echoed and answered the way the desk does, with the
 * working flag riding on `_meta.ggDesktopWorking`.
 */
import { agent, ndJsonStream } from "@agentclientprotocol/sdk";
import { appendFileSync } from "node:fs";
import { Readable, Writable } from "node:stream";

const calls = process.env.PEW2_TEST_DESKTOP_CALLS;
const note = (method: string, detail = "") => {
  if (calls) appendFileSync(calls, `${method} ${detail}\n`);
};
const sessions = JSON.parse(process.env.PEW2_TEST_DESKTOP_SESSIONS ?? "[]") as { sessionId: string; cwd: string }[];
const chunk = (sessionUpdate: string, text: string, working?: boolean) => ({
  sessionUpdate,
  content: { type: "text", text },
  ...(working === undefined ? {} : { _meta: { ggDesktopWorking: working, ggDesktopClosedAsks: [] } }),
});

const app = agent({ name: "pew2-desktop-bridge-test" })
  .onRequest("initialize", async () => {
    note("initialize");
    if (process.env.PEW2_TEST_DESKTOP_DOWN === "1") throw new Error("GG Coder desktop is not running");
    return {
      protocolVersion: 1,
      agentInfo: { name: "ggcoder-desktop", version: "1.0.0" },
      agentCapabilities: { loadSession: true, sessionCapabilities: { list: {}, close: {} }, promptCapabilities: { image: false } },
      authMethods: [],
    };
  })
  .onRequest("session/list", async () => {
    note("session/list");
    return { sessions: sessions.map((s) => ({ ...s, title: "goal" })) };
  })
  .onRequest("session/new", async () => {
    note("session/new");
    throw new Error("the test bridge never creates conversations");
  })
  .onRequest("session/load", async (ctx) => {
    const sessionId = ctx.params.sessionId as string;
    note("session/load", sessionId);
    const update = (u: unknown) => ctx.client.notify("session/update", { sessionId, update: u });
    await update(chunk("user_message_chunk", "snapshot from desk"));
    await update(chunk("agent_message_chunk", "", false));
    setTimeout(() => {
      void (async () => {
        await update(chunk("agent_message_chunk", "", true));
        await update(chunk("agent_message_chunk", "typed live at desk"));
        await update(chunk("agent_message_chunk", "", false));
      })();
    }, 50);
    return { configOptions: [] };
  })
  .onRequest("session/prompt", async (ctx) => {
    const sessionId = ctx.params.sessionId as string;
    const text = (ctx.params.prompt as { text?: string }[]).map((b) => b.text ?? "").join("\n");
    note("session/prompt", text);
    const update = (u: unknown) => ctx.client.notify("session/update", { sessionId, update: u });
    await update(chunk("user_message_chunk", text));
    await update(chunk("agent_message_chunk", "", true));
    await update(chunk("agent_message_chunk", `desk heard: ${text}`));
    await update(chunk("agent_message_chunk", "", false));
    return { stopReason: "end_turn" };
  })
  .onNotification("session/cancel", async () => {
    note("session/cancel");
  })
  .onRequest("session/close", async () => {
    note("session/close");
    return {};
  });

app.connect(
  ndJsonStream(
    Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
  ),
);
