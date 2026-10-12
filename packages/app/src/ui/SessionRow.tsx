/**
 * One conversation in the sidebar drawer: its title, when it last moved, and
 * whether it is working or came back while you were away.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useThemeStyles } from "../appearance";
import { motion, nativeMotionEasings } from "../theme";
import { formatHistoryMetadata } from "../historyMetadata";
import type { Session } from "../useDaemon";
import { makeStyles } from "./sidebarStyles";

const MAX_STAGGERED_ROWS = 14;
const ROW_STAGGER_MS = motion.rowStagger;
const ROW_REVEAL_MS = motion.rowReveal;

/**
 * The dot beside a conversation title: working, or finished while you were
 * away.
 *
 * Two states rather than one because they ask for opposite things. A pulsing
 * dot says "still going, nothing to do"; a solid one says "this came back, go
 * read it". Both are on the row you would tap anyway, so noticing and acting
 * are the same gesture.
 */
function SessionStatus({
  busy,
  unread,
  reduceMotion,
  paused,
}: {
  busy: boolean;
  unread: boolean;
  reduceMotion: boolean;
  /**
   * The drawer is shut, or the app is not on screen. Rows stay mounted through
   * both, so without this they keep pulsing where nobody can see them.
   */
  paused: boolean;
}) {
  const styles = useThemeStyles(makeStyles);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulse.stopAnimation();
    if (!busy || reduceMotion || paused) {
      pulse.setValue(1);
      return;
    }
    // Never fully out: a dot that disappears reads as a rendering glitch in a
    // list, where the neighbouring rows have no dot at all.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: motion.sessionPulse,
          easing: nativeMotionEasings.inOutQuad,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.sessionPulse,
          easing: nativeMotionEasings.inOutQuad,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse, reduceMotion, paused]);

  // Working outranks unread: a session that answered and was prompted again
  // from the desktop is, right now, working.
  if (!busy && !unread) return null;
  return (
    <Animated.View
      // Spoken, because colour alone carries this for everyone else. The role
      // is what makes a bare View announce its label at all, and it matches the
      // connection dot above.
      accessibilityRole="text"
      accessibilityLabel={busy ? "Working" : "New reply"}
      style={[
        styles.statusDot,
        busy ? styles.statusWorking : styles.statusUnread,
        busy && { opacity: pulse },
      ]}
    />
  );
}

interface SessionRowProps {
  session: Session;
  index: number;
  active: boolean;
  reduceMotion: boolean;
  /** Nothing in this row should be animating: shut drawer, or app in the
   *  background. */
  paused: boolean;
  /** Takes the id, so one stable callback serves every row. */
  onOpen: (id: string) => void;
}

export const SessionRow = memo(function SessionRow({
  session,
  index,
  active,
  reduceMotion,
  paused,
  onOpen,
}: SessionRowProps) {
  const styles = useThemeStyles(makeStyles);
  // Only the initial viewport cascades. Rows virtualized in later should appear
  // immediately, rather than fading under the user's finger while they scroll.
  //
  // And only rows that mount while the drawer is actually open. The list is
  // remounted by its `key` whenever the app or the project changes, and both of
  // those resolve on their own schedule — the daemon naming a provider a moment
  // after launch remounts it behind a shut drawer. The cascade then ran against
  // nothing, and pulling the drawer out a beat later caught it mid-flight: rows
  // arriving one after another under a panel that was itself still moving. That
  // is the drawer's intermittent stagger, and why it came and went with how
  // quickly the daemon answered.
  //
  // Captured at mount rather than read each render, because this must not
  // become true *later*: recomputing it when the drawer opens would re-run the
  // effect below and replay the cascade on open, every open — which is the
  // thing being fixed, arrived at from the other side.
  //
  // A lazy initial state rather than a ref, because this is read *during*
  // render. The `useRef(new Animated.Value(…))` idiom used elsewhere in this
  // file is a stable box whose identity never changes, so reading it in render
  // is harmless; this one derives from a prop, which is the case the rule is
  // actually about. Lazy state is the sanctioned way to freeze one at mount,
  // and it stays correct under the React Compiler's memoisation.
  const [revealing] = useState(() => !paused);
  const shouldAnimate = !reduceMotion && revealing && index < MAX_STAGGERED_ROWS;
  const entrance = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  useEffect(() => {
    entrance.stopAnimation();
    if (!shouldAnimate) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      delay: index * ROW_STAGGER_MS,
      duration: ROW_REVEAL_MS,
      easing: nativeMotionEasings.outCubic,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, index, shouldAnimate]);

  // Memoised against the row's own re-renders, not just the list's. `paused`
  // flips the instant the drawer opens, so `memo` above cannot spare these rows
  // that particular render — the one render that lands on the frame the slide
  // starts. Only the dot at the end of the row actually reads `paused`; this is
  // date arithmetic for a line that has not changed, and it ran once per
  // mounted row before the drawer had moved a pixel.
  const metadata = useMemo(() => formatHistoryMetadata(session), [session]);
  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [7, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={session.title}
        accessibilityState={{ selected: active }}
        onPress={() => onOpen(session.id)}
        style={({ pressed }) => [
          styles.session,
          active && styles.sessionActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.sessionLine}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {session.title}
          </Text>
          {/* The agent keeps running when you leave a conversation, so the
              drawer is where you find out what is still going and what came
              back while you were elsewhere. */}
          <SessionStatus
            busy={session.busy === true}
            unread={session.unread === true}
            reduceMotion={reduceMotion}
            paused={paused}
          />
        </View>
        {metadata ? (
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {metadata}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});
