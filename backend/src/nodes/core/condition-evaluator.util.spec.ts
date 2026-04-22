import { evaluateCondition } from './condition-evaluator.util.js';

describe('evaluateCondition', () => {
  describe('comparison operators (loose mode, default)', () => {
    it('eq — matches equal string primitives', () => {
      expect(
        evaluateCondition(
          { status: 'active' },
          { field: 'status', operator: 'eq', value: 'active' },
        ),
      ).toBe(true);
    });

    it('eq — loose mode coerces "42" and 42 as equal', () => {
      expect(
        evaluateCondition(
          { n: '42' },
          { field: 'n', operator: 'eq', value: 42 },
        ),
      ).toBe(true);
    });

    it('neq — true when values differ', () => {
      expect(
        evaluateCondition({ v: 5 }, { field: 'v', operator: 'neq', value: 10 }),
      ).toBe(true);
    });

    it('gt/gte/lt/lte — numeric comparison', () => {
      expect(
        evaluateCondition(
          { age: 25 },
          { field: 'age', operator: 'gt', value: 18 },
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { age: 18 },
          { field: 'age', operator: 'gte', value: 18 },
        ),
      ).toBe(true);
      expect(
        evaluateCondition({ s: 3 }, { field: 's', operator: 'lt', value: 5 }),
      ).toBe(true);
      expect(
        evaluateCondition({ s: 5 }, { field: 's', operator: 'lte', value: 5 }),
      ).toBe(true);
    });
  });

  describe('comparison operators (strict mode)', () => {
    it('eq strict — "42" and 42 are not equal', () => {
      expect(
        evaluateCondition(
          { n: '42' },
          { field: 'n', operator: 'eq', value: 42 },
          { strict: true },
        ),
      ).toBe(false);
    });

    it('eq strict — equal primitives still match', () => {
      expect(
        evaluateCondition(
          { n: 42 },
          { field: 'n', operator: 'eq', value: 42 },
          { strict: true },
        ),
      ).toBe(true);
    });

    it('neq strict — true when types differ even if loose-equal', () => {
      expect(
        evaluateCondition(
          { n: '42' },
          { field: 'n', operator: 'neq', value: 42 },
          { strict: true },
        ),
      ).toBe(true);
    });
  });

  describe('string operators', () => {
    it('contains / not_contains', () => {
      expect(
        evaluateCondition(
          { name: 'hello world' },
          { field: 'name', operator: 'contains', value: 'world' },
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { name: 'hello' },
          { field: 'name', operator: 'not_contains', value: 'world' },
        ),
      ).toBe(true);
    });

    it('starts_with / ends_with', () => {
      expect(
        evaluateCondition(
          { url: 'https://example.com' },
          { field: 'url', operator: 'starts_with', value: 'https' },
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { file: 'document.pdf' },
          { field: 'file', operator: 'ends_with', value: '.pdf' },
        ),
      ).toBe(true);
    });

    it('contains returns false when compare types are not strings', () => {
      expect(
        evaluateCondition(
          { n: 12345 },
          { field: 'n', operator: 'contains', value: '23' },
        ),
      ).toBe(false);
    });
  });

  describe('emptiness / null operators', () => {
    it('is_empty — empty string, null, undefined, empty array', () => {
      expect(
        evaluateCondition({ f: '' }, { field: 'f', operator: 'is_empty' }),
      ).toBe(true);
      expect(
        evaluateCondition({ f: null }, { field: 'f', operator: 'is_empty' }),
      ).toBe(true);
      expect(evaluateCondition({}, { field: 'f', operator: 'is_empty' })).toBe(
        true,
      );
      expect(
        evaluateCondition({ f: [] }, { field: 'f', operator: 'is_empty' }),
      ).toBe(true);
    });

    it('is_not_empty — truthy string / non-empty array', () => {
      expect(
        evaluateCondition({ f: 'x' }, { field: 'f', operator: 'is_not_empty' }),
      ).toBe(true);
      expect(
        evaluateCondition({ f: [1] }, { field: 'f', operator: 'is_not_empty' }),
      ).toBe(true);
    });

    it('is_null — null and undefined both match', () => {
      expect(
        evaluateCondition({ f: null }, { field: 'f', operator: 'is_null' }),
      ).toBe(true);
      expect(
        evaluateCondition({}, { field: 'missing', operator: 'is_null' }),
      ).toBe(true);
    });
  });

  describe('nested paths and safety', () => {
    it('supports dot-notation nested field access', () => {
      expect(
        evaluateCondition(
          { user: { profile: { age: 30 } } },
          { field: 'user.profile.age', operator: 'gte', value: 21 },
        ),
      ).toBe(true);
    });

    it('blocks prototype pollution paths', () => {
      expect(
        evaluateCondition(
          {},
          { field: '__proto__.constructor', operator: 'eq', value: 'Function' },
        ),
      ).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('returns false for unknown operators', () => {
      expect(
        evaluateCondition(
          { x: 1 },
          { field: 'x', operator: 'totally_made_up' as never, value: 1 },
        ),
      ).toBe(false);
    });
  });
});
