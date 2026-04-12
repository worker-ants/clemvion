"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthVariant, CredentialField } from "@/lib/api/integrations";

interface Props {
  variant: AuthVariant;
  values: Record<string, unknown>;
  /** When editing/rotating, existing secret fields are hidden; user may type to replace */
  secretsMasked?: boolean;
  onChange: (key: string, value: unknown) => void;
}

export function CredentialsForm({
  variant,
  values,
  secretsMasked,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      {variant.fields.map((f) => (
        <Field
          key={f.key}
          field={f}
          value={values[f.key]}
          secretsMasked={secretsMasked}
          onChange={(v) => onChange(f.key, v)}
        />
      ))}
    </div>
  );
}

interface FieldProps {
  field: CredentialField;
  value: unknown;
  secretsMasked?: boolean;
  onChange: (value: unknown) => void;
}

function Field({ field, value, secretsMasked, onChange }: FieldProps) {
  const id = `cred-${field.key}`;

  if (field.type === "enum" && field.enum) {
    return (
      <div>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
        <select
          id={id}
          value={(value as string) ?? field.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
        >
          {!field.required && <option value="">—</option>}
          {field.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "record") {
    const json = value ? JSON.stringify(value, null, 2) : "";
    return (
      <div>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
        <textarea
          id={id}
          value={json}
          placeholder='{"X-Example": "value"}'
          onChange={(e) => {
            const text = e.target.value;
            if (!text.trim()) return onChange(undefined);
            try {
              onChange(JSON.parse(text) as Record<string, unknown>);
            } catch {
              // invalid JSON — keep user input as string until valid
              onChange(text);
            }
          }}
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          JSON object
        </p>
      </div>
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.secret
        ? "password"
        : "text";

  const placeholder =
    secretsMasked && field.secret
      ? "Leave blank to keep existing"
      : field.placeholder;

  return (
    <div>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type={inputType}
        value={toDisplay(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (field.type === "number") {
            onChange(v === "" ? undefined : Number(v));
          } else {
            onChange(v === "" ? undefined : v);
          }
        }}
      />
      {field.description && (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {field.description}
        </p>
      )}
    </div>
  );
}

function toDisplay(v: unknown): string | number {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  return String(v);
}
