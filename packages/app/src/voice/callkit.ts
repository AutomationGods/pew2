/**
 * Ringing the phone like a real call: CallKit through `react-native-callkeep`
 * and VoIP pushes through `react-native-voip-push-notification` on iOS; on
 * Android the same callkeep API drives a Telecom ConnectionService, so the
 * system incoming-call screen rings there too (the push comes from Expo; see
 * `androidRing.ts`).
 *
 * Both are native modules, probed before they are required (see `ui/speech.ts`
 * for why), so Expo Go, Android and builds made before voice simply have no
 * CallKit and `callKitAvailable()` answers false.
 *
 * The VoIP push itself is reported to CallKit natively, in AppDelegate (added
 * by `plugins/withVoiceCall.js`): iOS kills an app that receives a VoIP push
 * and does not report a call before the handler returns, and JavaScript may not
 * even be loaded yet. This module only reacts to what CallKit reports back.
 */
import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";
import type RNCallKeepType from "react-native-callkeep";
import type RNVoipPushType from "react-native-voip-push-notification";
import { callerName, parseIncoming, type IncomingCall } from "./protocol";

type CallKeep = typeof RNCallKeepType;
type VoipPush = typeof RNVoipPushType;

/** `voip` is iOS only: Android rings through an Expo push instead. */
let modules: { callKeep: CallKeep; voip?: VoipPush } | null | undefined;

const isAndroid = Platform.OS === "android";

function native(): { callKeep: CallKeep; voip?: VoipPush } | null {
  if (modules !== undefined) return modules;
  // Merely reading a module off NativeModules can throw under the new
  // architecture: the interop layer builds the module on first touch and
  // refuses one it cannot parse (callkeep exported two methods with one name,
  // and the app died on launch with "Exception in HostObject::get for prop
  // 'RNCallKeep'"). Ringing is an extra; a module that will not load must cost
  // the call screen, never the app.
  const has = (name: string): boolean => {
    try {
      return !!(NativeModules as Record<string, unknown>)[name];
    } catch {
      return false;
    }
  };
  const ios = Platform.OS === "ios" && has("RNCallKeep") && has("RNVoipPushNotificationManager");
  const android = isAndroid && has("RNCallKeep");
  if (!ios && !android) {
    modules = null;
    return modules;
  }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const callKeep = (require("react-native-callkeep") as { default: CallKeep }).default;
    const voip = ios
      ? (require("react-native-voip-push-notification") as { default: VoipPush }).default
      : undefined;
    /* eslint-enable @typescript-eslint/no-require-imports */
    modules = { callKeep, voip };
  } catch {
    modules = null;
  }
  return modules;
}

export function callKitAvailable(): boolean {
  return native() !== null;
}

export interface CallKitHandlers {
  /** The user answered a ringing call (or an outgoing one started). */
  onAnswer: (call: IncomingCall) => void;
  /** CallKit ended a call: declined, hung up from the lock screen, or failed. */
  onEnd: (callId: string) => void;
  /** CallKit activated (true) or deactivated the audio session. */
  onAudioSession: (active: boolean) => void;
  onMute: (callId: string, muted: boolean) => void;
}

/** Calls CallKit knows about, by UUID, so an answer can find its session. */
const known = new Map<string, IncomingCall>();
let handlers: CallKitHandlers | undefined;
let setUp = false;
let lastToken: string | undefined;
/**
 * An Android call answered before the app's UI mounted (rung from the headless
 * push task while the app was closed). Delivered by `setupCallKit`.
 */
let pendingAnswer: IncomingCall | undefined;
const tokenWaiters: ((token: string) => void)[] = [];

function remember(value: unknown): IncomingCall | undefined {
  const call = parseIncoming(value);
  if (call) known.set(call.callId, { ...known.get(call.callId), ...call });
  return call;
}

function answered(callId: string) {
  const id = callId.toLowerCase();
  const call = known.get(id) ?? { callId: id, reason: "manual" as const, at: Date.now() };
  if (isAndroid) {
    const m = native();
    // The system call screen sits above the app; bring pew2 forward so the
    // call screen with captions is what the user sees, and tell Telecom the
    // call is live (otherwise it keeps "ringing" in the status bar).
    m?.callKeep.backToForeground();
    m?.callKeep.setCurrentCallActive(id);
  }
  if (handlers) handlers.onAnswer(call);
  else pendingAnswer = call;
}

