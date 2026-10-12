/**
 * The selectors and slash commands an agent advertises, normalised to one
 * shape whichever ACP generation the agent speaks.
 */
import { field } from "../untyped.js";

/**
 * A session-level selector advertised by the agent: model, thinking level, mode.
 * pew2 never hardcodes model names — each agent reports its own, so connecting a
 * new app automatically brings its models and reasoning levels with it.
 * https://agentclientprotocol.com/protocol/v1/session-config-options
 */
export interface ConfigOption {
  id: string;
  name: string;
  description?: string;
  /** 'model' | 'thought_level' | 'mode' | 'model_config', or a custom '_' name. */
  category?: string;
  type: string;
  currentValue: string | boolean;
  options?: { value: string; name: string; description?: string }[];
}

/**
 * Agents differ on the identifier field: ACP v1 uses `id`, the v2 draft uses
 * `configId`. Accept either so a mixed-version fleet works, and emit `id`.
 */
export function normaliseConfigOptions(raw: unknown): ConfigOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const option = entry as Record<string, unknown>;
    const id = (option.id ?? option.configId) as string | undefined;
    if (!id || typeof option.name !== "string") return [];
    return [
      {
        id,
        name: option.name,
        description: option.description as string | undefined,
        category: (option.category ?? undefined) as string | undefined,
        type: typeof option.type === "string" ? option.type : "select",
        currentValue: option.currentValue as string | boolean,
        options: Array.isArray(option.options)
          ? (option.options as ConfigOption["options"])
          : undefined,
      },
    ];
  });
}

/**
 * The `models` block `session/new` may return, alongside or instead of
 * `configOptions`. Claude Code's adapter reports its live model list this way —
 * the set is whatever that install currently offers, so it tracks agent updates
 * on its own and pew2 must never carry a model list of its own.
 */
export interface SessionModelState {
  availableModels?: { modelId: string; name: string; description?: string }[];
  currentModelId?: string;
}

/** Present the agent's `models` block as the same selector shape as the rest. */
export function modelsAsConfigOption(models: SessionModelState | undefined): ConfigOption[] {
  const available = models?.availableModels;
  if (!Array.isArray(available) || available.length === 0) return [];
  return [
    {
      id: MODEL_CONFIG_ID,
      name: "Model",
      category: "model",
      type: "select",
      currentValue: models?.currentModelId ?? available[0]!.modelId,
      options: available.map((model) => ({
        value: model.modelId,
        name: model.name,
        description: model.description,
      })),
    },
  ];
}

/**
 * Synthetic id for the selector built from `models`.
 *
 * That block has no config id of its own, so setting it routes to
 * `session/set_model` rather than `session/set_config_option`.
 */
export const MODEL_CONFIG_ID = "__acp_model";

/**
 * Synthetic id for the selector built from `modes`.
 *
 * Same story as the model: the legacy `modes` block carries no config id, so
 * setting it routes to `session/set_mode`. Sending `session/set_config_option`
 * for an id the agent never advertised is silently accepted and does nothing —
 * which is exactly what "I picked a mode and nothing happened" looks like.
 */
export const MODE_CONFIG_ID = "__acp_mode";

/** A slash command the agent offers, as advertised over ACP. */
export interface AvailableCommand {
  name: string;
  description: string;
  /** Placeholder for the argument it expects, when it takes one. */
  hint?: string;
}

/**
 * Normalise an `available_commands_update` payload.
 *
 * Nothing is filtered here: which commands make sense on a phone is a client
 * decision, and the daemon also serves clients that are not this app.
 */
export function readAvailableCommands(raw: unknown): AvailableCommand[] {
  if (!Array.isArray(raw)) return [];
  const commands: AvailableCommand[] = [];
  for (const command of raw as unknown[]) {
    const name = field(command, "name");
    if (typeof name !== "string" || !name.trim()) continue;
    const description = field(command, "description");
    const hint = field(field(command, "input"), "hint");
    commands.push({
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      ...(typeof hint === "string" ? { hint } : {}),
    });
  }
  return commands;
}

/**
 * The selector list after an update the agent sent unprompted, or undefined
 * when this notification does not carry one.
 *
 * Two shapes, because two protocol generations are live. `config_option_update`
 * resends the whole list and so replaces it — an option can legitimately
 * disappear, which is exactly what happens to the thinking level on a model
 * that does not support one. The legacy `current_mode_update` carries only an
 * id, so the selector synthesised from the `modes` block is edited in place.
 */
export function applyConfigUpdate(
  currentOptions: ConfigOption[],
  update: { sessionUpdate?: string; configOptions?: unknown; currentModeId?: unknown } | undefined,
): ConfigOption[] | undefined {
  if (update?.sessionUpdate === "config_option_update") {
    const announced = normaliseConfigOptions(update.configOptions);
    // An empty list is a malformed notification, not "this session has no
    // selectors": treating it as truth would blank every pill.
    return announced.length > 0 ? announced : undefined;
  }
  if (update?.sessionUpdate === "current_mode_update" && typeof update.currentModeId === "string") {
    const modeId = update.currentModeId;
    // Agents that advertise a real `configOptions` mode entry announce it via
    // `config_option_update` above; this only touches the synthetic one, so
    // nothing changes when the session has none.
    if (!currentOptions.some((option) => option.id === MODE_CONFIG_ID)) return undefined;
    return currentOptions.map((option) =>
      option.id === MODE_CONFIG_ID ? { ...option, currentValue: modeId } : option,
    );
  }
  return undefined;
}
