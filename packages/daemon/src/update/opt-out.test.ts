import { expect, test } from "bun:test";
import { join } from "node:path";
import { autoUpdateDisabled, OPT_OUT_FILE } from "./opt-out.js";
import { startUpdateScheduler } from "./scheduler.js";

const none = () => false;

test("self-update stays on unless someone turns it off", () => {
  expect(autoUpdateDisabled({ PEW2_HOME: "/x" }, none)).toBe(false);
  expect(autoUpdateDisabled({ PEW2_HOME: "/x", PEW2_AUTO_UPDATE: "1" }, none)).toBe(false);
});

test("the environment can turn it off", () => {
  for (const value of ["0", "false", "OFF", " no "]) {
    expect(autoUpdateDisabled({ PEW2_HOME: "/x", PEW2_AUTO_UPDATE: value }, none)).toBe(true);
  }
});

test("a file in the pew2 folder turns it off, and survives a rewritten service", () => {
  const seen: string[] = [];
  const exists = (path: string) => (seen.push(path), path === join("/x", OPT_OUT_FILE));
  expect(autoUpdateDisabled({ PEW2_HOME: "/x" }, exists)).toBe(true);
  expect(seen).toEqual([join("/x", OPT_OUT_FILE)]);
});

test("an opted-out build never looks for, downloads or installs an update", () => {
  let checked = false;
  const scheduler = startUpdateScheduler({
    disabled: () => true,
    installed: () => true,
    eligible: () => true,
    check: async () => ((checked = true), null),
    busyReason: () => undefined,
    exit: () => {
      throw new Error("must never exit");
    },
    firstDelayMs: 0,
  });
  expect(scheduler).toBeUndefined();
  expect(checked).toBe(false);
});
