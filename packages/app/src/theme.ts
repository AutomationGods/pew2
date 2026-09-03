import { Easing, Platform } from "react-native";
import type { AccentName } from "./appearancePreference";
import { materialTokens, type MaterialMode } from "./materialTokens";

export type ResolvedAppearanceMode = MaterialMode;

const modeColors = {
  light: {
    bg: "#f7f8fa",
    drawer: "#ffffff",
    surface: "#ffffff",
    surfaceRaised: "#f1f3f5",
    surfacePressed: "#e6e9ee",
    border: "#d9dee7",
    borderStrong: "#87909f",
    text: "#111827",
    textDim: "#4b5563",
    textFaint: "#667085",
    glyph: "#374151",
    placeholder: "#6b7280",
    success: "#147a45",
    successSoft: "#e8ecef",
    danger: "#b42318",
    dangerSoft: "#f1e9e8",
    thought: "#5b48a5",
    orb: "#2563eb",
    scrim: "rgba(15,23,42,0.38)",
    code: "#eef1f5",
  },
  dark: {
    bg: "#101216",
    drawer: "#15181e",
    surface: "#1a1e25",
    surfaceRaised: "#222832",
    surfacePressed: "#2b323e",
    border: "#303846",
    borderStrong: "#697586",
    text: "#f7f8fa",
    textDim: "#c3c9d2",
    textFaint: "#98a2b3",
    glyph: "#e4e7ec",
    placeholder: "#98a2b3",
    success: "#58cf88",
    successSoft: "#262d31",
    danger: "#ff837b",
    dangerSoft: "#332829",
    thought: "#b7a8f6",
    orb: "#60a5fa",
    scrim: "rgba(0,0,0,0.66)",
    code: "#15181d",
  },
} as const;

const accents = {
  coral: {
    light: { accent: "#1d4ed8", accentSoft: "#e9edf4", accentSolid: "#1d4ed8", accentText: "#ffffff" },
    dark: { accent: "#8ab4ff", accentSoft: "#272d36", accentSolid: "#4f86e8", accentText: "#07152d" },
  },
  ocean: {
    light: { accent: "#075985", accentSoft: "#d7edf8", accentSolid: "#036a9b", accentText: "#ffffff" },
    dark: { accent: "#7dd3fc", accentSoft: "#163447", accentSolid: "#38bdf8", accentText: "#082f49" },
  },
  violet: {
    light: { accent: "#5b21b6", accentSoft: "#e9e0fa", accentSolid: "#6d28d9", accentText: "#ffffff" },
    dark: { accent: "#c4b5fd", accentSoft: "#2d2450", accentSolid: "#a78bfa", accentText: "#201238" },
  },
  mint: {
    light: { accent: "#047857", accentSoft: "#d7f0e6", accentSolid: "#087a5b", accentText: "#ffffff" },
    dark: { accent: "#6ee7b7", accentSoft: "#153b31", accentSolid: "#34d399", accentText: "#072c22" },
  },
} as const satisfies Record<AccentName, Record<ResolvedAppearanceMode, object>>;

const metrics = {
  /** 4pt base grid. */
  space: (n: number) => n * 4,
  gutter: 20,
  sectionGap: 16,
  headerInset: 8,
  radius: { sm: 6, md: 10, lg: 14, composer: 20, pane: 20, pill: 999 },
  size: {
    control: 44,
    chip: 40,
    composerCollapsed: 60,
    composerButton: 40,
    composerInset: 10,
    orb: 40,
    touch: 44,
  },
  font: { tiny: 11, small: 13, body: 15, title: 18, greeting: 22 },
  display: {
    regular: "sans-serif",
    semibold: Platform.select({ android: "sans-serif-medium", default: "sans-serif" }),
    bold: Platform.select({ android: "sans-serif-medium", default: "sans-serif" }),
  },
  line: { body: 22, greeting: 28 },
  motion: { fast: 120, base: 180 },
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

export function createTheme(mode: ResolvedAppearanceMode, accent: AccentName) {
  const material = materialTokens(mode);
  return {
    ...metrics,
    mode,
    accentName: accent,
    color: { ...modeColors[mode], ...accents[accent][mode] },
    glass: material.glass,
    approval: material.approval,
  };
}

export type AppTheme = ReturnType<typeof createTheme>;

/** Dark coral remains the static compatibility default until every consumer migrates. */
export const theme = createTheme("dark", "coral");

/**
 * Lighten (ratio > 0) or darken (ratio < 0) a hex colour.
 * Used to build the orb's gloss from a single provider colour, so adding a
 * provider never requires hand-picking a gradient.
 */
export function shade(hex: string, ratio: number): string {
  const value = hex.replace("#", "");
  const normalised =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const num = Number.parseInt(normalised, 16);
  if (Number.isNaN(num)) return hex;

  const channel = (shift: number) => {
    const base = (num >> shift) & 0xff;
    const next = ratio >= 0 ? base + (255 - base) * ratio : base * (1 + ratio);
    return Math.round(Math.min(255, Math.max(0, next)));
  };

  return `#${[channel(16), channel(8), channel(0)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
