/**
 * Stage palettes: every colour token that changes with the user's appearance
 * choice (light/dark mode and accent). Pure — no React Native — so the
 * contrast test can import it under `bun test`.
 *
 * `DARK` is Ken's Stage palette verbatim and `theme.ts` reads its colours from
 * here, so dark mode with the periwinkle accent is exactly the original look.
 * Ratios for the dark palette are documented in theme.ts; both palettes and
 * every accent are held to the same floors by `ui/themeContrast.test.ts`.
 */
import { approvalActionColors, fallbackGlassTokens } from "./materialTokens";
import type { AccentName, AppearanceMode } from "./appearancePreference";

export type Scheme = "light" | "dark";

interface AccentTokens {
  accent: string;
  /** Control-fill strength of the accent (a button that is *on*). */
  accentSoft: string;
  /** Ink on an accent fill. */
  onAccent: string;
}

export const ACCENTS: Record<Scheme, Record<AccentName, AccentTokens>> = {
  dark: {
    periwinkle: { accent: "#b0b6ff", accentSoft: "#262a4d", onAccent: "#0c0e26" },
    coral: { accent: "#ffa08a", accentSoft: "#46241d", onAccent: "#2a0d06" },
    ocean: { accent: "#7cc8ff", accentSoft: "#15304a", onAccent: "#04182a" },
    violet: { accent: "#d0a8ff", accentSoft: "#38254f", onAccent: "#1c0a33" },
    mint: { accent: "#7ee8c8", accentSoft: "#163b31", onAccent: "#04241b" },
  },
  light: {
    periwinkle: { accent: "#4148c0", accentSoft: "#e2e4ff", onAccent: "#ffffff" },
    coral: { accent: "#b03a1a", accentSoft: "#fde3dc", onAccent: "#ffffff" },
    ocean: { accent: "#0b5e9f", accentSoft: "#dcecfa", onAccent: "#ffffff" },
    violet: { accent: "#7036b8", accentSoft: "#eee3fb", onAccent: "#ffffff" },
    mint: { accent: "#0c6a51", accentSoft: "#d8f2ea", onAccent: "#ffffff" },
  },
};

const DARK = {
  color: {
    bg: "#0a0a0c",
    drawer: "#141519",
    surface: "#141519",
    surfaceRaised: "#1c1e23",
    surfacePressed: "#24262c",
    border: "#2a2c33",
    text: "#f2f3f7",
    textDim: "#9a9ba5",
    textFaint: "#90919c",
    glyph: "#c8c9d2",
    placeholder: "#90919c",
    ...ACCENTS.dark.periwinkle,
    success: "#7fe89a",
    attention: "#f2b45a",
    danger: "#ff6b60",
    thought: "#ff8fd0",
    orb: "#b0b6ff",
  },
  composer: {
    fill: "#141519",
    border: "#3a3c44",
    chip: "#1c1e23",
    ink: "#c8c9d2",
    placeholder: "#9a9ba5",
  },
  stage: {
    dash: "#34363e",
    strip: "#121317",
    gridColor: "rgba(255,255,255,0.055)",
    fineColor: "rgba(255,255,255,0.06)",
  },
  /** Non-Apple glass fallback (materialTokens.ts holds the dark literals). */
  glass: fallbackGlassTokens,
  approval: approvalActionColors,
} as const;

