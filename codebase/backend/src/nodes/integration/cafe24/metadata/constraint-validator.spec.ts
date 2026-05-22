import type { Cafe24OperationMetadata } from './types.js';
import { validateCafe24Constraints } from './constraint-validator.js';

/**
 * Helper — minimal operation stub. `id`/`label`/etc. are not consulted by
 * the validator; only `fields` (for key reference) and `constraints` matter.
 */
function op(
  fields: string[],
  constraints: Cafe24OperationMetadata['constraints'],
): Cafe24OperationMetadata {
  return {
    id: 'test_op',
    label: 'test',
    description: 'test',
    scopeType: 'read',
    method: 'GET',
    path: 'test',
    requiredFields: [],
    fields: Object.fromEntries(
      fields.map((f) => [f, { type: 'string', location: 'query' as const }]),
    ),
    constraints,
  };
}

describe('validateCafe24Constraints', () => {
  it('returns null when no constraints declared', () => {
    expect(validateCafe24Constraints(op(['a', 'b'], undefined), {})).toBeNull();
    expect(validateCafe24Constraints(op(['a', 'b'], []), {})).toBeNull();
  });

  describe('oneOf', () => {
    const o = op(['a', 'b', 'c'], [{ kind: 'oneOf', fields: ['a', 'b', 'c'] }]);

    it('passes when at least one field is present', () => {
      expect(validateCafe24Constraints(o, { a: 'x' })).toBeNull();
      expect(validateCafe24Constraints(o, { b: 1, c: true })).toBeNull();
    });

    it('fails when all listed fields are absent', () => {
      expect(validateCafe24Constraints(o, {})).toContain('oneOf');
      expect(validateCafe24Constraints(o, { a: '', b: null })).toContain(
        'oneOf',
      );
    });

    it('treats null, undefined, empty string as absent', () => {
      expect(
        validateCafe24Constraints(o, { a: null, b: undefined, c: '' }),
      ).toContain('oneOf');
    });
  });

  describe('allOrNone', () => {
    const o = op(
      ['since', 'until'],
      [{ kind: 'allOrNone', fields: ['since', 'until'] }],
    );

    it('passes when all listed fields are present', () => {
      expect(
        validateCafe24Constraints(o, { since: '2026', until: '2027' }),
      ).toBeNull();
    });

    it('passes when none of the listed fields are present', () => {
      expect(validateCafe24Constraints(o, {})).toBeNull();
      expect(validateCafe24Constraints(o, { since: '', until: null })).toBeNull();
    });

    it('fails when only some listed fields are present', () => {
      expect(validateCafe24Constraints(o, { since: '2026' })).toContain(
        'allOrNone',
      );
      expect(validateCafe24Constraints(o, { until: '2027' })).toContain(
        'allOrNone',
      );
    });
  });

  describe('implies', () => {
    const o = op(
      ['a', 'b', 'c'],
      [{ kind: 'implies', if: 'a', then: ['b', 'c'] }],
    );

    it('passes when "if" is absent (regardless of "then")', () => {
      expect(validateCafe24Constraints(o, {})).toBeNull();
      expect(validateCafe24Constraints(o, { b: 'x' })).toBeNull();
    });

    it('passes when "if" present and all "then" fields present', () => {
      expect(
        validateCafe24Constraints(o, { a: 'x', b: 'y', c: 'z' }),
      ).toBeNull();
    });

    it('fails when "if" present but some "then" field absent', () => {
      expect(validateCafe24Constraints(o, { a: 'x' })).toContain('implies');
      expect(validateCafe24Constraints(o, { a: 'x', b: 'y' })).toContain(
        'implies',
      );
    });
  });

  describe('multiple constraints', () => {
    it('returns first violation only', () => {
      const o = op(
        ['a', 'b', 'c', 'd'],
        [
          { kind: 'oneOf', fields: ['a', 'b'] },
          { kind: 'allOrNone', fields: ['c', 'd'] },
        ],
      );
      // Both violated — message should be for the first (oneOf)
      const msg = validateCafe24Constraints(o, { c: 'x' });
      expect(msg).toContain('oneOf');
      expect(msg).not.toContain('allOrNone');
    });

    it('passes when all constraints satisfied', () => {
      const o = op(
        ['a', 'b', 'c', 'd'],
        [
          { kind: 'oneOf', fields: ['a', 'b'] },
          { kind: 'allOrNone', fields: ['c', 'd'] },
        ],
      );
      expect(
        validateCafe24Constraints(o, { a: 'x', c: 'y', d: 'z' }),
      ).toBeNull();
    });
  });
});
