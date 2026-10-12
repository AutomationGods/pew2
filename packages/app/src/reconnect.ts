/** Pure reconnect decisions shared by the native UI and behavioral tests. */
interface ReconnectDialog {
  title: string;
  message: string;
  buttons: { text: string; style: "cancel" | "destructive"; onPress?: () => void }[];
}

export function reconnectDialog(machineLabel: string, confirm: () => void): ReconnectDialog {
  return {
    title: "Forget connection & reconnect?",
    message: `Disconnect this phone from ${machineLabel} and scan a pairing code to connect again. Messages waiting to send will be discarded. Saved chats on your computer won't be deleted.`,
    buttons: [
      { text: "Cancel", style: "cancel" as const },
      { text: "Forget & reconnect", style: "destructive" as const, onPress: confirm },
    ],
  };
}

export async function forgetConnection(effects: {
  clearPairing: () => Promise<void>;
  clearProviders: () => Promise<void>;
  openPairing: () => void;
}): Promise<void> {
  // Preserve the existing policy: failed storage removal still leaves the
  // connected screen. The next explicit pairing write replaces stale storage.
  try {
    await Promise.all([effects.clearPairing(), effects.clearProviders()]);
  } finally {
    effects.openPairing();
  }
}

/** Both entry methods release their spinner even when secure storage rejects. */
export async function runPairingAttempt(
  accept: () => Promise<string | null>,
  setBusy: (busy: boolean) => void,
): Promise<string | null> {
  setBusy(true);
  try {
    return await accept();
  } catch {
    // Native errors can contain connection details. Show recovery advice, not
    // the raw exception or the pairing link.
    return "Couldn't connect. Unlock your phone and try again. If this keeps happening, restart the app.";
  } finally {
    setBusy(false);
  }
}

/** Storage failure must be visible without blocking connection recovery. */
export async function withPairingStorageWarning(
  operation: "save" | "forget",
  action: () => Promise<void>,
  warn: (title: string, message: string) => void,
): Promise<void> {
  try {
    await action();
  } catch {
    if (operation === "save") {
      warn(
        "Connection wasn't saved",
        "You can connect now, but may need to pair again after restarting the app. Unlock your phone and pair again to save the connection.",
      );
    } else {
      warn(
        "Couldn't fully forget this connection",
        "This phone is disconnected, but its saved connection may return after restarting the app. Unlock your phone and try forgetting it again, or scan a new pairing code.",
      );
    }
  }
}

export function scannerVisible(_visible: boolean, action: "scan" | "manual"): boolean {
  return action === "scan";
}
