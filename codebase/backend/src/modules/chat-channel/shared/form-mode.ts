import type { FormModalField } from '../types';

/**
 * Form 입력 표면 결정 + formConfig 필드 정규화 (pure, provider-invariant).
 *
 * SoT:
 *   - spec/conventions/chat-channel-adapter.md §4 / §4.1 / R-CCA-8
 *   - spec/5-system/15-chat-channel.md CCH-MP-03
 *
 * native modal 진입 조건 (§4.1):
 *   (a) supportsNativeForm === true (provider capability)
 *   (b) formMode !== 'multi_step' (사용자 opt-out 아님)
 *   (c) 0 < fields.length <= 5 (Discord modal 5 TEXT_INPUT hard limit 을 공통 분모로)
 *   (d) 전 필드가 provider 의 modal 수용 타입 (isFieldModalCompatible)
 * 하나라도 미충족이면 §4.2 다단계.
 */

export type FormMode = 'multi_step' | 'native_modal' | 'auto';

/** §4.1 진입 조건의 최대 필드 수 (Discord modal hard limit). */
export const NATIVE_MODAL_MAX_FIELDS = 5;

/**
 * spec/4-nodes/6-presentation/4-form.md §1 — `type: 'file'` 필드 공유 기본값.
 * formFieldSchema(`form.schema.ts`)는 4 file 옵션을 zod default 없이 optional() 로만 두므로,
 * 미설정 시 코드에서 자동 주입되지 않는다 → `extractFormFields` 가 **file 필드에 한해**
 * 아래 기본값을 주입한다(비-file 필드는 미설정 유지 — config echo 오염 방지, Principle 1.1).
 */
/** 문서/이미지만 허용 (실행파일·스크립트·아카이브 제외). */
export const DEFAULT_FILE_ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];
/** 단일 파일 최대 크기 (MB). */
export const DEFAULT_FILE_MAX_FILE_SIZE_MB = 10;
/** 필드 전체 파일 합계 최대 크기 (MB). */
export const DEFAULT_FILE_MAX_TOTAL_SIZE_MB = 50;
/** 필드당 최대 파일 수. */
export const DEFAULT_FILE_MAX_FILES = 5;
/** MB → bytes 변환 (MiB = 1024×1024). file size 비교에 사용. */
export const MB_IN_BYTES = 1024 * 1024;

export interface DecideFormModeParams {
  /** config.uiMapping.formMode — 미설정 시 'auto'. */
  formMode: FormMode | undefined;
  /** adapter.supportsNativeForm. */
  supportsNativeForm: boolean;
  fields: FormModalField[];
  /** provider 별 modal 수용 타입 판정 (Slack: file 외 전부 / Discord: text 계열만). */
  isFieldModalCompatible: (field: FormModalField) => boolean;
}

/**
 * native modal 경로를 탈지 결정. 위 4 조건 모두 충족 시 'native_modal', 아니면 'multi_step'.
 */
export function decideFormMode(
  params: DecideFormModeParams,
): 'native_modal' | 'multi_step' {
  const { formMode, supportsNativeForm, fields, isFieldModalCompatible } =
    params;
  if (formMode === 'multi_step') return 'multi_step';
  if (!supportsNativeForm) return 'multi_step';
  if (fields.length === 0 || fields.length > NATIVE_MODAL_MAX_FIELDS) {
    return 'multi_step';
  }
  if (!fields.every((f) => isFieldModalCompatible(f))) return 'multi_step';
  return 'native_modal';
}

/**
 * EIA waiting_for_input.context.formConfig (또는 form_modal.formConfig) 에서 fields[] 를
 * FormModalField[] 로 정규화. formConfig 의 두 shape 모두 수용:
 *   - `{ fields: [...] }` (formConfig 직접)
 *   - `{ config: { fields: [...] } }` (nodeOutput wrapping — dispatcher toChatChannelEvent 정합)
 * 잘못된 shape / 빈 필드는 빈 배열. §3.3 — 각 필드의 `validation.{minLength,maxLength}` 도
 * `minLength`(≥0)·`maxLength`(>0) 로 정규화한다 (modal TEXT_INPUT 길이 제약 + 서버측 재검증용).
 * §6.2 — `validation.{min,max}`(유한수, `min > max` 논리 역전은 두 경계 모두 무시)·`pattern`
 * (비어있지 않은 regex 문자열)도 서버측 검증용으로 정규화한다.
 * §1/§6.2 — `type: 'file'` 필드는 4 제약(`allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles`)을
 * 공유 기본값으로 주입한다(file 타입 한정 — 비-file 필드는 미설정 유지, Principle 1.1).
 */
