/**
 * Reading an approval request, from wherever it reached this device.
 *
 * The same request arrives by two routes that look nothing alike: live, as a
 * `permission_request` session event while the socket is up, and on reconnect,
 * as the daemon's list of what the agent is *still* blocked on. Both end up in
 * front of the same sheet with the same buttons, so both are read here — the
 * alternative was two copies of the defaulting below, and a phone that came
 * back from a signal drop offering "Allow/Reject" for a request whose real
 * options were "Yes, and don't ask again".
 *
 * Expo-free so it can be tested directly.
 */
import type { PermissionRequest } from "./useDaemon";
import { field, isRecord } from "./untyped";

/** One choice in a GG Coder desktop question, as the desktop sends it. */
export interface DesktopOption {
  label: string;
  value?: string;
  hint?: string;
  recommended?: boolean;
}

/** One question in a GG Coder desktop question card. */
export interface DesktopQuestion {
  id: string;
  question: string;
  kind: "confirm" | "choice" | "multi" | "text";
  detail?: string;
  options?: DesktopOption[];
  allowOther?: boolean;
}

/** A card's answers, keyed by question id: text or a pick, or a list for multi. */
export type DesktopAnswers = Record<string, string | string[]>;

const KINDS = new Set(["confirm", "choice", "multi", "text"]);
const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

function readOption(raw: unknown): DesktopOption | undefined {
  const label = text(field(raw, "label"));
  if (!label) return undefined;
  const value = text(field(raw, "value"));
  const hint = text(field(raw, "hint"));
  return {
    label,
    ...(value !== undefined ? { value } : {}),
    ...(hint ? { hint } : {}),
    ...(field(raw, "recommended") === true ? { recommended: true } : {}),
  };
}

function readQuestion(raw: unknown): DesktopQuestion | undefined {
  const id = text(field(raw, "id"));
  const question = text(field(raw, "question"));
  const kind = text(field(raw, "kind"));
  if (!id || !question || !kind || !KINDS.has(kind)) return undefined;
  const rawOptions = field(raw, "options");
  const options = Array.isArray(rawOptions)
    ? (rawOptions as unknown[]).map(readOption).filter((o): o is DesktopOption => o !== undefined)
    : undefined;
  const detail = text(field(raw, "detail"));
  const allowOther = field(raw, "allowOther");
  return {
    id,
    question,
    kind: kind as DesktopQuestion["kind"],
    ...(detail ? { detail } : {}),
    ...(options && options.length > 0 ? { options } : {}),
    ...(typeof allowOther === "boolean" ? { allowOther } : {}),
  };
}

/**
 * The question card a GG Coder desktop ask carries, or undefined for any other
 * request. All or nothing: a card with an unreadable question is not shown as
 * a card at all, because answering part of it would be refused anyway.
 */
export function readDesktopQuestions(params: unknown): DesktopQuestion[] | undefined {
  const raw = field(field(field(params, "_meta"), "ggDesktopAsk"), "questions");
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const questions = (raw as unknown[]).map(readQuestion);
  return questions.every((q): q is DesktopQuestion => q !== undefined) ? questions : undefined;
}

/** The shape an agent sends, of which everything is optional in practice. */
interface PermissionParams {
  toolCall?: { title?: string };
  options?: { optionId: string; name: string }[];
}

/**
 * Fallback buttons, for an agent that asks without offering any.
 *
 * A sheet with no options is unanswerable, and an unanswerable sheet stops the
 * turn exactly as dead as no sheet at all.
 */
const DEFAULT_OPTIONS = [
  { optionId: "allow", name: "Allow" },
  { optionId: "reject", name: "Reject" },
];

/** One open request, from its `requestId` and the agent's raw params. */
export function toPermissionRequest(requestId: string, params: unknown): PermissionRequest {
  const fields = (isRecord(params) ? params : {}) as PermissionParams;
  const questions = readDesktopQuestions(params);
  return {
    requestId,
    title: fields.toolCall?.title ?? "The agent needs your approval",
    options:
      Array.isArray(fields.options) && fields.options.length > 0
        ? fields.options
        : DEFAULT_OPTIONS,
    ...(questions ? { questions } : {}),
  };
}

/** A live `permission_request` event payload, or undefined for any other event. */
export function readPermissionRequest(payload: unknown): PermissionRequest | undefined {
  const event = payload as { kind?: string; requestId?: unknown; params?: unknown } | undefined;
  if (event?.kind !== "permission_request" || typeof event.requestId !== "string") return undefined;
  return toPermissionRequest(event.requestId, event.params);
}

/**
 * The request to put on screen, from the daemon's catch-up list.
 *
 * The newest, because that is what live does: a second request arriving while
 * the first is up replaces it. Matching that here means a reconnect shows what
 * the phone would have been showing had it never dropped, rather than an older
 * request the screen had already moved past.
 *
 * Undefined for an absent field — an older daemon that does not send one — and
 * *only* for that. An empty array is a daemon that says nothing is pending,
 * which is a fact worth carrying: it is what dismisses a sheet the user
 * answered on the desktop while this phone was offline.
 */
export function pendingPermission(
  permissions: unknown,
): PermissionRequest | undefined | null {
  if (!Array.isArray(permissions)) return undefined;
  const open = permissions.filter(
    (entry): entry is { requestId: string; params?: unknown } =>
      typeof entry?.requestId === "string",
  );
  const last = open[open.length - 1];
  return last ? toPermissionRequest(last.requestId, last.params) : null;
}
