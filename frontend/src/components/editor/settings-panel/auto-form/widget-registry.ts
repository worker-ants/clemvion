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

/**
 * Maps UI widget identifiers to React components. Widgets requiring app-level
 * selectors (integrations, LLM configs, KBs, workflows, condition-builder) are
 * marked as unsupported in auto-form — use the override registry for those.
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
  "llm-config-selector": UnsupportedWidget,
  "kb-selector": UnsupportedWidget,
  "workflow-selector": UnsupportedWidget,
  "condition-builder": UnsupportedWidget,
  "field-array": FieldArrayWidget,
};
