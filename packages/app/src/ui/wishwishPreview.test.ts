import { describe, expect, test } from "bun:test";
import { PREVIEW_REPLY, wishwishPreviewPalettes } from "./wishwishPreviewTheme";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(start => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

for (const [mode, colors] of Object.entries(wishwishPreviewPalettes)) {
  describe(`${mode} preview colors`, () => {
    test("readable text on canvas, cards and pressed controls", () => {
      for (const background of [colors.canvas, colors.surface, colors.pressed]) {
        for (const foreground of [colors.text, colors.muted, colors.accent, colors.success, colors.danger]) {
          expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    test("primary action text is readable in normal and pressed states", () => {
      expect(contrast(colors.onAccent, colors.solid)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.onAccent, colors.solidPressed)).toBeGreaterThanOrEqual(4.5);
    });
    test("blue messages and muted actions keep readable labels", () => {
      expect(contrast(colors.userInk, colors.userSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.disabledInk, colors.disabledSurface)).toBeGreaterThanOrEqual(4.5);
    });
    test("input boundary is distinguishable on both adjacent surfaces", () => {
      expect(contrast(colors.controlBorder, colors.canvas)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors.controlBorder, colors.surface)).toBeGreaterThanOrEqual(3);
    });
  });
}

test("the simulated reply does not pretend to call an agent", () => {
  expect(PREVIEW_REPLY).toContain("sample reply");
  expect(PREVIEW_REPLY).toContain("not sent to an agent");
});
