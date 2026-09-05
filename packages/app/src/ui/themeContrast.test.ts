import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approvalActionColors } from "../materialTokens";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(left: string, right: string): number {
  const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (bright! + 0.05) / (dark! + 0.05);
}

test("approval button labels meet AA contrast", () => {
  expect(contrast(approvalActionColors.allowText, approvalActionColors.allowFill)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(approvalActionColors.rejectText, approvalActionColors.rejectFill)).toBeGreaterThanOrEqual(4.5);
});

test("command-center text remains readable in both modes", () => {
  const source = readFileSync(join(import.meta.dir, "..", "theme.ts"), "utf8");
  for (const [canvas, text, dim] of [["#faf9f5", "#24231f", "#5d594f"], ["#181813", "#f7f4e9", "#d0c9b9"]]) {
    expect(source).toContain(canvas);
    expect(contrast(text, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dim, canvas)).toBeGreaterThanOrEqual(4.5);
  }
});
