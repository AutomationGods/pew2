/**
 * Walkie-talkie voice: one Responses API turn on the user's ChatGPT plan.
 *
 * The phone sends instructions, the whole input history and its tools; this
 * adds the plan credential (`openai-plan.ts`), calls `POST /v1/responses`
 * with `store: false, stream: true` as the plan-usage preview requires, and
 * hands back text deltas, function calls and one terminal event. The preview's
 * unsupported fields are never sent, and any system item from the phone is
 * dropped (the preview rejects them; `instructions` carries that role).
 *
 * Errors keep their documented meaning (errors-and-recovery): the usage limit
 * links to ChatGPT usage settings, `invalid_user` asks for a new sign-in, and
 * nothing silently switches to another billing path.
 */
import type { wire } from "@pew2/protocol";
import type { FetchLike } from "./openai-auth.js";
import { MANAGE_USAGE_URL, PlanAuthError, PlanSession, planGranted, PLAN_RESOURCE, type PlanRecord } from "./openai-plan.js";

export const RESPONSES_URL = `${PLAN_RESOURCE}/responses`;
export const MODELS_URL = `${PLAN_RESOURCE}/models`;
const MODEL_TTL_MS = 60 * 60_000;
const TURN_TIMEOUT_MS = 120_000;

type Event = wire.VoiceRespondEvent["event"];
type ErrorEvent = Extract<Event, { kind: "error" }>;
type Code = wire.VoiceRespondError;

const fail = (error: Code, message: string, extra: Partial<ErrorEvent> = {}): ErrorEvent => ({ kind: "error", error, message, ...extra });

export const SIGN_IN_AGAIN = "Your ChatGPT plan sign-in on your computer has ended. Run `pew2 openai login --plan` there again.";
const USAGE_LIMIT = "Usage limit reached. Review your ChatGPT plan or pew2's app limit in ChatGPT settings.";

/** Map a Responses-layer error code (or bare HTTP status) to what the phone can say. */
export function mapResponsesError(code: string | undefined, status: number | undefined, requestId?: string): ErrorEvent {
  const extra = requestId ? { openaiRequestId: requestId } : {};
  switch (code) {
    case "subscription_sharing_usage_limit_exceeded":
      return fail("usage_limit", USAGE_LIMIT, { ...extra, manageUrl: MANAGE_USAGE_URL });
    case "subscription_sharing_user_not_eligible":
      return fail("not_eligible", "ChatGPT plan usage isn't available for this account or workspace.", extra);
    case "subscription_sharing_usage_unavailable":
    case "subscription_sharing_user_unavailable":
      return fail("unavailable", "OpenAI couldn't check your ChatGPT plan usage right now. Try again in a minute.", extra);
    case "subscription_sharing_unsupported_capability":
    case "subscription_sharing_route_not_supported":
      return fail("unsupported", "OpenAI refused part of the walkie-talkie request. Update pew2 on your phone and computer.", extra);
    case "subscription_sharing_invalid_user":
      return fail("reauth", SIGN_IN_AGAIN, extra);
    case "chatpass_v2_scope_not_authorized":
    case "chatpass_v2_invalid_authorization_context":
      return fail("plan_not_enabled", "Your ChatGPT sign-in doesn't allow pew2 to use your plan. Run `pew2 openai login --plan` on your computer to enable it.", extra);
    case undefined:
    default:
      break;
  }
  if (status === 401) return fail("reauth", SIGN_IN_AGAIN, extra);
  if (status === 403) return fail("not_eligible", "OpenAI didn't allow this request (account, workspace or region policy).", extra);
  if (status === 429) return fail("usage_limit", USAGE_LIMIT, { ...extra, manageUrl: MANAGE_USAGE_URL });
  if (status === 503) return fail("unavailable", "ChatGPT plan usage is unavailable right now. Try again in a minute.", extra);
  if (status === 400) return fail("unsupported", "OpenAI refused the walkie-talkie request.", extra);
  return fail("failed", "Couldn't reach OpenAI from your computer. Try again.", extra);
}

/** Model catalog for the signed-in account, cached per client for an hour. */
export class PlanModelCache {
  private cached?: { clientId: string; at: number; slugs: string[] };

  async pick(record: PlanRecord, fetchImpl: FetchLike, now: number): Promise<string | undefined> {
    if (!this.cached || this.cached.clientId !== record.clientId || now - this.cached.at > MODEL_TTL_MS) {
      const slugs = await listModels(record.accessToken ?? "", fetchImpl);
      if (slugs.length === 0) return this.cached?.clientId === record.clientId ? chooseModel(this.cached.slugs) : undefined;
      this.cached = { clientId: record.clientId, at: now, slugs };
    }
    return chooseModel(this.cached.slugs);
  }
}

/** Slugs with `visibility: "list"`, in the server's order. Empty on any failure. */
export async function listModels(accessToken: string, fetchImpl: FetchLike): Promise<string[]> {
  try {
    const response = await fetchImpl(MODELS_URL, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: { slug?: unknown; visibility?: unknown }[]; data?: { id?: unknown }[] };
    const models = data.models ?? [];
    return models
      .filter((m) => m.visibility === "list" && typeof m.slug === "string")
      .map((m) => m.slug as string);
  } catch {
    return [];
  }
}

/**
 * A spoken back-and-forth wants a quick model: the first listed "mini" one,
 * otherwise the server's first (its own ordering is the recommendation).
 */
export function chooseModel(slugs: readonly string[]): string | undefined {
  return slugs.find((s) => /mini/i.test(s)) ?? slugs[0];
}

