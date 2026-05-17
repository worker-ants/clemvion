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
