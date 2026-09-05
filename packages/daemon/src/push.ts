/**
 * Remote push, sent by the machine that is still awake.
 *
 * The app can only raise a local banner while its JavaScript is running, and
 * iOS suspends that within seconds of the app being backgrounded — taking the
 * relay socket with it. So the notification that matters most, a long turn
 * finishing while the phone is in a pocket, arrived only when the app was next
 * opened. This closes that: the daemon never sleeps, so the daemon sends it.
 *
 * Two deliberate non-choices:
 *
 * - **The relay is not involved.** It would be the obvious place for a device
 *   registry, and it is the one component that must stay a dumb pipe holding no
 *   user state. The desktop has internet; it can call the push service itself.
 * - **Tokens are held in memory only.** A push token identifies a phone, and
 *   writing one to disk gives the daemon a persistent record of a device for no
 *   gain: the app re-registers on every connect, and a daemon that just started
 *   has nothing to announce yet anyway.
 *
 * The cost of the feature is honest and belongs here rather than buried: the
 * banner's title and body are rendered by iOS with no JavaScript involved, so
 * they cannot be encrypted end-to-end. Expo, Apple and Google see the project
 * name and the agent's opening line. Everything else in pew2 stays sealed; this
 * one string does not, and that is the price of an instant notification.
 */
import { noticeBody, noticeTitle, summarise, type NoticeOrigin } from "@pew2/protocol";

/** Expo's push endpoint. Needs no credentials of ours; EAS holds those. */
const PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Matches what `getExpoPushTokenAsync` returns, so junk never reaches Expo. */
const TOKEN_SHAPE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

/** A phone that has asked to be told about agent activity. */
interface Target {
  token: string;
  platform: "ios" | "android";
}

export type PushKind = "complete" | "input" | "error";

export interface AgentPush extends NoticeOrigin {
  sessionId: string;
  kind?: PushKind;
  /** Agent output for completion, or an error message for failures. */
  text?: string;
  /** Backwards-compatible completion input. */
  lastText?: string;
}

const ANDROID_CHANNELS: Record<PushKind, string> = {
  complete: "agent-complete",
  input: "agent-input",
  error: "agent-error",
};

const SOUNDS: Record<PushKind, string> = {
  complete: "complete.wav",
  input: "input.wav",
  error: "error.wav",
};

/** The notification category carrying the inline reply box. */
const CATEGORY = "agentTurn";

/**
 * Every phone paired to this daemon, keyed by device.
 *
 * Keyed by `deviceId` rather than by token so that a phone whose token rotated
 * replaces its old entry instead of accumulating one per launch — otherwise a
 * week of app restarts means a week of duplicate banners.
 */
export class PushRegistry {
  private readonly targets = new Map<string, Target>();

  /**
   * Remember where to push for a device, or reject a token that is not one.
   *
   * @returns whether the token was accepted, so a caller can log the refusal.
   */
  register(deviceId: string, token: string, platform: "ios" | "android"): boolean {
    if (!TOKEN_SHAPE.test(token)) return false;
    this.targets.set(deviceId, { token, platform });
    return true;
  }

  /** Stop pushing to a token the service says is no longer registered. */
  forget(token: string): void {
    for (const [deviceId, target] of this.targets) {
      if (target.token === token) this.targets.delete(deviceId);
    }
  }

  list(): Target[] {
    return [...this.targets.values()];
  }

  get size(): number {
    return this.targets.size;
  }
}

/** One message in Expo's push API shape. */
interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { sessionId: string; kind: PushKind };
  sound: string;
  categoryId: string;
  channelId?: string;
  priority: "high";
}

/** Expo's per-message result. Errors are reported here, not as an HTTP status. */
interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

export function pushMessages(registry: PushRegistry, notice: AgentPush): ExpoMessage[] {
  const kind = notice.kind ?? "complete";
  const title = noticeTitle(notice);
  const body =
    kind === "input"
      ? "Your agent needs an answer."
      : kind === "error"
        ? summarise(notice.text) ?? "The agent hit an error."
        : noticeBody(notice.text ?? notice.lastText);
  return registry.list().map((target) => ({
    to: target.token,
    title,
    body,
    data: { sessionId: notice.sessionId, kind },
    sound: SOUNDS[kind],
    categoryId: CATEGORY,
    ...(target.platform === "android"
      ? { channelId: ANDROID_CHANNELS[kind] }
      : null),
    priority: "high",
  }));
}

/**
 * Interpret Expo's reply and drop tokens it has declared dead.
 *
 * Exported for tests: the failure that matters is a token that keeps being sent
 * to forever, and that is invisible without asserting on this.
 */
export function applyTickets(
  registry: PushRegistry,
  messages: ExpoMessage[],
  tickets: unknown,
): void {
  if (!Array.isArray(tickets)) return;
  tickets.forEach((ticket: ExpoTicket, index) => {
    if (ticket?.status !== "error") return;
    if (ticket.details?.error !== "DeviceNotRegistered") return;
    const message = messages[index];
    if (message) registry.forget(message.to);
  });
}

/** Send one agent notification without delaying or failing the session. */
export async function pushAgentNotice(
  registry: PushRegistry,
  notice: AgentPush,
): Promise<void> {
  if (registry.size === 0) return;
  const messages = pushMessages(registry, notice);
  try {
    const response = await fetch(PUSH_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { data?: unknown };
    applyTickets(registry, messages, payload?.data);
  } catch {
    // Offline desktop, DNS failure, or Expo outage: notifications stay optional.
  }
}

/** Backwards-compatible completion helper. */
export function pushFinishedTurn(registry: PushRegistry, turn: AgentPush): Promise<void> {
  return pushAgentNotice(registry, { ...turn, kind: "complete" });
}
