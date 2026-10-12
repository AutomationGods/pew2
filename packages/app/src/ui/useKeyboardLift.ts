import { useKeyboardHandler } from "react-native-keyboard-controller";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/**
 * The mark's diameter on an empty conversation, with nothing to compete with.
 *
 * Large enough to be the subject of the screen rather than an icon above a
 * sentence, and it reaches the densest grid the geometry offers — so the
 * drifting light has the most cells to travel across.
 */
const ORB_REST_SIZE = 96;

/** What it settles back to once the keyboard is up, as a fraction of that. */
const ORB_SETTLED_SCALE = 56 / ORB_REST_SIZE;

/**
 * The curve iOS moves its keyboard along.
 *
 * UIKit animates the keyboard with a private curve — `UIViewAnimationCurve(7)`,
 * which has no public constant and is not any of the four documented ones. This
 * bezier is the long-standing community match for it, and it only matters when
 * the pane is animating itself because the platform has not reported the
 * keyboard's real position; when frames do arrive they overwrite this anyway.
 */
const KEYBOARD_CURVE = Easing.bezier(0.17, 0.59, 0.4, 0.77);

/**
 * Raises the thread and the composer by exactly the visible keyboard's height,
 * and returns a second style for content that is centred rather than
 * bottom-anchored.
 *
 * Written from a worklet on the keyboard's own animation, so the two move in
 * perfect step. No JS re-render can land halfway through and move things a
 * second time.
 *
 * A transform, deliberately, not a height. The thread is a recycling list, and
 * `RecyclerView` answers any container resize with a full layout pass in JS — so
 * shortening the pane per frame queued sixty of them across the keyboard's
 * animation, which is the stutter. Translating moves the same pixels on the UI
 * thread and lays out nothing.
 *
 * Cross-platform by construction rather than by branch: `useKeyboardHandler`
 * calls the library's `useResizeMode`, which sets Android to `adjustResize`, and
 * `KeyboardProvider` puts it in edge-to-edge — a pairing that stops Android
 * resizing the window at all. So on both platforms nothing but this transform
 * moves, and neither needs a `softwareKeyboardLayoutMode` in app.json.
 *
 * The keyboard is measured from the physical screen edge, so the home-indicator
 * clearance the dock keeps is handed back while it is open, and the composer
 * keeps the same gap above either boundary.
 *
 * @returns `pane` for bottom-anchored content, `centred` to cancel half of it,
 *   `settled` for content that gives up room while the keyboard is open.
 */
export function useKeyboardLift(bottomInset: number) {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useKeyboardHandler(
    {
      // Start the movement on the platform's own terms before a single frame
      // has been reported.
      //
      // `onMove` is the good path and stays the good path — it is the keyboard's
      // real position, sampled per frame. But it is *not guaranteed to arrive*.
      // iOS 26 stopped delivering those frames to release builds: the library
      // finds the keyboard by walking the window hierarchy for private UIKit
      // class names (`UIInputSetHostView` and friends) and driving a
      // `CADisplayLink` off the view it finds, and when that lookup comes back
      // empty there is no per-frame anything. `onStart`/`onEnd` still fire,
      // because those are ordinary keyboard notifications. So the pane sat
      // still for the whole animation and then snapped — in TestFlight only,
      // while every development build looked perfect, which is exactly the
      // shape of the bug that was so maddening to chase.
      //
      // Animating here removes the dependency. `event.duration` is what the
      // system says the keyboard will take, so the pane covers the same
      // distance in the same time whether or not a single frame is ever
      // reported. When they are reported, the assignment in `onMove` simply
      // takes over — assigning to a shared value cancels whatever animation is
      // running on it — and the exact path wins. Degrading, not branching:
      // there is no version check to go stale.
      onStart: (event) => {
        "worklet";
        const target = Math.max(0, event.height - bottomInset * event.progress);
        if (event.duration <= 0) {
          height.value = target;
          progress.value = event.progress;
          return;
        }
        const timing = { duration: event.duration, easing: KEYBOARD_CURVE };
        height.value = withTiming(target, timing);
        progress.value = withTiming(event.progress, timing);
      },
      onMove: (event) => {
        "worklet";
        height.value = Math.max(0, event.height - bottomInset * event.progress);
        progress.value = event.progress;
      },
      // The keyboard has stopped, so this is the authoritative position — but
      // only assign it if it is not already there. On the fallback path the
      // timing started in `onStart` is still running toward this exact value,
      // and overwriting it lands the last few points as a cut instead of the
      // end of the movement.
      onEnd: (event) => {
        "worklet";
        const target = Math.max(0, event.height - bottomInset * event.progress);
        if (Math.abs(height.value - target) > 0.5) {
          height.value = target;
        }
        progress.value = event.progress;
      },
    },
    [bottomInset],
  );

  const pane = useAnimatedStyle(() => ({
    transform: [{ translateY: -height.value }],
  }));

  // The empty state is centred in the pane rather than anchored to its bottom
  // edge, so the full lift would carry it up by a whole keyboard — twice what
  // re-centring needs, and far enough to push the greeting under the nav. Half
  // the lift keeps it centred in what is left of the screen.
  const centred = useAnimatedStyle(() => ({
    transform: [{ translateY: height.value / 2 }],
  }));

  // At rest the mark is the screen: nothing else is there, so it should own it.
  // Once you start typing the screen belongs to the sentence you are writing,
  // and the mark steps back to being an emblem above it.
  //
  // A scale, not a smaller `size`: the grid resolution is chosen from the size,
  // so animating that would rebuild the whole dot matrix mid-keyboard — exactly
  // the per-frame relayout the pane transform exists to avoid. Reserved layout
  // stays at full size for the same reason: nothing reflows on the keyboard's
  // clock, and the greeting keeps one still centre to scale about.
  //
  // Held in a local because a worklet runs in its own runtime, where this
  // file's module scope does not exist — only closed-over values cross over.
  const shrinkBy = 1 - ORB_SETTLED_SCALE;
  const settled = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - shrinkBy * progress.value }],
  }));

  return { pane, centred, settled };
}
