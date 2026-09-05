/**
 * First launch.
 *
 * One mark, one action. Nothing here explains ACP, providers or sessions,
 * because none of it is true yet: until a machine is connected the app has
 * nothing to show and exactly one useful thing to do.
 *
 * The mark is centred and the action sits within thumb reach, so the screen
 * reads top-down and is operable one-handed on a large phone.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { haptics } from "./haptics";
import { Logo } from "./Logo";
import { Glass } from "./Glass";

interface Props {
  onConnect: () => void;
}

export function LaunchScreen({ onConnect }: Props) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Fills the whole screen so the mark is centred on the display, not in
          the space left over above the button. */}
      <View style={styles.centre} pointerEvents="none">
        <Logo />
      </View>

      <View
        style={[
          styles.actions,
          { paddingBottom: insets.bottom + theme.space(8) },
        ]}
      >
        {/*
          The only glowing element on the screen, because it is the only
          action. A second halo would leave neither reading as primary, which
          is how a glow treatment stops meaning anything at all.
        */}
        {/*
          The halo lives on a wrapper, not on the glass itself. Every glass
          surface sets `overflow: hidden` so its rim and its clip are one
          rounded path, and a clipped view cannot cast a shadow — put `glow` on
          the Glass and it silently renders nothing at all.
        */}
        <View style={styles.glow}>
        <Glass radius={theme.radius.lg} tier="raised" interactive>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => {
              haptics.tap();
              onConnect();
            }}
            accessibilityRole="button"
            accessibilityLabel="Connect your device"
          >
            <Text style={styles.buttonText}>Connect your device</Text>
          </Pressable>
        </Glass>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  centre: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pushed to the bottom by the flex root, and drawn after the mark so the
  // button stays tappable despite the overlay above it.
  actions: { marginTop: "auto", paddingHorizontal: theme.gutter },
  button: {
    paddingVertical: theme.space(4),
    alignItems: "center",
    justifyContent: "center",
    // Comfortably above the 44pt minimum target.
    minHeight: 56,
  },
  // The wrapper must carry the same radius, or the shadow is cast by a square.
  glow: { borderRadius: theme.radius.lg },
  buttonPressed: { backgroundColor: theme.glass.fillPressed },
  buttonText: { color: theme.color.accent, fontSize: theme.font.title, fontWeight: "600" },
  });
}
;
