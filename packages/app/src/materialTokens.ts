export type MaterialMode = "light" | "dark";

const glassByMode = {
  light: {
    control: { fill: "rgba(252,251,247,0.94)", rim: "rgba(61,57,50,0.16)" },
    raised: { fill: "rgba(247,245,238,0.97)", rim: "rgba(61,57,50,0.18)" },
    fillActive: "rgba(61,57,50,0.08)",
    fillPressed: "rgba(61,57,50,0.11)",
    intensity: 30,
  },
  dark: {
    control: { fill: "rgba(39,38,31,0.95)", rim: "rgba(243,240,230,0.13)" },
    raised: { fill: "rgba(48,47,39,0.97)", rim: "rgba(243,240,230,0.15)" },
    fillActive: "rgba(243,240,230,0.10)",
    fillPressed: "rgba(243,240,230,0.08)",
    intensity: 38,
  },
} as const;

const approvalByMode = {
  light: {
    allowFill: "#176b42",
    allowText: "#ffffff",
    rejectFill: "#ffffff",
    rejectRim: "#687080",
    rejectText: "#17191d",
  },
  dark: {
    allowFill: "#55c98a",
    allowText: "#071b11",
    rejectFill: "#202329",
    rejectRim: "#8d96a5",
    rejectText: "#f4f5f7",
  },
} as const;

export function materialTokens(mode: MaterialMode) {
  return { glass: glassByMode[mode], approval: approvalByMode[mode] };
}

export const fallbackGlassTokens = glassByMode.dark;
export const approvalActionColors = approvalByMode.dark;
