import { Easing } from "react-native";
import type { AccentName } from "./appearancePreference";
import { materialTokens, type MaterialMode } from "./materialTokens";

export type ResolvedAppearanceMode = MaterialMode;

const modeColors = {
  light: {
    bg: "#f4f5f7",
    drawer: "#fcfcfd",
    surface: "#ffffff",
    surfaceRaised: "#eceef2",
    surfacePressed: "#e2e5ea",
    border: "#d4d8df",
    borderStrong: "#9aa2af",
    text: "#17191d",
    textDim: "#525866",
    textFaint: "#687080",
    glyph: "#343a46",
    placeholder: "#6b7280",
    success: "#147a45",
    successSoft: "#d7f0e6",
    danger: "#b42318",
    dangerSoft: "#f7dedb",
    thought: "#6941c6",
    orb: "#1677c8",
    scrim: "rgba(15,23,42,0.34)",
    code: "#eef0f3",
  },
  dark: {
    bg: "#0e1014",
    drawer: "#171a20",
    surface: "#1c2027",
    surfaceRaised: "#252a33",
    surfacePressed: "#303641",
    border: "#343b47",
    borderStrong: "#606b7a",
    text: "#f3f5f7",
    textDim: "#b1b7c2",
    textFaint: "#949caa",
    glyph: "#e4e7ec",
    placeholder: "#9299a5",
    success: "#55d187",
    successSoft: "#153b31",
    danger: "#ff766e",
    dangerSoft: "#442321",
    thought: "#b9a3ff",
    orb: "#58abf6",
    scrim: "rgba(0,0,0,0.62)",
    code: "#15181d",
  },
} as const;

const accents = {
  coral: {
    light: { accent: "#9c3d24", accentSoft: "#f6ded6", accentSolid: "#a94325", accentText: "#ffffff" },
    dark: { accent: "#ffaa8a", accentSoft: "#3b241c", accentSolid: "#e87854", accentText: "#17110f" },
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
  radius: { sm: 8, md: 12, lg: 18, composer: 32, pane: 34, pill: 999 },
  size: {
    control: 44,
    chip: 40,
    composerCollapsed: 64,
    composerButton: 40,
    composerInset: 12,
    orb: 44,
    touch: 44,
  },
  font: { tiny: 11, small: 13, body: 15, title: 17, greeting: 20 },
  display: {
    regular: "BitcountPropSingle_400Regular",
    semibold: "BitcountPropSingle_600SemiBold",
    bold: "BitcountPropSingle_700Bold",
  },
  line: { body: 22, greeting: 28 },
  motion: { fast: 120, base: 200 },
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
