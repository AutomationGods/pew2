/**
 * Shared control primitives.
 *
 * Every interactive surface in the app is one of these three shapes, so press
 * feedback, radii, touch targets and disabled treatment stay identical
 * everywhere rather than being re-styled per screen.
 *
 * That includes touch feedback: because every button routes through here, a tap
 * feels the same app-wide without a single call site opting in.
 */
import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { Glass } from "./Glass";
import { haptics } from "./haptics";

/**
 * Wrap a press handler so it pulses first.
 *
 * `feel` lets a control say what its press means — sending is not the same
 * event as opening a menu — while defaulting to the ordinary tap.
 */
function withHaptic(onPress: () => void, feel: () => void = haptics.tap) {
  return () => {
    feel();
    onPress();
  };
}

/** Expands a sub-44pt control to the platform minimum touch target. */
export function touchSlop(size: number, touchMin = 44) {
  const slop = Math.max(0, (touchMin - size) / 2);
  return { top: slop, bottom: slop, left: slop, right: slop };
}

interface CircleButtonProps {
  onPress: () => void;
  label: string;
  children: ReactNode;
  size?: number;
  disabled?: boolean;
  tint?: string;
  style?: ViewStyle;
  /** Override the press sensation, for controls that commit rather than open. */
  feel?: () => void;
}

/** Round icon button: menu, send, composer actions. */
export function CircleButton({
  onPress,
  label,
  children,
  size,
  disabled = false,
  tint,
  style,
  feel,
}: CircleButtonProps) {
  const { theme } = useAppTheme();
  const themed = useMemo(() => makeStyles(theme), [theme]);
  const resolvedSize = size ?? theme.size.control;
  const press = withHaptic(onPress, feel);

  // A solid tint opts out of glass: used where a control must read as filled.
  if (tint) {
    return (
      <Pressable
        onPress={press}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={touchSlop(resolvedSize, theme.size.touch)}
        style={({ pressed }) => [
          themed.circle,
          { width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2, backgroundColor: tint },
          pressed && !disabled && themed.pressed,
          disabled && themed.disabled,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Glass radius={resolvedSize / 2} interactive style={[{ width: resolvedSize, height: resolvedSize }, style]}>
      <Pressable
        onPress={press}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={touchSlop(resolvedSize, theme.size.touch)}
        style={({ pressed }) => [
          themed.circle,
          { width: resolvedSize, height: resolvedSize },
          pressed && !disabled && themed.pressedOverlay,
          disabled && themed.disabled,
        ]}
      >
        {children}
      </Pressable>
    </Glass>
  );
}

interface PillProps {
  onPress?: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  /** Override the press sensation. */
  feel?: () => void;
}

/** Horizontal pill: the provider selector and the quick-action chips. */
export function Pill({ onPress, label, children, disabled = false, feel }: PillProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const content = <View style={styles.pillRow}>{children}</View>;

  if (!onPress) {
    return (
      <Glass radius={theme.radius.pill} style={styles.pillGlass}>
        <View style={styles.pill} accessibilityLabel={label}>
          {content}
        </View>
      </Glass>
    );
  }

  return (
    <Glass radius={theme.radius.pill} interactive style={styles.pillGlass}>
      <Pressable
        onPress={withHaptic(onPress, feel)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.pill,
          pressed && !disabled && styles.pressedOverlay,
          disabled && styles.disabled,
        ]}
      >
        {content}
      </Pressable>
    </Glass>
  );
}

/** Small muted caption used inside pills and rows. */
export function Caption({ children }: { children: ReactNode }) {
  const styles = useThemeStyles(makeStyles);
  return <Text style={styles.caption}>{children}</Text>;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  // A pill in a crowded row must be able to give up width, and every layer down
  // to the label needs to say so — one rigid ancestor and the text below it can
  // never truncate, so the pill overflows the row instead.
  pillGlass: { flexShrink: 1, minWidth: 0 },
  pill: {
    height: theme.size.control,
    paddingHorizontal: theme.space(4),
    justifyContent: "center",
    flexShrink: 1,
    minWidth: 0,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.5),
    flexShrink: 1,
    minWidth: 0,
  },
  pressed: { backgroundColor: theme.color.surfacePressed },
  // On glass, press brightens the surface rather than replacing its colour.
  pressedOverlay: { backgroundColor: theme.glass.fillPressed },
  disabled: { opacity: 0.4 },
  caption: { color: theme.color.textDim, fontSize: theme.font.small },
  });
}
