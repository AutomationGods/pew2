/** Preview-only sRGB tokens. Native RN does not support CSS oklch() colors. */
export const wishwishPreviewPalettes = {
  light: {
    canvas: "#eef5fc", surface: "#ffffff", pressed: "#e1eef8",
    text: "#10243f", muted: "#4d627b", border: "#d6e3f1", controlBorder: "#75879f",
    accent: "#006a56", solid: "#006b58", solidPressed: "#005544", onAccent: "#ffffff",
    userSurface: "#2354da", userInk: "#ffffff",
    disabledSurface: "#dce8f6", disabledInk: "#506886",
    success: "#24613b", danger: "#85520d",
  },
  dark: {
    canvas: "#091323", surface: "#14243b", pressed: "#1d3350",
    text: "#eef5ff", muted: "#a8bdd6", border: "#294364", controlBorder: "#7990ac",
    accent: "#71eccb", solid: "#62e7c4", solidPressed: "#92f4d9", onAccent: "#052820",
    userSurface: "#214ca3", userInk: "#ffffff",
    disabledSurface: "#263b55", disabledInk: "#adc4df",
    success: "#9adeaf", danger: "#ffd18d",
  },
} as const;

export type WishwishPreviewMode = keyof typeof wishwishPreviewPalettes;
export type WishwishPreviewPalette = typeof wishwishPreviewPalettes[WishwishPreviewMode];

export const PREVIEW_REPLY = "This is a sample reply so you can try the new chat style. Your message stays in this preview and is not sent to an agent.";
