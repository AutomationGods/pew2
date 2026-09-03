import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import type { AccentName, AppearanceMode } from "../appearancePreference";
import { ACCENT_NAMES, APPEARANCE_MODES } from "../appearancePreference";
import { Glass } from "./Glass";
import { Sheet } from "./Sheet";
import { haptics } from "./haptics";

interface AppearanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MODE_LABELS: Record<AppearanceMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const ACCENT_LABELS: Record<AccentName, string> = {
  coral: "Coral",
  ocean: "Ocean",
  violet: "Violet",
  mint: "Mint",
};

function AppearanceSheetView({ visible, onClose }: AppearanceSheetProps) {
  const { preference, theme, setMode, setAccent } = useAppTheme();
  const styles = useThemeStyles(makeStyles);

  const handleMode = useCallback(
    (mode: AppearanceMode) => {
      haptics.tap();
      setMode(mode);
    },
    [setMode],
  );

  const handleAccent = useCallback(
    (accent: AccentName) => {
      haptics.tap();
      setAccent(accent);
    },
    [setAccent],
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Appearance">
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Mode</Text>
        <View style={styles.modeRow}>
          {APPEARANCE_MODES.map((mode) => {
            const selected = preference.mode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={`Use ${MODE_LABELS[mode]} mode`}
                accessibilityState={{ selected }}
                onPress={() => handleMode(mode)}
                style={({ pressed }) => [
                  styles.modeChip,
                  selected && styles.modeChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={mode === "system" ? "phone-portrait" : mode === "light" ? "sunny" : "moon"}
                  size={16}
                  color={selected ? theme.color.accentText : theme.color.textDim}
                />
                <Text
                  style={[
                    styles.modeLabel,
                    selected && styles.modeLabelSelected,
                  ]}
                >
                  {MODE_LABELS[mode]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Accent</Text>
        <View style={styles.accentRow}>
          {ACCENT_NAMES.map((accent) => {
            const selected = preference.accent === accent;
            const accentTheme = ACCENT_PREVIEW[accent][theme.mode];
            return (
              <Pressable
                key={accent}
                accessibilityRole="button"
                accessibilityLabel={`Use ${ACCENT_LABELS[accent]} accent`}
                accessibilityState={{ selected }}
                onPress={() => handleAccent(accent)}
                style={({ pressed }) => [
                  styles.swatch,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.swatchCircle,
                    { backgroundColor: accentTheme.fill },
                    selected && styles.swatchSelected,
                  ]}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={16} color={accentTheme.text} />
                  )}
                </View>
                <Text
                  style={[
                    styles.swatchLabel,
                    selected && { color: theme.color.text },
                  ]}
                >
                  {ACCENT_LABELS[accent]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

/** Accent preview colors for the swatch circles. */
const ACCENT_PREVIEW = {
  coral: {
    light: { fill: "#a94325", text: "#ffffff" },
    dark: { fill: "#e87854", text: "#17110f" },
  },
  ocean: {
    light: { fill: "#036a9b", text: "#ffffff" },
    dark: { fill: "#38bdf8", text: "#082f49" },
  },
  violet: {
    light: { fill: "#6d28d9", text: "#ffffff" },
    dark: { fill: "#a78bfa", text: "#201238" },
  },
  mint: {
    light: { fill: "#087a5b", text: "#ffffff" },
    dark: { fill: "#34d399", text: "#072c22" },
  },
} as const;

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      paddingHorizontal: theme.space(4),
      paddingTop: theme.space(3),
      paddingBottom: theme.space(4),
    },
    sectionLabel: {
      color: theme.color.textDim,
      fontSize: theme.font.small,
      marginBottom: theme.space(2),
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modeRow: {
      flexDirection: "row",
      gap: theme.space(2),
    },
    modeChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space(1.5),
      paddingVertical: theme.space(2.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.border,
    },
    modeChipSelected: {
      backgroundColor: theme.color.accentSoft,
      borderColor: theme.color.accent,
    },
    modeLabel: {
      color: theme.color.textDim,
      fontSize: theme.font.small,
      fontWeight: "500",
    },
    modeLabelSelected: {
      color: theme.color.text,
    },
    accentRow: {
      flexDirection: "row",
      gap: theme.space(3),
    },
    swatch: {
      alignItems: "center",
      gap: theme.space(1),
    },
    swatchCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchSelected: {
      borderColor: theme.color.text,
    },
    swatchLabel: {
      color: theme.color.textFaint,
      fontSize: theme.font.tiny,
    },
    pressed: { opacity: 0.7 },
  });
}

export const AppearanceSheet = memo(AppearanceSheetView);
