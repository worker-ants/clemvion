import type { UiHint } from "@/lib/node-definitions";

type Rule = NonNullable<UiHint["visibleWhen"]>;

function matches(rule: Rule, config: Record<string, unknown>): boolean {
  const value = config[rule.field];
  if ("equals" in rule) return value === rule.equals;
  if ("notEquals" in rule) return value !== rule.notEquals;
  if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value);
  return true;
}

/**
 * Visibility DSL: field is shown unless its hint has a `visibleWhen`
 * rule that resolves to false against the current config object.
 *
 * Supported rule shapes:
 *  - `{ field, equals }`    — `config[field] === equals`
 *  - `{ field, notEquals }` — `config[field] !== notEquals`
 *  - `{ field, oneOf }`     — `oneOf.includes(config[field])`
 */
export function isFieldVisible(
  ui: UiHint | undefined,
  config: Record<string, unknown>,
): boolean {
  if (!ui?.visibleWhen) return true;
  return matches(ui.visibleWhen, config);
}

/**
 * Required DSL: field is required when the schema's `required` array lists it,
 * or its hint's `requiredWhen` rule resolves to true against `config`. The
 * latter covers mode-dependent constraints (e.g. Carousel titleField only in
 * dynamic mode) that JSON Schema's static `required` can't express.
 */
export function isFieldRequired(
  ui: UiHint | undefined,
  key: string,
  schemaRequired: string[] | undefined,
  config: Record<string, unknown>,
): boolean {
  if (ui?.required) return true;
  if (schemaRequired?.includes(key)) return true;
  if (ui?.requiredWhen) return matches(ui.requiredWhen, config);
  return false;
}