const LIGHT: Widen<typeof DARK> = {
  color: {
    bg: "#f6f6f9",
    drawer: "#ebecf1",
    surface: "#ebecf1",
    surfaceRaised: "#ffffff",
    surfacePressed: "#dfe0e7",
    border: "#d0d2da",
    text: "#121318",
    textDim: "#50525e",
    textFaint: "#585a66",
    glyph: "#3a3c46",
    placeholder: "#585a66",
    ...ACCENTS.light.periwinkle,
    success: "#1a6e34",
    attention: "#8a5300",
    danger: "#b8241a",
    thought: "#a62c77",
    orb: "#4148c0",
  },
  composer: {
    fill: "#ffffff",
    border: "#c4c6d0",
    chip: "#ebecf1",
    ink: "#3a3c46",
    placeholder: "#50525e",
  },
  stage: {
    dash: "#c4c6d0",
    strip: "#ebecf1",
    gridColor: "rgba(0,0,0,0.06)",
    fineColor: "rgba(0,0,0,0.07)",
  },
  glass: {
    control: { fill: "rgba(235,236,241,0.78)", rim: "rgba(0,0,0,0.46)" },
    raised: { fill: "rgba(255,255,255,0.86)", rim: "rgba(0,0,0,0.5)" },
    fillActive: "rgba(0,0,0,0.08)",
    fillPressed: "rgba(0,0,0,0.07)",
    intensity: 55,
  },
  approval: {
    allowFill: "#4148c0",
    allowText: "#ffffff",
    rejectFill: "#ffffff",
    rejectRim: "#585a66",
    rejectText: "#121318",
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export interface Palette extends Widen<typeof DARK> {
  scheme: Scheme;
  /** A resting card or chip outline: dashed, so a selected one (solid) stands out. */
  outline: { borderWidth: number; borderStyle: "dashed"; borderColor: string };
  /** The card a sheet's content sits in: one rounded, clipped raised surface. */
  sheetCard: { backgroundColor: string; borderRadius: number; overflow: "hidden" };
}

function build(scheme: Scheme, tokens: Widen<typeof DARK>): Palette {
  return {
    scheme,
    ...tokens,
    outline: { borderWidth: 1, borderStyle: "dashed", borderColor: tokens.stage.dash },
    // 18 = theme.radius.lg (theme.ts imports react-native, so not importable here).
    sheetCard: { backgroundColor: tokens.color.surfaceRaised, borderRadius: 18, overflow: "hidden" },
  };
}

/** Ken's dark Stage palette, exactly. The default for anything not themed. */
export const DARK_PALETTE: Palette = build("dark", DARK);
export const LIGHT_PALETTE: Palette = build("light", LIGHT);

/** Literal dark colours, for theme.ts's static `theme.color`. */
export const DARK_COLORS = DARK.color;
export const DARK_COMPOSER = DARK.composer;
export const DARK_STAGE = DARK.stage;

export function resolveScheme(mode: AppearanceMode, system: Scheme | null | undefined): Scheme {
  if (mode === "system") return system === "light" ? "light" : "dark";
  return mode;
}

function withAccent(base: Palette, tokens: AccentTokens): Palette {
  return { ...base, color: { ...base.color, ...tokens, orb: tokens.accent } };
}

function accentsOf(base: Palette, scheme: Scheme): Record<AccentName, Palette> {
  const a = ACCENTS[scheme];
  return {
    periwinkle: base,
    coral: withAccent(base, a.coral),
    ocean: withAccent(base, a.ocean),
    violet: withAccent(base, a.violet),
    mint: withAccent(base, a.mint),
  };
}

/** Every palette built once, so a palette's identity is stable (style caches key on it). */
const PALETTES: Record<Scheme, Record<AccentName, Palette>> = {
  dark: accentsOf(DARK_PALETTE, "dark"),
  light: accentsOf(LIGHT_PALETTE, "light"),
};

export function resolvePalette(scheme: Scheme, accent: AccentName): Palette {
  return PALETTES[scheme][accent];
}

/**
 * Wrap a StyleSheet factory so each palette builds its sheet once. Components
 * call `makeStyles(usePalette())` every render and get the cached sheet back,
 * so a style object's identity only changes when the palette does.
 */
export function themedStyles<T>(factory: (p: Palette) => T): (p: Palette) => T {
  const cache = new WeakMap<Palette, T>();
  return (p) => {
    const hit = cache.get(p);
    if (hit !== undefined) return hit;
    const built = factory(p);
    cache.set(p, built);
    return built;
  };
}
