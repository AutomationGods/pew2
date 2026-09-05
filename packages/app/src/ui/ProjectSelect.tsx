import { memo } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { haptics } from "./haptics";
import { projectLabel, type Project } from "../projects";

interface ProjectSelectProps { selected?: Project; count: number; open: boolean; onToggle: () => void; onLayout?: (event: LayoutChangeEvent) => void; }

function ProjectSelectView({ selected, count, open, onToggle, onLayout }: ProjectSelectProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  if (count === 0) return null;
  return (
    <View style={styles.host} onLayout={onLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Project: ${projectLabel(selected)}`}
        accessibilityHint="Choose which project to show conversations from and start new ones in"
        accessibilityState={{ expanded: open }}
        onPress={() => { haptics.tap(); onToggle(); }}
        style={({ pressed }) => [styles.control, pressed && styles.pressed]}
      >
        <Ionicons name="folder-outline" size={18} color={theme.color.textDim} />
        <View style={styles.copy}>
          <Text style={styles.caption}>Project</Text>
          <Text style={[styles.label, !selected && styles.labelAll]} numberOfLines={1}>{projectLabel(selected)}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.color.textDim} />
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    host: { marginHorizontal: theme.gutter, marginTop: theme.sectionGap },
    control: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: theme.space(3), paddingHorizontal: theme.space(3), paddingVertical: theme.space(2), borderRadius: theme.radius.md, backgroundColor: theme.color.groupedSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.separator },
    copy: { flex: 1, minWidth: 0 },
    caption: { color: theme.color.textFaint, fontSize: theme.font.tiny, marginBottom: 1 },
    label: { color: theme.color.text, fontSize: theme.font.small },
    labelAll: { color: theme.color.textDim },
    pressed: { backgroundColor: theme.color.surfacePressed },
  });
}
export const ProjectSelect = memo(ProjectSelectView);