export function extractFormFields(formConfig: unknown): FormModalField[] {
  if (!formConfig || typeof formConfig !== 'object') return [];
  const root = formConfig as Record<string, unknown>;
  const rawFields = Array.isArray(root.fields)
    ? root.fields
    : root.config &&
        typeof root.config === 'object' &&
        Array.isArray((root.config as Record<string, unknown>).fields)
      ? ((root.config as Record<string, unknown>).fields as unknown[])
      : [];
  const out: FormModalField[] = [];
  /** Valid field name pattern: alphanumeric, underscore, hyphen, 1–64 chars.
   * Rejects path traversal (../../), newlines, SQL special chars etc. */
  const FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  for (const raw of rawFields) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : '';
    const type = typeof f.type === 'string' ? f.type : 'text';
    if (!name || !FIELD_NAME_RE.test(name)) continue;
    const label =
      typeof f.label === 'string' && f.label.length > 0 ? f.label : name;
    const field: FormModalField = { name, label, type };
    if (f.required === true) field.required = true;
    if (typeof f.description === 'string' && f.description.length > 0) {
      field.description = f.description;
    }
    const opts = normalizeOptions(f.options);
    if (opts) field.options = opts;
    // §3.3 — field.validation.{minLength,maxLength} (form.schema validationRuleSchema) 정규화.
    const validation =
      f.validation && typeof f.validation === 'object'
        ? (f.validation as Record<string, unknown>)
        : undefined;
    if (validation) {
      if (
        typeof validation.minLength === 'number' &&
        validation.minLength >= 0
      ) {
        field.minLength = validation.minLength;
      }
      if (
        typeof validation.maxLength === 'number' &&
        validation.maxLength > 0
      ) {
        field.maxLength = validation.maxLength;
      }
      // §6.2 — number 범위(min/max)·custom regex pattern. 서버측 검증 전용.
      // min/max 는 0·음수도 유효한 경계이므로 유한수 전부 수용(minLength 의 ≥0 제약과 다름).
      const minV = Number.isFinite(validation.min)
        ? (validation.min as number)
        : undefined;
      const maxV = Number.isFinite(validation.max)
        ? (validation.max as number)
        : undefined;
      // 논리 역전(min > max)은 항상-실패 config 오류 → 두 경계 모두 무시(방어적).
      if (minV === undefined || maxV === undefined || minV <= maxV) {
        if (minV !== undefined) field.min = minV;
        if (maxV !== undefined) field.max = maxV;
      }
      if (typeof validation.pattern === 'string' && validation.pattern) {
        field.pattern = validation.pattern;
      }
    }
    // §1/§6.2 — file 필드 전용 제약. file 타입에 한해 공유 기본값을 주입한다
    // (비-file 필드는 미설정 유지 — config echo 오염 방지, Principle 1.1).
    if (type === 'file') {
      const mimes = Array.isArray(f.allowedMimeTypes)
        ? f.allowedMimeTypes.filter((m): m is string => typeof m === 'string')
        : undefined;
      field.allowedMimeTypes =
        mimes && mimes.length > 0
          ? mimes
          : [...DEFAULT_FILE_ALLOWED_MIME_TYPES];
      field.maxFileSize =
        typeof f.maxFileSize === 'number' && f.maxFileSize > 0
          ? f.maxFileSize
          : DEFAULT_FILE_MAX_FILE_SIZE_MB;
      field.maxTotalSize =
        typeof f.maxTotalSize === 'number' && f.maxTotalSize > 0
          ? f.maxTotalSize
          : DEFAULT_FILE_MAX_TOTAL_SIZE_MB;
      field.maxFiles =
        typeof f.maxFiles === 'number' && f.maxFiles > 0
          ? f.maxFiles
          : DEFAULT_FILE_MAX_FILES;
    }
    out.push(field);
  }
  return out;
}

/**
 * §3.3 — formConfig 에서 폼 제목(`title`)을 추출. extractFormFields 와 동일하게 두 shape 수용
 * (`{ title }` 직접 / `{ config: { title } }` nodeOutput wrapping). 비문자열/빈 문자열은 undefined.
 */
export function extractFormTitle(formConfig: unknown): string | undefined {
  if (!formConfig || typeof formConfig !== 'object') return undefined;
  const root = formConfig as Record<string, unknown>;
  const direct = typeof root.title === 'string' ? root.title : undefined;
  const nested =
    root.config && typeof root.config === 'object'
      ? (root.config as Record<string, unknown>).title
      : undefined;
  const title = direct ?? (typeof nested === 'string' ? nested : undefined);
  return title && title.trim().length > 0 ? title : undefined;
}

/** §4.1 step 4 client-side 검증 정규식 — 기본 email shape. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** §4.1 step 4 client-side 검증 정규식 — 정수/소수 (음수 허용). */
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
/**
 * §6.2 `validation.pattern` 최대 길이. pattern 은 노드 관리자가 작성한 워크플로 config
 * 에서만 오므로(신뢰 경계 — 폼 제출자/외부 입력이 아님) ReDoS 표면은 작지만, defense-in-depth
 * 로 과도하게 긴 패턴은 컴파일하지 않고 skip 한다.
 */
