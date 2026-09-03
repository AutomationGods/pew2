import type { Session } from "./useDaemon";

export interface ActivitySessionGroups {
  needsYou: Session[];
  working: Session[];
  ready: Session[];
  recent: Session[];
}

function newestFirst(a: Session, b: Session): number {
  return b.startedAt - a.startedAt;
}

/** One session belongs to exactly one activity section, ordered by urgency. */
export function groupActivitySessions(sessions: readonly Session[]): ActivitySessionGroups {
  const sorted = [...sessions].sort(newestFirst);
  const needsYou: Session[] = [];
  const working: Session[] = [];
  const ready: Session[] = [];
  const recent: Session[] = [];

  for (const session of sorted) {
    if (session.permission) needsYou.push(session);
    else if (session.busy) working.push(session);
    else if (session.unread) ready.push(session);
    else recent.push(session);
  }

  return { needsYou, working, ready, recent };
}

export function activitySummary(groups: ActivitySessionGroups): string {
  const active = groups.needsYou.length + groups.working.length;
  const parts: string[] = [];
  if (active > 0) parts.push(`${active} working`);
  if (groups.needsYou.length > 0) {
    parts.push(`${groups.needsYou.length} ${groups.needsYou.length === 1 ? "needs" : "need"} you`);
  }
  if (parts.length === 0 && groups.ready.length > 0) {
    return `${groups.ready.length} ${groups.ready.length === 1 ? "result" : "results"} ready`;
  }
  return parts.length > 0 ? parts.join(" · ") : "Nothing active";
}

export function receiptSummary(session: Session): string {
  if (!session.receipt) return "New reply";
  return `${session.receipt.verb} in ${session.receipt.duration}`;
}
