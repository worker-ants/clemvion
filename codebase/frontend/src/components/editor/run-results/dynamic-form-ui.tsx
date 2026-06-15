import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT, type TFunction } from "@/lib/i18n";

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: Array<{ label: string; value: unknown }>;
  defaultValue?: unknown;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  maxTotalSize?: number;
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

/**
 * spec/4-nodes/6-presentation/4-form.md §1 — `type: 'file'` 공유 기본값.
 * backend `form-mode.ts` 의 DEFAULT_FILE_* 상수와 값이 일치해야 한다(SoT: spec §1).
 * 서버는 미설정 시 동일 기본값을 주입하므로, 클라이언트도 미설정 필드에 같은 기본값으로
 * 즉시 reject 한다(서버 왕복 전 1차 가드).
 */
const DEFAULT_FILE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];
const DEFAULT_FILE_MAX_FILE_SIZE_MB = 10;
const DEFAULT_FILE_MAX_TOTAL_SIZE_MB = 50;
const DEFAULT_FILE_MAX_FILES = 5;
const MB_IN_BYTES = 1024 * 1024;

function toFileMetadata(file: File): FilePickMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

/**
 * spec §1.5 — file 선택 시 제출 전 클라이언트 가드. FIRST 오류 메시지를 반환(통과면 null).
 * 검사 순서는 서버 `validateFileField` 와 동일(MIME → per-file size → total size → count).
 * 필드에 명시되지 않은 제약은 §1 공유 기본값을 적용한다. 메시지는 i18n(`editor.runResults.formFile*`).
 */
function validateFilesClient(
  files: File[],
  field: FormField,
  t: TFunction,
): string | null {
  if (files.length === 0) return null;
  const allowedMime =
    field.allowedMimeTypes && field.allowedMimeTypes.length > 0
      ? field.allowedMimeTypes
      : DEFAULT_FILE_ALLOWED_MIME_TYPES;
  const maxFileSize = field.maxFileSize ?? DEFAULT_FILE_MAX_FILE_SIZE_MB;
  const maxTotalSize = field.maxTotalSize ?? DEFAULT_FILE_MAX_TOTAL_SIZE_MB;
  const maxFiles = field.maxFiles ?? DEFAULT_FILE_MAX_FILES;

  for (const f of files) {
    if (f.type && !allowedMime.includes(f.type)) {
      return t("editor.runResults.formFileMimeRejected");
    }
  }
  for (const f of files) {
    if (f.size > maxFileSize * MB_IN_BYTES) {
      return t("editor.runResults.formFileSizeExceeded", { max: maxFileSize });
    }
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > maxTotalSize * MB_IN_BYTES) {
    return t("editor.runResults.formFileTotalExceeded", { max: maxTotalSize });
  }
  if (files.length > maxFiles) {
    return t("editor.runResults.formFileCountExceeded", { max: maxFiles });
  }
  return null;
}

/**
 * Sanitize `field.name` (LLM-emitted) before embedding in a DOM id.
 * CSS selector special chars (`.`, `[`, `#`, space, …) are replaced with `_`
 * so the id remains a safe CSS selector fragment (I#3).
 */
function fieldInputId(field: FormField, idx: number): string {
  const safe = (field.name || "field").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `dyn-form-${safe}-${idx}`;
}

/**
 * Normalise an option value to a string for use in `<option value>` / radio
 * `value` / `checked` comparison. Centralises the `String(v ?? "")` coerce
 * that was previously duplicated across select and radio (W#7).
 */
function normalizeOptionValue(v: unknown): string {
  return String(v ?? "");
}

function renderField(
  field: FormField,
  idx: number,
  value: unknown,
  onChange: (v: unknown) => void,
  onError: (msg: string | null) => void,
  t: TFunction,
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
          value={normalizeOptionValue(value)}
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
              key={`${normalizeOptionValue(opt.value)}-${optIdx}`}
              value={normalizeOptionValue(opt.value)}
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
              key={`${normalizeOptionValue(opt.value)}-${optIdx}`}
              className="flex items-center gap-1 text-xs"
            >
              <input
                type="radio"
                name={field.name}
                value={normalizeOptionValue(opt.value)}
                // spec §10.5 step 4 SSOT 4-layer alignment — backend may emit
                // option.value as number / boolean / object. normalizeOptionValue
                // coerces both sides for the equality check so user selection
                // persists across type drift.
                checked={normalizeOptionValue(value) === normalizeOptionValue(opt.value)}
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
            const input = e.target as HTMLInputElement;
            const fileList = input.files;
            if (!fileList) {
              onError(null);
              onChange([]);
              return;
            }
            const files = Array.from(fileList);
            // spec §1.5 — 제출 전 클라이언트 가드. MIME/크기/개수 위반 시 selection 자체를
            // 거부(fieldState 에 반영하지 않음) + 에러 표시 + input clear (제출 버튼은 유지).
            const err = validateFilesClient(files, field, t);
            if (err) {
              onError(err);
              input.value = "";
              return;
            }
            onError(null);
            onChange(files.map(toFileMetadata));
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
  const t = useT();
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
  // spec §1.5 — file 선택 클라이언트 검증 실패 메시지 (필드명 → 메시지).
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleError = (name: string, msg: string | null) => {
    setErrors((prev) => {
      if (msg === null) {
        if (prev[name] === undefined) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: msg };
    });
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
            {renderField(
              field,
              idx,
              values[field.name],
              (v) => handleChange(field.name, v),
              (msg) => handleError(field.name, msg),
              t,
            )}
            {errors[field.name] && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
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
