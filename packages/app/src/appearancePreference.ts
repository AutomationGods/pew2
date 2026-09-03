export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export const ACCENT_NAMES = ["coral", "ocean", "violet", "mint"] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number];
export type AccentName = (typeof ACCENT_NAMES)[number];

export interface AppearancePreference {
  mode: AppearanceMode;
  accent: AccentName;
}

export const DEFAULT_APPEARANCE: AppearancePreference = {
  mode: "system",
  accent: "coral",
};

const MAX_PAYLOAD = 1_024;

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

/** Parse a small stored preference. Invalid fields fall back independently. */
export function parseAppearancePreference(stored: string | null): AppearancePreference {
  if (!stored || stored.length > MAX_PAYLOAD) return DEFAULT_APPEARANCE;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_APPEARANCE;
    const value = parsed as Record<string, unknown>;
    return {
      mode: includes(APPEARANCE_MODES, value.mode) ? value.mode : DEFAULT_APPEARANCE.mode,
      accent: includes(ACCENT_NAMES, value.accent) ? value.accent : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function serializeAppearancePreference(preference: AppearancePreference): string {
  return JSON.stringify({
    mode: includes(APPEARANCE_MODES, preference.mode) ? preference.mode : DEFAULT_APPEARANCE.mode,
    accent: includes(ACCENT_NAMES, preference.accent)
      ? preference.accent
      : DEFAULT_APPEARANCE.accent,
  });
}
