import { describe, expect, it } from "bun:test";
import {
  base64ToBytes,
  bytesToBase64,
  chooseEngine,
  foldGemini,
  GEMINI_START,
  geminiFailure,
  geminiSetup,
  geminiTokenFailure,
  geminiTools,
  geminiUrl,
  PcmPacer,
  resamplePcm16,
  tokenEngine,
  translateClientEvent,
  utf8Decode,
} from "./geminiProtocol";
import { foldEvent, toolOutputEvents, voiceFailureMessage } from "./protocol";
import { VOICE_TOOLS } from "./tools";

describe("engine choice", () => {
  it("prefers gemini only when the computer advertises it", () => {
    expect(chooseEngine(undefined)).toBe("openai");
    expect(chooseEngine([])).toBe("openai");
    expect(chooseEngine(["openai"])).toBe("openai");
    expect(chooseEngine(["gemini", "openai"])).toBe("gemini");
  });
  it("reads the token's engine, absent = openai", () => {
    expect(tokenEngine({ ok: true })).toBe("openai");
    expect(tokenEngine({ ok: true, engine: "gemini" })).toBe("gemini");
    expect(tokenEngine(undefined)).toBe("openai");
  });
  it("puts the ephemeral token in the constrained endpoint", () => {
    expect(geminiUrl("auth_tokens/a b")).toContain("BidiGenerateContentConstrained?access_token=auth_tokens%2Fa%20b");
  });
});

describe("tools", () => {
  const decls = geminiTools(VOICE_TOOLS);
  it("maps every voice tool by name", () => {
    expect(decls.map((d) => d.name)).toEqual(VOICE_TOOLS.map((t) => t.name));
  });
  it("drops additionalProperties and empty parameter objects", () => {
    expect(JSON.stringify(decls)).not.toContain("additionalProperties");
    expect(decls.find((d) => d.name === "list_sessions")?.parameters).toBeUndefined();
    const send = decls.find((d) => d.name === "send_prompt")?.parameters as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(send.properties).sort()).toEqual(["sessionId", "text"]);
  });
});

describe("setup", () => {
  it("names the model, audio out, instructions, tools and transcription", () => {
    const setup = (geminiSetup("gemini-3.8-live", "be brief", VOICE_TOOLS) as { setup: Record<string, unknown> }).setup;
    expect(setup.model).toBe("models/gemini-3.8-live");
    expect(setup.generationConfig).toEqual({ responseModalities: ["AUDIO"] });
    expect(setup.systemInstruction).toEqual({ parts: [{ text: "be brief" }] });
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup.sessionResumption).toEqual({});
    expect(((geminiSetup("models/m", "", [], "h1") as { setup: { sessionResumption: unknown; model: string } }).setup)).toMatchObject({
      model: "models/m",
      sessionResumption: { handle: "h1" },
    });
  });
});

describe("client events", () => {
  const names = new Map([["c1", "send_prompt"]]);
  it("turns session.update into the setup frame", () => {
    const t = translateClientEvent({ type: "session.update", session: { instructions: "hi", tools: VOICE_TOOLS } }, names);
    expect(t.setup?.instructions).toBe("hi");
    expect(t.messages).toEqual([]);
  });
  it("speaks a greeting nudge as text, ignores the bare follow-up", () => {
    expect(translateClientEvent({ type: "response.create", response: { instructions: "Greet" } }, names).messages).toEqual([
      { realtimeInput: { text: "Greet" } },
    ]);
    expect(translateClientEvent({ type: "response.create" }, names).messages).toEqual([]);
  });
  it("sends tool output back as a toolResponse with id and name", () => {
    const [item, follow] = toolOutputEvents("c1", { ok: true });
    expect(translateClientEvent(item, names).messages).toEqual([
      { toolResponse: { functionResponses: [{ id: "c1", name: "send_prompt", response: { ok: true } }] } },
    ]);
    expect(translateClientEvent(follow, names).messages).toEqual([]);
    const scalar = translateClientEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: "c1", output: '"x"' } }, names);
    expect(scalar.messages).toEqual([{ toolResponse: { functionResponses: [{ id: "c1", name: "send_prompt", response: { output: "x" } }] } }]);
  });
});

