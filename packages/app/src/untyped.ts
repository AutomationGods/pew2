/**
 * Reading data that has not been checked yet: what the daemon relays from an
 * agent, before each field has been validated. `unknown` rather than `any`, so
 * the compiler refuses a field that is used before it is checked.
 */

/** True for anything that can carry fields, as `value?.field` would treat it. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `value?.[key]`: undefined unless `value` is an object. */
export function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}
