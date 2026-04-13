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
 * Resolve raw parameter values against a declared schema.
 *
 * - Applies defaults for optional params
 * - Throws TriggerParameterValidationException listing all missing required
 *   fields and any coerce failures (for object/array where JSON parse fails
 *   yet value is a string that looks like JSON)
 * - Returns `{}` when schema is empty or missing (pass-through compatibility)
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
