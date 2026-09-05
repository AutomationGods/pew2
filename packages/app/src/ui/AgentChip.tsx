import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { haptics } from "./haptics";
import type { Provider } from "../useDaemon";

interface AgentChipProps { provider: Provider; selected: boolean; onPress: (providerId: string) => void; }

function AgentChipView({ provider, selected, onPress }: AgentChipProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const enabled = provider.available;
  return (
    <Pressable
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={enabled ? provider.name : `${provider.name}, unavailable. ${provider.unavailableReason ?? ""}`}
      accessibilityState={{ selected, disabled: !enabled }}
      onPress={() => { haptics.select(); onPress(provider.id); }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && enabled && styles.pressed, !enabled && styles.disabled]}
    >
      <View style={[styles.marker, { backgroundColor: provider.color ?? theme.color.textFaint }]} />
      <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1}>{provider.name}</Text>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: { minHeight: theme.size.touch, maxWidth: 180, flexDirection: "row", alignItems: "center", gap: theme.space(2), paddingHorizontal: theme.space(3), borderRadius: theme.radius.pill, backgroundColor: theme.color.controlFill, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
    selected: { backgroundColor: theme.color.selectedRow, borderColor: theme.color.borderStrong },
    pressed: { backgroundColor: theme.color.surfacePressed }, disabled: { opacity: 0.45 },
    marker: { width: 8, height: 8, borderRadius: 4 },
    label: { color: theme.color.textDim, fontSize: theme.font.small, fontWeight: "600", flexShrink: 1 },
    selectedLabel: { color: theme.color.text },
  });
}

export const AgentChip = memo(AgentChipView, (before, after) =>
  before.selected === after.selected && before.provider.id === after.provider.id && before.provider.name === after.provider.name && before.provider.color === after.provider.color && before.provider.available === after.provider.available && before.onPress === after.onPress,
);
