/** App-owned motion profiles. Native sheet/keyboard timing stays platform-owned. */
export const motion = {
  fast: 120,
  base: 180,
  composerExpand: 140,
  rowReveal: 180,
  rowStagger: 18,
  titleOut: 110,
  titleIn: 150,
  iconEnter: 160,
  activitySwap: 160,
  receipt: 260,
  skeletonPulse: 650,
  sessionPulse: 700,
  workingPulse: 320,
  workingStagger: 160,
  shimmerSweep: 1800,
  activitySweep: 2200,
  commandPause: 900,
  drawerSpring: { duration: 340, dampingRatio: 0.95 },
  stepSpring: { duration: 340, dampingRatio: 0.92 },
  chipSpring: { damping: 24, stiffness: 300, mass: 0.8 },
} as const;

interface EasingEngine<Curve, Bezier> {
  ease: Curve;
  quad: Curve;
  cubic: Curve;
  inOut: (curve: Curve) => Curve;
  out: (curve: Curve) => Curve;
  bezier: (x1: number, y1: number, x2: number, y2: number) => Bezier;
}

/**
 * The same named curves, built by the engine that will run them. Reanimated
 * must receive its own worklet easings, never React Native's JS functions.
 * Keep each engine's former default explicit rather than changing its rhythm.
 */
export function createMotionEasings<Curve, Bezier>(engine: EasingEngine<Curve, Bezier>) {
  return {
    standard: engine.bezier(0.22, 1, 0.36, 1),
    nativeTiming: engine.inOut(engine.ease),
    inOutQuad: engine.inOut(engine.quad),
    outCubic: engine.out(engine.cubic),
  };
}
