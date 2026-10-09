/**
 * Shared control primitives.
 *
 * Shared shapes keep press feedback, radii, touch targets and disabled
 * treatment consistent instead of restyling them per screen.
 *
 * That includes touch feedback: because every button routes through here, a tap
 * feels the same app-wide without a single call site opting in.
 */
import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
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
          themed.solid,
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
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={touchSlop(resolvedSize, theme.size.touch)}
      style={({ pressed }) => [
        themed.circle,
        themed.control,
        { width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2 },
        pressed && !disabled && themed.pressed,
        disabled && themed.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

interface BarButtonProps {
  onPress: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * Navigation-bar icon button: no fill, no outline, as UIKit draws a bar button.
 *
 * A filled disc per control turned the bar into a row of floating bubbles; on
 * iOS a bar button is the glyph alone, and the press is the feedback. The box
 * is still the full touch target, so nothing gets harder to hit.
 */
export function BarButton({ onPress, label, children, disabled = false }: BarButtonProps): React.JSX.Element {
  const styles = useThemeStyles(makeStyles);
  return (
    <Pressable
      onPress={withHaptic(onPress)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.circle,
        styles.bar,
        pressed && !disabled && styles.barPressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  control: {
    backgroundColor: theme.color.controlFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
  },
  solid: {},
  bar: { width: theme.size.touch, height: theme.size.touch },
  barPressed: { opacity: 0.4 },
  pressed: {
    backgroundColor: theme.color.surfacePressed,
    opacity: 0.72,
  },
  disabled: { opacity: 0.4 },
  });
}
