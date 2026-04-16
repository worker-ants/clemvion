import type { ComponentType } from "react";
import type { UiWidget } from "@/lib/node-definitions";
import {
  TextWidget,
  TextAreaWidget,
  NumberWidget,
  SelectWidget,
  CheckboxWidget,
  ExpressionWidget,
  KvWidget,
  KvExpressionWidget,
  CodeWidget,
  FieldArrayWidget,
  UnsupportedWidget,
  type WidgetProps,
} from "./widgets";
import {
  LlmConfigSelectorWidget,
  KbSelectorWidget,
} from "./selector-widgets";
import { ButtonListWidget } from "./button-list-widget";
import { registerWidgets } from "./widget-resolver";

/**
 * Maps UI widget identifiers to React components. Widgets requiring app-level
 * selectors (integrations, workflows, condition-builder) are marked as
 * unsupported in auto-form — use the override registry for those.
 *
 * `table-grid` currently has no auto-form consumer (Table node remains an
 * override because of its cross-field column-row sync). Mapped to
 * UnsupportedWidget until/unless that migration happens.
 */
export const WIDGET_REGISTRY: Record<UiWidget, ComponentType<WidgetProps>> = {
  text: TextWidget,
  textarea: TextAreaWidget,
  number: NumberWidget,
  select: SelectWidget,
  checkbox: CheckboxWidget,
  expression: ExpressionWidget,
  kv: KvWidget,
  "kv-expression": KvExpressionWidget,
  code: CodeWidget,
  "integration-selector": UnsupportedWidget,
  "llm-config-selector": LlmConfigSelectorWidget,
  "kb-selector": KbSelectorWidget,
  "workflow-selector": UnsupportedWidget,
  "condition-builder": UnsupportedWidget,
  "field-array": FieldArrayWidget,
  "button-list": ButtonListWidget,
  "table-grid": UnsupportedWidget,
};

// Populate the lazy resolver so `widgets.tsx` can look up nested widgets
// without importing this module (which would create a cycle).
registerWidgets(WIDGET_REGISTRY);
