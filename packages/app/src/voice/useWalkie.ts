/**
 * Walkie-talkie voice on the user's ChatGPT plan: hold to talk (on-phone
 * speech-to-text), release to send, the computer asks OpenAI (`voice.respond`),
 * the phone shows and speaks the reply. Pressing again stops the speech and
 * drops any answer still on its way.
 *
 * The loop itself is `runWalkieTurn` (pure, tested); this binds it to the
 * recogniser, text-to-speech and the daemon.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { startDictation, type DictationSession } from "../ui/speech";
import { speak, stopSpeaking } from "../ui/tts";
import { voiceInstructions } from "./protocol";
import { runVoiceTool, sessionActedOn, transcriptOf, type VoiceToolContext } from "./tools";
import {
  readRespondEvent,
  runWalkieTurn,
  speakable,
  WALKIE_NOTE,
  walkieTools,
  type InputItem,
  type WalkieError,
} from "./walkie";
import type { CallFocus, CallTranscript } from "./useVoiceCall";

export type WalkiePhase = "ready" | "listening" | "thinking" | "speaking" | "error";

export interface WalkieLine {
  id: string;
  who: "user" | "assistant";
  text: string;
}

export interface WalkieState {
  open: boolean;
  phase: WalkiePhase;
  lines: WalkieLine[];
  /** What the recogniser has heard so far, while holding. */
  hearing: string;
  error?: WalkieError;
  errorDetail?: string;
  manageUrl?: string;
  focus: CallFocus;
}

const CLOSED: WalkieState = { open: false, phase: "ready", lines: [], hearing: "", focus: {} };

export interface WalkieDeps {
  online: boolean;
  voiceRespond: (body: { instructions: string; input: unknown[]; tools?: unknown[] }, onEvent: (event: unknown) => void) => Promise<void>;
  tools: VoiceToolContext;
  describe: (sessionId: string | undefined) => CallFocus;
  saveTranscript?: (sessionId: string, transcript: CallTranscript) => void;
}

export function useWalkie(deps: WalkieDeps) {
  const [state, setState] = useState<WalkieState>(CLOSED);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const history = useRef<InputItem[]>([]);
  const lines = useRef<WalkieLine[]>([]);
  const generation = useRef(0);
  const dictation = useRef<DictationSession | undefined>(undefined);
  const holding = useRef(false);
  const heard = useRef("");
  const callId = useRef("");
  const startedAt = useRef(0);
  const touched = useRef(new Set<string>());
  const focusRef = useRef<CallFocus>({});
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  const setLines = (next: WalkieLine[]) => {
    lines.current = next.slice(-60);
    setState((s) => ({ ...s, lines: lines.current }));
  };

  const fail = useCallback((error: WalkieError, detail?: string, manageUrl?: string) => {
    setState((s) => ({ ...s, phase: "error", error, errorDetail: detail, manageUrl, hearing: "" }));
  }, []);

  const send = useCallback(async (text: string) => {
    const mine = ++generation.current;
    const current = () => generation.current === mine;
    const replyId = `a${mine}`;
    setLines([...lines.current, { id: `u${mine}`, who: "user", text }]);
    setState((s) => ({ ...s, phase: "thinking", hearing: "", error: undefined, errorDetail: undefined, manageUrl: undefined }));
    const instructions = `${voiceInstructions(focusRef.current)} ${WALKIE_NOTE}`;
    const tools = walkieTools();
    const result = await runWalkieTurn(history.current, text, {
      respond: (input, onEvent) =>
        depsRef.current.voiceRespond({ instructions, input, tools }, (raw) => {
          const event = readRespondEvent(raw);
          if (event) onEvent(event);
        }),
      runTool: (name, args) => {
        const ctx = depsRef.current.tools;
        const output = runVoiceTool(name, args, ctx);
        const acted = sessionActedOn(name, args, output, ctx);
        if (acted) touched.current.add(acted);
        return output;
      },
      onText: (reply) => {
        if (!current()) return;
        const others = lines.current.filter((l) => l.id !== replyId);
        setLines([...others, { id: replyId, who: "assistant", text: reply }]);
      },
      isCurrent: current,
    });
    if (result.cancelled || !current()) return;
    history.current = result.history;
    if (result.error) {
      fail(result.error.error, result.error.message, result.error.manageUrl);
      return;
    }
    const others = lines.current.filter((l) => l.id !== replyId);
    setLines([...others, { id: replyId, who: "assistant", text: result.reply }]);
    setState((s) => ({ ...s, phase: "speaking" }));
    speak(speakable(result.reply), () => {
      if (current()) setState((s) => (s.phase === "speaking" ? { ...s, phase: "ready" } : s));
    });
  }, [fail]);

  /** Button down: stop anything playing or pending, start listening. */
  const pressIn = useCallback(() => {
    generation.current += 1;
    stopSpeaking();
    if (!depsRef.current.online) return fail("offline");
    holding.current = true;
    heard.current = "";
    setState((s) => ({ ...s, phase: "listening", hearing: "", error: undefined, errorDetail: undefined, manageUrl: undefined }));
    let ended = false;
    void startDictation({
      onTranscript: (transcript) => {
        heard.current = transcript;
        setState((s) => ({ ...s, hearing: transcript }));
      },
      onError: (code) => {
        if (code === "not-allowed") fail("mic_denied");
        else if (code === "service-not-allowed") fail("failed", "This phone has no speech recognition service.");
      },
      onEnd: () => {
        if (ended) return;
        ended = true;
        dictation.current = undefined;
        if (holding.current) return; // The recogniser gave up early; release decides.
        const text = heard.current.trim();
        if (text) void send(text);
        else setState((s) => (s.phase === "listening" ? { ...s, phase: "error", error: "no_speech", hearing: "" } : s));
      },
    }).then((session) => {
      if (!session) return;
      if (!holding.current) session.stop();
      else dictation.current = session;
    });
  }, [fail, send]);

  /** Button up: ask for the final words; `onEnd` sends them. */
  const pressOut = useCallback(() => {
    holding.current = false;
    if (dictation.current) {
      dictation.current.stop();
      return;
    }
    // The recogniser already ended while held: send what it heard.
    if (phaseRef.current !== "listening") return;
    const text = heard.current.trim();
    if (text) void send(text);
    else setState((s) => ({ ...s, phase: "error", error: "no_speech", hearing: "" }));
  }, [send]);

  const open = useCallback((sessionId?: string) => {
    const focus = depsRef.current.describe(sessionId);
    focusRef.current = focus;
    history.current = [];
    lines.current = [];
    callId.current = Crypto.randomUUID().toLowerCase();
    startedAt.current = Date.now();
    touched.current = new Set(sessionId ? [sessionId] : []);
    setState({ ...CLOSED, open: true, focus });
  }, []);

  const close = useCallback(() => {
    generation.current += 1;
    holding.current = false;
    dictation.current?.cancel();
    dictation.current = undefined;
    stopSpeaking();
    const transcript = callId.current ? transcriptOf(callId.current, startedAt.current, lines.current) : undefined;
    if (transcript) for (const id of touched.current) depsRef.current.saveTranscript?.(id, transcript);
    callId.current = "";
    touched.current = new Set();
    history.current = [];
    lines.current = [];
    setState(CLOSED);
  }, []);

  // A mic or voice left running outlives the screen that started it.
  useEffect(() => () => {
    dictation.current?.cancel();
    stopSpeaking();
  }, []);

  return { state, open, close, pressIn, pressOut };
}
