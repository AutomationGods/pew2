import { expect, test } from "bun:test";
import { ACCENT_NAMES } from "../appearancePreference";
import { DARK_PALETTE, LIGHT_PALETTE, resolvePalette } from "../palette";
import { approvalActionColors, fallbackGlassTokens } from "../materialTokens";

const canvas = "#111111";

function rgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(left: string, right: string): number {
  const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (bright! + 0.05) / (dark! + 0.05);
}

function whiteOver(background: string, alpha: number): string {
  const channels = rgb(background).map((channel) =>
    Math.round(255 * alpha + channel * (1 - alpha)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function alpha(color: string): number {
  const match = color.match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
  if (!match) throw new Error(`Expected rgba color, got ${color}`);
  return Number(match[1]);
}

test("approval button labels meet WCAG AA contrast", () => {
  expect(contrast(approvalActionColors.allowText, approvalActionColors.allowFill)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(approvalActionColors.rejectText, approvalActionColors.rejectFill)).toBeGreaterThanOrEqual(4.5);
});

test("the connected-apps count is legible on its badge", () => {
  // Small dim text is the easy thing to get wrong: it reads fine on a desk
  // monitor and vanishes on a phone outdoors. At 11px it is not large text, so
  // full AA applies. Checked against the drawer too: the badge fill is a quiet
  // container, so the number has to stand on its own wherever it is read.
  for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
    expect(contrast(palette.color.textDim, palette.color.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.color.textDim, palette.color.drawer)).toBeGreaterThanOrEqual(4.5);
  }
});

test("the default dark palette is Ken's Stage palette, unchanged", () => {
  const ken = resolvePalette("dark", "periwinkle");
  expect(ken.color).toEqual(DARK_PALETTE.color);
  expect(ken.color.bg).toBe("#0a0a0c");
  expect(ken.color.accent).toBe("#b0b6ff");
  expect(ken.color.accentSoft).toBe("#262a4d");
  expect(ken.color.onAccent).toBe("#0c0e26");
});

for (const scheme of ["dark", "light"] as const) {
  for (const accent of ACCENT_NAMES) {
    test(`${scheme} / ${accent} meets the Stage contrast floors`, () => {
      const c = resolvePalette(scheme, accent).color;
      // Every surface text is read on, not the pressed flash.
      for (const surface of [c.bg, c.drawer, c.surface, c.surfaceRaised]) {
        for (const ink of [c.text, c.textDim, c.textFaint, c.accent, c.danger, c.success, c.attention, c.thought]) {
          expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(c.text, c.surfacePressed)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent, c.accentSoft)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text, c.accentSoft)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    });
  }
}

test("the reject boundary and fallback glass rims remain distinguishable", () => {
  // #3c3c40 is a conservative bright sample of the adaptive dark glass panel.
  expect(contrast(approvalActionColors.rejectRim, "#3c3c40")).toBeGreaterThanOrEqual(3);
  for (const tier of [fallbackGlassTokens.control, fallbackGlassTokens.raised]) {
    const compositedRim = whiteOver(canvas, alpha(tier.rim));
    expect(contrast(compositedRim, canvas)).toBeGreaterThanOrEqual(3);
  }
});

test("light approval labels and fallback glass rims hold the same floors", () => {
  const { approval, glass } = LIGHT_PALETTE;
  expect(contrast(approval.allowText, approval.allowFill)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(approval.rejectText, approval.rejectFill)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(approval.rejectRim, approval.rejectFill)).toBeGreaterThanOrEqual(3);
  const light = LIGHT_PALETTE.color.bg;
  for (const tier of [glass.control, glass.raised]) {
    const a = alpha(tier.rim);
    const rim = `#${rgb(light).map((c) => Math.round(c * (1 - a)).toString(16).padStart(2, "0")).join("")}`;
    expect(contrast(rim, light)).toBeGreaterThanOrEqual(3);
  }
});

test("dark glass and approval tokens are still materialTokens' literals", () => {
  expect(DARK_PALETTE.glass).toEqual(fallbackGlassTokens);
  expect(DARK_PALETTE.approval).toEqual(approvalActionColors);
});
