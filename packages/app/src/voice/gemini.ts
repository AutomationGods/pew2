/**
 * A live call to Google's Gemini Live API.
 *
 * WebSocket with raw PCM: 16 kHz mono PCM16 up, 24 kHz down. Audio runs through
 * `@speechmatics/expo-two-way-audio`, which records from Android's
 * VOICE_COMMUNICATION source with the platform echo canceller on (iOS: the
 * voice-processing I/O unit) and plays on the same voice-communication stream,
 * so the model does not hear itself on speakerphone.
 *
 * The call loop speaks OpenAI Realtime events; `geminiProtocol.ts` translates
 * at this edge, so this returns the same `RealtimeCall` as `realtime.ts` and
 * tools, captions and transcripts run through exactly the same code.
 *
 * The native module is absent from builds made before it was added, so it is
 * probed with `requireOptionalNativeModule` and required lazily, and
 * `geminiAvailable()` answers false instead of the app crashing.
 */
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import type * as TwoWayAudio from "@speechmatics/expo-two-way-audio";
import { RECONNECT_GRACE_MS } from "./protocol";
import {
  base64ToBytes,
  bytesToBase64,
  foldGemini,
  GEMINI_INPUT_RATE,
  GEMINI_OUTPUT_RATE,
  GEMINI_START,
  geminiFailure,
  geminiSetup,
  geminiUrl,
  PcmPacer,
  resamplePcm16,
  translateClientEvent,
  utf8Decode,
} from "./geminiProtocol";
import type { RealtimeCall, RealtimeHandlers } from "./realtime";

function trace(message: string): void {
  console.info(`[pew2-voice] gemini ${message}`);
}

/** The engine plays at 16 kHz mono PCM16. */
const PLAYBACK_RATE = 16_000;
const PLAYBACK_BYTES_PER_MS = (PLAYBACK_RATE * 2) / 1000;
/** ~100 ms of mic audio per frame: fewer frames than the engine's 32 ms reads. */
const MIC_FRAME_BYTES = (GEMINI_INPUT_RATE * 2) / 10;
const PLAYBACK_TICK_MS = 40;

let cached: typeof TwoWayAudio | null | undefined;

function audio(): typeof TwoWayAudio | null {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoTwoWayAudio")) {
      cached = null;
      return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("@speechmatics/expo-two-way-audio") as typeof TwoWayAudio;
  } catch {
    cached = null;
  }
  return cached;
}

export function geminiAvailable(): boolean {
  return audio() !== null;
}

