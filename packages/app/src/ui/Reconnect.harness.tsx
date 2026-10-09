/** Real pairing storage and UI, with an offline drawer instead of a live socket.
 * Only Metro's explicit EXPO_PUBLIC_HARNESS=Reconnect entry can reach this file.
 * Run on a disposable simulator: seeding deliberately replaces its local fixture.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppearanceProvider } from "../appearance";
import { PairingGate } from "../../App";
import { loadPairing, savePairing, type Pairing } from "../pairing";
import { loadCachedProviders, saveCachedProviders } from "../preferences";
import { Sidebar } from "./Sidebar";

const fixture: Pairing = {
  url: `ws://127.0.0.1:1?token=${"disposable-fixture-".repeat(2)}`,
  label: "offline-fixture",
  remote: false,
  deviceId: "reconnect-fixture",
  key: "00".repeat(32),
};
const providers = [{ id: "echo", name: "Fixture agent", description: "Offline fixture", available: true }];

function Connected(_pairing: Pairing, onUnpair: () => void): ReactNode {
  return <Sidebar open providers={providers} sessions={[]} machineLabel="Offline fixture"
    machineRemote={false} connectionStatus="offline" onUnpair={onUnpair}
    onSelectProvider={() => {}} onOpenSession={() => {}} onOpenActivity={() => {}}
    projects={[]} onNewConversation={() => {}} onSelectProject={() => {}} />;
}

function Fixture(): ReactNode {
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [storage, setStorage] = useState("Not checked");

  async function inspect(): Promise<void> {
    const [pairing, cached] = await Promise.all([loadPairing(), loadCachedProviders()]);
    setStorage(`Pairing: ${pairing ? "stored" : "empty"}; providers: ${cached.length}`);
  }

  async function seed(): Promise<void> {
    setReady(false);
    await Promise.all([savePairing(fixture), saveCachedProviders(providers)]);
    await inspect();
    setGeneration(value => value + 1);
    setReady(true);
  }

  useEffect(() => { void seed(); }, []);

  return <SafeAreaView style={styles.screen}>
    <View style={styles.audit}>
      <Text style={styles.text}>{storage}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Read fixture storage" onPress={() => void inspect()} style={styles.button}>
          <Text style={styles.text}>Read fixture storage</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset offline fixture" onPress={() => void seed()} style={styles.button}>
          <Text style={styles.text}>Reset offline fixture</Text>
        </Pressable>
      </View>
    </View>
    <View style={styles.screen}>
      {ready && <PairingGate key={generation} connected={Connected} />}
    </View>
  </SafeAreaView>;
}

export default function ReconnectHarness(): ReactNode {
  return <AppearanceProvider><GestureHandlerRootView style={styles.screen}>
    <KeyboardProvider><SafeAreaProvider><Fixture /></SafeAreaProvider></KeyboardProvider>
  </GestureHandlerRootView></AppearanceProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101014" },
  audit: { padding: 8, backgroundColor: "#252530" },
  text: { color: "#ffffff", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  button: { padding: 12, minHeight: 44, justifyContent: "center" },
});
