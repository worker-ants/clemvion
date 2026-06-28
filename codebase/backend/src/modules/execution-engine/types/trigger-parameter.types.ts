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
  reason: 'missing_required' | 'coerce_failed' | 'invalid_schema';
}

/**
 * Public error-envelope `details[]` entry for a trigger-parameter validation
 * failure. `code` is the UPPER_SNAKE_CASE field code surfaced to clients
 * (spec `5-system/3-error-handling.md §1.7`), the public counterpart of the
 * internal lowercase `reason`.
 */
export interface TriggerParameterErrorDetail {
  field: string;
  code: 'MISSING_REQUIRED_FIELD' | 'TYPE_COERCION_FAILED' | 'INVALID_SCHEMA';
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
  return errors.map((e) => ({
    field: e.field,
    code: REASON_TO_DETAIL[e.reason].code,
    message: REASON_TO_DETAIL[e.reason].message,
  }));
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
