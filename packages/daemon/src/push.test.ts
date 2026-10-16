import { describe, expect, it } from "bun:test";
import { PushRegistry, applyTickets, incomingCallMessages, pushIncomingCall, pushMessages } from "./push.js";

const TOKEN = "ExponentPushToken[abcdef123456]";

describe("PushRegistry", () => {
  it("keeps one address per device, so a rotated token replaces the old one", () => {
    // Otherwise every app restart adds another copy of every banner.
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "ios");
    registry.register("phone", "ExponentPushToken[rotated]", "ios");
    expect(registry.list()).toEqual([{ token: "ExponentPushToken[rotated]", platform: "ios" }]);
  });

  it("keeps two phones apart", () => {
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "ios");
    registry.register("tablet", "ExponentPushToken[other]", "android");
    expect(registry.size).toBe(2);
  });

  it("refuses anything that is not an Expo push token", () => {
    // A rejected token is reported to the client; a silently stored one looks
    // exactly like a working one until a notification never arrives.
    const registry = new PushRegistry();
    expect(registry.register("phone", "not-a-token", "ios")).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("names the Android channel, without which the banner is filed silently", () => {
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "android");
    expect(pushMessages(registry, { sessionId: "s1" })[0]?.channelId).toBe("agent-complete");
  });
});

describe("pushMessages", () => {
  const registry = new PushRegistry();
  registry.register("phone", TOKEN, "ios");

  it("says which project and agent, and quotes the reply", () => {
    const [message] = pushMessages(registry, {
      sessionId: "s1",
      folder: "pew2",
      agentName: "Claude Code",
      lastText: "## Done\n\nRenamed the handler and fixed the test.",
    });
    expect(message?.title).toBe("pew2 · Claude Code");
    expect(message?.body).toBe("Done");
    // Read back by the app on tap, to open the conversation the banner is
    // about — the same payload the local banner carries.
    expect(message?.data).toEqual({ sessionId: "s1", kind: "complete" });
    expect(message?.sound).toBe("complete.wav");
    // The field that makes this instant on Android: normal priority lets FCM
    // hold a message back on a sleeping device, which is the phone-in-a-pocket
    // case the whole feature exists for.
    expect(message?.priority).toBe("high");
  });

  it("still says something for a turn that ended without a message", () => {
    const [message] = pushMessages(registry, { sessionId: "s1", folder: "pew2" });
    expect(message?.body).toBe("Finished and waiting on you.");
  });

  it("distinguishes input and error with their own copy, sound, and channel", () => {
    const android = new PushRegistry();
    android.register("phone", TOKEN, "android");

    expect(pushMessages(android, { sessionId: "s1", kind: "input" })[0]).toMatchObject({
      body: "Your agent needs an answer.",
      sound: "input.wav",
      channelId: "agent-input",
    });
    expect(
      pushMessages(android, { sessionId: "s1", kind: "error", text: "Connection failed" })[0],
    ).toMatchObject({ body: "Connection failed", sound: "error.wav", channelId: "agent-error" });
  });

  it("keeps an app without per-kind channels on the one channel it created", () => {
    const old = new PushRegistry();
    old.register("phone", TOKEN, "android", { legacy: true });
    expect(pushMessages(old, { sessionId: "s1", kind: "input" })[0]).toMatchObject({
      sound: "default",
      channelId: "agent-turns",
    });
  });

  it("sends nothing when no phone has registered", () => {
    expect(pushMessages(new PushRegistry(), { sessionId: "s1" })).toEqual([]);
  });
});

describe("applyTickets", () => {
  it("forgets a token the push service says is gone", () => {
    // Uninstalled app or revoked permission. Continuing to send to it is what
    // gets a sender rate limited.
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "ios");
    const messages = pushMessages(registry, { sessionId: "s1" });
    applyTickets(registry, messages, [
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    ]);
    expect(registry.size).toBe(0);
  });

  it("keeps a token through a transient failure", () => {
    // A rate limit or an Expo outage says nothing about whether the phone is
    // still there; dropping it would silence that device for good.
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "ios");
    const messages = pushMessages(registry, { sessionId: "s1" });
    applyTickets(registry, messages, [
      { status: "error", message: "too many", details: { error: "MessageRateExceeded" } },
    ]);
    expect(registry.size).toBe(1);
  });

  it("ignores a malformed reply rather than throwing on it", () => {
    const registry = new PushRegistry();
    registry.register("phone", TOKEN, "ios");
    applyTickets(registry, pushMessages(registry, { sessionId: "s1" }), "nonsense");
    expect(registry.size).toBe(1);
  });
});

describe("Android incoming calls", () => {
  const incoming = {
    t: "voice.incoming" as const,
    callId: "6f1c1b8e-6a7e-4c4e-9a59-1f8c2f0d9e11",
    reason: "input" as const,
    sessionId: "s1",
    folder: "pew2",
    summary: "Codex needs you in pew2",
    at: 1,
  };

  it("sends a data-only, high-priority push to Android phones only", () => {
    const registry = new PushRegistry();
    registry.register("ios-phone", TOKEN, "ios");
    registry.register("droid", "ExponentPushToken[droid]", "android");
    const messages = incomingCallMessages(registry.list(), incoming);
    expect(messages).toHaveLength(1);
    const m = messages[0]!;
    expect(m.to).toBe("ExponentPushToken[droid]");
    expect(m.priority).toBe("high");
    expect(m.channelId).toBe("incoming-call");
    // No title or body: Android draws nothing and the app's task rings instead.
    expect("title" in m || "body" in m).toBe(false);
    expect(m.data).toMatchObject({ pew2Call: "1", callId: incoming.callId, sessionId: "s1", summary: incoming.summary });
  });

  it("rings only the asking phone when given a device", async () => {
    const registry = new PushRegistry();
    registry.register("a", "ExponentPushToken[a]", "android");
    registry.register("b", "ExponentPushToken[b]", "android");
    const bodies: unknown[] = [];
    await pushIncomingCall(registry, incoming, "b", {
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ data: [{ status: "ok" }] }));
      },
    });
    expect(bodies).toEqual([[expect.objectContaining({ to: "ExponentPushToken[b]" })]]);
  });
});
