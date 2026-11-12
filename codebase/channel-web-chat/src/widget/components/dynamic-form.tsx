"use client";

import { useState, type FormEvent } from "react";
import { useTranslation } from "@/lib/i18n";

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
  /**
   * 검증 실패 문구(`400 VALIDATION_ERROR` 의 `details[]`, 키는 `field`). 그 필드 칸 아래에 그리고 입력값은
   * 그대로 둔다(REQ-WCWIDGET-041). 폼에 없는 필드의 문구는 폼 위에 모아 그린다.
   */
  fieldErrors?: Record<string, string>;
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
export function DynamicForm({ config, fieldErrors, onSubmit }: DynamicFormProps) {
  const t = useTranslation();
  const fields = fieldsOf(config);
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (fields.length === 0) return null;

  const names = new Set(fields.map(nameOf));
  // 폼에 없는 필드의 문구 — 버리면 사용자가 무엇을 고쳐야 하는지 알 수 없다.
  const orphanErrors = Object.entries(fieldErrors ?? {}).filter(([field]) => !names.has(field));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };
  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <form className="wc-form" onSubmit={submit}>
      {orphanErrors.map(([field, message]) => (
        <p key={field} className="wc-form-error" role="alert">
          {message}
        </p>
      ))}
      {fields.map((f, i) => {
        const name = nameOf(f, i);
        const id = `wc-field-${name}`;
        const error = fieldErrors?.[name];
        const errorId = `${id}-error`;
        const invalidProps = error
          ? { "aria-invalid": true as const, "aria-describedby": errorId }
          : {};
        return (
          <div key={name} className="wc-form-row">
            <label htmlFor={id}>
              {f.label ?? name}
              {f.required ? " *" : ""}
            </label>
            {f.type === "select" && f.options ? (
              <select id={id} required={f.required} {...invalidProps} onChange={(e) => set(name, e.target.value)}>
                <option value="">{t("form.selectPlaceholder")}</option>
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
                {...invalidProps}
                onChange={(e) => set(name, e.target.value)}
              />
            )}
            {error && (
              <p id={errorId} className="wc-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <button type="submit" className="wc-form-submit">
        {t("form.submit")}
      </button>
    </form>
  );
}
