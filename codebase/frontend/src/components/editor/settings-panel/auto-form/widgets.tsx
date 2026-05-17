"use client";

import { useMemo } from "react";
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
import { humanize, pickWidget } from "./utils";
import { isFieldRequired, isFieldVisible } from "./visibility";
import { useT, useLocale } from "@/lib/i18n";
import {
  translateBackendHint,
  translateBackendItemLabel,
  translateBackendLabel,
  translateBackendOptionLabel,
  translateBackendPlaceholder,
} from "@/lib/i18n/backend-labels";

export type WidgetProps = {
  schema: JsonSchemaNode;
  ui?: UiHint;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
};

/** Widget that renders a string as plain text input. */
export function TextWidget({ ui, label, value, onChange, required }: WidgetProps) {
  const locale = useLocale();
  return (
    <FieldGroup label={label} hint={translateBackendHint(ui?.hint, locale)} required={required}>
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={translateBackendPlaceholder(ui?.placeholder, locale)}
        aria-required={required || undefined}
        className="h-8 text-xs"
      />
    </FieldGroup>
  );
}

export function TextAreaWidget({ ui, label, value, onChange, required }: WidgetProps) {
  const locale = useLocale();
  return (
    <TextAreaField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      placeholder={translateBackendPlaceholder(ui?.placeholder, locale)}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    />
  );
}

export function NumberWidget({ ui, label, value, onChange, schema, required }: WidgetProps) {
  const locale = useLocale();
  return (
    <NumberField
      label={label}
      value={typeof value === "number" ? value : Number(value ?? 0)}
      onChange={onChange}
      min={typeof schema.minimum === "number" ? schema.minimum : undefined}
      max={typeof schema.maximum === "number" ? schema.maximum : undefined}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    />
  );
}

export function CheckboxWidget({ label, value, onChange, required }: WidgetProps) {
  return (
    <CheckboxField
      label={label}
      checked={Boolean(value)}
      onChange={onChange}
      required={required}
    />
  );
}

export function SelectWidget({ ui, label, value, onChange, schema, required }: WidgetProps) {
  const locale = useLocale();
  const rawOptions =
    ui?.options ??
    (Array.isArray(schema.enum)
      ? schema.enum.map((v) => ({ value: String(v), label: String(v) }))
      : []);
  const options = rawOptions.map((o) => ({
    ...o,
    label: translateBackendOptionLabel(o.label, locale) ?? o.label,
  }));
  return (
    <SelectField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      options={options}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    />
  );
}

export function ExpressionWidget({ ui, label, value, onChange, required }: WidgetProps) {
  const locale = useLocale();
  return (
    <ExpressionInput
      label={label}
      value={value == null ? "" : String(value)}
      onChange={onChange}
      placeholder={translateBackendPlaceholder(ui?.placeholder, locale)}
      hint={translateBackendHint(ui?.hint, locale)}
      multiline={ui?.multiline}
      rows={ui?.rows}
      required={required}
    />
  );
}

/** Key-value list where values accept either plain text or expressions. */
export function KvExpressionWidget({ label, value, onChange, required }: WidgetProps) {
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
      required={required}
    />
  );
}

export function KvWidget({ label, value, onChange, required }: WidgetProps) {
  const items = Array.isArray(value)
    ? (value as { key?: string; value?: string }[]).map((i) => ({
        key: i.key ?? "",
        value: i.value ?? "",
      }))
    : [];
  return (
    <KeyValueEditor label={label} items={items} onChange={onChange} required={required} />
  );
}

/** Monospaced multi-line editor for code/templates. */
export function CodeWidget({ ui, label, value, onChange, required }: WidgetProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <TextAreaField
      label={label}
      value={(value as string) ?? ""}
      onChange={onChange}
      rows={8}
      mono
      placeholder={translateBackendPlaceholder(ui?.placeholder, locale)}
      hint={
        translateBackendHint(ui?.hint, locale) ??
        (ui?.language
          ? t("nodeConfigs.autoForm.codeLanguageHint", { language: ui.language })
          : undefined)
      }
      required={required}
    />
  );
}

// ---------------------------------------------------------------------------
// Structured array items
// ---------------------------------------------------------------------------

type FieldEntry = {
  key: string;
  schema: JsonSchemaNode;
  ui: UiHint | undefined;
  order: number;
};

/**
 * Build a new item populated from schema defaults + `ui.itemDefault`. Fields
 * with `.default(...)` in zod (which surface as JSON Schema `default`) are
 * copied in; required string `id` / `*Id` fields without a default get an
 * auto-generated UUID so schemas like AI Agent conditions (where `id` is
 * required) produce valid items on "Add".
 */
