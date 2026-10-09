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

export function desktopAskId(params: unknown): string | undefined {
  const parsed = z.object({ _meta: z.object({ ggDesktopAskId: z.string().max(200) }) }).safeParse(params);
  return parsed.success ? parsed.data._meta.ggDesktopAskId : undefined;
}
