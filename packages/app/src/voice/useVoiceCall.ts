/**
 * One live voice call at a time: token from the daemon, WebRTC to Realtime,
 * tools run against the app's state, and CallKit kept in step.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import {
  foldEvent,
  readTokenResult,
  refusesSession,
  voiceInstructions,
  type Caption,
  type IncomingCall,
  type VoiceFailure,
  toolOutputEvents,
} from "./protocol";
import { runVoiceTool, sessionActedOn, sessionUpdate, transcriptOf, type VoiceToolContext } from "./tools";
import { audioSessionActivated, startRealtime, voiceAvailable, type RealtimeCall, type RealtimeHandlers } from "./realtime";
import { geminiAvailable, startGemini } from "./gemini";
import { chooseEngine, geminiTokenFailure, tokenEngine, type VoiceEngine } from "./geminiProtocol";
import {
  callKitAvailable,
  endCall,
  setCallMuted,
  setCallSpeaker,
  setupCallKit,
  showIncoming,
  startOutgoing,
} from "./callkit";
import { onCallNotificationTap, ringAndroidOrNotify } from "./androidRing";

export type CallPhase = "idle" | "connecting" | "connected" | "reconnecting" | "error";

/**
 * Android hands a backgrounded app a *silent* microphone: recording "works"
 * and every sample is zero, unless a microphone-type foreground service was
 * started while the app was in front. A call answered from the lock screen
 * or the system call screen starts here with the app still in the background
 * (callkeep's `backToForeground` is asynchronous), so the model heard nothing
 * ("Sounds like nothing came through") until the user happened to open the
 * app. Wait, briefly, for the app to be in front before opening the mic.
 */
const FOREGROUND_WAIT_MS = 6_000;

function whenActive(timeoutMs: number): Promise<boolean> {
  if (AppState.currentState === "active") return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve(AppState.currentState === "active");
    }, timeoutMs);
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      clearTimeout(timer);
      sub.remove();
      resolve(true);
    });
  });
}

export interface CallFocus {
  sessionId?: string;
  title?: string;
  folder?: string;
}

export interface VoiceCallState {
  open: boolean;
  phase: CallPhase;
  error?: VoiceFailure;
  errorDetail?: string;
  captions: Caption[];
  muted: boolean;
  speaker: boolean;
  focus: CallFocus;
}

const IDLE: VoiceCallState = {
  open: false,
  phase: "idle",
  captions: [],
  muted: false,
  speaker: false,
  focus: {},
};

export interface VoiceCallDeps {
  online: boolean;
  requestVoiceToken: (model?: string, voice?: string, engine?: VoiceEngine) => Promise<unknown>;
  /** Engines the computer can mint for (`providers.voiceEngines`); absent = older daemon. */
  voiceEngines?: string[];
  tools: VoiceToolContext;
  /** Resolve a session id into what the call screen names. */
  describe: (sessionId: string | undefined) => CallFocus;
  /** Bring the session on screen behind the call. */
  openSession: (sessionId: string) => void;
  /** File a finished call's transcript in a conversation (`voice.transcript`). */
  saveTranscript?: (sessionId: string, transcript: CallTranscript) => void;
}

/** What a finished call leaves behind in a conversation. */
export interface CallTranscript {
  callId: string;
  startedAt: number;
  endedAt: number;
  lines: { who: "user" | "assistant"; text: string }[];
}

