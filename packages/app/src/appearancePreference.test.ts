import { expect, test } from "bun:test";
import {
  DEFAULT_APPEARANCE,
  parseAppearancePreference,
  serializeAppearancePreference,
} from "./appearancePreference.js";

test("appearance preferences round-trip", () => {
  const preference = { mode: "dark", accent: "ocean" } as const;
  expect(parseAppearancePreference(serializeAppearancePreference(preference))).toEqual(preference);
});

test("missing and malformed preferences use defaults", () => {
  for (const stored of [null, "", "not json", "[]", "x".repeat(1_025)]) {
    expect(parseAppearancePreference(stored)).toEqual(DEFAULT_APPEARANCE);
  }
});

test("invalid fields fall back independently", () => {
  expect(parseAppearancePreference(JSON.stringify({ mode: "sepia", accent: "mint" }))).toEqual({
    mode: "system",
    accent: "mint",
  });
  expect(parseAppearancePreference(JSON.stringify({ mode: "light", accent: 42 }))).toEqual({
    mode: "light",
    accent: "coral",
  });
});