function buildNewItem(
  itemSchema: JsonSchemaNode,
  itemDefault: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  const props = itemSchema.properties ?? {};
  const required = itemSchema.required ?? [];

  for (const [key, field] of Object.entries(props)) {
    if (field.default !== undefined) {
      item[key] = field.default;
    }
  }

  for (const key of required) {
    const field = props[key];
    if (item[key] !== undefined) continue;
    const isIdField = key === "id" || /Id$/.test(key);
    const isString =
      field?.type === "string" ||
      (Array.isArray(field?.type) && field.type.includes("string"));
    if (isIdField && isString) {
      item[key] =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `id-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  if (itemDefault) Object.assign(item, itemDefault);
  return item;
}

const PRIMITIVES = {
  Text: TextWidget,
  Number: NumberWidget,
  Checkbox: CheckboxWidget,
  Select: SelectWidget,
  FieldArray: FieldArrayWidget,
  Unsupported: UnsupportedWidget,
};

/** Renders a sub-form for a single structured array item. */
function StructuredItemForm({
  itemSchema,
  item,
  onChange,
}: {
  itemSchema: JsonSchemaNode;
  item: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const locale = useLocale();
  const fieldEntries = useMemo<FieldEntry[]>(() => {
    const props = itemSchema.properties ?? {};
    const list: FieldEntry[] = Object.entries(props).map(([key, field], idx) => {
      const ui = (field.ui as UiHint | undefined) ?? undefined;
      return { key, schema: field, ui, order: ui?.order ?? idx };
    });
    list.sort((a, b) => a.order - b.order);
    return list;
  }, [itemSchema]);

  return (
    <div className="flex flex-col gap-1.5">
      {fieldEntries.map(({ key, schema: fieldSchema, ui }) => {
        if (ui?.hidden) return null;
        if (!isFieldVisible(ui, item)) return null;
        const Widget = pickWidget<WidgetProps>(fieldSchema, ui, PRIMITIVES);
        const label =
          translateBackendLabel(ui?.label, locale) ?? humanize(key);
        const required = isFieldRequired(ui, key, itemSchema.required, item);
        return (
          <Widget
            key={key}
            schema={fieldSchema}
            ui={ui}
            label={label}
            value={item[key]}
            onChange={(v) => onChange({ ...item, [key]: v })}
            required={required}
          />
        );
      })}
    </div>
  );
}

/**
 * Generic ordered array editor.
 *
 * - When `schema.items` has `properties` (array of objects with known shape),
 *   renders a structured sub-form per item with proper widgets.
 * - Otherwise, falls back to a raw JSON textarea per item.
 */
export function FieldArrayWidget({ ui, label, value, onChange, schema, required }: WidgetProps) {
  const t = useT();
  const locale = useLocale();
  const items = Array.isArray(value) ? (value as unknown[]) : [];
  const itemSchema = schema.items;
  const isStructured = itemSchema?.properties != null;
  const translatedItemLabel = translateBackendItemLabel(ui?.itemLabel, locale);
  const itemLabel =
    translatedItemLabel ?? t("nodeConfigs.autoForm.defaultItemLabel");
  const itemLabelLower =
    translatedItemLabel ?? t("nodeConfigs.autoForm.defaultItemLabelLowercase");

  const add = () => {
    if (isStructured && itemSchema) {
      onChange([...items, buildNewItem(itemSchema, ui?.itemDefault)]);
    } else {
      onChange([...items, ui?.itemDefault ?? {}]);
    }
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? v : it)));

  return (
    <FieldGroup label={label} hint={translateBackendHint(ui?.hint, locale)} required={required}>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          // Prefer a stable per-item id over array index so reorder / mid-list
          // removal doesn't desync input focus.
          const itemId =
            isStructured &&
            typeof (item as Record<string, unknown>)?.id === "string"
              ? ((item as Record<string, unknown>).id as string)
              : `_idx_${i}`;
          return (
            <div
              key={itemId}
              className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {itemLabel} {i + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => remove(i)}
                  aria-label={t("nodeConfigs.autoForm.removeItemAria", { label: itemLabel })}
                >
                  <X size={10} />
                </Button>
              </div>
              {isStructured ? (
                <StructuredItemForm
                  itemSchema={itemSchema!}
                  item={(item as Record<string, unknown>) ?? {}}
                  onChange={(v) => update(i, v)}
                />
              ) : (
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
              )}
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={add}
        >
          <Plus size={12} className="mr-1" />
          {t("nodeConfigs.autoForm.addItem", { label: itemLabelLower })}
        </Button>
      </div>
    </FieldGroup>
  );
}

/** Fallback for widgets that haven't been implemented yet. Shows a raw JSON viewer. */
export function UnsupportedWidget({ label, value, required }: WidgetProps) {
  const t = useT();
  return (
    <FieldGroup
      label={label}
      hint={t("nodeConfigs.autoForm.unsupportedWidgetHint")}
      required={required}
    >
      <pre className="rounded-md bg-[hsl(var(--muted))] p-2 text-[11px]">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </FieldGroup>
  );
}
