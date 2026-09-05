/**
 * The pew2 mark: an aperture.
 *
 * A broken ring around a lit core. The reading is the product — a lens held
 * open on a machine somewhere else, with the agent burning at the centre of it
 * — and the two gaps are what stop it from being a loading spinner: a spinner's
 * arc is asymmetric and unclosed, while this is a symmetric iris caught open.
 *
 * It replaces a dot-matrix `P2`. That mark was a wordmark pretending to be a
 * glyph, and at home-screen size the two characters collapsed into a bright bar
 * with texture. A single closed shape survives being 40pt on a dark wallpaper,
 * which is the only size that actually decides whether an icon is any good.
 *
 * Built from plain views rather than SVG on purpose: this app has no SVG
 * renderer, and adding one to draw two arcs and a circle would put a native
 * dependency behind the launch screen — the one place in the app where a
 * failure to render is indistinguishable from a failure to launch.
 */
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme, useThemeStyles } from "../appearance";
import { shade, type AppTheme } from "../theme";

interface LogoProps {
  /** Diameter of the aperture. The wordmark scales with it. */
  size?: number;
}

/**
 * Where the ring is cut.
 *
 * Two gaps rather than four: at four the remaining segments are shorter than
 * the gaps between them and the ring stops reading as a circle at all. They sit
 * on the diagonal so neither cut lands on the vertical or horizontal axis,
 * where the eye is most sensitive to a shape being not-quite-round.
 */
const GAP_ROTATION = "-45deg";

export function Logo({ size = 72 }: LogoProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const ring = Math.max(2, Math.round(size * 0.055));
  const core = Math.round(size * 0.42);

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="image"
      accessibilityLabel="pew2"
    >
      <View style={[styles.aperture, { width: size, height: size }]}>
        {/*
         * The arcs. `borderColor` cannot take a gradient and a border cannot be
         * dashed into even segments, so the gaps are cut the way every arc in
         * React Native is cut: a full ring with two of its four quadrant
         * borders made transparent, then rotated off-axis.
         */}
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: ring,
              borderColor: theme.color.accent,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              transform: [{ rotate: GAP_ROTATION }],
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: size * 0.78,
              height: size * 0.78,
              borderRadius: size / 2,
              borderWidth: Math.max(1, Math.round(ring / 2)),
              borderColor: theme.color.accent,
              opacity: 0.4,
            },
          ]}
        />
        <View style={[styles.core, { width: core, height: core, borderRadius: core / 2 }]}>
          <LinearGradient
            // Darkened hard, because `thought` is chosen to be *read* against
            // the page: at its own lightness the gradient runs cyan to lilac,
            // two pale colours, and the core comes out as a grey pebble. The
            // far end has to be genuinely deep or there is nothing for the lit
            // end to fall off *to*, which is the whole illusion of a sphere.
            colors={[theme.color.accent, shade(theme.color.thought, -0.55)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
      <Text
        style={[styles.word, { fontSize: size * 0.36, letterSpacing: size * 0.06 }]}
        // The mark is already labelled, so the text must not be read twice.
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        pew2
      </Text>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: { alignItems: "center", gap: theme.space(5) },
    aperture: { alignItems: "center", justifyContent: "center" },
    ring: { position: "absolute" },
    core: { overflow: "hidden" },
    word: {
      color: theme.color.text,
      fontFamily: theme.display.semibold,
    },
  });
}
