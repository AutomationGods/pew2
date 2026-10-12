/** Fixture-only list interaction checks. Native sheet behavior is checked on-device. */
import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { AppearanceProvider, useAppTheme } from "../appearance";
import { withChoice } from "../configTruth";
import type { ConfigOption } from "../useDaemon";
import { configMenuSections, parseChoiceId } from "./configMenu";
import { ConfigSelectorList } from "./ConfigSelectorList";

const INITIAL: ConfigOption[] = [
  {
    id: "model", name: "Model", category: "model", type: "select", currentValue: "model-0",
    options: Array.from({ length: 80 }, (_, index) => ({
      value: `model-${index}`,
      name: index === 79 ? "Test model 79 with a deliberately long name that must wrap completely" : `Test model ${index}`,
      ...(index === 79 ? { description: "Long descriptions must remain readable without covering the selected-state label." } : {}),
    })),
  },
  {
    id: "thinking", name: "Thinking", category: "thought_level", type: "select", currentValue: "medium",
    options: ["off", "low", "medium", "high"].map((value) => ({ value, name: value })),
  },
];

function Fixture(): React.JSX.Element {
  const { theme, resolvedMode, setMode } = useAppTheme();
  const { height } = useWindowDimensions();
  const [options, setOptions] = useState(INITIAL);
  const [sectionId, setSectionId] = useState<string>();
  const sections = configMenuSections(options);
  const select = (id: string) => {
    const choice = parseChoiceId(id);
    if (choice) setOptions((current) => withChoice(current, choice.configId, choice.value));
  };
  const label = options.map((option) => `${option.name}: ${option.currentValue}`).join("; ");

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.canvas, padding: theme.gutter, paddingTop: 60, gap: 16 }}>
      <Text style={{ color: theme.color.text }}>Model and thinking fixture</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Switch theme" onPress={() => setMode(resolvedMode === "light" ? "dark" : "light")}>
        <Text style={{ color: theme.color.text }}>Switch theme</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setSectionId(undefined)}>
        <Text style={{ color: theme.color.text }}>Back</Text>
      </Pressable>
      <ConfigSelectorList sections={sections} sectionId={sectionId} maxHeight={Math.min(300, height * 0.5)} onSection={setSectionId} onSelect={select} />
      <Text testID="selection-result" style={{ color: theme.color.text }}>{label}</Text>
    </View>
  );
}

export default function ConfigSelectorHarness(): React.JSX.Element {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden, or this harness is running without a native splash.
    });
  }, []);
  return <AppearanceProvider><Fixture /></AppearanceProvider>;
}