/** Open the call. Resolves undefined after reporting a failure. */
export async function startGemini(
  token: string,
  model: string,
  handlers: RealtimeHandlers,
  onOpen: (call: RealtimeCall) => void,
  /** A fresh token for resuming after a drop; undefined when none can be had. */
  renewToken: () => Promise<string | undefined>,
): Promise<RealtimeCall | undefined> {
  const engine = audio();
  if (!engine) {
    handlers.onError("unsupported");
    return undefined;
  }
  handlers.onState("connecting");

  try {
    const permission = await engine.requestMicrophonePermissionsAsync();
    if (!permission.granted) {
      handlers.onError("mic_denied");
      return undefined;
    }
    if (!(await engine.initialize())) throw new Error("the audio engine did not start");
  } catch (error) {
    handlers.onError("failed", error instanceof Error ? error.message : "the audio engine did not start");
    return undefined;
  }

  let ended = false;
  let muted = false;
  let ws: WebSocket | undefined;
  let ready = false;
  let everReady = false;
  let opened = false;
  let resumeHandle: string | undefined;
  let fold = GEMINI_START;
  let setupFrame: { instructions: string; tools: unknown[] } | undefined;
  let pending: unknown[] = [];
  let micBuffer: Uint8Array[] = [];
  let micBytes = 0;
  let reconnecting: Promise<void> | undefined;
  const names = new Map<string, string>();
  const pacer = new PcmPacer(PLAYBACK_BYTES_PER_MS);

  const sendRaw = (message: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const sendSetup = () => {
    if (setupFrame) sendRaw(geminiSetup(model, setupFrame.instructions, setupFrame.tools, resumeHandle));
  };

  const ticker = setInterval(() => {
    for (const chunk of pacer.take(Date.now())) engine.playPCMData(chunk);
  }, PLAYBACK_TICK_MS);

  const micSub = engine.addExpoTwoWayAudioEventListener("onMicrophoneData", (event) => {
    if (ended || !ready || muted) return;
    micBuffer.push(event.data);
    micBytes += event.data.length;
    if (micBytes < MIC_FRAME_BYTES) return;
    const frame = new Uint8Array(micBytes);
    let offset = 0;
    for (const part of micBuffer) {
      frame.set(part, offset);
      offset += part.length;
    }
    micBuffer = [];
    micBytes = 0;
    sendRaw({ realtimeInput: { audio: { data: bytesToBase64(frame), mimeType: `audio/pcm;rate=${GEMINI_INPUT_RATE}` } } });
  });
  const interruptionSub = engine.addExpoTwoWayAudioEventListener("onAudioInterruption", (event) => {
    trace(`audio interruption: ${event.data}`);
  });

  const end = (reason: string) => {
    if (ended) return;
    ended = true;
    trace(`call ended: ${reason}`);
    clearInterval(ticker);
    pacer.flush();
    micSub.remove();
    interruptionSub.remove();
    try {
      engine.toggleRecording(false);
      engine.tearDown();
    } catch {
      // Already down.
    }
    try {
      ws?.close(1000);
    } catch {
      // Already closed.
    }
    ws = undefined;
    handlers.onState("ended");
  };

  const call: RealtimeCall = {
    send: (event) => {
      const translated = translateClientEvent(event, names);
      if (translated.setup) {
        setupFrame = translated.setup;
        if (!ready) sendSetup();
      }
      for (const message of translated.messages) {
        if (ready) sendRaw(message);
        else pending.push(message);
      }
    },
    setMuted: (next) => {
      muted = next;
      if (next) sendRaw({ realtimeInput: { audioStreamEnd: true } });
    },
    hangUp: () => end("hung up on the phone"),
  };

  const onMessage = (raw: unknown) => {
    let text: string;
    if (typeof raw === "string") text = raw;
    else if (raw instanceof ArrayBuffer) text = utf8Decode(new Uint8Array(raw));
    else return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const folded = foldGemini(fold, parsed);
    fold = folded.state;
    if (folded.diagnostic) trace(folded.diagnostic);
    for (const c of folded.calls) names.set(c.id, c.name);
    if (folded.resumeHandle) resumeHandle = folded.resumeHandle;
    if (folded.interrupted) pacer.flush();
    for (const chunk of folded.audio) pacer.push(resamplePcm16(base64ToBytes(chunk), GEMINI_OUTPUT_RATE, PLAYBACK_RATE));
    if (folded.setupComplete) {
      ready = true;
      const firstTime = !everReady;
      everReady = true;
      const queued = pending;
      pending = [];
      for (const message of queued) sendRaw(message);
      handlers.onState("connected");
      if (firstTime) {
        try {
          engine.toggleRecording(true);
        } catch (error) {
          handlers.onError("mic_denied", error instanceof Error ? error.message : undefined);
          end("microphone did not start");
          return;
        }
      }
    }
    for (const event of folded.events) handlers.onEvent(event);
    if (folded.goingAway && resumeHandle) void reconnect("server goAway");
  };

  const open = (secret: string) => {
    const socket = new WebSocket(geminiUrl(secret));
    socket.binaryType = "arraybuffer";
    ws = socket;
    ready = false;
    socket.onopen = () => {
      if (ws !== socket || ended) return;
      trace(everReady ? "socket reopened" : "socket open");
      if (!opened) {
        opened = true;
        onOpen(call); // Sends session.update, which sends the setup frame.
      } else {
        sendSetup();
      }
    };
    socket.onmessage = (event) => {
      if (ws === socket && !ended) onMessage(event.data);
    };
    socket.onerror = () => {
      if (ws === socket) trace("socket error");
    };
    socket.onclose = (event) => {
      if (ws !== socket || ended) return;
      ws = undefined;
      ready = false;
      const failure = geminiFailure(event.code, event.reason ?? "");
      trace(`socket closed ${event.code}${event.reason ? `: ${event.reason.slice(0, 160)}` : ""}`);
      if (!everReady || !failure.retryable) {
        handlers.onError(failure.error, failure.detail);
        end(`closed ${event.code}`);
        return;
      }
      void reconnect(`closed ${event.code}`);
    };
  };

  /** Resume on a fresh token within the grace period, or give up. */
  const reconnect = (why: string): Promise<void> => {
    reconnecting ??= (async () => {
      trace(`reconnecting: ${why}`);
      handlers.onState("reconnecting");
      const old = ws;
      ws = undefined;
      ready = false;
      try {
        old?.close(1000);
      } catch {
        // Already closed.
      }
      const deadline = Date.now() + RECONNECT_GRACE_MS;
      while (!ended && Date.now() < deadline) {
        const next = await renewToken().catch(() => undefined);
        if (ended) return;
        if (next) {
          open(next);
          const socket = ws as WebSocket | undefined;
          // Wait for this attempt to come up (setupComplete) or close.
          const up = await new Promise<boolean>((resolve) => {
            const check = setInterval(() => {
              if (ended || ready) {
                clearInterval(check);
                resolve(ready);
              } else if (ws !== socket || socket?.readyState === WebSocket.CLOSED) {
                clearInterval(check);
                resolve(false);
              }
            }, 200);
          });
          if (up) return;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }
      if (!ended) {
        handlers.onError("failed", "the connection to Gemini dropped and did not come back.");
        end("no connection after the grace period");
      }
    })().finally(() => {
      reconnecting = undefined;
    });
    return reconnecting;
  };

  open(token);
  return call;
}
