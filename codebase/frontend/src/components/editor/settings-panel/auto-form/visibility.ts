import type { UiHint } from "@/lib/node-definitions";

type VisibleRule = NonNullable<UiHint["visibleWhen"]>;
type RequiredRule = NonNullable<UiHint["requiredWhen"]>;

function matchesVisible(rule: VisibleRule, config: Record<string, unknown>): boolean {
  const value = config[rule.field];
  if ("equals" in rule) return value === rule.equals;
  if ("notEquals" in rule) return value !== rule.notEquals;
  if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value);
  return true;
}

function matchesRequired(rule: RequiredRule, config: Record<string, unknown>): boolean {
  // `equals` 는 단일 값 또는 화이트리스트 array — array.isArray 분기.
  // 2026-05-19 정준화 (requiredwhen-dsl-whitelist): notEquals/oneOf 제거됨.
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
 * 2026-05-19 정준화 — `requiredWhen` 은 단일 shape `{ field, equals }` 만
 * 지원. `equals` 가 array 면 화이트리스트로 동작 (`oneOf` 의미).
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
