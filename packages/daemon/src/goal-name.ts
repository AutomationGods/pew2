/**
 * GG Coder refuses a new goal whose name is longer than 15 characters
 * ("Keep the name to 15 characters"). Phone builds before the fix suggested
 * names of up to 40 from the goal text, and the App Store is days behind a
 * daemon release, so the daemon fits the name rather than let the launch fail.
 */
export const GOAL_NAME_MAX = 15;

/** Trims to GG Coder's limit: at a word boundary when one is close, else a hard cut. */
export function fitGoalName(raw: string, max = GOAL_NAME_MAX): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if ([...name].length <= max) return name;
  const chars = [...name].slice(0, max + 1).join("");
  const space = chars.lastIndexOf(" ");
  // A word boundary that keeps at least half the room; otherwise cut mid-word.
  const cut = space >= Math.ceil(max / 2) ? chars.slice(0, space) : [...name].slice(0, max).join("");
  return cut.trim();
}