const MAX_PATTERN_LENGTH = 512;

/**
 * 단일 비-file 필드(scalar)의 값 검증 (pure). FIRST 오류 반환, 통과면 null.
 * `value` 는 이미 문자열로 정규화된 상태여야 한다(호출자가 coerce).
 *
 * 규칙 (FIRST 오류 순서):
 *   - required: 값 누락/공백 → 필수 입력 오류.
 *   - type=email: 비어있지 않은 값이 EMAIL_RE 미충족 → 이메일 형식 오류.
 *   - type=number: 비어있지 않은 값이 NUMBER_RE 미충족 → 숫자 형식 오류.
 *   - minLength/maxLength: 길이 제약 위반 → 길이 오류.
 *   - type=number + min/max: 숫자 범위(min 미만/max 초과) 위반 → 범위 오류 (§6.2).
 *   - pattern: 비어있지 않은 값이 custom regex pattern 미일치 → 형식 오류 (§6.2).
 *     pattern 은 노드 관리자 config(신뢰 경계) 전용 — 폼 제출자 입력이 아니다.
 *     (잘못된 regex·과길이 패턴은 방어적으로 통과 — validator 가 throw 하지 않는다.)
 *   - type=select|radio (+ options): 비어있지 않은 값이 options.value 집합 밖 → 선택지 오류.
 * 빈 optional 필드는 skip. `type: 'file'` 은 본 함수 대상이 아님({@link validateFileField}).
 *
 * SoT: spec/conventions/chat-channel-adapter.md §4.1 step 4 + spec/4-nodes/6-presentation/4-form.md §6.2.
 */
export function validateScalarField(
  value: string,
  def: FormModalField,
): { field: string; message: string } | null {
  const isEmpty = value.trim().length === 0;

  if (def.required === true && isEmpty) {
    return { field: def.name, message: '필수 입력 항목입니다.' };
  }
  // 빈 optional 필드는 형식 검증 skip.
  if (isEmpty) return null;

  if (def.type === 'email' && !EMAIL_RE.test(value)) {
    return { field: def.name, message: '올바른 이메일 형식이 아닙니다.' };
  }
  if (def.type === 'number' && !NUMBER_RE.test(value)) {
    return { field: def.name, message: '숫자만 입력해 주세요.' };
  }
  // §3.3 — 길이 제약 서버측 검증 (Discord modal min/max 는 UI hint 일 뿐 bypass 가능).
  if (typeof def.minLength === 'number' && value.length < def.minLength) {
    return {
      field: def.name,
      message: `최소 ${def.minLength}자 이상 입력해 주세요.`,
    };
  }
  if (typeof def.maxLength === 'number' && value.length > def.maxLength) {
    return {
      field: def.name,
      message: `최대 ${def.maxLength}자까지 입력할 수 있습니다.`,
    };
  }
  // §6.2 — number 범위 검증 (형식 검증 통과 후, value 는 유한수).
  if (def.type === 'number') {
    const num = Number(value);
    if (typeof def.min === 'number' && num < def.min) {
      return {
        field: def.name,
        message: `최솟값은 ${def.min} 이상이어야 합니다.`,
      };
    }
    if (typeof def.max === 'number' && num > def.max) {
      return {
        field: def.name,
        message: `최댓값은 ${def.max} 이하여야 합니다.`,
      };
    }
  }
  // §6.2 — custom regex pattern 검증. pattern 은 노드 관리자 config(신뢰 경계) 전용 —
  // 폼 제출자 입력이 아니다. 잘못된 regex·과길이 패턴(MAX_PATTERN_LENGTH 초과)은 방어적으로
  // 통과(throw·ReDoS 회피).
  if (
    typeof def.pattern === 'string' &&
    def.pattern &&
    def.pattern.length <= MAX_PATTERN_LENGTH
  ) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(def.pattern);
    } catch {
      re = null;
    }
    if (re && !re.test(value)) {
      return { field: def.name, message: '형식이 올바르지 않습니다.' };
    }
  }
  if (
    (def.type === 'select' || def.type === 'radio') &&
    def.options &&
    def.options.length > 0
  ) {
    const allowed = def.options.map((o) => o.value);
    if (!allowed.includes(value)) {
      return { field: def.name, message: '유효한 선택지가 아닙니다.' };
    }
  }
  return null;
}

