import { expect, test } from "bun:test";
import { forgetConnection, reconnectDialog, runPairingAttempt, scannerVisible, withPairingStorageWarning } from "./reconnect";

test("Cancel preserves the existing connection and provider cache", () => {
  const state = { pairing: "saved-connection", providers: ["echo"], scanner: false };
  let confirmations = 0;
  const dialog = reconnectDialog("Offline computer", () => { confirmations += 1; });
  const cancel = dialog.buttons.find(button => button.style === "cancel");
  expect(cancel).toBeDefined();
  cancel?.onPress?.();
  expect(confirmations).toBe(0);
  expect(state).toEqual({ pairing: "saved-connection", providers: ["echo"], scanner: false });
});

test("confirmation clears pairing and providers before opening the scanner offline", async () => {
  const state: { pairing: string | null; providers: string[]; scanner: boolean; status: string } = {
    pairing: "saved-connection", providers: ["echo"], scanner: false, status: "offline",
  };
  let release = () => {};
  const storageReady = new Promise<void>(resolve => { release = resolve; });
  let operation: Promise<void> | undefined;
  const dialog = reconnectDialog("Offline computer", () => {
    operation = forgetConnection({
      clearPairing: async () => { await storageReady; state.pairing = null; },
      clearProviders: async () => { state.providers = []; },
      openPairing: () => { state.scanner = true; },
    });
  });
  const confirm = dialog.buttons.find(button => button.style === "destructive");
  expect(confirm?.onPress).toBeDefined();
  confirm?.onPress?.();
  expect(operation).toBeDefined();
  expect(state.scanner).toBe(false);
  expect(state.pairing).toBe("saved-connection");
  release();
  await operation;
  expect(state).toEqual({ pairing: null, providers: [], scanner: true, status: "offline" });
});

test.each(["scanner cancellation", "paste instead after camera denial"])("%s restores manual pairing and permits scanning again", () => {
  // Both QrScanner exits use PairingScreen's same manual-entry action.
  const manual = scannerVisible(true, "manual");
  expect(manual).toBe(false);
  expect(scannerVisible(manual, "scan")).toBe(true);
});

test("storage failure still leaves the connected view, retaining the existing recovery policy", async () => {
  let opened = false;
  let providersCleared = false;
  const operation = forgetConnection({
    clearPairing: async () => { throw new Error("Keychain unavailable"); },
    clearProviders: async () => { providersCleared = true; },
    openPairing: () => { opened = true; },
  });
  await expect(operation).rejects.toThrow("Keychain unavailable");
  expect(providersCleared).toBe(true);
  expect(opened).toBe(true);
});

test("a rejected pairing attempt releases busy state and shows recovery advice, not native details", async () => {
  const busy: boolean[] = [];
  const failure = await runPairingAttempt(
    async () => { throw new Error("private-connection-details"); },
    value => busy.push(value),
  );
  expect(busy).toEqual([true, false]);
  expect(failure).toBe("Couldn't connect. Unlock your phone and try again. If this keeps happening, restart the app.");
  expect(failure).not.toContain("private-connection-details");
});

test("pairing stays busy until acceptance finishes and clears on success", async () => {
  const busy: boolean[] = [];
  let finish = () => {};
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const operation = runPairingAttempt(async () => { await ready; return null; }, value => busy.push(value));
  expect(busy).toEqual([true]);
  finish();
  expect(await operation).toBeNull();
  expect(busy).toEqual([true, false]);
});

test("an explained pairing refusal keeps its specific message and clears busy state", async () => {
  const busy: boolean[] = [];
  expect(await runPairingAttempt(async () => "Scan a current code.", value => busy.push(value)))
    .toBe("Scan a current code.");
  expect(busy).toEqual([true, false]);
});

test("a failed save warns but still permits the connection", async () => {
  const warnings: string[][] = [];
  let connected = false;
  await withPairingStorageWarning("save",
    async () => { throw new Error("private-storage-error"); },
    (title, message) => warnings.push([title, message]),
  ).then(() => { connected = true; });
  expect(connected).toBe(true);
  expect(warnings).toEqual([[
    "Connection wasn't saved",
    "You can connect now, but may need to pair again after restarting the app. Unlock your phone and pair again to save the connection.",
  ]]);
  expect(JSON.stringify(warnings)).not.toContain("private-storage-error");
});

test("failed removal opens pairing and warns that the saved connection may return", async () => {
  const warnings: string[][] = [];
  let opened = false;
  let providersCleared = false;
  await withPairingStorageWarning("forget", () => forgetConnection({
    clearPairing: async () => { throw new Error("private-storage-error"); },
    clearProviders: async () => { providersCleared = true; },
    openPairing: () => { opened = true; },
  }), (title, message) => warnings.push([title, message]));
  expect(opened).toBe(true);
  expect(providersCleared).toBe(true);
  expect(warnings).toEqual([[
    "Couldn't fully forget this connection",
    "This phone is disconnected, but its saved connection may return after restarting the app. Unlock your phone and try forgetting it again, or scan a new pairing code.",
  ]]);
  expect(JSON.stringify(warnings)).not.toContain("private-storage-error");
});

test.each(["save", "forget"] as const)("successful %s does not display a storage warning", async operation => {
  let warnings = 0;
  await withPairingStorageWarning(operation, async () => {}, () => { warnings++; });
  expect(warnings).toBe(0);
});
