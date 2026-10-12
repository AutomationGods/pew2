import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import type { ConfigMenuSection } from "./configMenu";
import { Icon } from "./Icon";

interface ConfigSelectorListProps {
  sections: readonly ConfigMenuSection[];
  sectionId: string | undefined;
  maxHeight: number;
  onSection: (id: string) => void;
  onSelect: (id: string) => void;
}

/** Shared content for the native sheet and its interaction harness. */
export function ConfigSelectorList({
  sections, sectionId, maxHeight, onSection, onSelect,
}: ConfigSelectorListProps): React.JSX.Element {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const section = sections.find((entry) => entry.id === sectionId);

  return (
    <ScrollView
      key={section?.id ?? "sections"}
      style={{ maxHeight, flexGrow: 0 }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      contentContainerStyle={styles.content}
    >
      {section ? section.choices.map((choice) => (
        <Pressable
          key={choice.id}
          accessibilityRole="button"
          accessibilityLabel={choice.title}
          accessibilityHint={choice.subtitle}
          accessibilityState={{ selected: choice.selected }}
          onPress={() => onSelect(choice.id)}
          style={({ pressed }) => [
            styles.row,
            choice.selected && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.text}>
            <Text style={[styles.title, choice.selected && styles.selectedTitle]}>
              {choice.title}
            </Text>
            {choice.subtitle ? <Text style={styles.detail}>{choice.subtitle}</Text> : null}
          </View>
          {choice.selected ? <Text style={styles.current}>Current</Text> : null}
        </Pressable>
      )) : sections.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          accessibilityValue={{ text: entry.choices.find((choice) => choice.selected)?.title ?? "Not selected" }}
          onPress={() => onSection(entry.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.text}>
            <Text style={styles.title}>{entry.title}</Text>
            <Text style={styles.detail}>
              {entry.choices.find((choice) => choice.selected)?.title ?? "Not selected"}
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color={theme.color.textDim} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { gap: theme.space(1) },
    row: {
      minHeight: theme.size.touch + theme.space(4),
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space(3),
      paddingVertical: theme.space(3),
      paddingHorizontal: theme.space(4),
      borderRadius: theme.radius.sm,
      backgroundColor: theme.color.groupedSurface,
    },
    selected: { backgroundColor: theme.color.selectedRow },
    pressed: { backgroundColor: theme.color.surfacePressed },
    text: { flex: 1, minWidth: 0, gap: theme.space(1) },
    title: { color: theme.color.text, fontSize: theme.font.body, lineHeight: theme.line.body },
    selectedTitle: { fontWeight: "600" },
    detail: { color: theme.color.textDim, fontSize: theme.font.small },
    current: { color: theme.color.text, fontSize: theme.font.small, fontWeight: "600" },
  });
}
