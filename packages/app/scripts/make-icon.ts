/**
 * Draws the pew2 app icon.
 *
 * The icon is generated rather than drawn by hand because it is the same shape
 * as the rest of the brand and that relationship should be enforced, not
 * remembered. The mark is the aperture from `src/ui/Logo.tsx`: a broken ring
 * around a lit core, a lens held open on a machine somewhere else. Keeping both
 * in code means the icon cannot quietly drift away from the launch screen the
 * user sees two seconds after tapping it.
 *
 * It replaced a dot-matrix `P2`. Two characters is a wordmark, and at the size
 * an icon is actually looked at they fused into a bright textured bar; a single
 * closed shape is legible at 40pt, which is the only size that decides whether
 * an icon works.
 *
 * Run it with `bun packages/app/scripts/make-icon.ts`. Committing the output is
 * deliberate: an app icon must not depend on a build step that could fail on
 * someone else's machine and ship a blank square to a store.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const REPO = join(APP, "..", "..");

/**
 * Straight from `src/theme.ts` — the dark default accent, the violet it
 * gradients into, and the page base. Duplicated because a PNG cannot import a
 * module that pulls in React Native.
 */
const ACCENT = "#5ce1ff";
const ACCENT_DEEP = "#8b3dff";
const BACKGROUND = "#05070e";

/**
 * The aperture, as fractions of the canvas.
 *
 * Written as ratios rather than pixels so every output size — 1024 store asset,
 * 512 favicon, the hard-cropped Android foreground — draws the identical shape
 * instead of one that thickens as it shrinks.
 */
const RING_RADIUS = 0.33;
const RING_WIDTH = 0.055;
/** The faint second ring, which is what makes it read as an instrument. */
const INNER_RADIUS = 0.255;
const INNER_OPACITY = 0.4;
const CORE_RADIUS = 0.21;

/**
 * How much of the ring is cut away, as a fraction of its circumference.
 *
 * Two gaps, not four: at four the remaining segments are shorter than the gaps
 * and the ring stops reading as a circle. Cut on the diagonal so neither gap
 * lands on the vertical or horizontal axis, where the eye is most sensitive to
 * a shape being not-quite-round.
 */
const GAP_FRACTION = 0.11;

/**
 * The iOS squircle, as the superellipse Apple actually uses.
 *
 * A rounded rectangle is visibly not this: the corners meet the sides at a
 * curvature discontinuity that the eye picks up as a slightly wrong icon,
 * especially beside real ones on a home screen.
 *
 * iOS masks the icon itself, so this shape is for the README and anywhere else
 * the icon appears unmasked. The store asset stays square.
 */
function squirclePath(size: number, n = 5): string {
  const half = size / 2;
  const steps = 720;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    // |x|^n + |y|^n = 1, solved parametrically so the curve is exact rather
    // than an approximation stitched from arcs.
    const x = Math.sign(cos) * Math.abs(cos) ** (2 / n) * half + half;
    const y = Math.sign(sin) * Math.abs(sin) ** (2 / n) * half + half;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`);
  }
  return `${points.join(" ")} Z`;
}

/**
 * The mark, as SVG.
 *
 * @param size      Canvas edge in pixels.
 * @param squircle  Clip to the superellipse. Off for store assets, which iOS
 *                  masks itself and which must be full-bleed square.
 * @param scale     Shrinks the mark within its canvas. Android crops adaptive
 *                  icons hard, so the foreground draws smaller than the plate.
 */
function icon(size: number, { squircle = true, scale = 1 } = {}): string {
  const c = size / 2;
  const ringR = size * RING_RADIUS * scale;
  const ringW = size * RING_WIDTH * scale;
  const innerR = size * INNER_RADIUS * scale;
  const coreR = size * CORE_RADIUS * scale;

  // Stroke dashes rather than four drawn arcs: the dash pattern is measured
  // along the path itself, so the two segments and two gaps stay exactly equal
  // without any trigonometry that could round differently per size.
  const circumference = 2 * Math.PI * ringR;
  const gap = circumference * GAP_FRACTION;
  const segment = circumference / 2 - gap;

  const clip = squircle
    ? `<clipPath id="s"><path d="${squirclePath(size)}"/></clipPath>`
    : "";
  const group = squircle ? `<g clip-path="url(#s)">` : "<g>";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    ${clip}
    <radialGradient id="halo" cx="50%" cy="50%" r="58%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="core" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${group}
    <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
    <rect width="${size}" height="${size}" fill="url(#halo)"/>
    <circle cx="${c}" cy="${c}" r="${innerR.toFixed(2)}" fill="none"
            stroke="${ACCENT}" stroke-opacity="${INNER_OPACITY}" stroke-width="${(ringW / 2).toFixed(2)}"/>
    <circle cx="${c}" cy="${c}" r="${ringR.toFixed(2)}" fill="none"
            stroke="${ACCENT}" stroke-width="${ringW.toFixed(2)}" stroke-linecap="round"
            stroke-dasharray="${segment.toFixed(2)} ${gap.toFixed(2)}"
            transform="rotate(-45 ${c} ${c})"/>
    <circle cx="${c}" cy="${c}" r="${coreR.toFixed(2)}" fill="url(#core)"/>
    <circle cx="${c}" cy="${c}" r="${coreR.toFixed(2)}" fill="url(#sheen)"/>
  </g>
</svg>`;
}

