import type { UiHint } from "@/lib/node-definitions";

/**
 * Simple visibility DSL: field is shown unless its hint has a `visibleWhen`
 * rule that resolves to false against the current config object.
 */
export function isFieldVisible(
  ui: UiHint | undefined,
  config: Record<string, unknown>,
): boolean {
  if (!ui?.visibleWhen) return true;
  const { field, equals } = ui.visibleWhen;
  return config[field] === equals;
}
