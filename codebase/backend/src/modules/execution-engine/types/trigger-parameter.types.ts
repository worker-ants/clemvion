import type { CoercibleType } from '../utils/coerce-type';

export interface TriggerParameterDefinition {
  name: string;
  type: CoercibleType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface TriggerParameterValidationError {
  field: string;
  reason:
    | 'missing_required'
    | 'coerce_failed'
    | 'invalid_schema'
    | 'masked_value_resubmitted';
}

/**
 * Public error-envelope `details[]` entry for a trigger-parameter validation
 * failure. `code` is the UPPER_SNAKE_CASE field code surfaced to clients
 * (spec `5-system/3-error-handling.md §1.7`), the public counterpart of the
 * internal lowercase `reason`.
 */
export interface TriggerParameterErrorDetail {
  field: string;
  code:
    | 'MISSING_REQUIRED_FIELD'
    | 'TYPE_COERCION_FAILED'
    | 'INVALID_SCHEMA'
    | 'MASKED_VALUE_RESUBMITTED';
  message: string;
}

const REASON_TO_DETAIL: Record<
  TriggerParameterValidationError['reason'],
  { code: TriggerParameterErrorDetail['code']; message: string }
> = {
  /** `required: true` 인데 값이 없다 — 사용자가 취할 행동: 그 필드를 채운다. */
  missing_required: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required parameter is missing',
  },
  /**
   * 값은 있으나 선언 타입으로 변환할 수 없다(`number` 에 문자열, `object`/`array` 에
   * 파싱 불가 JSON 등) — 사용자가 취할 행동: **타입을 맞춘다**.
   */
  coerce_failed: {
    code: 'TYPE_COERCION_FAILED',
    message: 'Value could not be coerced to the declared type',
  },
  /**
   * 값이 아니라 **스키마 자체**가 깨졌다(이름 중복·미지원 타입 등) — 사용자가 취할 행동은
   * 입력 수정이 아니라 **트리거 노드 설정 수정**이다. 위 둘과 책임 주체가 다르다.
   */
  invalid_schema: {
    code: 'INVALID_SCHEMA',
    message: 'Trigger parameter schema is invalid',
  },
  /**
   * 마스킹된 값이 그대로 재제출됨 — Manual 실행 경로 한정 (EIA §R17).
   *
   * `coerce_failed` 를 재사용하지 않는 이유: 사용자가 취할 행동이 다르다. "타입이 안
   * 맞는다" 가 아니라 **"가려진 값을 다시 입력하라"** 다. 의미가 틀린 코드를 재사용하면
   * 다음 사람이 그 코드를 믿고 잘못 분기한다.
   */
  masked_value_resubmitted: {
    code: 'MASKED_VALUE_RESUBMITTED',
    message: 'Masked value was resubmitted — enter the real value',
  },
};

/**
 * Map internal validation reasons to public error-envelope `details[]` entries.
 *
 * The lowercase `reason` values (`missing_required`/`coerce_failed`) are internal
 * classification strings; the public surface uses UPPER_SNAKE_CASE field codes.
 * Callers throw `{ code, message, details }`; `GlobalExceptionFilter` forwards the
 * `details` into the official envelope's `error.details[]`
 * (spec `5-system/12-webhook.md §5.2`).
 */
export function toTriggerParameterErrorDetails(
  errors: TriggerParameterValidationError[],
): TriggerParameterErrorDetail[] {
  return errors.map((e) => {
    const { code, message } = REASON_TO_DETAIL[e.reason];
    return { field: e.field, code, message };
  });
}

export class TriggerParameterValidationException extends Error {
  readonly errors: TriggerParameterValidationError[];
  constructor(errors: TriggerParameterValidationError[]) {
    super(
      `Trigger parameter validation failed: ${errors
        .map((e) => `${e.field}(${e.reason})`)
        .join(', ')}`,
    );
    this.name = 'TriggerParameterValidationException';
    this.errors = errors;
  }
}
