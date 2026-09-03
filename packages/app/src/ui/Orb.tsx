import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";

interface OrbProps {
  color?: string;
  size?: number;
  /** Adds a visible status ring while the agent is working. */
  busy?: boolean;
}

function OrbView({ color, size, busy = false }: OrbProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const resolvedSize = size ?? theme.size.orb;
  const resolvedColor = color ?? theme.color.orb;
  const inset = Math.max(4, Math.round(resolvedSize * 0.18));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.mark,
        {
          width: resolvedSize,
          height: resolvedSize,
          borderRadius: resolvedSize / 2,
          borderColor: busy ? resolvedColor : theme.color.borderStrong,
        },
      ]}
    >
      <View
        style={{
          position: "absolute",
          top: inset,
          right: inset,
          bottom: inset,
          left: inset,
          borderRadius: resolvedSize / 2,
          backgroundColor: resolvedColor,
        }}
      />
      {busy ? <View style={[styles.status, { backgroundColor: resolvedColor }]} /> : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    mark: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceRaised,
      borderWidth: 1.5,
    },
    status: {
      position: "absolute",
      right: 1,
      bottom: 1,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.color.surface,
    },
  });
}

export const Orb = memo(OrbView);