/** The request body, with only fields the plan-usage preview accepts. */
export function responsesBody(model: string, request: Pick<wire.VoiceRespondRequest, "instructions" | "input" | "tools">) {
  const input = request.input.filter((item) => item.role !== "system");
  return {
    model,
    instructions: request.instructions,
    input,
    ...(request.tools && request.tools.length > 0 ? { tools: request.tools, tool_choice: "auto" } : {}),
    store: false,
    stream: true,
  };
}

/** Split an SSE byte stream into parsed `data:` JSON payloads. */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = body.getReader();
  const flush = function* (block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data || data === "[DONE]") return;
    try {
      const value = JSON.parse(data) as unknown;
      if (value && typeof value === "object") yield value as Record<string, unknown>;
    } catch {
      // A malformed frame is skipped; the terminal event decides the outcome.
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, "");
      yield* flush(block);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield* flush(buffer);
}

const errorOf = (value: unknown): { code?: string; message?: string } => {
  if (!value || typeof value !== "object") return {};
  const e = value as Record<string, unknown>;
  return { code: typeof e.code === "string" ? e.code : undefined, message: typeof e.message === "string" ? e.message : undefined };
};

/** Read a stream to its terminal event, emitting deltas and calls as they come. */
export async function relayStream(
  body: ReadableStream<Uint8Array>,
  model: string,
  emit: (event: Event) => void,
  requestId?: string,
): Promise<void> {
  for await (const e of sseEvents(body)) {
    switch (e.type) {
      case "response.output_text.delta":
        if (typeof e.delta === "string" && e.delta) emit({ kind: "delta", text: e.delta });
        break;
      case "response.output_item.done": {
        const item = (e.item ?? {}) as Record<string, unknown>;
        if (item.type === "function_call" && typeof item.call_id === "string" && typeof item.name === "string") {
          emit({
            kind: "call",
            callId: item.call_id,
            name: item.name,
            ...(typeof item.namespace === "string" ? { namespace: item.namespace } : {}),
            arguments: typeof item.arguments === "string" ? item.arguments : "{}",
          });
        }
        break;
      }
      case "response.completed":
        emit({ kind: "done", model });
        return;
      case "response.failed": {
        const err = errorOf((e.response as Record<string, unknown> | undefined)?.error);
        emit(mapResponsesError(err.code, undefined, requestId));
        return;
      }
      case "response.incomplete":
        emit(fail("incomplete", "The answer stopped early. Try again.", requestId ? { openaiRequestId: requestId } : {}));
        return;
      case "error": {
        const err = errorOf(e.error ?? e);
        emit(mapResponsesError(err.code, undefined, requestId));
        return;
      }
    }
  }
  emit(fail("incomplete", "The connection to OpenAI dropped before the answer finished. Try again.", requestId ? { openaiRequestId: requestId } : {}));
}

export interface VoiceRespondDeps {
  env: NodeJS.ProcessEnv;
  session: PlanSession;
  models: PlanModelCache;
  fetchImpl?: FetchLike;
  now?: () => number;
}

async function post(token: string, body: unknown, fetchImpl: FetchLike): Promise<Response> {
  return fetchImpl(RESPONSES_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
  });
}

/** Run one turn. Always ends with exactly one `done` or `error` event; never throws. */
export async function voiceRespond(request: wire.VoiceRespondRequest, emit: (event: Event) => void, deps: VoiceRespondDeps): Promise<void> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = (deps.now ?? Date.now)();
  let record: PlanRecord | undefined;
  try {
    record = await deps.session.fresh(deps.env);
  } catch (error) {
    if (error instanceof PlanAuthError && (error.kind === "reauth" || error.kind === "invalid_client")) {
      emit(fail("reauth", SIGN_IN_AGAIN));
    } else {
      emit(fail("failed", "Couldn't refresh the ChatGPT sign-in on your computer. Try again."));
    }
    return;
  }
  if (!record?.accessToken) {
    emit(fail("not_signed_in", "Walkie-talkie needs your ChatGPT plan on your computer. Run `pew2 openai login --plan` there."));
    return;
  }
  if (!planGranted(record)) {
    emit(fail("plan_not_enabled", "ChatGPT plan use isn't enabled for pew2. Run `pew2 openai login --plan` on your computer to enable it."));
    return;
  }

  try {
    const model = request.model ?? (await deps.models.pick(record, fetchImpl, now));
    if (!model) {
      emit(fail("failed", "Couldn't list the models on your ChatGPT plan. Try again."));
      return;
    }
    const body = responsesBody(model, request);
    let response = await post(record.accessToken, body, fetchImpl);
    if (response.status === 401) {
      // Revoked early or rotated elsewhere: one forced refresh, one retry.
      try {
        const next = await deps.session.fresh(deps.env, true);
        if (next?.accessToken) response = await post(next.accessToken, body, fetchImpl);
      } catch {
        // keep the 401
      }
    }
    const openaiRequestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.ok || !response.body) {
      let code: string | undefined;
      try {
        code = errorOf(((await response.json()) as { error?: unknown }).error).code;
      } catch {
        // `{"detail": …}` admission bodies and non-JSON carry no stable code.
      }
      emit(mapResponsesError(code, response.status, openaiRequestId));
      return;
    }
    await relayStream(response.body, model, emit, openaiRequestId);
  } catch {
    emit(fail("failed", "Couldn't reach OpenAI from your computer. Try again."));
  }
}
