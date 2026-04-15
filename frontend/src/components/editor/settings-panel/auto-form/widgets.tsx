"use client";

import { ExpressionInput } from "@/components/editor/expression";
import {
  FieldGroup,
  SelectField,
  NumberField,
  TextAreaField,
  CheckboxField,
  KeyValueEditor,
} from "../node-configs/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { JsonSchemaNode, UiHint } from "@/lib/node-definitions";

export type WidgetProps = {
  schema: JsonSchemaNode;
  ui?: UiHint;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
};

/** Widget that renders a string as plain text input. */
export function TextWidget({ ui, label, value, onChange }: WidgetProps) {
  return (
    <FieldGroup label={label} hint={ui?.hint}>
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ui?.placeholder}
        className="h-8 text-xs"
      />
    </FieldGroup>
  );
}

export function TextAreaWidget({ ui, label, value, onChange }: WidgetProps) {
  return (
    <TextAreaField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      placeholder={ui?.placeholder}
      hint={ui?.hint}
    />
  );
}

export function NumberWidget({ ui, label, value, onChange, schema }: WidgetProps) {
  return (
    <NumberField
      label={label}
      value={typeof value === "number" ? value : Number(value ?? 0)}
      onChange={onChange}
      min={typeof schema.minimum === "number" ? schema.minimum : undefined}
      max={typeof schema.maximum === "number" ? schema.maximum : undefined}
      hint={ui?.hint}
    />
  );
}

export function CheckboxWidget({ label, value, onChange }: WidgetProps) {
  return (
    <CheckboxField
      label={label}
      checked={Boolean(value)}
      onChange={onChange}
    />
  );
}

export function SelectWidget({ ui, label, value, onChange, schema }: WidgetProps) {
  // Derive options from z.enum (JSON Schema `enum`) or UiHint.options.
  const options =
    ui?.options ??
    (Array.isArray(schema.enum)
      ? schema.enum.map((v) => ({ value: String(v), label: String(v) }))
      : []);
  return (
    <SelectField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      options={options}
      hint={ui?.hint}
    />
  );
}

export function ExpressionWidget({ ui, label, value, onChange }: WidgetProps) {
  return (
    <ExpressionInput
      label={label}
      value={value == null ? "" : String(value)}
      onChange={onChange}
      placeholder={ui?.placeholder}
    />
  );
}

/** Key-value list where values accept either plain text or expressions. */
export function KvExpressionWidget({ label, value, onChange }: WidgetProps) {
  const items = Array.isArray(value)
    ? (value as { key?: string; value?: string }[]).map((i) => ({
        key: i.key ?? "",
        value: i.value ?? "",
      }))
    : [];
  return (
    <KeyValueEditor
      label={label}
      items={items}
      onChange={(next) => onChange(next)}
      expressionValues
    />
  );
}

export function KvWidget({ label, value, onChange }: WidgetProps) {
  const items = Array.isArray(value)
    ? (value as { key?: string; value?: string }[]).map((i) => ({
        key: i.key ?? "",
        value: i.value ?? "",
      }))
    : [];
  return (
    <KeyValueEditor label={label} items={items} onChange={onChange} />
  );
}

/** Monospaced multi-line editor for code/templates. */
export function CodeWidget({ ui, label, value, onChange }: WidgetProps) {
  return (
    <TextAreaField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      rows={8}
      mono
      placeholder={ui?.placeholder}
      hint={ui?.hint ?? (ui?.language ? `Language: ${ui.language}` : undefined)}
    />
  );
}

/**
 * Generic ordered array of objects. Renders each item as a collapsible block
 * with a JSON editor per field — not pretty, but guarantees round-trip.
 * Complex arrays (conditions, cases, etc.) should use override components.
 */
export function FieldArrayWidget({ ui, label, value, onChange }: WidgetProps) {
  const items = Array.isArray(value) ? (value as unknown[]) : [];
  const add = () => onChange([...items, {}]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? v : it)));

  return (
    <FieldGroup label={label} hint={ui?.hint}>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex gap-1 rounded border border-[hsl(var(--border))] p-2"
          >
            <textarea
              value={JSON.stringify(item, null, 2)}
              onChange={(e) => {
                try {
                  update(i, JSON.parse(e.target.value));
                } catch {
                  /* ignore parse errors while typing */
                }
              }}
              rows={4}
              className="flex-1 rounded bg-transparent p-1 font-mono text-[11px]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => remove(i)}
            >
              <X size={12} />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={add}
        >
          <Plus size={12} className="mr-1" /> Add {ui?.itemLabel ?? "item"}
        </Button>
      </div>
    </FieldGroup>
  );
}

/** Fallback for widgets that haven't been implemented yet. Shows a raw JSON viewer. */
export function UnsupportedWidget({ label, value }: WidgetProps) {
  return (
    <FieldGroup
      label={label}
      hint="Advanced widget not yet supported in auto-form"
    >
      <pre className="rounded-md bg-[hsl(var(--muted))] p-2 text-[11px]">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </FieldGroup>
  );
}
