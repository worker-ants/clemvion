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
      if (Number.isFinite(validation.min)) {
        field.min = validation.min as number;
      }
      if (Number.isFinite(validation.max)) {
        field.max = validation.max as number;
      }
      if (typeof validation.pattern === 'string' && validation.pattern) {
        field.pattern = validation.pattern;
      }
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
 * §4.1 step 4 — submit_form 전 client-side 값 검증 (pure). 서버측 EIA 검증 + catch 경로를
 * 보완하는 1차 게이트. defs 순서대로 검사해 FIRST 오류를 반환, 모두 통과면 null.
 *
 * 규칙 (def 별, FIRST 오류 순서):
 *   - required: 값 누락/공백 → 필수 입력 오류.
 *   - type=email: 비어있지 않은 값이 EMAIL_RE 미충족 → 이메일 형식 오류.
 *   - type=number: 비어있지 않은 값이 NUMBER_RE 미충족 → 숫자 형식 오류.
 *   - minLength/maxLength: 길이 제약 위반 → 길이 오류.
 *   - type=number + min/max: 숫자 범위(min 미만/max 초과) 위반 → 범위 오류 (§6.2).
 *   - pattern: 비어있지 않은 값이 custom regex pattern 미일치 → 형식 오류 (§6.2).
 *     (잘못된 regex 는 방어적으로 통과 — validator 가 throw 하지 않는다.)
 *   - type=select|radio (+ options): 비어있지 않은 값이 options.value 집합 밖 → 선택지 오류.
 * 빈 optional 필드는 skip.
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
    const isEmpty = value.trim().length === 0;

    if (def.required === true && isEmpty) {
      return { field: def.name, message: '필수 입력 항목입니다.' };
    }
    // 빈 optional 필드는 형식 검증 skip.
    if (isEmpty) continue;

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
    // §6.2 — custom regex pattern 검증. 잘못된 regex 는 방어적으로 통과(throw 회피).
    if (typeof def.pattern === 'string' && def.pattern) {
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
