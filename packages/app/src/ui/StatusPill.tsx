/**
 * The one status pill (see `statusPill.ts` for what each status says).
 *
 * Ink and mark: a soft neutral chip, a sentence-case label in ordinary ink,
 * and a 6pt dot carrying the only colour. No outline, no coloured text, no
 * glow. A live state breathes its dot slowly (opacity only, 1.6s); reduced
 * motion holds it still.
 */
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { theme } from "../theme";
import type { Pill, PillTone } from "../statusPill";
import { useReducedMotion } from "./useReducedMotion";
import { usePalette } from "./appearance";
import { themedStyles, type Palette } from "../palette";

const toneFor = themedStyles((palette: Palette): Record<PillTone, string> => ({
  live: palette.color.success,
  accent: palette.color.accent,
  attention: palette.color.attention,
  danger: palette.color.danger,
  quiet: palette.color.textFaint,
}));

function StatusPillView({ pill }: { pill: Pill }) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const TONE = toneFor(palette);
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(1);
  const breathing = pill.pulse === true && !reduceMotion;
  useEffect(() => {
    if (!breathing) {
      cancelAnimation(breath);
      breath.value = 1;
      return;
    }
    breath.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(breath);
  }, [breathing, breath]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <View style={styles.pill} accessible accessibilityLabel={pill.label}>
      <Animated.View style={[styles.dot, { backgroundColor: TONE[pill.tone] }, dotStyle]} />
      <Text style={styles.label} numberOfLines={1}>
        {pill.label}
      </Text>
    </View>
  );
}

const makeStyles = themedStyles((p: Palette) => StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.5),
    paddingHorizontal: theme.space(2),
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    // Raised one step off the drawer and canvas: shape by surface, not outline.
    backgroundColor: p.color.surfaceRaised,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    color: p.color.textDim,
    fontSize: theme.font.tiny,
    fontWeight: "500",
    // Explicit for a padded control (1.27 × 11pt).
    lineHeight: 14,
  },
}));

export const StatusPill = memo(StatusPillView);
