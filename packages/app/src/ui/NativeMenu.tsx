/**
 * A control that opens the system menu: UIMenu on iOS, a popup menu on Android.
 *
 * Replaces the hand-built dropdowns (a scrim, a glass card, scale-in animation,
 * manual viewport clamping) with the menu every other app on the phone uses, so
 * it is positioned, animated, scrolled and read by VoiceOver the way iOS users
 * already expect. It leaves the keyboard alone, as the old ones did on purpose:
 * changing a model mid-sentence must not drop the draft.
 *
 * The library lays an invisible system button over `children`, so the wrapped
 * view must not be a Pressable (it would claim the touch first). That button
 * has no label of its own, so VoiceOver gets one element from the wrapper
 * below; activating it lands a tap on the button's centre, which opens the menu.
 */
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import { memo, useCallback, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "../appearance";
import { haptics } from "./haptics";

export interface NativeMenuChoice {
  id: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  /** Shown greyed out and cannot be picked. */
  disabled?: boolean;
  /** iOS: an SF Symbol name drawn beside the title. */
  image?: string;
}

export interface NativeMenuSection {
  id: string;
  /** Shown as a small header above the section's rows. */
  title: string;
  choices: NativeMenuChoice[];
}

interface NativeMenuProps {
  sections: readonly NativeMenuSection[];
  onSelect: (choiceId: string) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Heading over the whole menu. */
  title?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

function toAction(choice: NativeMenuChoice): MenuAction {
  return {
    id: choice.id,
    title: choice.title,
    ...(choice.subtitle ? { subtitle: choice.subtitle } : {}),
    ...(choice.image ? { image: choice.image } : {}),
    ...(choice.disabled ? { attributes: { disabled: true } } : {}),
    state: choice.selected ? "on" : "off",
  };
}

/** One inline group per section, as Notes and Files do, so nothing hides in a submenu. */
function toActions(sections: readonly NativeMenuSection[]): MenuAction[] {
  if (sections.length === 1) return (sections[0]?.choices ?? []).map(toAction);
  return sections.map((section) => ({
    id: `section:${section.id}`,
    title: section.title,
    displayInline: true,
    subactions: section.choices.map(toAction),
  }));
}

function NativeMenuView({
  sections,
  onSelect,
  accessibilityLabel,
  accessibilityHint,
  title,
  style,
  children,
}: NativeMenuProps) {
  const { resolvedMode } = useAppTheme();

  const handleAction = useCallback(
    ({ nativeEvent }: { nativeEvent: { event: string } }) => {
      // Selection, not impact: a value changing in a list, the same gesture
      // family as a picker wheel.
      haptics.select();
      onSelect(nativeEvent.event);
    },
    [onSelect],
  );

  return (
    <View
      style={style}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <MenuView
        style={styles.fill}
        title={title}
        actions={toActions(sections)}
        onPressAction={handleAction}
        // Follows the app's own appearance setting, which can differ from the
        // phone's, rather than the system default.
        themeVariant={resolvedMode}
        shouldOpenOnLongPress={false}
      >
        {children}
      </MenuView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignSelf: "stretch" },
});

export const NativeMenu = memo(NativeMenuView);
