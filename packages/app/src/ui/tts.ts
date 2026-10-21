/**
 * Reading walkie-talkie replies aloud with the phone's own text-to-speech
 * (`expo-speech`). Required lazily behind a native-module probe, as
 * `speech.ts` does for recognition: a build without the module answers
 * "unavailable" and the walkie screen shows captions only.
 */
import { requireOptionalNativeModule } from "expo-modules-core";

type SpeechModule = typeof import("expo-speech");

function ttsModule(): SpeechModule | null {
  if (!requireOptionalNativeModule("ExpoSpeech")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-speech") as SpeechModule;
  } catch {
    return null;
  }
}

export function ttsAvailable(): boolean {
  return ttsModule() !== null;
}

/** Speak `text`; `onDone` fires once when it finishes, is stopped, or fails. */
export function speak(text: string, onDone: () => void): void {
  const module = ttsModule();
  if (!module || !text) {
    onDone();
    return;
  }
  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    onDone();
  };
  try {
    module.speak(text, { onDone: done, onStopped: done, onError: done });
  } catch {
    done();
  }
}

export function stopSpeaking(): void {
  try {
    void ttsModule()?.stop();
  } catch {
    // Nothing was speaking.
  }
}
