/**
 * Theme-aware opaque cover for the navigation and composer rails.
 *
 * Deliberately not blurred: these full-width surfaces stay mounted while the
 * transcript scrolls, so an opaque canvas is clearer and cheaper to render.
 */
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../appearance";

interface CanvasCoverProps {
  /** Exactly the zone to cover. Nothing beyond it is touched. */
  height: number;
  /** Which screen edge the cover is attached to. */
  edge?: "top" | "bottom";
  style?: object;
}

function CanvasCoverView({ height, edge = "top", style }: CanvasCoverProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.container,
        edge === "top" ? styles.top : styles.bottom,
        { height, backgroundColor: theme.color.canvas },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

// Memoized: both rails live in the root screen, which re-renders on every
// keystroke, and neither cover depends on anything that changes when it does.
// Callers pass `StyleSheet` references rather than inline objects, so the
// shallow comparison actually holds.
export const CanvasCover = memo(CanvasCoverView);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
