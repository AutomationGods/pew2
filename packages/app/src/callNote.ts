/**
 * How a filed voice call names itself. Expo-free, so `bun test` covers it.
 */
import type { CallNote } from "./chunks";

/** Whole minutes, never "0 min": a call worth filing had at least one line. */
export function callDuration(call: Pick<CallNote, "startedAt" | "endedAt">): string {
  const minutes = Math.max(1, Math.round((call.endedAt - call.startedAt) / 60_000));
  return `${minutes} min`;
}

/** "Voice call · 2:14 PM · 3 min", in the phone's own clock format. */
export function callHeading(call: Pick<CallNote, "startedAt" | "endedAt">, locale?: string): string {
  const parts = ["Voice call"];
  if (call.startedAt > 0) {
    try {
      parts.push(new Date(call.startedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }));
    } catch {
      // No Intl on this engine: the duration still says enough.
    }
  }
  parts.push(callDuration(call));
  return parts.join(" · ");
}
