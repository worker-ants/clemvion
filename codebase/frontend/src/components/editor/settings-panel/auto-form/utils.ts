import type { ComponentType } from "react";
import type { JsonSchemaNode, UiHint } from "@/lib/node-definitions";
import { resolveWidget } from "./widget-resolver";

/**
 * Shared utilities for the auto-form renderer. Kept separate from
 * `widgets.tsx` to avoid a circular import with `widget-registry.ts`.
 */

export type WidgetOption = { value: string; label: string };

/**
 * Resolve the raw options list for a widget from `ui.options` or schema enum
 * values. Pass `itemsEnum: true` to prefer `schema.items.enum` over
 * `schema.enum` (MultiSelectWidget pattern for array schemas).
 */
export function resolveWidgetOptions(
  schema: JsonSchemaNode,
  ui: UiHint | undefined,
  { itemsEnum = false }: { itemsEnum?: boolean } = {},
): WidgetOption[] {
  if (ui?.options) return ui.options as WidgetOption[];
  if (itemsEnum && Array.isArray(schema.items?.enum)) {
    return schema.items.enum.map((v) => ({ value: String(v), label: String(v) }));
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((v) => ({ value: String(v), label: String(v) }));
  }
  return [];
}

export function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

/**
 * Pick a widget for a field.
 *  1. explicit `ui.widget` hint → widget resolved from the global registry
 *  2. enum → Select
 *  3. type → primitive widget (string/number/boolean/array)
 *  4. fallback → Unsupported
 *
 * `primitives` are injected by the caller because they live in `widgets.tsx`
 * (which this module imports from via the `widget-resolver` indirection).
 */
export function pickWidget<W>(
  schema: JsonSchemaNode,
  ui: UiHint | undefined,
  primitives: {
    Text: ComponentType<W>;
    Number: ComponentType<W>;
    Checkbox: ComponentType<W>;
    Select: ComponentType<W>;
    FieldArray: ComponentType<W>;
    Unsupported: ComponentType<W>;
  },
): ComponentType<W> {
  if (ui?.widget) {
    const widget = resolveWidget(ui.widget) as ComponentType<W> | undefined;
    if (widget) return widget;
  }
  if (Array.isArray(schema.enum)) return primitives.Select;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "string":
      return primitives.Text;
    case "number":
    case "integer":
      return primitives.Number;
    case "boolean":
      return primitives.Checkbox;
    case "array":
      return primitives.FieldArray;
    default:
      return primitives.Unsupported;
  }
}

/** Reserved keys that must not be removed via `clearFields` (prototype pollution). */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Apply `clearFields` directives safely. Returns a new object with the listed
 * keys removed. Filters out prototype-polluting keys (`__proto__`, etc.).
 */
export function applyClearFields(
  config: Record<string, unknown>,
  clearFields: string[] | undefined,
): Record<string, unknown> {
  if (!clearFields?.length) return config;
  const next = { ...config };
  for (const key of clearFields) {
    if (UNSAFE_KEYS.has(key)) continue;
    delete next[key];
  }
  return next;
}