/**
 * §4.1 step 4 — submit_form 전 client-side 값 검증 (pure). 서버측 EIA 검증 + catch 경로를
 * 보완하는 1차 게이트. defs 순서대로 scalar 검사해 FIRST 오류를 반환, 모두 통과면 null.
 * (chat-channel modal 경로 — file 필드는 modal 미수용이라 도달하지 않으므로 scalar 만 검사.)
 *
 * SoT: spec/conventions/chat-channel-adapter.md §4.1 step 4 + spec/4-nodes/6-presentation/4-form.md §6.2.
 */
export function validateFormSubmission(
  fields: Record<string, string>,
  defs: FormModalField[],
): { field: string; message: string } | null {
  for (const def of defs) {
    const raw = fields[def.name];
    const value = typeof raw === 'string' ? raw : '';
    const err = validateScalarField(value, def);
    if (err) return err;
  }
  return null;
}

/**
 * §6.2 / §1.5 — `type: 'file'` 필드의 metadata 배열 서버측 검증 (pure). FIRST 오류 반환, 통과면 null.
 *
 * frontend(`DynamicFormUI`)가 FileList → `{name,size,type,lastModified}[]` 로 직렬화한
 * metadata-only payload 가 대상. binary 본문은 미전달이라 검증 대상은 metadata 필드
 * (`size`/`type`/개수)에 한정한다.
 *
 * 규칙 (FIRST 오류 순서, §1.5 와 동일):
 *   - required: 파일 없음(빈 배열/누락) → 필수 입력 오류.
 *   - MIME: 첫 위반 파일의 `type` 이 `allowedMimeTypes` 밖 → 형식 오류.
 *   - per-file size: 어떤 파일의 `size` > `maxFileSize` MB → 크기 오류.
 *   - total size: Σ`size` > `maxTotalSize` MB → 합계 오류.
 *   - count: 파일 수 > `maxFiles` → 개수 오류.
 *
 * 방어적: 배열이 아니거나 element 가 객체가 아니면 해당 element skip. metadata 에 `size`(number)/
 * `type`(string) 이 없으면 그 체크만 skip — chat-channel 어댑터(Slack `{fileId,mimeType,…}`) 처럼
 * 다른 shape 의 file payload 는 size/MIME 미보유라 자연 bypass (form §1.5 divergence 주석).
 *
 * SoT: spec/4-nodes/6-presentation/4-form.md §1.5 / §6.2 / §1.
 */
export function validateFileField(
  value: unknown,
  def: FormModalField,
): { field: string; message: string } | null {
  const metas = (Array.isArray(value) ? value : []).filter(
    (x): x is Record<string, unknown> => !!x && typeof x === 'object',
  );

  if (def.required === true && metas.length === 0) {
    return { field: def.name, message: '필수 입력 항목입니다.' };
  }
  if (metas.length === 0) return null;

  // MIME — 첫 위반 파일.
  if (def.allowedMimeTypes && def.allowedMimeTypes.length > 0) {
    const allowed = def.allowedMimeTypes;
    for (const m of metas) {
      if (typeof m.type === 'string' && !allowed.includes(m.type)) {
        return { field: def.name, message: '허용되지 않은 파일 형식입니다.' };
      }
    }
  }
  // per-file size (MB → bytes).
  if (typeof def.maxFileSize === 'number') {
    const limit = def.maxFileSize * MB_IN_BYTES;
    for (const m of metas) {
      if (typeof m.size === 'number' && m.size > limit) {
        return {
          field: def.name,
          message: `파일 크기는 ${def.maxFileSize}MB 이하여야 합니다.`,
        };
      }
    }
  }
  // total size (Σ size, MB → bytes).
  if (typeof def.maxTotalSize === 'number') {
    const total = metas.reduce(
      (sum, m) => sum + (typeof m.size === 'number' ? m.size : 0),
      0,
    );
    if (total > def.maxTotalSize * MB_IN_BYTES) {
      return {
        field: def.name,
        message: `전체 파일 크기는 ${def.maxTotalSize}MB 이하여야 합니다.`,
      };
    }
  }
  // count.
  if (typeof def.maxFiles === 'number' && metas.length > def.maxFiles) {
    return {
      field: def.name,
      message: `최대 ${def.maxFiles}개까지 업로드할 수 있습니다.`,
    };
  }
  return null;
}

function normalizeOptions(
  raw: unknown,
): Array<{ label: string; value: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{ label: string; value: string }> = [];
  for (const o of raw) {
    if (typeof o === 'string') {
      out.push({ label: o, value: o });
      continue;
    }
    if (o && typeof o === 'object') {
      const obj = o as Record<string, unknown>;
      const value =
        typeof obj.value === 'string'
          ? obj.value
          : typeof obj.value === 'number'
            ? String(obj.value)
            : undefined;
      if (value === undefined) continue;
      const label = typeof obj.label === 'string' ? obj.label : value;
      out.push({ label, value });
    }
  }
  return out.length > 0 ? out : undefined;
}
