/**
 * The one bottom sheet every modal in this app is made of.
 *
 * Commands, an agent's thinking, an approval request, settings and new chat are
 * all "a titled card arriving from the bottom edge", so they share this chrome
 * exactly: same header, same card styling, same dismissal rules.
 *
 * The sheet itself is the system's (UISheetPresentationController on iOS, via
 * `@lodev09/react-native-true-sheet`). It used to be drawn by hand in
 * Reanimated, and however carefully the springs were tuned it never quite
 * matched the drag, the rubber-banding, the dimming or the keyboard handling
 * every other app on the phone gets from UIKit. The native sheet also sizes
 * itself to its content (`auto`), pads for the home indicator, keeps a focused
 * text field above the keyboard, and respects Reduce Motion, so none of that
 * is reimplemented here.
 *
 * `onClose` is optional on purpose. A sheet the user opened is dismissed by a
 * swipe, a tap on the dimmed background, or the close button; an approval
 * request is *not* — the agent is blocked on an answer, and a stray swipe that
 * dismissed it would strand the turn with no way back.
 *
 * A sheet with steps changes its own title and swaps close for back as it goes.
 * Both cross-fade, because the content underneath them is travelling: a header
 * that cuts while the panes slide is the one part of the movement that gives
 * away there were two cards all along.
 */
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon, type IconName } from "./Icon";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { motion, createMotionEasings } from "../motionTokens";
import { CircleButton } from "./controls";
import { useReducedMotion } from "./useReducedMotion";

const sheetEasings = createMotionEasings(Easing);

/** Rows visible in a list sheet before it scrolls. */
export const SHEET_VISIBLE_ROWS = 5;
export const SHEET_ROW_HEIGHT = 60;
/** The card's height when a sheet is full: five rows. */
export const SHEET_CARD_HEIGHT = SHEET_VISIBLE_ROWS * SHEET_ROW_HEIGHT;

interface SheetProps {
  visible: boolean;
  title: string;
  /** Omitted for a blocking sheet: no close button, and it cannot be swiped away. */
  onClose?: () => void;
  /**
   * Turns the header's close button into a back button, for a sheet that has a
   * second step. Dismissal stays available by swiping, which is how a pushed
   * screen behaves everywhere else on the platform — two buttons in a header
   * this size would crowd the title off centre.
   */
  onBack?: () => void;
  /** Accessible name for the close button. */
  dismissLabel?: string;
  /** Bound long content to the screen while leaving the sheet header visible. */
  scrollContent?: boolean;
  children: ReactNode;
}

/** A sheet that failed to open or close is a bug, never a user action. */
function reportSheetError(error: unknown): void {
  console.error("[pew2] sheet transition failed:", error);
}

