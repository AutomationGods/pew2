import { z } from "zod";

export const SHARED_DESKTOP_PROVIDER = "ggcoder-desktop";
const state = z.object({
  update: z.object({
    _meta: z.object({ ggDesktopWorking: z.boolean(), ggDesktopClosedAsks: z.array(z.string()).max(128).default([]) }),
  }),
});

export function readDesktopState(payload: unknown): { working: boolean; closedAsks: string[] } | undefined {
  const parsed = state.safeParse(payload);
  if (!parsed.success) return undefined;
  return { working: parsed.data.update._meta.ggDesktopWorking, closedAsks: parsed.data.update._meta.ggDesktopClosedAsks };
}

const kenVerdict = z.object({
  update: z.object({ _meta: z.object({ ggKen: z.object({ phase: z.string(), live: z.literal(true) }) }) }),
});

/**
 * True for a live verdict in which GG Coder's reviewer, Ken, hands the decision
 * back: he needs you, or he stopped after his last round. All-clears and
 * snapshot replays are not news, so they never notify.
 */
export function kenNeedsYou(payload: unknown): boolean {
  const parsed = kenVerdict.safeParse(payload);
  if (!parsed.success) return false;
  const phase = parsed.data.update._meta.ggKen.phase;
  return phase === "human" || phase === "capped";
}

export function desktopAskId(params: unknown): string | undefined {
  const parsed = z.object({ _meta: z.object({ ggDesktopAskId: z.string().max(200) }) }).safeParse(params);
  return parsed.success ? parsed.data._meta.ggDesktopAskId : undefined;
}
