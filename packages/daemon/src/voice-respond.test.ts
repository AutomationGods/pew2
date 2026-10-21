import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { wire } from "@pew2/protocol";
import { DIRECT_SCOPE, PlanSession, savePlan, type PlanRecord } from "./openai-plan";
import { chooseModel, mapResponsesError, PlanModelCache, responsesBody, voiceRespond } from "./voice-respond";

type Event = wire.VoiceRespondEvent["event"];
const NOW = 1_800_000_000_000;
const record = (scopes = [DIRECT_SCOPE]): PlanRecord => ({
  issuer: "https://auth.openai.com",
  clientId: "oaiapp_1",
  extAgentHostId: "urn:uuid:1",
  subject: "u",
  accessToken: "tok",
  refreshToken: "r",
  expiresAt: NOW + 3600_000,
  scopes,
});
const request: wire.VoiceRespondRequest = {
  t: "voice.respond",
  requestId: "r1",
  instructions: "Be brief.",
  input: [{ role: "system", content: "x" }, { role: "user", content: "hi" }],
  tools: [{ type: "namespace", name: "pew2", description: "d", tools: [] }],
};
const sse = (events: unknown[]) =>
  new Response(events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join(""), { headers: { "content-type": "text/event-stream", "x-request-id": "req_1" } });

async function run(responses: (url: string, body: unknown) => Response, scopes?: string[]) {
  const env = { PEW2_HOME: await mkdtemp(join(tmpdir(), "pew2-respond-")) };
  await savePlan(record(scopes), env);
  const events: Event[] = [];
  const bodies: unknown[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    if (url.endsWith("/v1/responses")) bodies.push(body);
    return responses(url, body);
  };
  await voiceRespond(request, (e) => events.push(e), { env, session: new PlanSession({ now: () => NOW, fetchImpl }), models: new PlanModelCache(), fetchImpl, now: () => NOW });
  return { events, bodies };
}

const models = () => new Response(JSON.stringify({ models: [
  { slug: "hidden-mini", visibility: "hide" },
  { slug: "big", visibility: "list" },
  { slug: "fast-mini", visibility: "list" },
] }));

describe("voiceRespond", () => {
  test("streams deltas and namespaced calls, then done, with a preview-safe body", async () => {
    const { events, bodies } = await run((url) =>
      url.endsWith("/models")
        ? models()
        : sse([
          { type: "response.output_text.delta", delta: "Hel" },
          { type: "response.output_text.delta", delta: "lo" },
          { type: "response.output_item.done", item: { type: "function_call", call_id: "c1", name: "list_sessions", namespace: "pew2", arguments: "{}" } },
          { type: "response.completed", response: {} },
        ]));
    expect(events).toEqual([
      { kind: "delta", text: "Hel" },
      { kind: "delta", text: "lo" },
      { kind: "call", callId: "c1", name: "list_sessions", namespace: "pew2", arguments: "{}" },
      { kind: "done", model: "fast-mini" },
    ]);
    const body = bodies[0] as Record<string, unknown>;
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.model).toBe("fast-mini");
    expect(body.input).toEqual([{ role: "user", content: "hi" }]);
    for (const banned of ["temperature", "max_output_tokens", "metadata", "previous_response_id", "truncation", "user"]) {
      expect(banned in body).toBe(false);
    }
  });

  test("usage limit mid-stream links to ChatGPT usage settings", async () => {
    const { events } = await run((url) =>
      url.endsWith("/models") ? models() : sse([{ type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }]));
    expect(events).toEqual([expect.objectContaining({ kind: "error", error: "usage_limit", manageUrl: "https://chatgpt.com/settings/usage", openaiRequestId: "req_1" })]);
  });

  test("a stream that ends without completion is incomplete", async () => {
    const { events } = await run((url) => (url.endsWith("/models") ? models() : sse([{ type: "response.output_text.delta", delta: "a" }])));
    expect(events.at(-1)).toMatchObject({ kind: "error", error: "incomplete" });
  });

  test("structured errors before the stream map to the enum", async () => {
    const { events } = await run((url) =>
      url.endsWith("/models") ? models() : new Response(JSON.stringify({ error: { code: "subscription_sharing_user_not_eligible" } }), { status: 403 }));
    expect(events).toEqual([expect.objectContaining({ kind: "error", error: "not_eligible" })]);
  });

  test("no plan grant never calls OpenAI", async () => {
    const { events, bodies } = await run(() => models(), ["openid"]);
    expect(events).toEqual([expect.objectContaining({ kind: "error", error: "plan_not_enabled" })]);
    expect(bodies).toHaveLength(0);
  });

  test("not signed in", async () => {
    const env = { PEW2_HOME: await mkdtemp(join(tmpdir(), "pew2-respond-")) };
    const events: Event[] = [];
    await voiceRespond(request, (e) => events.push(e), { env, session: new PlanSession(), models: new PlanModelCache() });
    expect(events).toEqual([expect.objectContaining({ error: "not_signed_in" })]);
  });
});

describe("helpers", () => {
  test("model choice prefers a listed mini model", () => {
    expect(chooseModel(["big", "fast-mini"])).toBe("fast-mini");
    expect(chooseModel(["big", "bigger"])).toBe("big");
    expect(chooseModel([])).toBeUndefined();
  });
  test("error map", () => {
    expect(mapResponsesError("subscription_sharing_invalid_user", 401).error).toBe("reauth");
    expect(mapResponsesError(undefined, 503).error).toBe("unavailable");
    expect(mapResponsesError("subscription_sharing_unsupported_capability", 400).error).toBe("unsupported");
  });
  test("body omits tools when there are none", () => {
    expect("tools" in responsesBody("m", { instructions: "", input: [{ role: "user", content: "x" }] })).toBe(false);
  });
});
