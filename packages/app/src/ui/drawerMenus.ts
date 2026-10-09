/**
 * What the drawer's two pickers offer, as plain data.
 *
 * The drawer used to choose an agent from a sideways-scrolling row of chips
 * (the end of which was always cut off) and a project from a hand-built
 * dropdown. Both are now one row each opening the system menu; this module
 * decides the rows inside those menus. Expo-free so `bun test` can load it.
 */
import type { Project } from "../projects";
import type { Provider } from "../useDaemon";
// Type-only: erased at runtime, so this module never loads React Native.
import type { NativeMenuChoice } from "./NativeMenu";

/** The "All projects" row's id; no real path is empty. */
export const ALL_PROJECTS_ID = "";

/**
 * Agents in the order given (most recently used first), the active one ticked.
 *
 * An agent that cannot run right now is still listed, with the reason as its
 * subtitle, rather than hidden: "why isn't Gemini here" is a worse question
 * than "why is Gemini greyed out". Picking it does nothing, as before.
 */
export function agentChoices(
  providers: readonly Provider[],
  activeProviderId: string | undefined,
): NativeMenuChoice[] {
  return providers.map((provider) => {
    const subtitle = provider.available ? undefined : provider.unavailableReason ?? "Not available";
    return {
      id: provider.id,
      title: provider.name,
      ...(subtitle ? { subtitle } : {}),
      selected: provider.id === activeProviderId,
      disabled: !provider.available,
    };
  });
}

/** "All projects" first, then each project, the chosen one ticked. */
export function projectChoices(
  projects: readonly Project[],
  selectedPath: string | undefined,
): NativeMenuChoice[] {
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return [
    {
      id: ALL_PROJECTS_ID,
      title: "All projects",
      subtitle: count(projects.length, "project"),
      selected: selectedPath === undefined,
    },
    ...projects.map((project) => ({
      id: project.path,
      title: project.name,
      ...(project.sessions === undefined
        ? {}
        : { subtitle: count(project.sessions, "conversation") }),
      selected: project.path === selectedPath,
    })),
  ];
}

/** Undoes `projectChoices`' ids: the empty id is "All projects". */
export function projectPathFromChoice(id: string): string | undefined {
  return id === ALL_PROJECTS_ID ? undefined : id;
}
