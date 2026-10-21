/**
 * A WebRTC call to OpenAI Realtime.
 *
 * `react-native-webrtc` is a native module, absent in Expo Go and in builds
 * made before voice existed, so it is probed with `requireOptionalNativeModule`
 * and required lazily — exactly as `ui/speech.ts` does — and `voiceAvailable()`
 * answers false instead of the app crashing.
 */
import { NativeModules, Platform } from "react-native";
import type * as WebRTC from "react-native-webrtc";
import { diagnosticLine, judgeConnection, RECONNECT_GRACE_MS } from "./protocol";

/** Device-log line for a call ("[pew2-voice] ..."), readable with `adb logcat -s ReactNativeJS`. */
function trace(message: string): void {
  console.info(`[pew2-voice] ${message}`);
}

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

let cached: typeof WebRTC | null | undefined;

function webrtc(): typeof WebRTC | null {
  if (cached !== undefined) return cached;
  // A bridge module (not an Expo module), so it is looked up on NativeModules;
  // under the new architecture's interop layer it is still listed there.
  // Read inside a try: under the new architecture a module that fails to
  // build throws from this property read, and voice is an extra that must
  // hide itself rather than take the app down (see callkit.ts).
  let present: boolean;
  try {
    present = Platform.OS !== "web" && !!(NativeModules as Record<string, unknown>).WebRTCModule;
  } catch {
    present = false;
  }
  if (!present) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("react-native-webrtc") as typeof WebRTC;
  } catch {
    cached = null;
  }
  return cached;
}

export function voiceAvailable(): boolean {
  return webrtc() !== null;
}

/**
 * Tell WebRTC that CallKit activated or deactivated the audio session. With
 * CallKit in charge of audio, WebRTC must not start its audio unit until the
 * system says the session is live, or the mic records silence.
 */
export function audioSessionActivated(active: boolean): void {
  const rtc = webrtc();
  if (!rtc) return;
  if (active) rtc.RTCAudioSession.audioSessionDidActivate();
  else rtc.RTCAudioSession.audioSessionDidDeactivate();
}

export interface RealtimeHandlers {
  onState: (state: "connecting" | "connected" | "reconnecting" | "ended") => void;
  onEvent: (event: unknown) => void;
  onError: (error: "mic_denied" | "unsupported" | "failed" | "gemini_key" | "gemini_quota", detail?: string) => void;
}

export interface RealtimeCall {
  send: (event: unknown) => void;
  setMuted: (muted: boolean) => void;
  hangUp: () => void;
}

/** Open the call. Resolves undefined after reporting a failure. */
export async function startRealtime(
  clientSecret: string,
  handlers: RealtimeHandlers,
  onOpen: (call: RealtimeCall) => void,
): Promise<RealtimeCall | undefined> {
  const rtc = webrtc();
  if (!rtc) {
    handlers.onError("unsupported");
    return undefined;
  }
  handlers.onState("connecting");

  let stream: WebRTC.MediaStream;
  try {
    stream = await rtc.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (error) {
    handlers.onError("mic_denied", error instanceof Error ? error.message : undefined);
    return undefined;
  }

  const pc = new rtc.RTCPeerConnection({});
  let ended = false;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  const end = (reason: string) => {
    if (ended) return;
    ended = true;
    trace(`call ended: ${reason}`);
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = undefined;
    try {
      channel.close();
    } catch {
      // Already closed.
    }
    for (const track of stream.getTracks()) track.stop();
    try {
      pc.close();
    } catch {
      // Already closed.
    }
    handlers.onState("ended");
  };

  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  // Remote audio plays through the native audio session on its own; there is
  // no <audio> element to attach it to on React Native.
  const channel = pc.createDataChannel("oai-events");

  const call: RealtimeCall = {
    send: (event) => {
      if (channel.readyState === "open") channel.send(JSON.stringify(event));
    },
    setMuted: (muted) => {
      for (const track of stream.getAudioTracks()) track.enabled = !muted;
    },
    hangUp: () => end("hung up on the phone"),
  };

  // The typings inherit `addEventListener` from event-target-shim, which does
  // not resolve here; the runtime has it.
  type Listenable = { addEventListener: (type: string, listener: (event: never) => void) => void };
  const channelEvents = channel as unknown as Listenable;
  const pcEvents = pc as unknown as Listenable;
  channelEvents.addEventListener("open", () => {
    trace("event channel open");
    onOpen(call);
  });
  channelEvents.addEventListener("close", () => trace("event channel closed"));
  channelEvents.addEventListener("error", () => trace("event channel error"));
  channelEvents.addEventListener("message", (message: { data: unknown }) => {
    if (typeof message.data !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.data);
    } catch {
      return; // Not JSON; nothing to fold.
    }
    const line = diagnosticLine(parsed);
    if (line) trace(line);
    handlers.onEvent(parsed);
  });
  pcEvents.addEventListener("iceconnectionstatechange", () => trace(`ice ${String(pc.iceConnectionState)}`));
  pcEvents.addEventListener("connectionstatechange", () => {
    if (ended) return;
    const verdict = judgeConnection(pc.connectionState);
    trace(`connection ${String(pc.connectionState)}`);
    if (verdict === "connected") {
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = undefined;
      handlers.onState("connected");
    } else if (verdict === "reconnecting") {
      handlers.onState("reconnecting");
      graceTimer ??= setTimeout(() => {
        graceTimer = undefined;
        if (ended || judgeConnection(pc.connectionState) === "connected") return;
        handlers.onError("failed", "the connection dropped and did not come back");
        end("no connection after the grace period");
      }, RECONNECT_GRACE_MS);
    } else if (verdict === "lost") {
      handlers.onError("failed", "the connection dropped");
      end("connection failed");
    } else if (verdict === "ended") {
      end("connection closed");
    }
  });

  try {
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    const response = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI answered ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
    }
    const sdp = await response.text();
    await pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: "answer", sdp }));
  } catch (error) {
    handlers.onError("failed", error instanceof Error ? error.message : undefined);
    end(`setup failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  return call;
}
