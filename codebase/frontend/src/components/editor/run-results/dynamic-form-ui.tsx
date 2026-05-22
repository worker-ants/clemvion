import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
}

function renderField(
  field: FormField,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs resize-y min-h-[60px]"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          required={field.required}
        />
      );
    case "email":
      return (
        <Input
          type="email"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "select":
      return (
        <select
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs h-7"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">Select...</option>
          {/* Compound key (`value-idx`) — LLM-emitted `render_form` payloads
              occasionally produce options with duplicate / empty values
              (e.g. ai_form_render submitted by the model from a partial
              schema). Falling back to the array index keeps React keys
              unique while preserving the user-visible value/label. */}
          {field.options?.map((opt, idx) => (
            <option key={`${opt.value ?? ""}-${idx}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options?.map((opt, idx) => (
            <label
              key={`${opt.value ?? ""}-${idx}`}
              className="flex items-center gap-1 text-xs"
            >
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                required={field.required}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
    default:
      return (
        <Input
          type="text"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}

export function DynamicFormUI({
  formConfig,
  onSubmit,
}: {
  formConfig: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const fields = (formConfig.fields ?? []) as FormField[];
  const title = formConfig.title as string | undefined;
  const description = formConfig.description as string | undefined;
  const submitLabel = (formConfig.submitLabel as string) ?? "Submit";

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of fields) {
      initial[f.name] =
        f.defaultValue ?? (f.type === "checkbox" ? false : "");
    }
    return initial;
  });

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {title && <p className="text-sm font-medium">{title}</p>}
      {description && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      )}
      {fields.map((field, idx) => (
        // Compound key — LLM-emitted form payloads (ai_form_render) may
        // produce duplicate / undefined `field.name`. Index fallback keeps
        // React keys unique without changing the semantic field name.
        <div key={`${field.name ?? ""}-${idx}`} className="space-y-1">
          <Label className="text-xs">
            {field.label}
            {field.required && (
              <span className="text-red-500 ml-0.5">*</span>
            )}
          </Label>
          {renderField(field, values[field.name], (v) =>
            handleChange(field.name, v),
          )}
        </div>
      ))}
      <Button type="submit" size="sm" className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