describe("server messages", () => {
  it("reports setupComplete", () => {
    expect(foldGemini(GEMINI_START, { setupComplete: {} }).setupComplete).toBe(true);
  });
  it("folds transcripts into the same captions, per turn", () => {
    let state = GEMINI_START;
    let captions = foldEvent([], { type: "noop" }).captions;
    for (const message of [
      { serverContent: { inputTranscription: { text: "how is " } } },
      { serverContent: { inputTranscription: { text: "it going" } } },
      { serverContent: { outputTranscription: { text: "All good." }, modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAA=" } }] } } },
      { serverContent: { turnComplete: true } },
      { serverContent: { outputTranscription: { text: "Next" } } },
    ]) {
      const f = foldGemini(state, message);
      state = f.state;
      for (const e of f.events) captions = foldEvent(captions, e).captions;
    }
    expect(captions.map((c) => [c.who, c.text, c.final])).toEqual([
      ["user", "how is it going", true],
      ["assistant", "All good.", true],
      ["assistant", "Next", false],
    ]);
  });
  it("collects audio and ignores text parts", () => {
    const f = foldGemini(GEMINI_START, { serverContent: { modelTurn: { parts: [{ text: "thinking" }, { inlineData: { mimeType: "audio/pcm", data: "AQI=" } }] } } });
    expect(f.audio).toEqual(["AQI="]);
    expect(f.events).toEqual([]);
  });
  it("turns a tool call into the Realtime function call foldEvent runs", () => {
    const f = foldGemini(GEMINI_START, { toolCall: { functionCalls: [{ id: "c9", name: "get_session_status", args: { sessionId: "s" } }] } });
    expect(f.calls).toEqual([{ id: "c9", name: "get_session_status" }]);
    const call = foldEvent([], f.events[0]).call;
    expect(call).toEqual({ callId: "c9", name: "get_session_status", arguments: '{"sessionId":"s"}' });
  });
  it("flags barge-in and closes the turn", () => {
    const f = foldGemini(GEMINI_START, { serverContent: { interrupted: true } });
    expect(f.interrupted).toBe(true);
    expect(f.state.turn).toBe(1);
  });
  it("keeps the resume handle and notices goAway", () => {
    expect(foldGemini(GEMINI_START, { sessionResumptionUpdate: { newHandle: "h", resumable: true } }).resumeHandle).toBe("h");
    expect(foldGemini(GEMINI_START, { sessionResumptionUpdate: { newHandle: "h", resumable: false } }).resumeHandle).toBeUndefined();
    const away = foldGemini(GEMINI_START, { goAway: { timeLeft: "10s" } });
    expect(away.goingAway).toBe(true);
    expect(away.diagnostic).toBe("goAway in 10s");
  });
  it("ignores junk", () => {
    expect(foldGemini(GEMINI_START, null).events).toEqual([]);
    expect(foldGemini(GEMINI_START, "x").setupComplete).toBe(false);
  });
});

describe("failures", () => {
  it("names a bad key and a used-up quota, and says what to do", () => {
    expect(geminiFailure(1008, "API key not valid. Please pass a valid API key.")).toMatchObject({ error: "gemini_key", retryable: false });
    expect(geminiFailure(1008, "PERMISSION_DENIED")).toMatchObject({ error: "gemini_key", retryable: false });
    expect(geminiFailure(1011, "RESOURCE_EXHAUSTED: quota exceeded")).toMatchObject({ error: "gemini_quota", retryable: false });
    expect(geminiFailure(1007, "Unknown name \"foo\"")).toMatchObject({ error: "failed", retryable: false });
    expect(geminiFailure(1006, "")).toMatchObject({ error: "failed", retryable: true });
    expect(voiceFailureMessage("gemini_key")).toContain("pew2 voice gemini-key");
    expect(voiceFailureMessage("gemini_quota")).toContain("quota");
  });
  it("maps a refused token mint the same way", () => {
    expect(geminiTokenFailure("unauthorized", "")).toBe("gemini_key");
    expect(geminiTokenFailure("failed", "Your Gemini API quota is used up")).toBe("gemini_quota");
    expect(geminiTokenFailure("not_signed_in", "")).toBe("not_signed_in");
  });
});

describe("pcm", () => {
  it("round-trips base64 and decodes utf8", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 255);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
    expect(utf8Decode(new TextEncoder().encode('{"t":"é✓"}'))).toBe('{"t":"é✓"}');
  });
  it("resamples 24 kHz to 16 kHz by length and value", () => {
    const input = new Uint8Array(6 * 2);
    const view = new DataView(input.buffer);
    for (let i = 0; i < 6; i++) view.setInt16(i * 2, i * 300, true);
    const out = resamplePcm16(input, 24_000, 16_000);
    expect(out.length).toBe(4 * 2);
    const o = new DataView(out.buffer);
    expect([0, 1, 2, 3].map((i) => o.getInt16(i * 2, true))).toEqual([0, 450, 900, 1350]);
    expect(resamplePcm16(input, 16_000, 16_000)).toEqual(input);
  });
  it("paces playback and drops the rest on barge-in", () => {
    const pacer = new PcmPacer(32, 100); // 32 bytes per ms
    for (let i = 0; i < 10; i++) pacer.push(new Uint8Array(32 * 40)); // 40 ms each
    expect(pacer.take(0).length).toBe(3); // 0, 40, 80 ms < 100 ms lead
    expect(pacer.take(40).length).toBe(1);
    pacer.flush();
    expect(pacer.pending).toBe(0);
    expect(pacer.take(1000)).toEqual([]);
  });
});
