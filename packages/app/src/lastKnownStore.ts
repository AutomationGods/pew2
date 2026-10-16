/**
 * The file behind `lastKnown.ts`. A file rather than the keychain: a goal
 * list and a few hundred history rows are far past what SecureStore is for,
 * and none of it is a secret. Every call is best effort and never throws.
 */
import { File, Paths } from "expo-file-system";
import { EMPTY_LAST_KNOWN, fromLastKnown, toLastKnown, type LastKnown } from "./lastKnown";

const FILE = "last-known.json";

function lastKnownFile(): File {
  return new File(Paths.document, FILE);
}

export async function loadLastKnown(): Promise<LastKnown> {
  try {
    const file = lastKnownFile();
    if (!file.exists) return EMPTY_LAST_KNOWN;
    return fromLastKnown(await file.text());
  } catch {
    return EMPTY_LAST_KNOWN;
  }
}

export function saveLastKnown(value: LastKnown): void {
  try {
    const payload = toLastKnown(value);
    if (!payload) return;
    const file = lastKnownFile();
    file.create({ overwrite: true });
    file.write(payload);
  } catch {
    // A cache that fails to write costs one slow cold start, nothing more.
  }
}

/** Forget it on unpair: it describes one machine. */
export async function clearLastKnown(): Promise<void> {
  try {
    const file = lastKnownFile();
    if (file.exists) file.delete();
  } catch {
    // The next machine's answers overwrite it anyway.
  }
}
