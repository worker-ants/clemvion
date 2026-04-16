import type { UiHint } from "@/lib/node-definitions";

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
  const rule = ui.visibleWhen;
  const value = config[rule.field];
  if ("equals" in rule) return value === rule.equals;
  if ("notEquals" in rule) return value !== rule.notEquals;
  if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value);
  return true;
}
