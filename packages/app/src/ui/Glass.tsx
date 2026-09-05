import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useAppTheme } from "../appearance";
import { useReduceTransparency } from "./accessibilityState";

interface GlassProps {
  children: ReactNode;
  radius: number;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  interactive?: boolean;
  tier?: "control" | "raised";
}

/** Tonal by default; blur is reserved for overlays above scrolling content. */
export function Glass({ children, radius, style, intensity, tier = "control" }: GlassProps) {
  const { theme } = useAppTheme();
  const reduceTransparency = useReduceTransparency();
  const { fill, rim } = theme.glass[tier];
  return (
    <View style={[styles.surface, { borderRadius: radius, borderColor: rim, backgroundColor: fill }, style]}>
      {tier === "raised" && !reduceTransparency && (
        <BlurView
          intensity={intensity ?? theme.glass.intensity}
          tint={theme.mode}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});
