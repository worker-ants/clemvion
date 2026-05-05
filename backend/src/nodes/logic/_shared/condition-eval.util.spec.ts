import {
  Condition,
  EXPRESSION_PATTERN,
  MAX_REGEX_LENGTH,
  VALID_OPERATORS,
  compileRegexCache,
  evaluateCondition,
  evaluateResolvedCondition,
} from './condition-eval.util.js';

describe('condition-eval.util', () => {
  describe('evaluateResolvedCondition', () => {
    it('compares eq with loose coercion by default', () => {
      expect(evaluateResolvedCondition('1', 'eq', 1, false)).toBe(true);
      expect(evaluateResolvedCondition('1', 'eq', 1, true)).toBe(false);
    });

    it('handles numeric operators with NaN-safe coercion', () => {
      expect(evaluateResolvedCondition(5, 'gt', 3, false)).toBe(true);
      expect(evaluateResolvedCondition(undefined, 'gt', 3, false)).toBe(false);
      expect(evaluateResolvedCondition(undefined, 'gte', 0, false)).toBe(false);
    });

    it('treats undefined and null identically for is_null', () => {
      expect(evaluateResolvedCondition(undefined, 'is_null', null, false)).toBe(
        true,
      );
      expect(evaluateResolvedCondition(null, 'is_null', null, false)).toBe(
        true,
      );
      expect(evaluateResolvedCondition(0, 'is_null', null, false)).toBe(false);
    });

    it('considers empty string, null, undefined, and [] as is_empty', () => {
      expect(evaluateResolvedCondition('', 'is_empty', null, false)).toBe(true);
      expect(evaluateResolvedCondition(null, 'is_empty', null, false)).toBe(
        true,
      );
      expect(
        evaluateResolvedCondition(undefined, 'is_empty', null, false),
      ).toBe(true);
      expect(evaluateResolvedCondition([], 'is_empty', null, false)).toBe(true);
      expect(evaluateResolvedCondition(0, 'is_empty', null, false)).toBe(false);
    });

    it('returns false for regex when no compiled regex is provided', () => {
      expect(
        evaluateResolvedCondition('abc', 'regex', '^a', false, undefined),
      ).toBe(false);
    });

    it('matches with the provided compiled regex', () => {
      expect(evaluateResolvedCondition('abc', 'regex', '^a', false, /^a/)).toBe(
        true,
      );
      expect(evaluateResolvedCondition(123, 'regex', '^1', false, /^1/)).toBe(
        true,
      );
    });

    it('rejects unknown is_type values', () => {
      expect(
        evaluateResolvedCondition(() => null, 'is_type', 'function', false),
      ).toBe(false);
    });

    it('reports array via is_type "array"', () => {
      expect(evaluateResolvedCondition([1], 'is_type', 'array', false)).toBe(
        true,
      );
      expect(
        evaluateResolvedCondition({ a: 1 }, 'is_type', 'array', false),
      ).toBe(false);
    });

    it('limits string operators to string fieldValue', () => {
      expect(evaluateResolvedCondition(123, 'contains', '12', false)).toBe(
        false,
      );
      expect(
        evaluateResolvedCondition('hello', 'starts_with', 'hel', false),
      ).toBe(true);
    });
  });

  describe('evaluateCondition (path-driven)', () => {
    const item = { a: 1, nested: { b: 'x' } };

    it('looks up the field via dot-path', () => {
      const cond: Condition = { field: 'a', operator: 'eq', value: 1 };
      expect(evaluateCondition(item, cond, false)).toBe(true);
    });

    it('supports nested dot-paths', () => {
      const cond: Condition = {
        field: 'nested.b',
        operator: 'eq',
        value: 'x',
      };
      expect(evaluateCondition(item, cond, false)).toBe(true);
    });

    it('returns false when path is missing (no item-self fallback)', () => {
      // The shared evaluator does NOT silently fall back to `item` for
      // missing paths — that sentinel is filter-handler-specific. Other
      // consumers (transform.array_filter) rely on missing paths producing
      // `undefined` and failing the comparison.
      const cond: Condition = {
        field: 'missing',
        operator: 'eq',
        value: item,
      };
      expect(evaluateCondition(item, cond, false)).toBe(false);
    });

    it('delegates regex via compileRegexCache', () => {
      const conds: Condition[] = [
        { field: 'nested.b', operator: 'regex', value: '^x' },
      ];
      const cache = compileRegexCache(conds);
      expect(evaluateCondition(item, conds[0], false, cache.get(0))).toBe(true);
    });
  });

  describe('compileRegexCache', () => {
    it('caches valid patterns and skips invalid / oversized', () => {
      const longPattern = 'a'.repeat(MAX_REGEX_LENGTH + 1);
      const conds: Condition[] = [
        { field: 'x', operator: 'regex', value: '^foo' },
        { field: 'x', operator: 'regex', value: '[invalid' },
        { field: 'x', operator: 'regex', value: longPattern },
        { field: 'x', operator: 'eq', value: '^bar' },
      ];
      const cache = compileRegexCache(conds);
      expect(cache.get(0)).toBeInstanceOf(RegExp);
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(2)).toBeUndefined();
      expect(cache.get(3)).toBeUndefined();
    });
  });

  describe('exports', () => {
    it('lists every spec operator', () => {
      expect(VALID_OPERATORS).toContain('eq');
      expect(VALID_OPERATORS).toContain('regex');
      expect(VALID_OPERATORS).toContain('is_type');
    });

    it('exposes the expression detector pattern', () => {
      expect(EXPRESSION_PATTERN.test('{{ $item }}')).toBe(true);
      expect(EXPRESSION_PATTERN.test('plain.path')).toBe(false);
    });
  });
});