function SheetView({ visible, title, onClose, onBack, dismissLabel, scrollContent = false, children }: SheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const sheet = useRef<TrueSheet>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(theme.size.chip + theme.space(6));
  // Reserve the measured header, body padding and space above the native sheet.
  // Recomputed on rotation; measuring the header also accounts for text scaling.
  const contentHeight = Math.max(1, height - insets.top - insets.bottom - headerHeight - theme.space(8));

  // Native callbacks arrive after the render that caused them, so they read
  // the latest intent from refs rather than from a stale closure.
  //
  // `wanted`: what the parent last asked for. `open`: a present() has been
  // issued and no dismissal has finished since. `closing`: the dismissal in
  // flight was ours, so it must not be reported back as the user's.
  const wanted = useRef(visible);
  const open = useRef(false);
  const closing = useRef(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  const present = useCallback(() => {
    const current = sheet.current;
    if (!current || open.current) return;
    open.current = true;
    // Sheets open from the composer, and the keyboard would otherwise sit over
    // the bottom of the card. A field inside the sheet brings it back, and the
    // native sheet then keeps that field above it.
    Keyboard.dismiss();
    current.present().catch(reportSheetError);
  }, []);

  const dismiss = useCallback(() => {
    const current = sheet.current;
    // Never dismiss a sheet that was never presented: its native view is
    // lazily created, and asking for it before it exists throws.
    if (!current || !open.current || closing.current) return;
    closing.current = true;
    current.dismiss().catch(reportSheetError);
  }, []);

  useEffect(() => {
    wanted.current = visible;
    if (visible) present();
    else dismiss();
  }, [visible, present, dismiss]);

  // Closed by the parent while still arriving. UIKit ignores a dismissal
  // issued mid-presentation, so the one already sent is treated as lost and
  // sent again: a blocking sheet left on screen could never be swiped off.
  const handleDidPresent = useCallback(() => {
    if (wanted.current) return;
    closing.current = false;
    dismiss();
  }, [dismiss]);

  const handleDidDismiss = useCallback(() => {
    open.current = false;
    const ours = closing.current;
    closing.current = false;
    if (!ours) {
      // Swiped away or tapped off: the parent still thinks it is open.
      close.current?.();
      return;
    }
    // Reopened while it was leaving. Deferred a frame: the library unmounts its
    // native view just before this callback, and presenting into that render
    // would look the view up after it is gone and report a failed open.
    if (wanted.current) {
      requestAnimationFrame(() => {
        if (wanted.current) present();
      });
    }
  }, [present]);

  const dismissible = onClose !== undefined;

  return (
    <TrueSheet
      ref={sheet}
      detents={["auto"]}
      dismissible={dismissible}
      draggable={dismissible}
      grabber={dismissible}
      backgroundColor={theme.color.canvas}
      onDidPresent={handleDidPresent}
      onDidDismiss={handleDidDismiss}
    >
      <View style={styles.body}>
        <View style={styles.header} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
          {/* Keyed, and that is what makes the fade happen at all: both
              branches render a CircleButton at the same position, so without
              distinct keys React reconciles one instance, the icon never
              remounts, and the swap hard-cuts. */}
          {onBack ? (
            <CircleButton key="back" label="Back" onPress={onBack} size={theme.size.chip}>
              <CrossfadeIcon name="chevron-back" />
            </CircleButton>
          ) : onClose ? (
            <CircleButton
              key="close"
              label={dismissLabel ?? `Close ${title}`}
              onPress={onClose}
              size={theme.size.chip}
            >
              <CrossfadeIcon name="close" />
            </CircleButton>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <CrossfadeTitle title={title} />
          {/* Balances the close button so the title stays optically centred. */}
          <View style={styles.headerSpacer} />
        </View>

        {scrollContent ? (
          <ScrollView
            style={{ maxHeight: contentHeight }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : children}
      </View>
    </TrueSheet>
  );
}

/**
 * The title, re-fading whenever the words change.
 *
 * Out then in, rather than two copies dissolving into each other: a title is
 * centred, so two of different widths overlapping mid-fade read as a smear. The
 * swap happens at zero opacity, and the pane travelling underneath is what
 * carries the sense of direction.
 */
function CrossfadeTitle({ title }: { title: string }) {
  const styles = useThemeStyles(makeStyles);

  const reduceMotion = useReducedMotion();
  const shown = useRef(title);
  const fade = useSharedValue(1);
  const [rendered, setRendered] = useState(title);

  useEffect(() => {
    // Settle first: an unchanged title must not hide a preference update.
    if (reduceMotion) {
      cancelAnimation(fade);
      fade.value = 1;
      shown.current = title;
      setRendered(title);
      return;
    }
    if (title === shown.current) return;
    shown.current = title;
    let current = true;
    const commitTitle = () => { if (current) setRendered(title); };
    // The swap happens inside the animation's own completion, on the UI thread,
    // so the words change at exactly zero opacity rather than on whichever
    // frame a JS timer happened to land on.
    fade.value = withTiming(0, { duration: motion.titleOut, easing: sheetEasings.inOutQuad }, (finished) => {
      "worklet";
      // A second change interrupts the first: an interrupted timing reports
      // unfinished, and the newer effect owns the swap. Without this guard the
      // stale title would be committed on top of it.
      if (!finished) return;
      runOnJS(commitTitle)();
      fade.value = withTiming(1, { duration: motion.titleIn, easing: sheetEasings.inOutQuad });
    });
    return () => {
      current = false;
      cancelAnimation(fade);
    };
  }, [title, reduceMotion, fade]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.Text style={[styles.title, style]} numberOfLines={1} accessibilityRole="header">
      {rendered}
    </Animated.Text>
  );
}

/**
 * The header glyph, fading in when it is swapped for a different one.
 *
 * Remounted by the keys on the buttons above, so this only ever plays the
 * arrival — the half that matters when close becomes back.
 */
function CrossfadeIcon({ name }: { name: IconName }) {
  const { theme } = useAppTheme();

  return (
    <Animated.View entering={FadeIn.duration(motion.iconEnter).easing(sheetEasings.inOutQuad)}>
      <Icon name={name} size={18} color={theme.color.text} />
    </Animated.View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // The home indicator's clearance comes from the native sheet itself
    // (`insetAdjustment` defaults to automatic), so only breathing room here.
    body: {
      paddingHorizontal: theme.space(3),
      paddingTop: theme.space(2),
      paddingBottom: theme.space(3),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.space(3),
    },
    headerSpacer: { width: theme.size.chip },
    title: {
      flexShrink: 1,
      color: theme.color.text,
      fontSize: theme.font.title,
      fontWeight: "600",
    },
  });
}

/** The card the sheet's content sits in: one rounded, clipped raised surface. */
export function sheetCardStyle(theme: AppTheme) {
  return {
    backgroundColor: theme.color.groupedSurface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
    overflow: "hidden" as const,
  };
}

export const Sheet = memo(SheetView);
