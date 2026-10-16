const MAX_PROVIDERS = 50;
const MAX_PROVIDER_ID = 128;
const MAX_PATH = 4096;
const MAX_PAYLOAD = 64 * 1024;

export type ProjectPreferences = Record<string, string>;

function validEntry(entry: unknown): entry is [string, string] {
  if (!Array.isArray(entry) || entry.length !== 2) return false;
  const [providerId, path] = entry;
  return (
    typeof providerId === "string" &&
    /^[a-z0-9][a-z0-9._-]*$/i.test(providerId) &&
    providerId.length <= MAX_PROVIDER_ID &&
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= MAX_PATH &&
    !/[\u0000-\u001f\u007f]/u.test(path)
  );
}

/** Parse one bounded per-provider project map. Junk is a preference miss. */
export function parseProjectPreferences(stored: string | null): ProjectPreferences {
  if (!stored || stored.length > MAX_PAYLOAD) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed);
    if (entries.length > MAX_PROVIDERS || !entries.every(validEntry)) return {};
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Serialize only valid entries and cap oldest object entries first. */
export function serializeProjectPreferences(preferences: ProjectPreferences): string {
  const entries = Object.entries(preferences).filter(validEntry).slice(-MAX_PROVIDERS);
  let serialized = JSON.stringify(Object.fromEntries(entries));
  while (serialized.length > MAX_PAYLOAD && entries.length > 0) {
    entries.shift();
    serialized = JSON.stringify(Object.fromEntries(entries));
  }
  return serialized;
}