/** Android Telecom setup without the in-app alert (safe in a headless task). */
const ANDROID_OPTIONS = {
  alertTitle: "Let pew2 ring you",
  alertDescription: "Turn on pew2 as a calling account so your agents can ring this phone when they need you.",
  cancelButton: "Not now",
  okButton: "Open settings",
  additionalPermissions: [] as string[],
  selfManaged: false,
  foregroundService: {
    channelId: "pew2-call-service",
    channelName: "Live voice calls",
    notificationTitle: "pew2 call in progress",
  },
};

let androidEvents = false;
function listenAndroid(callKeep: CallKeep) {
  if (androidEvents) return;
  androidEvents = true;
  callKeep.addEventListener("answerCall", (d) => handleCallKeepEvent("RNCallKeepPerformAnswerCallAction", d));
  callKeep.addEventListener("endCall", (d) => handleCallKeepEvent("RNCallKeepPerformEndCallAction", d));
  callKeep.addEventListener("didPerformSetMutedCallAction", (d) => handleCallKeepEvent("RNCallKeepDidPerformSetMutedCallAction", d));
}

/**
 * Android only: show the system incoming-call screen from the background push
 * task, where no UI exists and the setup alert must not run.
 *
 * @returns false when Telecom cannot ring (no callkeep in this build, or the
 * user has not enabled pew2 as a calling account); the caller then falls back
 * to a high-priority notification.
 */
export async function ringAndroid(call: IncomingCall): Promise<boolean> {
  const m = native();
  if (!m || !isAndroid) return false;
  try {
    m.callKeep.registerPhoneAccount({ android: ANDROID_OPTIONS } as never);
    m.callKeep.registerAndroidEvents();
    m.callKeep.setAvailable(true);
    if (!(await m.callKeep.checkPhoneAccountEnabled())) return false;
    listenAndroid(m.callKeep);
    if (known.has(call.callId)) return true;
    known.set(call.callId, call);
    m.callKeep.displayIncomingCall(call.callId, "pew2", callerName(call), "generic", false);
    return true;
  } catch {
    return false;
  }
}

function handleCallKeepEvent(name: string, data: Record<string, unknown> | undefined) {
  const callUUID = typeof data?.callUUID === "string" ? data.callUUID.toLowerCase() : "";
  switch (name) {
    case "RNCallKeepDidDisplayIncomingCall":
      remember(data?.payload);
      return;
    case "RNCallKeepPerformAnswerCallAction":
      if (callUUID) answered(callUUID);
      return;
    case "RNCallKeepPerformEndCallAction":
      if (callUUID) {
        known.delete(callUUID);
        handlers?.onEnd(callUUID);
      }
      return;
    case "RNCallKeepDidActivateAudioSession":
      handlers?.onAudioSession(true);
      return;
    case "RNCallKeepDidDeactivateAudioSession":
      handlers?.onAudioSession(false);
      return;
    case "RNCallKeepDidPerformSetMutedCallAction":
      if (callUUID) handlers?.onMute(callUUID, data?.muted === true);
      return;
  }
}

/**
 * Install listeners once. Safe to call on every mount; the latest handlers win.
 * Replays events CallKit queued before JavaScript loaded (a cold launch from a
 * VoIP push that was answered from the lock screen).
 */
