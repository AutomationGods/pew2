/**
 * One row of an inset grouped list that opens a system menu: a caption, the
 * current value, and the up-and-down chevron iOS uses for a pop-up button.
 *
 * The drawer stacks two of these (agent, then project) in one grouped block,
 * so choosing what the conversation list shows is a single tidy control rather
 * than a strip of chips beside a form field.
 */
import { memo } from "react";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { Icon } from "./Icon";
import { NativeMenu, type NativeMenuChoice } from "./NativeMenu";

interface MenuRowProps {
  caption: string;
  value: string;
  choices: readonly NativeMenuChoice[];
  onSelect: (choiceId: string) => void;
  accessibilityHint: string;
  /**
   * A small colour dot before the value, such as the agent's own colour. On
   * the value side, not the caption's, so every caption in the group starts
   * on one edge whether or not its row has a mark.
   */
  valueMarker?: ColorValue;
  /** Draws the hairline above it, for every row after the first. */
  divided?: boolean;
}

function MenuRowView({
  caption,
  value,
  choices,
  onSelect,
  accessibilityHint,
  valueMarker,
  divided = false,
}: MenuRowProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  return (
    <NativeMenu
      style={divided ? styles.divided : undefined}
      sections={[{ id: caption, title: caption, choices: [...choices] }]}
      onSelect={onSelect}
      title={caption}
      accessibilityLabel={`${caption}: ${value}`}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.row}>
        <Text style={styles.caption}>{caption}</Text>
        <View style={styles.valueGroup}>
          {valueMarker ? <View style={[styles.marker, { backgroundColor: valueMarker }]} /> : null}
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <Icon name="chevron-expand" size={14} color={theme.color.textFaint} weight="semibold" />
      </View>
    </NativeMenu>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      minHeight: theme.size.touch,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space(2),
      paddingHorizontal: theme.space(3),
    },
    divided: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.separator,
    },
    caption: { color: theme.color.text, fontSize: theme.font.body },
    // Right-aligned and dimmer, as a value is in Settings: the caption names
    // the row, the value is what it is set to.
    valueGroup: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.space(2),
    },
    marker: { width: 8, height: 8, borderRadius: 4 },
    value: {
      flexShrink: 1,
      color: theme.color.textDim,
      fontSize: theme.font.body,
    },
  });
}

export const MenuRow = memo(MenuRowView);
