import { describe, expect, it } from "bun:test";
import { PushRegistry, applyTickets, pushAgentNotice, pushMessages } from "./push.js";

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

describe("push delivery diagnostics", () => {
  const failures = [
    { reason: "http 503", reply: async () => new Response("private-response", { status: 503 }) },
    { reason: "network", reply: async (): Promise<Response> => { throw new Error("private-response"); } },
    { reason: "invalid-response", reply: async () => new Response("not json: private-response") },
    { reason: "invalid-response", reply: async () => Response.json(null) },
    { reason: "invalid-response", reply: async () => Response.json({ data: [null] }) },
    { reason: "ticket", reply: async () => Response.json({ data: [
      { status: "error", message: "private-response", details: { error: "MessageTooBig" } },
    ] }) },
  ];

  it.each(failures)("reports $reason without leaking contents or failing the caller", async ({ reason, reply }) => {
    const warnings: string[] = [];
    const registry = new PushRegistry({ warn: message => warnings.push(message), now: () => 0 });
    registry.register("phone", TOKEN, "ios");
    await expect(pushAgentNotice(registry, {
      sessionId: "private-session", folder: "private-folder", text: "private-prompt",
    }, {
      fetchImpl: async (_url, init) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return reply();
      },
    })).resolves.toBeUndefined();
    expect(warnings).toEqual([
      `[push] Notification delivery failed (${reason}). Further failures are suppressed for 60s.`,
    ]);
    const output = warnings.join("\n");
    for (const secret of [TOKEN, "private-response", "private-session", "private-folder", "private-prompt"]) {
      expect(output).not.toContain(secret);
    }
    expect(registry.size).toBe(1);
  });

  it("limits warnings across failure types to one per minute per registry", async () => {
    let now = 0;
    const warnings: string[] = [];
    const registry = new PushRegistry({ warn: message => warnings.push(message), now: () => now });
    registry.register("phone", TOKEN, "ios");
    const send = () => pushAgentNotice(registry, { sessionId: "s1" }, {
      fetchImpl: async () => new Response(null, { status: 429 }),
    });
    await send();
    registry.reportFailure("ticket");
    now = 59_999;
    await send();
    expect(warnings).toHaveLength(1);
    now = 60_000;
    await send();
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain("http 429");
  });

  it("logs only a fixed category even for an unknown service error", async () => {
    const warnings: string[] = [];
    const registry = new PushRegistry({ warn: message => warnings.push(message) });
    registry.register("phone", TOKEN, "ios");
    await pushAgentNotice(registry, { sessionId: "s1" }, {
      fetchImpl: async () => Response.json({ data: [{ status: "error", details: { error: "private-response" } }] }),
    });
    expect(warnings).toEqual(["[push] Notification delivery failed (ticket). Further failures are suppressed for 60s."]);
  });

  it("does not log successful delivery", async () => {
    const warnings: string[] = [];
    const registry = new PushRegistry({ warn: message => warnings.push(message) });
    registry.register("phone", TOKEN, "ios");
    await pushAgentNotice(registry, { sessionId: "s1" }, {
      fetchImpl: async () => Response.json({ data: [{ status: "ok" }] }),
    });
    expect(warnings).toEqual([]);
  });

  it("contains diagnostic-sink failures and still removes expired tokens", async () => {
    const registry = new PushRegistry({ warn: () => { throw new Error("sink unavailable"); } });
    registry.register("phone", TOKEN, "ios");
    await expect(pushAgentNotice(registry, { sessionId: "s1" }, {
      fetchImpl: async () => Response.json({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }),
    })).resolves.toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it("does not fetch or warn when no phone has registered", async () => {
    let calls = 0;
    let warnings = 0;
    await pushAgentNotice(new PushRegistry({ warn: () => { warnings++; } }), { sessionId: "s1" }, {
      fetchImpl: async () => { calls++; return Response.json({ data: [] }); },
    });
    expect(calls).toBe(0);
    expect(warnings).toBe(0);
  });
});
