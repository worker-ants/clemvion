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
  missing_required: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required parameter is missing',
  },
  coerce_failed: {
    code: 'TYPE_COERCION_FAILED',
    message: 'Value could not be coerced to the declared type',
  },
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