/** Just the mark, for the Android adaptive foreground and the splash. */
function foreground(size: number): string {
  // Android crops adaptive icons hard: the outer third can be masked away on
  // some launchers, so the mark sits well inside its own canvas.
  return (
    icon(size, { squircle: false, scale: 0.62 })
      .replace(new RegExp(`<rect width="\\d+" height="\\d+" fill="${BACKGROUND}"/>`), "")
      // The halo goes with it. It is a full-bleed gradient tuned to sit on the
      // plate, and these two outputs have no plate: over transparency it
      // composites to a grey square the size of the canvas, which on the splash
      // reads as a smudge behind the mark and on an Android launcher is exactly
      // the soft-edged fill that adaptive cropping smears. The glow belongs to
      // the icon, which owns its own background.
      .replace(/<rect width="\d+" height="\d+" fill="url\(#halo\)"\/>/, "")
  );
}

async function png(svg: string, size: number, out: string, opaque: boolean) {
  const image = sharp(Buffer.from(svg)).resize(size, size);
  // App Store rejects an icon with an alpha channel, so the store asset is
  // flattened rather than left transparent.
  const buffer = await (opaque ? image.flatten({ background: BACKGROUND }) : image)
    .png()
    .toBuffer();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buffer);
  console.log(`  ${out.replace(REPO + "/", "")}  ${(buffer.length / 1024).toFixed(0)}KB`);
}

console.log("Drawing the icon:");

// Store icon: square and opaque, because iOS applies its own mask and rejects
// alpha. Everything else can keep the squircle.
await png(icon(1024, { squircle: false }), 1024, join(APP, "assets/icon.png"), true);
await png(icon(1024), 1024, join(REPO, "docs/icon.png"), true);
await png(icon(512), 512, join(APP, "assets/favicon.png"), false);
await png(foreground(1024), 1024, join(APP, "assets/android-icon-foreground.png"), false);
await png(foreground(1024), 1024, join(APP, "assets/splash-icon.png"), false);

// Android's adaptive background is a flat plate; the foreground floats over it.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BACKGROUND}"/></svg>`,
  1024,
  join(APP, "assets/android-icon-background.png"),
  true,
);

// Monochrome is used by Android as a mask and tinted by the system wallpaper,
// so it ships as a flat silhouette. The halo and the sheen are dropped rather
// than recoloured: a soft-edged gradient in a mask becomes a smear once themed.
await png(
  foreground(1024)
    .replace(/<circle[^>]*fill="url\(#sheen\)"\/>/, "")
    .replace(/fill="url\(#core\)"/, `fill="#ffffff"`)
    .replaceAll(ACCENT, "#ffffff"),
  1024,
  join(APP, "assets/android-icon-monochrome.png"),
  false,
);

console.log("Done.");
