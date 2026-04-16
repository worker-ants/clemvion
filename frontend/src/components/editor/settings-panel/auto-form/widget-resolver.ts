import type { ComponentType } from "react";
import type { UiWidget } from "@/lib/node-definitions";
import type { WidgetProps } from "./widgets";

/**
 * Module-level widget lookup table. Populated once by `widget-registry.ts`
 * at module-init time; consumed lazily at render time by widgets that need
 * to resolve nested widgets (e.g. FieldArrayWidget rendering structured
 * array items with arbitrary field widgets).
 *
 * This indirection breaks the circular dependency that would otherwise
 * exist between `widgets.tsx` and `widget-registry.ts`.
 */
let registry: Record<string, ComponentType<WidgetProps>> | null = null;

export function registerWidgets(
  r: Record<UiWidget, ComponentType<WidgetProps>>,
): void {
  registry = r;
}

export function resolveWidget(
  name: UiWidget,
): ComponentType<WidgetProps> | undefined {
  return registry?.[name];
}
