import type { ComponentType } from "react";
import type { UiWidget } from "@/lib/node-definitions";
import {
  TextWidget,
  TextAreaWidget,
  NumberWidget,
  SelectWidget,
  MultiSelectWidget,
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
  McpServerSelectorWidget,
} from "./selector-widgets";
import { ButtonListWidget } from "./button-list-widget";
import { registerWidgets } from "./widget-resolver";

/**
 * Maps UI widget identifiers to React components. Most app-level selector
 * widgets (LLM config, KB, MCP server) have first-class auto-form components
 * — see `selector-widgets.tsx`. Widgets that still need an explicit per-node
 * override (`integration-selector`, `workflow-selector`, `condition-builder`,
 * `table-grid`) fall through to `UnsupportedWidget` so their owners are
 * forced to register custom UI rather than receiving a silent stub.
 */
export const WIDGET_REGISTRY: Record<UiWidget, ComponentType<WidgetProps>> = {
  text: TextWidget,
  textarea: TextAreaWidget,
  number: NumberWidget,
  select: SelectWidget,
  multiselect: MultiSelectWidget,
  checkbox: CheckboxWidget,
  expression: ExpressionWidget,
  kv: KvWidget,
  "kv-expression": KvExpressionWidget,
  code: CodeWidget,
  "integration-selector": UnsupportedWidget,
  "llm-config-selector": LlmConfigSelectorWidget,
  "kb-selector": KbSelectorWidget,
  "mcp-server-selector": McpServerSelectorWidget,
  "workflow-selector": UnsupportedWidget,
  "condition-builder": UnsupportedWidget,
  "field-array": FieldArrayWidget,
  "button-list": ButtonListWidget,
  "table-grid": UnsupportedWidget,
};

// Populate the lazy resolver so `widgets.tsx` can look up nested widgets
// without importing this module (which would create a cycle).
registerWidgets(WIDGET_REGISTRY);
