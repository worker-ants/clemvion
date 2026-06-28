import {
  resolveTriggerParameters,
  validateTriggerParameterSchema,
} from './resolve-trigger-parameters';
import {
  TriggerParameterValidationException,
  toTriggerParameterErrorDetails,
} from '../types/trigger-parameter.types';

describe('resolveTriggerParameters', () => {
  it('returns {} when schema is empty or missing', () => {
    expect(resolveTriggerParameters(undefined, { anything: 1 })).toEqual({});
    expect(resolveTriggerParameters([], { anything: 1 })).toEqual({});
  });

  it('extracts same-name top-level keys and coerces types', () => {
    const schema = [
      { name: 'orderId', type: 'string' as const },
      { name: 'amount', type: 'number' as const },
      { name: 'paid', type: 'boolean' as const },
    ];
    const result = resolveTriggerParameters(schema, {
      orderId: 'abc',
      amount: '1500',
      paid: 'true',
      ignored: 'junk',
    });
    expect(result).toEqual({ orderId: 'abc', amount: 1500, paid: true });
  });

  it('applies defaultValue when optional and missing', () => {
    const schema = [
      { name: 'count', type: 'number' as const, defaultValue: 1 },
      { name: 'tag', type: 'string' as const, defaultValue: 'x' },
    ];
    expect(resolveTriggerParameters(schema, {})).toEqual({
      count: 1,
      tag: 'x',
    });
  });

  it('throws TriggerParameterValidationException listing all missing required', () => {
    const schema = [
      { name: 'a', type: 'string' as const, required: true },
      { name: 'b', type: 'number' as const, required: true },
      { name: 'c', type: 'string' as const },
    ];
    try {
      resolveTriggerParameters(schema, {});
      throw new Error('expected exception');
    } catch (err) {
      expect(err).toBeInstanceOf(TriggerParameterValidationException);
      const ex = err as TriggerParameterValidationException;
      expect(ex.errors.map((e) => e.field).sort()).toEqual(['a', 'b']);
      expect(ex.errors.every((e) => e.reason === 'missing_required')).toBe(
        true,
      );
    }
  });

  it('throws coerce_failed for non-numeric number input', () => {
    const schema = [{ name: 'n', type: 'number' as const, required: true }];
    try {
      resolveTriggerParameters(schema, { n: 'abc' });
      throw new Error('expected exception');
    } catch (err) {
      expect(err).toBeInstanceOf(TriggerParameterValidationException);
      expect((err as TriggerParameterValidationException).errors).toEqual([
        { field: 'n', reason: 'coerce_failed' },
      ]);
    }
  });

  it('throws coerce_failed for object-typed param receiving a string that is not JSON object', () => {
    const schema = [
      { name: 'payload', type: 'object' as const, required: true },
    ];
    try {
      resolveTriggerParameters(schema, { payload: 'not-json' });
      throw new Error('expected exception');
    } catch (err) {
      expect(err).toBeInstanceOf(TriggerParameterValidationException);
      expect((err as TriggerParameterValidationException).errors).toEqual([
        { field: 'payload', reason: 'coerce_failed' },
      ]);
    }
  });

  it('throws coerce_failed for array-typed param receiving non-array non-JSON-array', () => {
    const schema = [{ name: 'items', type: 'array' as const, required: true }];
    try {
      resolveTriggerParameters(schema, { items: 123 });
      throw new Error('expected exception');
    } catch (err) {
      expect(err).toBeInstanceOf(TriggerParameterValidationException);
      expect((err as TriggerParameterValidationException).errors).toEqual([
        { field: 'items', reason: 'coerce_failed' },
      ]);
    }
  });

  it('accepts JSON-serialized object strings for object params', () => {
    const schema = [{ name: 'payload', type: 'object' as const }];
    expect(resolveTriggerParameters(schema, { payload: '{"a":1}' })).toEqual({
      payload: { a: 1 },
    });
  });

  it('treats non-object rawSource as empty body (all missing)', () => {
    const schema = [{ name: 'x', type: 'string' as const }];
    expect(resolveTriggerParameters(schema, 'not-an-object')).toEqual({
      x: null,
    });
  });

  it('empty string is treated as missing for optional with default', () => {
    const schema = [
      { name: 'label', type: 'string' as const, defaultValue: 'fallback' },
    ];
    expect(resolveTriggerParameters(schema, { label: '' })).toEqual({
      label: 'fallback',
    });
  });
});

describe('validateTriggerParameterSchema', () => {
  it('accepts empty/undefined schema', () => {
    expect(validateTriggerParameterSchema(undefined)).toEqual([]);
    expect(validateTriggerParameterSchema([])).toEqual([]);
  });

  it('rejects non-array schemas', () => {
    const errs = validateTriggerParameterSchema({});
    expect(errs).toEqual([{ field: '(root)', reason: 'invalid_schema' }]);
  });

  it('flags duplicate names', () => {
    const errs = validateTriggerParameterSchema([
      { name: 'a', type: 'string' },
      { name: 'a', type: 'number' },
    ]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toEqual({ field: 'a', reason: 'invalid_schema' });
  });

  it('flags invalid identifier and unknown type', () => {
    const errs = validateTriggerParameterSchema([
      { name: '1bad', type: 'string' },
      { name: 'ok', type: 'funky' },
    ]);
    expect(errs).toEqual(
      expect.arrayContaining([
        { field: '1bad', reason: 'invalid_schema' },
        { field: 'ok', reason: 'invalid_schema' },
      ]),
    );
  });
});

describe('toTriggerParameterErrorDetails', () => {
  it('maps internal reasons to UPPER_SNAKE_CASE public field codes + messages', () => {
    const details = toTriggerParameterErrorDetails([
      { field: 'orderId', reason: 'missing_required' },
      { field: 'amount', reason: 'coerce_failed' },
      { field: '(root)', reason: 'invalid_schema' },
    ]);
    expect(details).toEqual([
      {
        field: 'orderId',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Required parameter is missing',
      },
      {
        field: 'amount',
        code: 'TYPE_COERCION_FAILED',
        message: 'Value could not be coerced to the declared type',
      },
      {
        field: '(root)',
        code: 'INVALID_SCHEMA',
        message: 'Trigger parameter schema is invalid',
      },
    ]);
  });

  it('preserves order and is empty for empty input', () => {
    expect(toTriggerParameterErrorDetails([])).toEqual([]);
  });

  it('every field code is UPPER_SNAKE_CASE (error-codes convention)', () => {
    const details = toTriggerParameterErrorDetails([
      { field: 'a', reason: 'missing_required' },
      { field: 'b', reason: 'coerce_failed' },
      { field: 'c', reason: 'invalid_schema' },
    ]);
    for (const d of details) {
      expect(d.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
