import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useAppTheme } from "../appearance";
import { clearPairing, loadPairing, savePairing, type Pairing } from "../pairing";
import { clearCachedProviders } from "../preferences";
import { forgetConnection, withPairingStorageWarning } from "../reconnect";
import { LaunchScreen } from "./LaunchScreen";
import { PairingScreen } from "./PairingScreen";

/**
 * Pairing gate.
 *
 * The daemon's address is a secret held in the keychain, so it is not known
 * until an async read completes. Rendering the conversation before then would
 * open a socket to nowhere, so this holds a neutral screen for the frame it
 * takes, and shows the pairing screen when nothing is stored.
 */
/** The connected surface is separate so native harnesses never start a daemon socket. */
export function PairingGate({ connected }: {
  connected: (pairing: Pairing, onUnpair: () => void) => ReactNode;
}): ReactNode {
  const { theme: appTheme } = useAppTheme();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [checked, setChecked] = useState(false);
  // Whether the user has moved past the launch screen. Not persisted: it only
  // exists between opening the app and pairing, and a stored pairing skips it
  // entirely.
  const [connecting, setConnecting] = useState<false | "manual" | "scan">(false);

  useEffect(() => {
    let alive = true;
    void loadPairing()
      .catch(() => {
        // The same reasoning `pair` uses below, which already guards the write
        // side: a locked or unavailable keychain has to read as "not paired",
        // not as a rejection. Without this the promise rejects, `setChecked`
        // never runs, and the app sits on its loading screen with no way out.
        return null;
      })
      .then((stored) => {
        if (!alive) return;
        setPairing(stored);
        setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Lift the splash only once there is a real screen behind it.
  //
  // This is the first moment the app knows which screen it is: the conversation
  // for a paired device, the launch screen otherwise. `index.ts` holds the
  // splash from launch, and every path that sets `checked` — including the
  // keychain failures above, which resolve to "not paired" rather than
  // rejecting — arrives here, so there is no route that leaves it up.
  //
  // One frame later, not immediately: `hideAsync` takes effect straight away,
  // and calling it during the commit that renders the first screen can uncover
  // the window before that screen has been drawn into it — a flash of empty
  // canvas, which is the exact thing the splash is being held to prevent.
  useEffect(() => {
    if (!checked) return;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [checked]);

  const pair = useCallback((next: Pairing) => {
    // Connect regardless of whether the keychain accepted it. A locked or
    // unavailable keychain costs the user a re-pair next launch; blocking on it
    // would strand them on this screen with a spinner and no way forward.
    return withPairingStorageWarning("save", () => savePairing(next), Alert.alert)
      .then(() => setPairing(next));
  }, []);

  const unpair = useCallback(() => {
    // Same reasoning inverted: forget it locally even if the delete failed, or
    // the confirmed "Forget" action would appear to do nothing.
    //
    // The remembered agent list goes with it. It describes one specific machine,
    // so keeping it would offer the next computer agents it may not have — and
    // "Forget this computer" ought to mean it.
    void withPairingStorageWarning("forget", () => forgetConnection({
      clearPairing,
      clearProviders: clearCachedProviders,
      openPairing: () => {
        setPairing(null);
        // A deliberate reconnect goes straight to scanning, even offline.
        setConnecting("scan");
      },
    }), Alert.alert);
  }, []);

  if (!checked) return <View style={{ flex: 1, backgroundColor: appTheme.color.bg }} />;
  // A paired device never sees the launch screen: it has a machine already, and
  // an extra tap on every cold start would be pure friction.
  if (pairing) return connected(pairing, unpair);
  if (!connecting) return <LaunchScreen onConnect={() => setConnecting("manual")} />;
  return <PairingScreen onPaired={pair} onBack={() => setConnecting(false)} startScanning={connecting === "scan"} />;
}
