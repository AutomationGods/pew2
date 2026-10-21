import { describe, expect, test } from "bun:test";
import { callerName, diagnosticLine, refusesSession, findCallPush, foldEvent, judgeConnection, parseIncoming, readTokenResult, RECONNECT_GRACE_MS, toolOutputEvents, voiceFailureMessage } from "./protocol";

const ID = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";

describe("readTokenResult", () => {
  test("ok", () => {
    expect(readTokenResult({ ok: true, clientSecret: "ek_1", expiresAt: 5, model: "m", source: "chatgpt" })).toEqual({
      ok: true, clientSecret: "ek_1", expiresAt: 5, model: "m", source: "chatgpt",
    });
  });
  test("known errors pass through, unknown becomes failed", () => {
    expect(readTokenResult({ ok: false, error: "not_signed_in", message: "x" })).toEqual({ ok: false, error: "not_signed_in", message: "x" });
    expect(readTokenResult({ ok: false, error: "weird" })).toEqual({ ok: false, error: "failed", message: "" });
    expect(readTokenResult({ ok: true, clientSecret: "" }).ok).toBe(false);
    expect(readTokenResult(null).ok).toBe(false);
  });
  test("messages name the fix", () => {
    expect(voiceFailureMessage("not_signed_in")).toContain("pew2 openai login");
    expect(voiceFailureMessage("unavailable")).toContain("Update pew2 on your computer");
    expect(voiceFailureMessage("mic_denied")).toContain("Microphone");
  });
});

describe("parseIncoming", () => {
  test("socket frame", () => {
    const call = parseIncoming({ t: "voice.incoming", callId: ID, reason: "input", sessionId: "s1", folder: "pew2", summary: "Allow edit?", at: 7 });
    expect(call).toEqual({ callId: ID.toLowerCase(), reason: "input", sessionId: "s1", providerId: undefined, folder: "pew2", summary: "Allow edit?", at: 7 });
  });
  test("nested push payload", () => {
    expect(parseIncoming({ aps: {}, voice: { callId: ID, reason: "manual", at: 1 } })?.callId).toBe(ID.toLowerCase());
  });
  test("rejects bad ids", () => {
    expect(parseIncoming({ callId: "nope" })).toBeUndefined();
    expect(parseIncoming("x")).toBeUndefined();
  });
  test("callerName", () => {
    expect(callerName({ reason: "input", summary: "  Needs approval  " })).toBe("Needs approval");
    expect(callerName({ reason: "input", folder: "app" })).toBe("app needs you");
    expect(callerName({ reason: "manual" })).toBe("pew2");
  });
});

describe("foldEvent", () => {
  test("assistant transcript streams then finalises", () => {
    let c = foldEvent([], { type: "response.output_audio_transcript.delta", item_id: "a", delta: "Hel" }).captions;
    c = foldEvent(c, { type: "response.output_audio_transcript.delta", item_id: "a", delta: "lo" }).captions;
    expect(c).toEqual([{ id: "a", who: "assistant", text: "Hello", final: false }]);
    c = foldEvent(c, { type: "response.output_audio_transcript.done", item_id: "a", transcript: "Hello." }).captions;
    expect(c[0]).toMatchObject({ text: "Hello.", final: true });
  });
  test("user transcript and function call", () => {
    const c = foldEvent([], { type: "conversation.item.input_audio_transcription.completed", item_id: "u", transcript: " hi " }).captions;
    expect(c[0]).toMatchObject({ who: "user", text: "hi", final: true });
    const r = foldEvent(c, { type: "response.output_item.done", item: { type: "function_call", call_id: "c1", name: "list_sessions", arguments: "{}" } });
    expect(r.call).toEqual({ callId: "c1", name: "list_sessions", arguments: "{}" });
  });
  test("error and output events", () => {
    expect(foldEvent([], { type: "error", error: { message: "bad" } }).error).toBe("bad");
    const [item, create] = toolOutputEvents("c1", { ok: true }) as Record<string, unknown>[];
    expect(item).toMatchObject({ type: "conversation.item.create", item: { type: "function_call_output", call_id: "c1", output: '{"ok":true}' } });
    expect(create).toEqual({ type: "response.create" });
  });
});