export function setupCallKit(next: CallKitHandlers): void {
  handlers = next;
  const m = native();
  if (!m || setUp) return;
  setUp = true;
  const { callKeep, voip } = m;

  void callKeep
    .setup({
      ios: { appName: "pew2", includesCallsInRecents: false, supportsVideo: false },
      android: ANDROID_OPTIONS,
    })
    .then(() => {
      if (isAndroid) callKeep.setAvailable(true);
    })
    .catch(() => undefined);

  if (pendingAnswer) {
    const call = pendingAnswer;
    pendingAnswer = undefined;
    next.onAnswer(call);
  }

  if (isAndroid) {
    listenAndroid(callKeep);
    return;
  }
  if (!voip) return;

  callKeep.addEventListener("didDisplayIncomingCall", (d) => handleCallKeepEvent("RNCallKeepDidDisplayIncomingCall", d as never));
  callKeep.addEventListener("answerCall", (d) => handleCallKeepEvent("RNCallKeepPerformAnswerCallAction", d));
  callKeep.addEventListener("endCall", (d) => handleCallKeepEvent("RNCallKeepPerformEndCallAction", d));
  callKeep.addEventListener("didActivateAudioSession", () => handleCallKeepEvent("RNCallKeepDidActivateAudioSession", undefined));
  callKeep.addEventListener("didDeactivateAudioSession", () => handleCallKeepEvent("RNCallKeepDidDeactivateAudioSession", undefined));
  callKeep.addEventListener("didPerformSetMutedCallAction", (d) => handleCallKeepEvent("RNCallKeepDidPerformSetMutedCallAction", d));
  callKeep.addEventListener("didLoadWithEvents", (events) => {
    for (const event of events ?? []) handleCallKeepEvent(event.name, event.data as Record<string, unknown> | undefined);
  });

  const onToken = (token: string) => {
    lastToken = token;
    for (const resolve of tokenWaiters.splice(0)) resolve(token);
  };
  const onPush = (payload: unknown) => {
    const call = remember(payload);
    // The native side already reported the call to CallKit; tell PushKit the
    // push is handled.
    if (call) voip.onVoipNotificationCompleted(call.callId);
  };
  voip.addEventListener("register", onToken);
  voip.addEventListener("notification", onPush);
  voip.addEventListener("didLoadWithEvents", (events) => {
    for (const event of events ?? []) {
      if (event.name === "RNVoipPushRemoteNotificationsRegisteredEvent") onToken(event.data as string);
      if (event.name === "RNVoipPushRemoteNotificationReceivedEvent") onPush(event.data);
    }
  });
  voip.registerVoipToken();
}

/** What the daemon needs to send this phone VoIP pushes. */
export interface VoipAddress {
  token: string;
  environment: "production" | "sandbox";
  bundleId: string;
}

/**
 * This phone's VoIP push address, or undefined (Android, Expo Go, simulator,
 * no PushKit token within a few seconds).
 *
 * `sandbox` for development builds: those are signed with the development
 * `aps-environment`. Release and TestFlight builds are production.
 */
export async function voipAddress(): Promise<VoipAddress | undefined> {
  const m = native();
  if (!m?.voip) return undefined;
  const voip = m.voip;
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  if (!bundleId) return undefined;
  const token =
    lastToken ??
    (await new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), 8000);
      tokenWaiters.push((t) => {
        clearTimeout(timer);
        resolve(t);
      });
      voip.registerVoipToken();
    }));
  if (!token || !/^[0-9a-fA-F]{32,200}$/.test(token)) return undefined;
  return { token, environment: __DEV__ ? "sandbox" : "production", bundleId };
}

/** Ring with the system call UI, for a `voice.incoming` while foregrounded. */
export function showIncoming(call: IncomingCall): boolean {
  const m = native();
  if (!m) return false;
  if (known.has(call.callId)) return true;
  known.set(call.callId, call);
  m.callKeep.displayIncomingCall(call.callId, "pew2", callerName(call), "generic", false);
  return true;
}

/**
 * Register a call the user started from the app, so CallKit owns the audio
 * session the same way it does for an incoming one. Answers at once.
 */
export function startOutgoing(call: IncomingCall): boolean {
  const m = native();
  // Android: a Talk call is in-app only; registering it with Telecom would need
  // the calling account and buys nothing the call screen does not already do.
  if (!m || isAndroid) return false;
  known.set(call.callId, call);
  m.callKeep.startCall(call.callId, "pew2", callerName(call), "generic", false);
  m.callKeep.reportConnectedOutgoingCallWithUUID(call.callId);
  return true;
}

export function endCall(callId: string): void {
  known.delete(callId);
  native()?.callKeep.endCall(callId);
}

export function setCallMuted(callId: string, muted: boolean): void {
  native()?.callKeep.setMutedCall(callId, muted);
}

/**
 * Route call audio to the loudspeaker or back to the earpiece. iOS: speaker is
 * an output override; "off" re-selects the built-in mic (type "Phone"), which
 * clears the override and puts audio back on the receiver.
 */
export async function setCallSpeaker(callId: string, on: boolean): Promise<void> {
  const m = native();
  if (!m) return;
  try {
    if (isAndroid) {
      m.callKeep.toggleAudioRouteSpeaker(callId, on);
      return;
    }
    if (on) {
      await m.callKeep.setAudioRoute(callId, "Speaker");
      return;
    }
    const routes = (await m.callKeep.getAudioRoutes()) as unknown as { name: string; type: string }[];
    const phone = routes.find((route) => route.type === "Phone");
    if (phone) await m.callKeep.setAudioRoute(callId, phone.name);
  } catch {
    // A route that vanished mid-call (headset unplugged); the toggle stays as
    // the user left it and the next tap tries again.
  }
}
