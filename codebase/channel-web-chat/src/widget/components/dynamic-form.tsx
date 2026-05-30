"use client";

import { useState, type FormEvent } from "react";

interface FieldDef {
  name?: string;
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value: string; label?: string } | string>;
}

interface DynamicFormProps {
  config: Record<string, unknown> | undefined;
  onSubmit: (data: Record<string, unknown>) => void;
}

function fieldsOf(config: Record<string, unknown> | undefined): FieldDef[] {
  const raw = (config?.fields ?? config?.schema) as unknown;
  return Array.isArray(raw) ? (raw as FieldDef[]) : [];
}
function nameOf(f: FieldDef, i: number): string {
  return f.name ?? f.key ?? `field_${i}`;
}
function optionValue(o: { value: string; label?: string } | string): string {
  return typeof o === "string" ? o : o.value;
}

// Form 노드 (다중 필드) — 일반 렌더 → submit_form. spec 1-widget-app §2 (전체 렌더), EIA §5.1.
export function DynamicForm({ config, onSubmit }: DynamicFormProps) {
  const fields = fieldsOf(config);
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (fields.length === 0) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };
  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <form className="wc-form" onSubmit={submit}>
      {fields.map((f, i) => {
        const name = nameOf(f, i);
        const id = `wc-field-${name}`;
        return (
          <div key={name} className="wc-form-row">
            <label htmlFor={id}>
              {f.label ?? name}
              {f.required ? " *" : ""}
            </label>
            {f.type === "select" && f.options ? (
              <select id={id} required={f.required} onChange={(e) => set(name, e.target.value)}>
                <option value="">선택</option>
                {f.options.map((o) => {
                  const v = optionValue(o);
                  return (
                    <option key={v} value={v}>
                      {typeof o === "string" ? o : (o.label ?? o.value)}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                id={id}
                type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                required={f.required}
                onChange={(e) => set(name, e.target.value)}
              />
            )}
          </div>
        );
      })}
      <button type="submit" className="wc-form-submit">
        제출
      </button>
    </form>
  );
}
