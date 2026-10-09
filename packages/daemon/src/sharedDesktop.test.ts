import { expect, test } from "bun:test";
import { Daemon } from "./index.js";
import { SessionLog } from "./session/log.js";
import { SHARED_DESKTOP_PROVIDER, readDesktopState } from "./acp/sharedDesktop.js";
import type { AcpSessionHandle } from "./acp/connect.js";
import { PromptGate } from "../../app/src/promptGate.js";

const state = (working: boolean, closedAsks: string[] = []) => ({
  sessionId: "desktop-chat", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "" }, _meta: { ggDesktopWorking: working, ggDesktopClosedAsks: closedAsks } },
});
function setup(providerId = SHARED_DESKTOP_PROVIDER) {
  const daemon = new Daemon({ id: "shared-desktop-test", name: "test" });
  const sent: unknown[] = [];
  // Collect unit-test frames without a transport's background reaper.
  daemon["send"] = (frame) => { sent.push(frame); };
  const session = {
    log: new SessionLog("phone-chat"), providerId, cwd: "/project", ready: Promise.resolve(),
    live: false, working: false, lastUsedAt: 0, permissions: new Map<string, unknown>(),
    handle: undefined as AcpSessionHandle | undefined,
  };
  daemon["sessions"].set("phone-chat", session);
  return { daemon, session, sent };
}

test("desktop-initiated activity is authoritative on attach, replay, and completion", () => {
  const { daemon, session, sent } = setup();
  expect(daemon["reaper"]).toBeUndefined();
  daemon["record"](session, state(true));
  expect(session.working).toBe(true);
  expect(sent).toHaveLength(0);
  daemon.markLive("phone-chat");
  expect(sent).toEqual([
    { t: "session.replay", sessionId: "phone-chat", events: [] },
    { t: "session.replay", sessionId: "phone-chat", events: [], catchUp: true, complete: true, working: true, permissions: [] },
  ]);
  daemon["record"](session, { sessionId: "desktop-chat", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "live reply" } } });
  daemon["record"](session, state(false));
  expect(session.working).toBe(false);
  expect(sent.some((frame) => (frame as { t: string }).t === "session.idle")).toBe(true);
  expect(daemon.catchUp({ "phone-chat": -1 })[0]?.working).toBe(false);
  expect(session.log.since(-1)).toHaveLength(1);
});

test("desktop live status uses the existing Android catch-up contract", () => {
  const { daemon, session, sent } = setup();
  session.live = true;
  daemon["record"](session, state(true));
  expect(sent[0]).toMatchObject({ t: "session.replay", catchUp: true, working: true, events: [] });
});

test("desktop resolution dismisses only the matching phone approval", () => {
  const { daemon, session, sent } = setup();
  session.live = true;
  session.permissions.set("perm-1", { _meta: { ggDesktopAskId: "ask-1" } });
  session.permissions.set("perm-2", { _meta: { ggDesktopAskId: "ask-2" } });
  daemon["record"](session, state(true, ["ask-1"]));
  expect([...session.permissions.keys()]).toEqual(["perm-2"]);
  expect(sent).toEqual([{ t: "session.replay", sessionId: "phone-chat", events: [], catchUp: true, complete: true, working: true, permissions: [{ requestId: "perm-2", params: { _meta: { ggDesktopAskId: "ask-2" } } }] }]);
});

test("a shared phone prompt uses the owner's echo and does not clear a subsequent desktop turn", async () => {
  const { daemon, session } = setup();
  session.live = true;
  session.handle = {
    async prompt() {
      daemon["record"](session, { sessionId: "desktop-chat", update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "from phone" } } });
      daemon["record"](session, state(true));
      daemon["record"](session, state(false));
      daemon["record"](session, state(true));
    },
  } as unknown as AcpSessionHandle;
  await daemon.prompt("phone-chat", "from phone");
  expect(session.log.since(-1)).toHaveLength(1);
  expect(session.working).toBe(true);
});

test("rejected shared attachments release idle prompt gates without ending desktop work", async () => {
  for (const working of [false, true]) {
    const { daemon, session, sent } = setup();
    session.live = true;
    session.working = working;
    if (working) session.permissions.set("perm-1", { title: "Still waiting" });
    let prompts = 0;
    session.handle = { async prompt() { prompts++; } } as unknown as AcpSessionHandle;
    const gate = new PromptGate();
    gate.started("phone-chat");

    await expect(daemon.prompt("phone-chat", "attached", [{
      name: "note.txt", mimeType: "text/plain", data: Buffer.from("fixture").toString("base64"),
    }])).rejects.toThrow("Attach files in GG Coder desktop");
    expect(prompts).toBe(0);
    expect(session.log.since(-1)).toEqual([]);
    expect(sent).toEqual([{
      t: "session.replay", sessionId: "phone-chat", events: [],
      catchUp: true, complete: true, working,
      permissions: working ? [{ requestId: "perm-1", params: { title: "Still waiting" } }] : [],
    }]);
    for (const frame of sent) {
      if (!frame || typeof frame !== "object" || !("working" in frame) || !("permissions" in frame)) {
        throw new Error("Missing authoritative desktop state");
      }
      gate.catchUp("phone-chat", frame.working, frame.permissions);
    }
    expect(gate.canSend("phone-chat")).toBe(!working);
    expect(session.working).toBe(working);
    expect(session.permissions.size).toBe(working ? 1 : 0);
    if (gate.canSend("phone-chat")) {
      await daemon.prompt("phone-chat", "text-only follow-up");
      expect(prompts).toBe(1);
    }
  }
});

test("a disconnected desktop is removed from live sessions and announced", () => {
  const { daemon, session, sent } = setup();
  session.live = true;
  session.working = true;
  daemon["record"](session, { kind: "exit", code: 0 });
  expect(daemon["sessions"].has("phone-chat")).toBe(false);
  expect(sent).toContainEqual(expect.objectContaining({ t: "providers", activeSessions: [] }));
  expect(session.working).toBe(false);
});

test("other ACP providers cannot change liveness with desktop-only metadata", () => {
  const { daemon, session } = setup("echo");
  daemon["record"](session, state(true));
  expect(session.working).toBe(false);
  expect(session.log.since(-1)).toHaveLength(1);
  expect(readDesktopState({ update: { _meta: { ggDesktopWorking: "yes" } } })).toBeUndefined();
});
