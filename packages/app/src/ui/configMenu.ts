/**
 * What the model-and-mode menu offers, as plain data.
 *
 * Kept free of React Native and Expo so `bun test` can load it: the native menu
 * component (`NativeMenu.tsx`) only maps these sections onto UIMenu actions.
 */
import type { ConfigOption } from "../useDaemon";

/** Section order when the agent gives no explicit priority. */
const CATEGORY_RANK: Record<string, number> = {
  model: 0,
  model_config: 1,
  thought_level: 2,
  mode: 3,
};

/** Unranked categories sort after every ranked one, in the agent's own order. */
const UNRANKED = 90;

export interface ConfigMenuChoice {
  /** Round-trips through the native menu; decode with `parseChoiceId`. */
  id: string;
  title: string;
  subtitle?: string;
  selected: boolean;
}

export interface ConfigMenuSection {
  id: string;
  title: string;
  choices: ConfigMenuChoice[];
}

/**
 * Encodes which option and which value a menu row sets.
 *
 * JSON rather than a joined string: both halves are agent-supplied, so no
 * separator is guaranteed absent from them, and the native event carries the
 * id as a C string, which would silently cut a NUL separator off.
 */
export function choiceId(configId: string, value: string): string {
  return JSON.stringify([configId, value]);
}

export function parseChoiceId(id: string): { configId: string; value: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(id);
  } catch {
    return undefined;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string"
  ) {
    return undefined;
  }
  return { configId: parsed[0], value: parsed[1] };
}

/** Every selectable option the agent advertises, model first, one section each. */
export function configMenuSections(options: readonly ConfigOption[]): ConfigMenuSection[] {
  return options
    .filter((option) => option.type === "select" && (option.options?.length ?? 0) > 0)
    .map((option, order) => ({ option, order }))
    .sort(
      (a, b) =>
        (CATEGORY_RANK[a.option.category ?? ""] ?? UNRANKED) -
          (CATEGORY_RANK[b.option.category ?? ""] ?? UNRANKED) || a.order - b.order,
    )
    .map(({ option }) => ({
      id: option.id,
      title: option.name,
      choices: (option.options ?? []).map((value) => ({
        id: choiceId(option.id, value.value),
        title: value.name,
        // An empty description would draw an empty second line in the menu.
        ...(value.description ? { subtitle: value.description } : {}),
        selected: value.value === option.currentValue,
      })),
    }));
}
