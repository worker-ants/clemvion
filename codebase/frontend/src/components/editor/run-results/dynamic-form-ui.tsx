import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: Array<{ label: string; value: unknown }>;
  defaultValue?: unknown;
  allowedMimeTypes?: string[];
  maxFiles?: number;
}

/**
 * spec/4-nodes/6-presentation/4-form.md §1.5 — file 필드의 metadata-only
 * 직렬화 형식. binary 본문은 LLM 에 전달하지 않는다 (cap 초과 위험 + multimodal
 * 비지원 모델 호환 + 향후 별도 binary upload 채널 확장 여지 보존).
 */
interface FilePickMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

function toFileMetadata(file: File): FilePickMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

function fieldInputId(field: FormField, idx: number): string {
  return `dyn-form-${field.name || "field"}-${idx}`;
}

function renderField(
  field: FormField,
  idx: number,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  const id = fieldInputId(field, idx);

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          id={id}
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs resize-y min-h-[60px]"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "number":
      return (
        <Input
          id={id}
          type="number"
          className="h-7 text-xs"
          value={String(value ?? "")}
          // spec/4-nodes/6-presentation/0-common.md §Rationale — empty input
          // 은 빈 문자열로 보존. `Number("") === 0` 자동 강제는 사용자가
          // 비우는 의도를 잃게 만든다 (회귀 가드).
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? "" : Number(v));
          }}
          required={field.required}
        />
      );
    case "email":
      return (
        <Input
          id={id}
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
          id={id}
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
          id={id}
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
              unique while preserving the user-visible value/label.

              Note: spec §10.5 step 4 (backfillFormOptionValues) ensures
              backend emits unique non-empty values. The compound key here
              is defense-in-depth for stale payloads or thread replay. */}
          {field.options?.map((opt, optIdx) => (
            <option
              key={`${String(opt.value ?? "")}-${optIdx}`}
              value={String(opt.value ?? "")}
            >
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3" id={id}>
          {field.options?.map((opt, optIdx) => (
            <label
              key={`${String(opt.value ?? "")}-${optIdx}`}
              className="flex items-center gap-1 text-xs"
            >
              <input
                type="radio"
                name={field.name}
                value={String(opt.value ?? "")}
                // spec §10.5 step 4 SSOT 4-layer alignment — backend may emit
                // option.value as number / boolean / object. `String(...)`
                // coerce normalises both sides for the equality check so
                // user selection persists across type drift.
                checked={String(value ?? "") === String(opt.value ?? "")}
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
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
    case "file":
      // spec/4-nodes/6-presentation/4-form.md §1.5 — file 필드는 FileList →
      // metadata 객체 배열 (`{name, size, type, lastModified}[]`) 로 직렬화.
      // binary 본문은 LLM 에 미전달 (multimodal 비지원 모델 호환 + 1MB cap 보호).
      return (
        <Input
          id={id}
          type="file"
          className="h-7 text-xs"
          accept={(field.allowedMimeTypes ?? []).join(",") || undefined}
          multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}
          required={field.required}
          onChange={(e) => {
            const fileList = (e.target as HTMLInputElement).files;
            if (!fileList) {
              onChange([]);
              return;
            }
            const arr: FilePickMetadata[] = [];
            for (let i = 0; i < fileList.length; i++) {
              arr.push(toFileMetadata(fileList[i]));
            }
            onChange(arr);
          }}
        />
      );
    default:
      return (
        <Input
          id={id}
          type="text"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}

function initialValueFor(field: FormField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "checkbox") return false;
  if (field.type === "file") return [];
  return "";
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

  // 사용자 보고 (2026-05-23): "select 선택 후 초기값으로 돌아감".
  // useState initializer 는 첫 마운트에만 실행 — 부모 conditional flicker 로
  // 컴포넌트가 remount 되면 입력 손실. 부모는 본 컴포넌트를 안정된 key 로
  // 감싸 의도된 시점에만 mount/unmount 가 일어나게 한다 (executions page +
  // result-detail.tsx 가 `key={waitingNodeId ?? result.nodeId}` 적용).
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of fields) {
      initial[f.name] = initialValueFor(f);
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
      {fields.map((field, idx) => {
        const id = fieldInputId(field, idx);
        // Compound key — LLM-emitted form payloads (ai_form_render) may
        // produce duplicate / undefined `field.name`. Index fallback keeps
        // React keys unique without changing the semantic field name.
        return (
          <div key={`${field.name ?? ""}-${idx}`} className="space-y-1">
            {/* checkbox 는 input 옆에 label 이 inline 으로 들어가므로 외부
                Label 은 건너뛴다 (이중 label 회피). */}
            {field.type !== "checkbox" && (
              <Label htmlFor={id} className="text-xs">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </Label>
            )}
            {renderField(field, idx, values[field.name], (v) =>
              handleChange(field.name, v),
            )}
          </div>
        );
      })}
      <Button type="submit" size="sm" className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
