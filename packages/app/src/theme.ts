import { Easing, Platform } from "react-native";
import type { AccentName } from "./appearancePreference";
import { materialTokens, type MaterialMode } from "./materialTokens";

export type ResolvedAppearanceMode = MaterialMode;

const modeColors = {
  light: {
    bg: "#faf9f5", canvas: "#faf9f5", drawer: "#f3f1e8", surface: "#ffffff",
    groupedSurface: "#f3f1e8", surfaceRaised: "#ffffff", surfacePressed: "#ece9df",
    selectedRow: "#fff3e7", controlFill: "#f5f3eb", separator: "#dedbd1",
    border: "#dedbd1", borderStrong: "#6d685e", text: "#24231f", textDim: "#5d594f",
    textFaint: "#747065", glyph: "#38362f", placeholder: "#747065", success: "#2f7d52",
    successSoft: "#e8e9df", warning: "#825a14", danger: "#a23b31", dangerSoft: "#efe5df",
    thought: "#66517f", orb: "#c76545", scrim: "rgba(37,35,31,0.38)", code: "#f2efe7",
  },
  dark: {
    bg: "#181813", canvas: "#181813", drawer: "#22211b", surface: "#292821",
    groupedSurface: "#292821", surfaceRaised: "#302f27", surfacePressed: "#3c3a31",
    selectedRow: "#40362f", controlFill: "#35332a", separator: "#4a473b",
    border: "#4a473b", borderStrong: "#aaa28e", text: "#f7f4e9", textDim: "#d0c9b9",
    textFaint: "#aaa292", glyph: "#ebe5d7", placeholder: "#aaa292", success: "#79bd8c",
    successSoft: "#2d332a", warning: "#e2b460", danger: "#f09286", dangerSoft: "#3b2c28",
    thought: "#c3add8", orb: "#df7d5d", scrim: "rgba(0,0,0,0.66)", code: "#22211b",
  },
} as const;

// Stored keys are stable; only their visual values are remapped.
const accents = {
  coral: {
    light: { accent: "#9a3e25", accentSoft: "#eee8e5", accentSolid: "#9a3e25", accentText: "#ffffff" },
    dark: { accent: "#ef8b6d", accentSoft: "#342824", accentSolid: "#d66d4d", accentText: "#160b07" },
  },
  ocean: {
    light: { accent: "#1859a9", accentSoft: "#e6eaf0", accentSolid: "#1859a9", accentText: "#ffffff" },
    dark: { accent: "#86b6fa", accentSoft: "#252c35", accentSolid: "#5c91dc", accentText: "#071421" },
  },
  violet: {
    light: { accent: "#6242a1", accentSoft: "#ebe8f0", accentSolid: "#6242a1", accentText: "#ffffff" },
    dark: { accent: "#baa1ed", accentSoft: "#2d2935", accentSolid: "#9876d4", accentText: "#110a1d" },
  },
  mint: {
    light: { accent: "#176b55", accentSoft: "#e5ece9", accentSolid: "#176b55", accentText: "#ffffff" },
    dark: { accent: "#69c9a8", accentSoft: "#25312d", accentSolid: "#45a987", accentText: "#071813" },
  },
} as const satisfies Record<AccentName, Record<ResolvedAppearanceMode, object>>;

const metrics = {
  space: (n: number) => n * 4,
  gutter: 20, sectionGap: 18, headerInset: 10,
  radius: { sm: 10, md: 16, lg: 20, composer: 26, pane: 24, pill: 999 },
  size: { control: 46, chip: 42, composerCollapsed: 64, composerButton: 42, composerInset: 11, orb: 42, touch: 44 },
  font: { tiny: 11, small: 13, body: 15, title: 19, greeting: 30 },
  display: {
    regular: "sans-serif",
    editorial: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
    semibold: Platform.select({ android: "sans-serif-medium", default: "sans-serif" }),
    bold: Platform.select({ android: "sans-serif-medium", default: "sans-serif" }),
  },
  line: { body: 22, greeting: 34 },
  motion: { fast: 120, base: 180 },
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

export function createTheme(mode: ResolvedAppearanceMode, accent: AccentName) {
  const material = materialTokens(mode);
  return { ...metrics, mode, accentName: accent, color: { ...modeColors[mode], ...accents[accent][mode] }, glass: material.glass, approval: material.approval };
}

export type AppTheme = ReturnType<typeof createTheme>;
export const theme = createTheme("dark", "coral");

export function shade(hex: string, ratio: number): string {
  const value = hex.replace("#", "");
  const normalised = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const num = Number.parseInt(normalised, 16);
  if (Number.isNaN(num)) return hex;
  const channel = (shift: number) => {
    const base = (num >> shift) & 0xff;
    const next = ratio >= 0 ? base + (255 - base) * ratio : base * (1 + ratio);
    return Math.round(Math.min(255, Math.max(0, next)));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
