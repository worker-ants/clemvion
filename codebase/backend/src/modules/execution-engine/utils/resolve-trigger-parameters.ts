import {
  TriggerParameterDefinition,
  TriggerParameterValidationError,
  TriggerParameterValidationException,
} from '../types/trigger-parameter.types';
import { coerceToType, CoercibleType } from './coerce-type';

/**
 * Detect when coerceToType silently passed through an incompatible raw value.
 *
 * - number: non-numeric input → null (coerceToType) → failure
 * - object: non-object, non-JSON-object-string input → passthrough → failure
 * - array: non-array, non-JSON-array-string input → passthrough → failure
 * - string/boolean never fail (always coercible)
 */
function isCoerceFailure(
  type: CoercibleType,
  source: unknown,
  coerced: unknown,
): boolean {
  if (source === null || source === undefined) return false;
  if (type === 'number') {
    return coerced === null;
  }
  if (type === 'object') {
    return (
      coerced === null || typeof coerced !== 'object' || Array.isArray(coerced)
    );
  }
  if (type === 'array') {
    return !Array.isArray(coerced);
  }
  return false;
}

/**
 * Extract a top-level key from an object-typed raw source.
 * Returns undefined if source is not an object or key is missing.
 */
function readRawValue(
  rawSource: unknown,
  name: string,
): { present: boolean; value: unknown } {
  if (
    rawSource !== null &&
    typeof rawSource === 'object' &&
    !Array.isArray(rawSource) &&
    Object.prototype.hasOwnProperty.call(rawSource, name)
  ) {
    return {
      present: true,
      value: (rawSource as Record<string, unknown>)[name],
    };
  }
  return { present: false, value: undefined };
}

/**
 * Validate a trigger parameter schema structurally. Returns list of errors.
 */
export function validateTriggerParameterSchema(
  schema: unknown,
): TriggerParameterValidationError[] {
  const errors: TriggerParameterValidationError[] = [];
  if (schema === undefined || schema === null) return errors;
  if (!Array.isArray(schema)) {
    errors.push({ field: '(root)', reason: 'invalid_schema' });
    return errors;
  }
  const seen = new Set<string>();
  for (let i = 0; i < schema.length; i++) {
    const def = schema[i] as Partial<TriggerParameterDefinition> | undefined;
    const label = def?.name ?? `[${i}]`;
    if (
      !def ||
      typeof def.name !== 'string' ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.name)
    ) {
      errors.push({ field: label, reason: 'invalid_schema' });
      continue;
    }
    if (seen.has(def.name)) {
      errors.push({ field: def.name, reason: 'invalid_schema' });
      continue;
    }
    seen.add(def.name);
    if (
      def.type !== 'string' &&
      def.type !== 'number' &&
      def.type !== 'boolean' &&
      def.type !== 'object' &&
      def.type !== 'array'
    ) {
      errors.push({ field: def.name, reason: 'invalid_schema' });
    }
  }
  return errors;
}

/**
 * 선언된 스키마에 맞춰 raw 파라미터 값을 해석한다.
 *
 * - optional 파라미터에는 기본값을 채운다
 * - 누락된 required 필드 **전부**와 coerce 실패(`object`/`array` 인데 JSON 처럼 보이는
 *   문자열이 파싱에 실패한 경우 등)를 모아 `TriggerParameterValidationException` 을 던진다
 * - 스키마가 비었거나 없으면 `{}` 를 돌려준다(pass-through 호환)
 *
 * ## ⚠️ Manual 실행 경로는 이 함수를 **직접 부르지 않는다**
 *
 * `POST /workflows/:id/execute` 와 `POST /executions/:id/re-run` 두 곳은 wrapper
 * {@link resolveTriggerParametersRejectingMasked}
 * (`./reject-masked-resubmission.ts`) 를 부른다 — 그쪽이 egress 마스킹 마커의 재제출을
 * raw 단계에서 먼저 거부한 뒤 이 함수로 위임한다.
 *
 * **그 검사를 여기(base)에 넣지 않은 것은 의도다.** base 는 Webhook·Schedule 어댑터도
 * 공유하는데 그 경로들은 마커를 되돌려 받는 표면이 아니다 — 공유 함수에 넣으면 무관한
 * 경로가 같은 거부 규칙을 진다. 규칙의 강제는 CI 가드
 * (`repo-guards/__tests__/masked-reject-callers-guard.ts`)가 맡는다: Manual 경로가 base 를
 * 직접 부르면 RED.
 *
 * 정의 SoT: `spec/5-system/14-external-interaction-api.md` §R17 ·
 * `spec/4-nodes/7-trigger/1-manual-trigger.md` §6.
 */
export function resolveTriggerParameters(
  schema: TriggerParameterDefinition[] | undefined | null,
  rawSource: unknown,
): Record<string, unknown> {
  if (!schema || schema.length === 0) {
    return {};
  }

  const errors: TriggerParameterValidationError[] = [];
  const resolved: Record<string, unknown> = {};

  for (const def of schema) {
    const { present, value } = readRawValue(rawSource, def.name);
    let effective: unknown;
    if (!present || value === undefined || value === null || value === '') {
      if (def.required === true) {
        errors.push({ field: def.name, reason: 'missing_required' });
        continue;
      }
      effective = def.defaultValue ?? null;
    } else {
      effective = value;
    }

    const coerced = coerceToType(effective, def.type);

    if (isCoerceFailure(def.type, effective, coerced)) {
      errors.push({ field: def.name, reason: 'coerce_failed' });
      continue;
    }

    resolved[def.name] = coerced;
  }

  if (errors.length > 0) {
    throw new TriggerParameterValidationException(errors);
  }

  return resolved;
}
