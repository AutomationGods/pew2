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

test.each(["ios", "android", "web"])("shared theme keeps accent pairs and system monospace on %s", platform => {
  // Stub only React Native's platform boundary, in a child process so no mock
  // can leak into the rest of the suite. The actual theme factory is executed.
  const retry = readFileSync(join(import.meta.dir, "ErrorBoundary.tsx"), "utf8");
  const pressedOpacity = Number(retry.match(/buttonPressed:\s*\{\s*opacity:\s*([\d.]+)/)?.[1]);
  expect(pressedOpacity).toBeGreaterThan(0);
  expect(pressedOpacity).toBeLessThanOrEqual(1);
  const script = `
    import { mock, expect } from "bun:test";
    const luminance = ${luminance.toString()};
    const contrast = ${contrast.toString()};
    const blend = (foreground, background) => "#" + [1, 3, 5].map(offset => {
      const front = Number.parseInt(foreground.slice(offset, offset + 2), 16);
      const back = Number.parseInt(background.slice(offset, offset + 2), 16);
      return Math.round(front * ${pressedOpacity} + back * (1 - ${pressedOpacity})).toString(16).padStart(2, "0");
    }).join("");
    mock.module("react-native", () => ({
      Platform: { select: values => values[${JSON.stringify(platform)}] ?? values.default },
      Easing: {
        bezier: () => () => 0,
        ease: t => t, quad: t => t * t, cubic: t => t * t * t,
        inOut: curve => curve, out: curve => curve,
      },
    }));
    const { createTheme } = await import(${JSON.stringify(join(import.meta.dir, "..", "theme.ts"))});
    const values = [];
    for (const accent of ["coral", "ocean", "violet", "mint"]) {
      for (const mode of ["light", "dark"]) {
        const theme = createTheme(mode, accent);
        // Glyph contrast in normal and pressed composer states.
        expect(contrast(theme.color.canvas, theme.color.text)).toBeGreaterThanOrEqual(3);
        expect(contrast(theme.color.canvas, theme.color.textDim)).toBeGreaterThanOrEqual(3);
        // Retry text, including the existing whole-button pressed fade.
        expect(contrast(theme.color.accentText, theme.color.accentSolid)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(blend(theme.color.accentText, theme.color.bg), blend(theme.color.accentSolid, theme.color.bg))).toBeGreaterThanOrEqual(4.5);
        // Small Activity metadata must be readable on ordinary and pressed rows.
        for (const background of [theme.color.groupedSurface, theme.color.surface, theme.color.surfacePressed, theme.color.surfaceRaised]) {
          expect(contrast(theme.color.textDim, background)).toBeGreaterThanOrEqual(4.5);
        }
        // Token replacements must retain the previous geometry.
        expect([theme.size.touch, theme.font.small, theme.font.body, theme.radius.sm]).toEqual([44, 13, 17, 10]);
        values.push({ accent, mode, fill: theme.color.accentSolid, text: theme.color.accentText, font: theme.display.monospace });
      }
    }
    console.log(JSON.stringify(values));
  `;
  const result = Bun.spawnSync([process.execPath, "--eval", script], { stdout: "pipe", stderr: "pipe" });
  expect(new TextDecoder().decode(result.stderr)).toBe("");
  expect(result.exitCode).toBe(0);
  const actual: unknown = JSON.parse(new TextDecoder().decode(result.stdout));
  const expected = [
    { accent: "coral", mode: "light", fill: "#9a3e25", text: "#ffffff" },
    { accent: "coral", mode: "dark", fill: "#d66d4d", text: "#160b07" },
    { accent: "ocean", mode: "light", fill: "#1859a9", text: "#ffffff" },
    { accent: "ocean", mode: "dark", fill: "#5c91dc", text: "#071421" },
    { accent: "violet", mode: "light", fill: "#6242a1", text: "#ffffff" },
    { accent: "violet", mode: "dark", fill: "#9876d4", text: "#110a1d" },
    { accent: "mint", mode: "light", fill: "#176b55", text: "#ffffff" },
    { accent: "mint", mode: "dark", fill: "#45a987", text: "#071813" },
  ].map(value => ({ ...value, font: platform === "ios" ? "Menlo" : "monospace" }));
  expect(actual).toEqual(expected);
});

test("accent previews consume the theme instead of maintaining a second palette", () => {
  const source = readFileSync(join(import.meta.dir, "AppearanceSheet.tsx"), "utf8");
  expect(source).toContain("createTheme(theme.mode, accent).color");
  expect(source).toContain("backgroundColor: accentTheme.accentSolid");
  expect(source).toContain("color={accentTheme.accentText}");
  expect(source).not.toContain("ACCENT_PREVIEW");
  expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

test("commands, markdown and stack traces use the shared monospace token", () => {
  for (const name of ["PairingScreen.tsx", "MarkdownText.tsx", "ErrorBoundary.tsx"]) {
    const source = readFileSync(join(import.meta.dir, name), "utf8");
    expect(source).toContain("fontFamily: theme.display.monospace");
    expect(source).not.toContain('"Menlo"');
    expect(source).not.toMatch(/fontFamily:\s*["']monospace["']/);
  }
});

test("composer and retry controls use theme-aware foreground/background pairs", () => {
  const composer = readFileSync(join(import.meta.dir, "Composer.tsx"), "utf8");
  expect(composer).toContain("color={theme.color.canvas}");
  expect(composer).toContain("sendButton: { backgroundColor: theme.color.text }");
  expect(composer).toContain("sendPressed: { backgroundColor: theme.color.textDim }");
  expect(composer).not.toContain('color="#0f0f0f"');
  const retry = readFileSync(join(import.meta.dir, "ErrorBoundary.tsx"), "utf8");
  expect(retry).toContain("backgroundColor: theme.color.accentSolid");
  expect(retry).toContain("buttonText: { color: theme.color.accentText");
  expect(retry).not.toContain('color: "#ffffff"');
});

test("Activity metadata uses the contrast-checked foreground", () => {
  const source = readFileSync(join(import.meta.dir, "ActivityScreen.tsx"), "utf8");
  expect(source).toContain("metadata: { color: theme.color.textDim, fontSize: theme.font.small");
});

test("the recorded duplicate sizes stay connected to shared tokens", () => {
  const source = (name: string) => readFileSync(join(import.meta.dir, name), "utf8");
  expect(source("Turn.tsx")).toContain("cancelQueued: { minWidth: theme.size.touch, minHeight: theme.size.touch");
  expect(source("ActivityScreen.tsx")).toContain("cardTitle: { color: theme.color.text, fontSize: theme.font.body");
  expect(source("QrScanner.tsx")).toContain("borderRadius: theme.radius.sm");
  expect(source("QrScanner.tsx")).not.toContain("borderRadius: 10");
  expect(source("PairingScreen.tsx").match(/fontSize: theme\.font\.small/g)).toHaveLength(3);
  expect(source("PairingScreen.tsx")).not.toContain("fontSize: 13");
});
