/**
 * GG Goals as its own agent (provider `gg-goals`): pure rules, Expo-free so
 * `bun test` can load them. The daemon synthesises the provider from GG Coder;
 * an older daemon never announces it, which means no goals UI at all.
 */

export const GOALS_PROVIDER_ID = "gg-goals";

export function isGoalsProvider(providerId: string | undefined): boolean {
  return providerId === GOALS_PROVIDER_ID;
}

interface StripExtensions {
  autopilot?: boolean;
  checklist?: boolean;
}

/**
 * Which GG Coder strips a conversation shows. Autopilot, Checklist and the
 * plan sheet are strictly GG Coder's: never for a goal, whatever the
 * extensions claim; otherwise only what the provider advertises.
 */
export function ggStrips(
  providerId: string | undefined,
  extensions: StripExtensions | undefined,
  hasSession: boolean,
): { autopilot: boolean; checklist: boolean; plan: boolean } {
  if (!hasSession || isGoalsProvider(providerId)) return { autopilot: false, checklist: false, plan: false };
  return { autopilot: extensions?.autopilot === true, checklist: extensions?.checklist === true, plan: true };
}

/** A goal name suggested from the first few words of the goal text. */
/** GG Coder refuses a goal name longer than this ("Keep the name to 15 characters"). */
export const GOAL_NAME_MAX = 15;

/** A name GG Coder will take: trimmed and hard-cut at `GOAL_NAME_MAX`. */
export function clampGoalName(name: string, maxChars = GOAL_NAME_MAX): string {
  return name.trim().slice(0, maxChars).trim();
}

/** How many goals are running right now; undefined when the list never arrived. */
export function runningGoalCount(goals: readonly { status: string }[] | undefined): number | undefined {
  return goals?.filter((goal) => goal.status === "running").length;
}

/** The home screen's way into goals: "Goals", or "Goals · 2 running". */
export function goalsEntryLabel(running: number | undefined): string {
  return running && running > 0 ? `Goals · ${running} running` : "Goals";
}

/**
 * The launch pad's caption. `plain` is Reduce Motion or a screen reader,
 * where the pad is tapped, not held; `short` is a hold let go too soon.
 */
export function launchCaption(s: { pending: boolean; ready: boolean; plain: boolean; holding: boolean; short: boolean }): string {
  if (s.pending) return "Launching";
  if (!s.ready) return "Name and goal first";
  if (s.plain) return "Tap to launch goal";
  if (s.holding) return "Keep holding";
  if (s.short) return "Hold until the ring fills";
  return "Hold anywhere here";
}

export function suggestGoalName(text: string, maxWords = 4, maxChars = GOAL_NAME_MAX): string {
  const words = text
    .replace(/[\r\n]+/g, " ")
    .split(" ")
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((word) => word.length > 0)
    .slice(0, maxWords);
  let name = "";
  for (const word of words) {
    const next = name ? `${name} ${word}` : word;
    if (next.length > maxChars) break;
    name = next;
  }
  if (!name && words[0]) name = words[0].slice(0, maxChars);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

/** The status words a goal row shows; an idle goal says nothing extra. */
const GOAL_STATUS_WORD: Record<string, string | undefined> = {
  running: "Running",
  briefing: "Briefing",
  paused: "Paused",
  interrupted: "Interrupted",
};

interface GoalRowSource {
  id: string;
  name: string;
  status: string;
  path: string;
  lastActiveMs: number;
  sessionId?: string;
}

/**
 * A goal as a drawer row: the same shape and the same two lines as a chat
 * ("4 messages · proj"), so the GG Goals list reads exactly like every other
 * agent's. The status rides in the grey line as a word, not a pill; a running
 * goal also gets the chat list's busy dot.
 */
export function goalDrawerRow(goal: GoalRowSource, lastActive: string) {
  const word = GOAL_STATUS_WORD[goal.status];
  return {
    row: {
      id: goal.id,
      providerId: GOALS_PROVIDER_ID,
      title: goal.name,
      startedAt: goal.lastActiveMs,
      cwd: goal.path,
      busy: goal.status === "running",
      unread: false,
    },
    meta: [word, lastActive].filter(Boolean).join(" · "),
  };
}
