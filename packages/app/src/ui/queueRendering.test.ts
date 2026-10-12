import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Native rendering needs a device; this source contract prevents the list from
// discarding an image-only turn before the cell can show its queue controls.
test("the transcript and cell both retain image-only queued messages", () => {
  const thread = readFileSync(join(import.meta.dir, "ChatThread.tsx"), "utf8");
  expect(thread).toContain("if (!item.text.trim() && !item.images?.length) return null;");
  const turn = readFileSync(join(import.meta.dir, "Turn.tsx"), "utf8");
  expect(turn).toContain("if (!turn.text.trim() && images.length === 0) return null;");
  expect(turn).toContain("Cancel queued message");
});
