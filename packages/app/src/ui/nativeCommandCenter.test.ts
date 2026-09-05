import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (name: string) => readFileSync(join(import.meta.dir, name), "utf8");

test("agent filters use neutral controls and a small provider marker", () => {
  const chip = source("AgentChip.tsx");
  expect(chip).toContain("theme.color.controlFill");
  expect(chip).toContain("styles.marker");
  expect(chip).not.toContain("LinearGradient");
});

test("shared controls keep the Apple minimum touch target", () => {
  const controls = source("controls.tsx");
  expect(controls).toContain("theme.size.touch");
  expect(controls).toContain("accessibilityState={{ disabled }}");
});

test("glass is restricted to raised overlays without edge decoration", () => {
  const glass = source("Glass.tsx");
  expect(glass).toContain('tier === "raised"');
  expect(glass).not.toContain("EdgeHighlight");
  expect(glass).not.toContain("Sheen");
});
