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
 * 잘못된 shape / 빈 필드는 빈 배열.
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
  for (const raw of rawFields) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : '';
    const type = typeof f.type === 'string' ? f.type : 'text';
    if (!name) continue;
    const label =
      typeof f.label === 'string' && f.label.length > 0 ? f.label : name;
    const field: FormModalField = { name, label, type };
    if (f.required === true) field.required = true;
    if (typeof f.description === 'string' && f.description.length > 0) {
      field.description = f.description;
    }
    const opts = normalizeOptions(f.options);
    if (opts) field.options = opts;
    out.push(field);
  }
  return out;
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
