"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Shared form field components for node config forms

export function FieldGroup({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <FieldGroup label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldGroup>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <FieldGroup label={label} hint={hint}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <FieldGroup label={label} hint={hint}>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <FieldGroup label={label} hint={hint}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        placeholder={placeholder}
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
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = `cb-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[hsl(var(--input))]"
      />
      <Label htmlFor={id} className="text-xs">
        {label}
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
}: {
  label: string;
  items: { key: string; value: string }[];
  onChange: (items: { key: string; value: string }[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const addItem = () => onChange([...items, { key: "", value: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "key" | "value", val: string) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  return (
    <FieldGroup label={label}>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={item.key}
              onChange={(e) => updateItem(i, "key", e.target.value)}
              placeholder={keyPlaceholder ?? "Key"}
              className="h-7 flex-1 text-xs"
            />
            <Input
              value={item.value}
              onChange={(e) => updateItem(i, "value", e.target.value)}
              placeholder={valuePlaceholder ?? "Value"}
              className="h-7 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => removeItem(i)}
            >
              <X size={12} />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus size={12} className="mr-1" /> Add
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
