"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ExpressionInput } from "@/components/editor/expression";
import { useT } from "@/lib/i18n";

// Shared form field components for node config forms

export function RequiredMark() {
  return (
    <span
      className="ml-0.5 text-red-500"
      aria-hidden="true"
    >
      *
    </span>
  );
}

export function FieldGroup({
  label,
  children,
  hint,
  required,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
      {children}
      {hint && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  required,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  /**
   * `disabled` per option renders the row as unselectable (greyed out by
   * the browser). The cafe24 node uses it for `status: planned` operations
   * — visible in the dropdown so users see what's coming next, but blocked
   * from being picked.
   */
  options: { value: string; label: string; disabled?: boolean }[];
  hint?: string;
  required?: boolean;
}) {
  return (
    <FieldGroup label={label} hint={hint} required={required}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldGroup>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  required,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FieldGroup label={label} hint={hint} required={required}>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        aria-required={required || undefined}
        className="h-8 text-xs"
      />
    </FieldGroup>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows,
  placeholder,
  hint,
  mono,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  required?: boolean;
}) {
  return (
    <FieldGroup label={label} hint={hint} required={required}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        placeholder={placeholder}
        aria-required={required || undefined}
        className={cn(
          "rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
          mono && "font-mono",
        )}
      />
    </FieldGroup>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  required,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
}) {
  const reactId = useId();
  const id =
    typeof label === "string"
      ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
      : `cb-${reactId}`;
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-required={required || undefined}
        className="h-4 w-4 rounded border-[hsl(var(--input))]"
      />
      <Label htmlFor={id} className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
    </div>
  );
}

export function KeyValueEditor({
  label,
  items,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  expressionValues,
  required,
}: {
  label: string;
  items: { key: string; value: string }[];
  onChange: (items: { key: string; value: string }[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** When true, value fields render as ExpressionInput with autocomplete */
  expressionValues?: boolean;
  required?: boolean;
}) {
  const t = useT();
  const addItem = () => onChange([...items, { key: "", value: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "key" | "value", val: string) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  return (
    <FieldGroup label={label} required={required}>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={item.key}
              onChange={(e) => updateItem(i, "key", e.target.value)}
              placeholder={keyPlaceholder ?? t("nodeConfigs.common.keyPlaceholder")}
              className="h-7 flex-1 text-xs"
            />
            {expressionValues ? (
              <div className="flex-1">
                <ExpressionInput
                  bare
                  label=""
                  value={item.value}
                  onChange={(v) => updateItem(i, "value", v)}
                  placeholder={valuePlaceholder ?? t("nodeConfigs.common.valueExpression")}
                />
              </div>
            ) : (
              <Input
                value={item.value}
                onChange={(e) => updateItem(i, "value", e.target.value)}
                placeholder={valuePlaceholder ?? t("nodeConfigs.common.valuePlaceholder")}
                className="h-7 flex-1 text-xs"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => removeItem(i)}
              aria-label={t("editor.sharedRemoveRow")}
            >
              <X size={12} />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus size={12} className="mr-1" /> {t("editor.sharedAdd")}
        </Button>
      </div>
    </FieldGroup>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-[hsl(var(--border))] pb-1 pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {children}
      </span>
    </div>
  );
}