export function useVoiceCall(deps: VoiceCallDeps) {
  const [state, setState] = useState<VoiceCallState>(IDLE);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const rtc = useRef<RealtimeCall | undefined>(undefined);
  const callId = useRef<string | undefined>(undefined);
  const captions = useRef<Caption[]>([]);
  // Bumped per call, so a late answer from a call already hung up is ignored.
  const generation = useRef(0);
  // For filing the transcript: when the call began, and every conversation it
  // was about (the focused one plus any the model acted on).
  const startedAt = useRef(0);
  const touched = useRef(new Set<string>());

  const fail = useCallback((error: VoiceFailure, detail?: string) => {
    setState((s) => ({ ...s, phase: "error", error, errorDetail: detail }));
  }, []);

  const teardown = useCallback((fromCallKit: boolean, why: string) => {
    if (rtc.current || callId.current) console.info(`[pew2-voice] teardown: ${why}`);
    generation.current += 1;
    rtc.current?.hangUp();
    rtc.current = undefined;
    const id = callId.current;
    callId.current = undefined;
    if (id && !fromCallKit) endCall(id);
    // File what was said in each conversation the call was about. A call that
    // was about nothing in particular, or where nothing was said, files nothing.
    const transcript = id ? transcriptOf(id, startedAt.current, captions.current) : undefined;
    if (transcript) {
      for (const sessionId of touched.current) depsRef.current.saveTranscript?.(sessionId, transcript);
    }
    touched.current = new Set();
    captions.current = [];
  }, []);

  const hangUp = useCallback(() => {
    teardown(false, "hang-up button");
    setState(IDLE);
  }, [teardown]);

  const connect = useCallback(
    /**
     * `viaCallKit`: the call was answered through the phone's own call system
     * (CallKit / Android Telecom). Telecom puts its own call screen in front,
     * so the app is *not* active, yet the mic works: callkeep starts a
     * microphone-type foreground service the moment the call rings, which is
     * exactly the exemption Android needs. Waiting for the app to come to the
     * front there left an answered call silent until the user gave up.
     */
    async (focus: CallFocus, viaCallKit = false) => {
      const mine = ++generation.current;
      const current = () => generation.current === mine;
      const d = depsRef.current;
      // Gemini when the computer can mint for it and this build has the audio
      // engine; otherwise OpenAI exactly as before.
      const wanted = chooseEngine(d.voiceEngines) === "gemini" && geminiAvailable() ? "gemini" : "openai";
      if (wanted === "openai" && !voiceAvailable()) return fail("unsupported");
      if (!d.online) return fail("offline");

      const raw = await d.requestVoiceToken(undefined, undefined, wanted === "gemini" ? "gemini" : undefined);
      if (!current()) return;
      if (raw === undefined) return fail("unavailable");
      const token = readTokenResult(raw);
      if (!token.ok) return fail(wanted === "gemini" ? geminiTokenFailure(token.error, token.message) : token.error, token.message);
      const engine = tokenEngine(raw);
      console.info(`[pew2-voice] engine ${engine} (${token.model || "default model"})`);
      const start =
        engine === "gemini"
          ? (secret: string, handlers: RealtimeHandlers, onOpen: (call: RealtimeCall) => void) =>
              startGemini(secret, token.model, handlers, onOpen, async () => {
                if (!current()) return undefined;
                const next = readTokenResult(await depsRef.current.requestVoiceToken(token.model, undefined, "gemini"));
                return next.ok ? next.clientSecret : undefined;
              })
          : startRealtime;

      if (Platform.OS === "android" && !viaCallKit && !(await whenActive(FOREGROUND_WAIT_MS))) {
        if (!current()) return;
        // Still in the background: the mic would record silence. Say so on
        // the call screen instead of letting the model talk to nobody.
        setState((s) => ({ ...s, errorDetail: "Open pew2 so it can hear you." }));
        if (!(await whenActive(60_000))) {
          if (current()) fail("failed", "pew2 could not use the microphone because the app stayed in the background.");
          return;
        }
        if (current()) setState((s) => ({ ...s, errorDetail: undefined }));
      }
      if (!current()) return;

      let answeredOnce = false;
      const call = await start(
        token.clientSecret,
        {
          onState: (phase) => {
            if (!current()) return;
            if (phase === "connected") setState((s) => (s.phase === "error" ? s : { ...s, phase: "connected" }));
            if (phase === "reconnecting") setState((s) => (s.phase === "error" ? s : { ...s, phase: "reconnecting" }));
            if (phase === "ended") setState((s) => (s.phase === "error" ? s : { ...s, phase: "idle" }));
          },
          onError: (error, detail) => {
            if (current()) fail(error, detail);
          },
          onEvent: (event) => {
            if (!current()) return;
            if (!answeredOnce && (event as { type?: unknown })?.type === "response.done") {
              answeredOnce = true;
              if (refusesSession(event)) {
                // OpenAI opened the session and then would not answer at all:
                // say so now, rather than wait out the dropped connection.
                console.info("[pew2-voice] first reply failed: OpenAI refused the session");
                fail("refused");
                // Close the link to OpenAI; the call screen stays up with the
                // reason until the user hangs up.
                rtc.current?.hangUp();
                rtc.current = undefined;
                return;
              }
            }
            const folded = foldEvent(captions.current, event);
            if (folded.captions !== captions.current) {
              captions.current = folded.captions;
              setState((s) => ({ ...s, captions: folded.captions }));
            }
            if (folded.error) setState((s) => ({ ...s, errorDetail: folded.error }));
            if (folded.call) {
              const result = runVoiceTool(folded.call.name, folded.call.arguments, depsRef.current.tools);
              const acted = sessionActedOn(folded.call.name, folded.call.arguments, result, depsRef.current.tools);
              if (acted) touched.current.add(acted);
              for (const out of toolOutputEvents(folded.call.callId, result)) rtc.current?.send(out);
            }
          },
        },
        (open) => {
          if (!current()) return;
          open.send(sessionUpdate(voiceInstructions(focus)));
          // Speak first, like answering a phone.
          open.send({
            type: "response.create",
            response: {
              instructions: focus.sessionId
                ? "Greet the user in a few words and give a one-sentence status of the focused session (use get_session_status). If it has an open question or a permission request, read that out and ask for their answer."
                : "Greet the user in a few words and ask what they need.",
            },
          });
        },
      );
      if (!current()) {
        call?.hangUp();
        return;
      }
      rtc.current = call;
    },
    [fail],
  );

  /** Show the call screen and connect; CallKit owns audio where it exists. */
  const begin = useCallback(
    (call: IncomingCall, viaCallKit: boolean) => {
      teardown(false, "a new call replaced it");
      const focus = depsRef.current.describe(call.sessionId);
      if (call.sessionId) depsRef.current.openSession(call.sessionId);
      captions.current = [];
      callId.current = call.callId;
      startedAt.current = Date.now();
      touched.current = new Set(call.sessionId ? [call.sessionId] : []);
      setState({ ...IDLE, open: true, phase: "connecting", focus });
      if (!viaCallKit) startOutgoing(call);
      void connect(focus, viaCallKit);
    },
    [connect, teardown],
  );

  /** The Talk button. */
  const startCall = useCallback(
    (sessionId?: string) => {
      const call: IncomingCall = {
        callId: Crypto.randomUUID().toLowerCase(),
        reason: "manual",
        sessionId,
        at: Date.now(),
      };
      const focus = depsRef.current.describe(sessionId);
      begin({ ...call, folder: focus.folder, summary: focus.title }, false);
    },
    [begin],
  );

  /** The daemon rang (`voice.incoming` on the socket). */
  const ring = useCallback(
    (call: IncomingCall) => {
      if (callId.current) return; // Already on a call.
      if (Platform.OS === "android") {
        // System call screen through Telecom, or a loud notification.
        void ringAndroidOrNotify(call);
        return;
      }
      // iOS: CallKit. Expo Go has none; the push banner is the prompt and Talk
      // is one tap away.
      showIncoming(call);
    },
    [],
  );

  useEffect(() => {
    if (!callKitAvailable()) return;
    setupCallKit({
      onAnswer: (call) => {
        if (callId.current === call.callId) return; // Our own outgoing call.
        begin(call, true);
      },
      onEnd: (id) => {
        if (callId.current !== id) return;
        teardown(true, "ended from the system call screen");
        setState(IDLE);
      },
      onAudioSession: audioSessionActivated,
      onMute: (id, muted) => {
        if (callId.current !== id) return;
        rtc.current?.setMuted(muted);
        setState((s) => ({ ...s, muted }));
      },
    });
  }, [begin, teardown]);

  // Android fallback: the "pew2 is calling" notification was tapped.
  useEffect(() => onCallNotificationTap((call) => {
    if (!callId.current) begin(call, false);
  }), [begin]);

  const setMuted = useCallback((muted: boolean) => {
    rtc.current?.setMuted(muted);
    if (callId.current) setCallMuted(callId.current, muted);
    setState((s) => ({ ...s, muted }));
  }, []);

  const setSpeaker = useCallback((speaker: boolean) => {
    if (callId.current) void setCallSpeaker(callId.current, speaker);
    setState((s) => ({ ...s, speaker }));
  }, []);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, phase: "connecting", error: undefined, errorDetail: undefined }));
    void connect(state.focus);
  }, [connect, state.focus]);

  return { state, startCall, ring, hangUp, setMuted, setSpeaker, retry, available: voiceAvailable() || geminiAvailable() };
}
