/**
 * Android ringing.
 *
 * iOS rings through PushKit and CallKit. Android has neither, so the daemon
 * sends a high-priority, data-only Expo push (`pew2Call: "1"`, no title or
 * body, so the OS draws nothing). `expo-notifications` hands it to the task
 * defined here even when the app was swiped away, and the task shows the
 * system incoming-call screen through callkeep's ConnectionService.
 *
 * If Telecom cannot ring (the user has not enabled pew2 as a calling account,
 * or the build predates voice), it falls back to a max-importance notification
 * on the `incoming-call` channel; tapping it opens the call screen.
 *
 * `defineCallTask` must run at module scope, early (from `index.ts`), because
 * the background task loads the JS bundle without mounting the app.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { ringAndroid } from "./callkit";
import { callerName, findCallPush, type IncomingCall } from "./protocol";

export const CALL_TASK = "pew2-incoming-call";
/** Must match `CALL_CHANNEL` in the daemon's push.ts. */
export const CALL_CHANNEL = "incoming-call";

/** Calls already rung, so the push and the socket broadcast ring once. */
const rung = new Set<string>();

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CALL_CHANNEL, {
    name: "Incoming calls",
    description: "pew2 rings you when an agent needs you.",
    importance: Notifications.AndroidImportance.MAX,
    sound: "input.wav",
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/** Ring with the system call screen, or a loud notification if that is not possible. */
export async function ringAndroidOrNotify(call: IncomingCall): Promise<void> {
  if (Platform.OS !== "android" || rung.has(call.callId)) return;
  rung.add(call.callId);
  if (await ringAndroid(call)) return;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: callerName(call),
        body: "Tap to talk to pew2.",
        sound: "input.wav",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          pew2Call: "1",
          callId: call.callId,
          reason: call.reason,
          at: String(call.at),
          ...(call.sessionId ? { sessionId: call.sessionId } : null),
          ...(call.folder ? { folder: call.folder } : null),
          ...(call.summary ? { summary: call.summary } : null),
        },
      },
      trigger: { channelId: CALL_CHANNEL },
    });
  } catch {
    // Nothing else to try; the agent's ordinary "needs input" banner remains.
  }
}

/** Register the background task. Call once at module scope from `index.ts`. */
export function defineCallTask(): void {
  if (Platform.OS !== "android") return;
  try {
    TaskManager.defineTask(CALL_TASK, async ({ data, error }) => {
      if (error) return;
      const call = findCallPush(data);
      if (call) await ringAndroidOrNotify(call);
    });
    void Notifications.registerTaskAsync(CALL_TASK).catch(() => undefined);
    // Create the channel up front so a daemon push naming it is never filed
    // into a missing channel.
    void ensureChannel().catch(() => undefined);
  } catch {
    // A build without expo-task-manager: foreground ringing still works.
  }
}

/**
 * Calls opened by tapping the fallback notification, including the tap that
 * launched the app. Returns an unsubscribe function.
 */
export function onCallNotificationTap(open: (call: IncomingCall) => void): () => void {
  if (Platform.OS !== "android") return () => {};
  const seen = new Set<string>();
  const handle = (response: Notifications.NotificationResponse | null) => {
    const call = response ? findCallPush(response.notification.request.content.data) : undefined;
    if (!call || seen.has(call.callId)) return;
    seen.add(call.callId);
    void Notifications.dismissNotificationAsync(response!.notification.request.identifier).catch(() => undefined);
    open(call);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