describe("findCallPush (Android ringing)", () => {
  const callId = "6F1C1B8E-6A7E-4C4E-9A59-1F8C2F0D9E11";
  const data = { pew2Call: "1", callId, reason: "input", sessionId: "s1", folder: "pew2", summary: "Codex needs you in pew2", at: "1700" };

  test("reads the background-task shape, where data arrives as a JSON string", () => {
    const call = findCallPush({ notification: null, data: { dataString: JSON.stringify(data) } });
    expect(call).toMatchObject({ callId: callId.toLowerCase(), reason: "input", sessionId: "s1", summary: "Codex needs you in pew2", at: 1700 });
  });

  test("reads a tapped fallback notification's nested content.data", () => {
    const call = findCallPush({ notification: { request: { content: { data } } } });
    expect(call?.callId).toBe(callId.toLowerCase());
  });

  test("ignores ordinary agent banners", () => {
    expect(findCallPush({ data: { sessionId: "s1", kind: "input" } })).toBeUndefined();
    expect(findCallPush({ data: { dataString: JSON.stringify({ sessionId: "s1" }) } })).toBeUndefined();
  });
});

describe("judgeConnection", () => {
  test("a dropped network is a wait, not a hang-up", () => {
    expect(judgeConnection("disconnected")).toBe("reconnecting");
    expect(judgeConnection("connected")).toBe("connected");
  });
  test("only failed and closed end the call", () => {
    expect(judgeConnection("failed")).toBe("lost");
    expect(judgeConnection("closed")).toBe("ended");
    expect(judgeConnection("new")).toBe("pending");
    expect(judgeConnection("connecting")).toBe("pending");
    expect(judgeConnection(undefined)).toBe("pending");
  });
  test("the wait is long enough for a handover, short enough to notice", () => {
    expect(RECONNECT_GRACE_MS).toBeGreaterThanOrEqual(10_000);
    expect(RECONNECT_GRACE_MS).toBeLessThanOrEqual(30_000);
  });
});

describe("diagnosticLine", () => {
  test("server errors and failed responses are logged with their reason", () => {
    expect(diagnosticLine({ type: "error", error: { type: "invalid_request_error", code: "x", message: "bad tool" } })).toContain("bad tool");
    expect(diagnosticLine({ type: "response.done", response: { status: "failed", status_details: { error: { code: "insufficient_quota" } } } })).toContain("insufficient_quota");
    expect(diagnosticLine({ type: "response.done", response: { status: "completed" } })).toBeUndefined();
  });
  test("lifecycle and speech detection are logged, chatter and words are not", () => {
    expect(diagnosticLine({ type: "session.created" })).toBe("session.created");
    expect(diagnosticLine({ type: "input_audio_buffer.speech_started" })).toBe("input_audio_buffer.speech_started");
    expect(diagnosticLine({ type: "response.output_audio.delta", delta: "AAAA" })).toBeUndefined();
    expect(diagnosticLine({ type: "conversation.item.input_audio_transcription.completed", transcript: "secret" })).toBeUndefined();
    expect(diagnosticLine(null)).toBeUndefined();
  });
});

describe("refusesSession", () => {
  test("a failed first reply means OpenAI will not run this call", () => {
    expect(refusesSession({ type: "response.done", response: { status: "failed", status_details: { error: { type: "server_error" } } } })).toBe(true);
  });
  test("a finished, cancelled or other event does not", () => {
    expect(refusesSession({ type: "response.done", response: { status: "completed" } })).toBe(false);
    expect(refusesSession({ type: "response.done", response: { status: "cancelled" } })).toBe(false);
    expect(refusesSession({ type: "error", error: {} })).toBe(false);
    expect(refusesSession(undefined)).toBe(false);
  });
  test("the message says it is OpenAI and the plan, not the phone", () => {
    const text = voiceFailureMessage("refused");
    expect(text).toContain("OpenAI");
    expect(text).toContain("ChatGPT plan");
  });
});
