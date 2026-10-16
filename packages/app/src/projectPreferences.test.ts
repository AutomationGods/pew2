import { expect, test } from "bun:test";
import {
  parseProjectPreferences,
  serializeProjectPreferences,
} from "./projectPreferences.js";

test("selected projects round-trip per provider", () => {
  const selected = {
    echo: "/Users/someone/gg-projects/mobile-app",
    codex: "C:\\code\\api",
  };
  expect(parseProjectPreferences(serializeProjectPreferences(selected))).toEqual(selected);
});

test("malformed and oversized stored values are preference misses", () => {
  for (const stored of [
    null,
    "",
    "not json",
    "[]",
    JSON.stringify({ echo: 12 }),
    JSON.stringify({ echo: "bad\npath" }),
    JSON.stringify({ ["x".repeat(129)]: "/tmp/project" }),
    "x".repeat(64 * 1024 + 1),
  ]) {
    expect(parseProjectPreferences(stored)).toEqual({});
  }
});

test("provider maps are bounded and invalid live entries are omitted", () => {
  const many = Object.fromEntries(
    Array.from({ length: 55 }, (_, index) => [`provider-${index}`, `/project/${index}`]),
  );
  const parsed = parseProjectPreferences(
    serializeProjectPreferences({ ...many, "bad id": "/ignored", invalid: "" }),
  );
  expect(Object.keys(parsed)).toHaveLength(50);
  expect(parsed["provider-54"]).toBe("/project/54");
  expect(parsed["bad id"]).toBeUndefined();
});

test("serialization stays within its own payload bound", () => {
  const large = Object.fromEntries(
    Array.from({ length: 50 }, (_, index) => [`provider-${index}`, `/${"x".repeat(4_000)}${index}`]),
  );
  const serialized = serializeProjectPreferences(large);
  expect(serialized.length).toBeLessThanOrEqual(64 * 1024);
  expect(Object.keys(parseProjectPreferences(serialized)).length).toBeGreaterThan(0);
});
