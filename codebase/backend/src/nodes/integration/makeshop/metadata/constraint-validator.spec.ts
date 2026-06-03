import type { MakeshopOperationMetadata } from './types.js';
import { validateMakeshopConstraints } from './constraint-validator.js';

/**
 * Helper — minimal operation stub. Only `fields` (for key reference) and
 * `constraints` matter to the validator; `id`/`description`/etc. are stubs.
 */
function op(
  fields: string[],
  constraints: MakeshopOperationMetadata['constraints'],
): MakeshopOperationMetadata {
  return {
    id: 'test_op',
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

describe('validateMakeshopConstraints', () => {
  it('returns null when no constraints declared', () => {
    expect(
      validateMakeshopConstraints(op(['a', 'b'], undefined), {}),
    ).toBeNull();
    expect(validateMakeshopConstraints(op(['a', 'b'], []), {})).toBeNull();
  });

  describe('oneOf', () => {
    const o = op(['a', 'b', 'c'], [{ kind: 'oneOf', fields: ['a', 'b', 'c'] }]);

    it('passes when at least one field is present', () => {
      expect(validateMakeshopConstraints(o, { a: 'x' })).toBeNull();
      expect(validateMakeshopConstraints(o, { b: 1, c: true })).toBeNull();
    });

    it('fails when all listed fields are absent', () => {
      expect(validateMakeshopConstraints(o, {})).toContain('oneOf');
      expect(validateMakeshopConstraints(o, { a: '', b: null })).toContain(
        'oneOf',
      );
    });

    it('treats null, undefined, empty string as absent', () => {
      expect(
        validateMakeshopConstraints(o, { a: null, b: undefined, c: '' }),
      ).toContain('oneOf');
    });

    // MakeShop query parameters can legitimately use the number 0 and boolean
    // false — `isAbsent` only treats undefined/null/empty-string as absent,
    // not falsy values broadly.
    it('treats 0, false, and [] as present (NOT falsy-absent)', () => {
      expect(validateMakeshopConstraints(o, { a: 0 })).toBeNull();
      expect(validateMakeshopConstraints(o, { b: false })).toBeNull();
      expect(validateMakeshopConstraints(o, { c: [] })).toBeNull();
    });
  });

  describe('allOrNone', () => {
    const o = op(
      ['since', 'until'],
      [{ kind: 'allOrNone', fields: ['since', 'until'] }],
    );

    it('passes when all listed fields are present', () => {
      expect(
        validateMakeshopConstraints(o, { since: '2026', until: '2027' }),
      ).toBeNull();
    });

    it('passes when none of the listed fields are present', () => {
      expect(validateMakeshopConstraints(o, {})).toBeNull();
      expect(
        validateMakeshopConstraints(o, { since: '', until: null }),
      ).toBeNull();
    });

    it('fails when only some listed fields are present', () => {
      expect(validateMakeshopConstraints(o, { since: '2026' })).toContain(
        'allOrNone',
      );
      expect(validateMakeshopConstraints(o, { until: '2027' })).toContain(
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
      expect(validateMakeshopConstraints(o, {})).toBeNull();
      expect(validateMakeshopConstraints(o, { b: 'x' })).toBeNull();
    });

    it('passes when "if" present and all "then" fields present', () => {
      expect(
        validateMakeshopConstraints(o, { a: 'x', b: 'y', c: 'z' }),
      ).toBeNull();
    });

    it('fails when "if" present but some "then" field absent', () => {
      expect(validateMakeshopConstraints(o, { a: 'x' })).toContain('implies');
      expect(validateMakeshopConstraints(o, { a: 'x', b: 'y' })).toContain(
        'implies',
      );
    });
  });

  describe('impliesValue', () => {
    const o = op(
      ['refund_method', 'bank_name', 'account_no'],
      [
        {
          kind: 'impliesValue',
          if: 'refund_method',
          value: 'T',
          then: ['bank_name', 'account_no'],
        },
      ],
    );

    it('passes when "if" is absent (no obligation)', () => {
      expect(validateMakeshopConstraints(o, {})).toBeNull();
      expect(validateMakeshopConstraints(o, { bank_name: 'x' })).toBeNull();
    });

    it('passes when "if" is present but value differs (e.g. F vs T)', () => {
      expect(validateMakeshopConstraints(o, { refund_method: 'F' })).toBeNull();
      expect(
        validateMakeshopConstraints(o, { refund_method: 'OTHER' }),
      ).toBeNull();
    });

    it('passes when value matches and all "then" fields present', () => {
      expect(
        validateMakeshopConstraints(o, {
          refund_method: 'T',
          bank_name: 'X',
          account_no: '123',
        }),
      ).toBeNull();
    });

    it('fails when value matches but some "then" fields absent', () => {
      const msg = validateMakeshopConstraints(o, { refund_method: 'T' });
      expect(msg).toContain('impliesValue');
      expect(msg).toContain('refund_method');
      expect(msg).toContain('"T"');
      expect(
        validateMakeshopConstraints(o, {
          refund_method: 'T',
          bank_name: 'X',
        }),
      ).toContain('impliesValue');
    });

    it('uses strict equality (numeric 1 !== string "1")', () => {
      const numericOp = op(
        ['flag', 'then1'],
        [{ kind: 'impliesValue', if: 'flag', value: 1, then: ['then1'] }],
      );
      // String '1' should NOT trigger (strict equality)
      expect(validateMakeshopConstraints(numericOp, { flag: '1' })).toBeNull();
      // Numeric 1 triggers and fails
      expect(validateMakeshopConstraints(numericOp, { flag: 1 })).toContain(
        'impliesValue',
      );
    });

    it('handles boolean values', () => {
      const boolOp = op(
        ['flag', 'then1'],
        [
          {
            kind: 'impliesValue',
            if: 'flag',
            value: true,
            then: ['then1'],
          },
        ],
      );
      expect(validateMakeshopConstraints(boolOp, { flag: true })).toContain(
        'impliesValue',
      );
      expect(validateMakeshopConstraints(boolOp, { flag: false })).toBeNull();
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
      const msg = validateMakeshopConstraints(o, { c: 'x' });
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
        validateMakeshopConstraints(o, { a: 'x', c: 'y', d: 'z' }),
      ).toBeNull();
    });
  });

  describe('unknown kind — exhaustive throw', () => {
    it('throws for an unrecognized constraint kind', () => {
      const badOp = op(
        ['a'],

        [{ kind: 'badKind', fields: ['a'] } as any],
      );
      expect(() => validateMakeshopConstraints(badOp, { a: 'x' })).toThrow(
        'Unknown MakeshopFieldConstraint kind',
      );
    });
  });
});
