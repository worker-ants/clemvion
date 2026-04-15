"use client";

import { useMemo } from "react";
import type { JsonSchemaNode, UiHint } from "@/lib/node-definitions";
import { WIDGET_REGISTRY } from "./widget-registry";
import { isFieldVisible } from "./visibility";
import {
  TextWidget,
  NumberWidget,
  CheckboxWidget,
  SelectWidget,
  FieldArrayWidget,
  UnsupportedWidget,
  type WidgetProps,
} from "./widgets";

type SchemaFormProps = {
  schema: JsonSchemaNode;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
};

/**
 * Pick a widget for a field:
 *  1. explicit `ui.widget` hint → matching registry entry
 *  2. enum → select
 *  3. type → primitive widget (string/number/boolean/array)
 *  4. fallback → unsupported
 */
function pickWidget(
  schema: JsonSchemaNode,
  ui: UiHint | undefined,
): React.ComponentType<WidgetProps> {
  if (ui?.widget) {
    const widget = WIDGET_REGISTRY[ui.widget];
    if (widget) return widget;
  }
  if (Array.isArray(schema.enum)) return SelectWidget;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "string":
      return TextWidget;
    case "number":
    case "integer":
      return NumberWidget;
    case "boolean":
      return CheckboxWidget;
    case "array":
      return FieldArrayWidget;
    default:
      return UnsupportedWidget;
  }
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

type FieldEntry = {
  key: string;
  schema: JsonSchemaNode;
  ui: UiHint | undefined;
  order: number;
};

export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const entries = useMemo<FieldEntry[]>(() => {
    const props = schema.properties ?? {};
    const list: FieldEntry[] = Object.entries(props).map(([key, field], idx) => {
      const ui = (field.ui as UiHint | undefined) ?? undefined;
      return {
        key,
        schema: field,
        ui,
        order: ui?.order ?? idx,
      };
    });
    list.sort((a, b) => a.order - b.order);
    return list;
  }, [schema]);

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        No configurable fields.
      </p>
    );
  }

  const update = (key: string, next: unknown) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="flex flex-col gap-3">
      {entries.map(({ key, schema: fieldSchema, ui }) => {
        if (ui?.hidden) return null;
        if (!isFieldVisible(ui, value)) return null;
        const Widget = pickWidget(fieldSchema, ui);
        const label = ui?.label ?? humanize(key);
        return (
          <Widget
            key={key}
            schema={fieldSchema}
            ui={ui}
            label={label}
            value={value[key]}
            onChange={(v) => update(key, v)}
          />
        );
      })}
    </div>
  );
}
