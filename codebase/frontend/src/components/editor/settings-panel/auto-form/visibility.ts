import type { UiHint } from "@/lib/node-definitions";

type VisibleRule = NonNullable<UiHint["visibleWhen"]>;
type RequiredRule = NonNullable<UiHint["requiredWhen"]>;

/**
 * Evaluate a `visibleWhen` rule.
 *
 * The `equals` branch performs strict equality only — array whitelist semantic
 * belongs to `oneOf`. Passing an array to `equals` will silently evaluate to
 * `false` (a value never `===` an array reference). If you need a whitelist,
 * use `{ field, oneOf: [...] }`.
 *
 * `requiredWhen` uses the single-shape `{ field, equals }` where `equals`
 * accepts both a single value AND a readonly array — see {@link matchesRequired}.
 * The two DSLs are intentionally asymmetric until `visibleWhen` is unified
 * (tracked as separate follow-up).
 */
function matchesVisible(rule: VisibleRule, config: Record<string, unknown>): boolean {
  const value = config[rule.field];
  if ("equals" in rule) return value === rule.equals;
  if ("notEquals" in rule) return value !== rule.notEquals;
  if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value);
  return true;
}

/**
 * Evaluate a `requiredWhen` rule.
 *
 * Single shape — `{ field, equals }` where `equals` is either:
 *  - a single value: required when `config[field] === equals`
 *  - a readonly array (whitelist): required when `equals.includes(config[field])`
 *
 * See spec/4-nodes/1-logic/2-switch.md §8 Rationale for the rationale.
 */
function matchesRequired(rule: RequiredRule, config: Record<string, unknown>): boolean {
  const value = config[rule.field];
  if (Array.isArray(rule.equals)) return rule.equals.includes(value);
  return value === rule.equals;
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
  return matchesVisible(ui.visibleWhen, config);
}

/**
 * Required DSL: field is required when the schema's `required` array lists it,
 * or its hint's `requiredWhen` rule resolves to true against `config`. The
 * latter covers mode-dependent constraints (e.g. Carousel titleField only in
 * dynamic mode) that JSON Schema's static `required` can't express.
 *
 * `requiredWhen` is single-shape `{ field, equals }` — single value (`===`)
 * or readonly array (whitelist `.includes()`). See spec
 * `4-nodes/1-logic/2-switch.md §8` for the whitelist-only rationale.
 */
export function isFieldRequired(
  ui: UiHint | undefined,
  key: string,
  schemaRequired: string[] | undefined,
  config: Record<string, unknown>,
): boolean {
  if (ui?.required) return true;
  if (schemaRequired?.includes(key)) return true;
  if (ui?.requiredWhen) return matchesRequired(ui.requiredWhen, config);
  return false;
}
