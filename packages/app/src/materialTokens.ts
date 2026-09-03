export type MaterialMode = "light" | "dark";

const glassByMode = {
  light: {
    control: { fill: "rgba(255,255,255,0.78)", rim: "rgba(23,25,29,0.20)" },
    raised: { fill: "rgba(255,255,255,0.88)", rim: "rgba(23,25,29,0.24)" },
    fillActive: "rgba(23,25,29,0.08)",
    fillPressed: "rgba(23,25,29,0.10)",
    intensity: 38,
  },
  dark: {
    control: { fill: "rgba(255,255,255,0.10)", rim: "rgba(255,255,255,0.36)" },
    raised: { fill: "rgba(255,255,255,0.14)", rim: "rgba(255,255,255,0.42)" },
    fillActive: "rgba(255,255,255,0.16)",
    fillPressed: "rgba(255,255,255,0.15)",
    intensity: 55,
  },
} as const;

const approvalByMode = {
  light: {
    allowFill: "#147a45",
    allowText: "#ffffff",
    rejectFill: "#ffffff",
    rejectRim: "#687080",
    rejectText: "#17191d",
  },
  dark: {
    allowFill: "#55d187",
    allowText: "#092017",
    rejectFill: "#1c2027",
    rejectRim: "#949caa",
    rejectText: "#f3f5f7",
  },
} as const;

export function materialTokens(mode: MaterialMode) {
  return { glass: glassByMode[mode], approval: approvalByMode[mode] };
}

// Dark aliases keep pure helpers and older tests source-compatible during migration.
export const fallbackGlassTokens = glassByMode.dark;
export const approvalActionColors = approvalByMode.dark;