import { FilterHandler } from './filter.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

type FilterMeta = {
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  fellBackToEmpty: boolean;
  invalidRegexPatterns: string[];
  durationMs?: number;
};

type FilterResult = {
  config: Record<string, unknown>;
  output: { match: unknown[]; unmatched: unknown[] };
  meta: FilterMeta;
  port?: string | string[];
};

describe('FilterHandler', () => {
  let handler: FilterHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new FilterHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: 0,
    };
  });

  async function execFilter(
    input: unknown,
    config: Record<string, unknown>,
  ): Promise<FilterResult> {
    return (await handler.execute(
      input,
      config,
      context,
    )) as unknown as FilterResult;
  }

  describe('validate', () => {
    it('should return valid for correct config', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when inputField is missing', () => {
      const result = handler.validate({
        conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Input 필드를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Input'))).toBe(true);
    });

    it('should return invalid when conditions is missing', () => {
      const result = handler.validate({
        inputField: 'items',
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "최소 1개 이상의 조건을 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
    });

    it('should return invalid when conditions is empty', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
    });

    it('should accept missing field as item-self sentinel', () => {
      // Spec: empty/missing field means "compare item itself" — required for
      // scalar arrays like [1, 2, 3] where there is no nested path to address.
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ operator: 'eq', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for non-string field', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ field: 123, operator: 'eq', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
    });

    it('should return invalid for unknown operator', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ field: 'x', operator: 'unknown', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
    });

    it('should return invalid for bad combineMode', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
        combineMode: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('combineMode must be "and" or "or"');
    });

    it('should accept regex and is_type operators', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [
          { field: 'name', operator: 'regex', value: '^A' },
          { field: 'age', operator: 'is_type', value: 'number' },
        ],
        combineMode: 'and',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept an already-resolved array as inputField (inline expression)', () => {
      // {{ $var.a }} is evaluated before reaching the handler and arrives as
      // the underlying array value rather than a string path.
      const result = handler.validate({
        inputField: [{ status: 'active' }],
        conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept config without combineMode', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    const items = [
      { name: 'Alice', age: 30, status: 'active' },
      { name: 'Bob', age: 17, status: 'inactive' },
      { name: 'Charlie', age: 25, status: 'active' },
      { name: 'Diana', age: 15, status: 'active' },
    ];

    it('should use an already-resolved array directly (inline expression)', async () => {
      // Mirrors the runtime behaviour after {{ $var.a }} has been replaced
      // with the underlying array value. Previously this path crashed with
      // "path.split is not a function" inside getNestedValue.
      const result = await execFilter(
        {},
        {
          inputField: items,
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(3);
      expect(result.output.unmatched).toHaveLength(1);
      expect(result.output.unmatched[0]).toMatchObject(items[1]);
    });

    it('should filter items by eq condition', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(3);
      expect(result.output.unmatched).toHaveLength(1);
      expect(result.output.unmatched[0]).toMatchObject(items[1]);
    });

    it('should filter items by gt condition', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'age', operator: 'gt', value: 18 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[0], items[2]]);
      expect(result.output.unmatched).toHaveLength(2);
    });

    it('should combine conditions with AND mode', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'age', operator: 'gte', value: 25 },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[0], items[2]]);
    });

    it('should combine conditions with OR mode', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [
            { field: 'status', operator: 'eq', value: 'inactive' },
            { field: 'age', operator: 'gte', value: 30 },
          ],
          combineMode: 'or',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[0], items[1]]);
    });

    it('should default combineMode to "and"', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'age', operator: 'gt', value: 20 },
          ],
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[0], items[2]]);
    });

    it('should throw error for non-array input (primitive string)', async () => {
      // Non-null primitive that resolves to a string keeps the strict throw —
      // signals a wrong inputField path / config mistake. Only null/undefined
      // is forgiven (Principle 10 fallback).
      await expect(
        execFilter(
          { items: 'not-an-array' },
          {
            inputField: 'items',
            conditions: [{ field: 'x', operator: 'eq', value: 1 }],
            combineMode: 'and',
          },
        ),
      ).rejects.toThrow('does not resolve to an array');
    });

    it('should throw error for non-array input (number / object)', async () => {
      // Defensive: number / plain object also stays in the throw branch so
      // misconfigured inputField paths surface loudly instead of silently
      // emitting empty `match` / `unmatched`.
      await expect(
        execFilter(
          { items: 42 },
          {
            inputField: 'items',
            conditions: [{ field: 'x', operator: 'eq', value: 1 }],
            combineMode: 'and',
          },
        ),
      ).rejects.toThrow('does not resolve to an array');

      await expect(
        execFilter(
          { items: { not: 'array' } },
          {
            inputField: 'items',
            conditions: [{ field: 'x', operator: 'eq', value: 1 }],
            combineMode: 'and',
          },
        ),
      ).rejects.toThrow('does not resolve to an array');
    });

    it('should fall back to `[]` when inputField path is missing (Principle 10)', async () => {
      // Missing path → getNestedValue returns `undefined` → empty fallback
      // with `meta.fellBackToEmpty: true`.
      const result = await execFilter(
        { other: [] },
        {
          inputField: 'items',
          conditions: [{ field: 'x', operator: 'eq', value: 1 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([]);
      expect(result.output.unmatched).toEqual([]);
      expect(result.meta).toMatchObject({
        matchedCount: 0,
        unmatchedCount: 0,
        totalCount: 0,
        fellBackToEmpty: true,
        invalidRegexPatterns: [],
      });
    });

    it('should return empty arrays for empty input array', async () => {
      const result = await execFilter(
        { items: [] },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(0);
      expect(result.output.unmatched).toHaveLength(0);
    });

    it('should handle nested field access', async () => {
      const nestedItems = [
        { user: { profile: { age: 30 } } },
        { user: { profile: { age: 15 } } },
        { user: { profile: { age: 25 } } },
      ];

      const result = await execFilter(
        { data: nestedItems },
        {
          inputField: 'data',
          conditions: [
            { field: 'user.profile.age', operator: 'gte', value: 25 },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.unmatched).toHaveLength(1);
    });

    it('should handle neq operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'neq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject(items[1]);
    });

    it('should handle lt operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'age', operator: 'lt', value: 18 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[1], items[3]]);
    });

    it('should handle lte operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'age', operator: 'lte', value: 17 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
      expect(result.output.match).toMatchObject([items[1], items[3]]);
    });

    it('should handle contains operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'contains', value: 'li' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2); // Alice, Charlie
    });

    it('should handle not_contains operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [
            { field: 'name', operator: 'not_contains', value: 'li' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2); // Bob, Diana
    });

    it('should return false for not_contains when field is non-string', async () => {
      const testItems = [{ value: 42 }, { value: 'hello world' }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'value', operator: 'not_contains', value: 'hello' },
          ],
          combineMode: 'and',
        },
      );

      // 42 is non-string → false (symmetric with contains), "hello world" contains "hello" → false
      expect(result.output.match).toHaveLength(0);
    });

    it('should handle starts_with operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'starts_with', value: 'A' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject(items[0]);
    });

    it('should handle ends_with operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'ends_with', value: 'a' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject(items[3]); // Diana
    });

    it('should handle is_empty operator', async () => {
      const testItems = [
        { name: 'Alice', tags: [] },
        { name: 'Bob', tags: ['admin'] },
        { name: 'Charlie', tags: null },
      ];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'tags', operator: 'is_empty', value: null }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2); // Alice (empty array), Charlie (null)
    });

    it('should handle is_empty with empty string', async () => {
      const testItems = [{ name: '' }, { name: 'Bob' }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'is_empty', value: null }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject({ name: '' });
    });

    it('should handle is_not_empty operator', async () => {
      const testItems = [
        { name: 'Alice', tags: [] },
        { name: 'Bob', tags: ['admin'] },
        { name: 'Charlie', tags: null },
      ];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'tags', operator: 'is_not_empty', value: null },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject(testItems[1]);
    });

    it('should handle is_null operator', async () => {
      const testItems = [
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: null },
        { name: 'Charlie' },
      ];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'email', operator: 'is_null', value: null }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2); // Bob (null), Charlie (undefined)
    });

    it('should handle regex operator', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'regex', value: '^[A-C]' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(3); // Alice, Bob, Charlie
      expect(result.output.unmatched).toHaveLength(1); // Diana
    });

    it('should handle invalid regex gracefully', async () => {
      const result = await execFilter(
        { items: [{ name: 'test' }] },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'regex', value: '[invalid' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(0);
      expect(result.output.unmatched).toHaveLength(1);
    });

    it('should reject regex patterns exceeding max length', async () => {
      const longPattern = 'a'.repeat(201);
      const result = await execFilter(
        { items: [{ name: 'aaa' }] },
        {
          inputField: 'items',
          conditions: [
            { field: 'name', operator: 'regex', value: longPattern },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(0);
      expect(result.output.unmatched).toHaveLength(1);
    });

    it('should handle is_type operator with string', async () => {
      const testItems = [{ value: 'hello' }, { value: 42 }, { value: true }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'value', operator: 'is_type', value: 'string' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject(testItems[0]);
    });

    it('should handle is_type operator with number', async () => {
      const testItems = [{ value: 'hello' }, { value: 42 }, { value: true }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'value', operator: 'is_type', value: 'number' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject({ value: 42 });
    });

    it('should handle is_type operator with boolean', async () => {
      const testItems = [{ value: 'hello' }, { value: 42 }, { value: true }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'value', operator: 'is_type', value: 'boolean' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject({ value: true });
    });

    it('should handle is_type operator with array', async () => {
      const testItems = [
        { value: [1, 2] },
        { value: 'not-array' },
        { value: [3] },
      ];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'value', operator: 'is_type', value: 'array' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2);
    });

    it('should handle is_type operator with null', async () => {
      const testItems = [
        { value: null },
        { value: 'hello' },
        { value: undefined },
      ];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'value', operator: 'is_type', value: 'null' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(2); // null and undefined
    });

    it('should reject invalid is_type values', async () => {
      const testItems = [{ value: () => {} }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [
            { field: 'value', operator: 'is_type', value: 'function' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(0); // "function" not in whitelist
    });

    it('should handle strictComparison mode', async () => {
      const testItems = [{ value: 1 }, { value: '1' }, { value: 2 }];

      // Non-strict: "1" == 1 is true
      const looseResult = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'value', operator: 'eq', value: 1 }],
          combineMode: 'and',
          strictComparison: false,
        },
      );

      expect(looseResult.output.match).toHaveLength(2); // 1 and "1"

      // Strict: "1" === 1 is false
      const strictResult = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'value', operator: 'eq', value: 1 }],
          combineMode: 'and',
          strictComparison: true,
        },
      );

      expect(strictResult.output.match).toHaveLength(1);
      expect(strictResult.output.match[0]).toMatchObject({ value: 1 });
    });

    it('should handle strictComparison with neq', async () => {
      const testItems = [{ value: 1 }, { value: '1' }, { value: 2 }];

      // Strict: "1" !== 1 is true
      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'value', operator: 'neq', value: 1 }],
          combineMode: 'and',
          strictComparison: true,
        },
      );

      expect(result.output.match).toHaveLength(2); // "1" and 2
    });

    it('should handle all items matching', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [
            { field: 'name', operator: 'is_not_empty', value: null },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(4);
      expect(result.output.unmatched).toHaveLength(0);
    });

    it('should handle no items matching', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'eq', value: 'deleted' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(0);
      expect(result.output.unmatched).toHaveLength(4);
    });

    it('should handle numeric comparison with non-numeric values as NaN', async () => {
      const testItems = [{ score: 10 }, { score: 'abc' }, { score: undefined }];

      const result = await execFilter(
        { items: testItems },
        {
          inputField: 'items',
          conditions: [{ field: 'score', operator: 'gt', value: 5 }],
          combineMode: 'and',
        },
      );

      // NaN > 5 is false, so only score: 10 matches
      expect(result.output.match).toHaveLength(1);
      expect(result.output.match[0]).toMatchObject({ score: 10 });
    });
  });

  describe('per-item expression resolution and item-self sentinel', () => {
    // spec/4-nodes/1-logic/8-filter.md §1 (config) + §4 (실행 컨텍스트 변수):
    // - `field` is an Expression (`{{ $item.status }}` etc.)
    // - `$item` is bound to the current array item during evaluation.
    // Combined with the C sentinel: empty/$item field means "item itself".

    it('should match user case: field "{{ $item }}" + value "{{ 1 }}" on scalar array', async () => {
      // Reproduces the exact bug report: gt comparison on [1, 2, 3] should
      // return [2, 3] when comparing item to literal 1.
      const result = await execFilter(
        {},
        {
          inputField: [1, 2, 3],
          conditions: [
            { field: '{{ $item }}', operator: 'gt', value: '{{ 1 }}' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([2, 3]);
      expect(result.output.unmatched).toEqual([1]);
    });

    it('should match scalar array with empty-field sentinel and literal value', async () => {
      const result = await execFilter(
        {},
        {
          inputField: [1, 2, 3],
          conditions: [{ field: '', operator: 'gt', value: 1 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([2, 3]);
      expect(result.output.unmatched).toEqual([1]);
    });

    it('should match scalar array with "$item" literal sentinel', async () => {
      const result = await execFilter(
        {},
        {
          inputField: ['a', 'b', 'c'],
          conditions: [{ field: '$item', operator: 'eq', value: 'b' }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual(['b']);
      expect(result.output.unmatched).toEqual(['a', 'c']);
    });

    it('should resolve "{{ $item.<key> }}" expression per item (spec form)', async () => {
      const data = [{ age: 10 }, { age: 20 }, { age: 30 }];
      const result = await execFilter(
        {},
        {
          inputField: data,
          conditions: [{ field: '{{ $item.age }}', operator: 'gt', value: 15 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([{ age: 20 }, { age: 30 }]);
      expect(result.output.unmatched).toEqual([{ age: 10 }]);
    });

    it('should resolve per-item expressions on both field and value', async () => {
      const data = [
        { a: 5, b: 2 },
        { a: 1, b: 3 },
      ];
      const result = await execFilter(
        {},
        {
          inputField: data,
          conditions: [
            {
              field: '{{ $item.a }}',
              operator: 'gt',
              value: '{{ $item.b }}',
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([{ a: 5, b: 2 }]);
      expect(result.output.unmatched).toEqual([{ a: 1, b: 3 }]);
    });

    it('should treat per-item expression eval failure as unmatched without throwing', async () => {
      // {{ $item.deeply.missing }} resolves to undefined for a number item;
      // eq comparison against literal 1 → false (no throw).
      const result = await execFilter(
        {},
        {
          inputField: [1, 2],
          conditions: [
            {
              field: '{{ $item.deeply.missing }}',
              operator: 'eq',
              value: 1,
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([]);
      expect(result.output.unmatched).toEqual([1, 2]);
    });

    it('should honor strictComparison with item-self sentinel', async () => {
      const items = [1, '1', 2];

      const looseResult = await execFilter(
        {},
        {
          inputField: items,
          conditions: [{ field: '$item', operator: 'eq', value: 1 }],
          combineMode: 'and',
          strictComparison: false,
        },
      );
      expect(looseResult.output.match).toEqual([1, '1']);

      const strictResult = await execFilter(
        {},
        {
          inputField: items,
          conditions: [{ field: '$item', operator: 'eq', value: 1 }],
          combineMode: 'and',
          strictComparison: true,
        },
      );
      expect(strictResult.output.match).toEqual([1]);
    });

    it('should compile regex patterns from per-item-resolved values', async () => {
      // Regex pattern itself is a literal expression resolved before the
      // loop (constant value); confirms the regex cache redesign still works
      // under the per-item resolution flow.
      const result = await execFilter(
        {},
        {
          inputField: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
          conditions: [
            {
              field: '{{ $item.name }}',
              operator: 'regex',
              value: '^[AC]',
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([
        { name: 'Alice' },
        { name: 'Carol' },
      ]);
    });

    it('should treat undefined field at execute time as item-self sentinel', async () => {
      // validate() accepts a condition without `field`; execute must agree
      // and treat the missing key the same as `field: ""` rather than
      // dropping every item to `unmatched`.
      const result = await execFilter(
        {},
        {
          inputField: [1, 2, 3],
          conditions: [{ operator: 'eq', value: 2 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([2]);
      expect(result.output.unmatched).toEqual([1, 3]);
    });

    it('should expose $itemIndex in expression context (0-based)', async () => {
      const result = await execFilter(
        {},
        {
          inputField: ['a', 'b', 'c'],
          conditions: [{ field: '{{ $itemIndex }}', operator: 'eq', value: 1 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual(['b']);
    });

    it('should evaluate per-item expressions with combineMode "or"', async () => {
      const data = [
        { a: 1, b: 10 },
        { a: 5, b: 1 },
        { a: 0, b: 0 },
      ];
      const result = await execFilter(
        {},
        {
          inputField: data,
          conditions: [
            { field: '{{ $item.a }}', operator: 'gt', value: 3 },
            { field: '{{ $item.b }}', operator: 'gt', value: 5 },
          ],
          combineMode: 'or',
        },
      );

      // {a:1,b:10} → b>5 ✓; {a:5,b:1} → a>3 ✓; {a:0,b:0} → both fail.
      expect(result.output.match).toEqual([
        { a: 1, b: 10 },
        { a: 5, b: 1 },
      ]);
      expect(result.output.unmatched).toEqual([{ a: 0, b: 0 }]);
    });

    it('should support per-item dynamic regex pattern (memoized cache)', async () => {
      // Each item carries its own pattern; the cache is keyed by resolved
      // pattern string so distinct items can have distinct regexes.
      const data = [
        { name: 'Alice', pat: '^Al' },
        { name: 'Bob', pat: '^Z' },
        { name: 'Carol', pat: '^Ca' },
      ];
      const result = await execFilter(
        {},
        {
          inputField: data,
          conditions: [
            {
              field: '{{ $item.name }}',
              operator: 'regex',
              value: '{{ $item.pat }}',
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([
        { name: 'Alice', pat: '^Al' },
        { name: 'Carol', pat: '^Ca' },
      ]);
    });

    it('should inherit workflow context variables in per-item expressions', async () => {
      const ctxWithVars: ExecutionContext = {
        ...context,
        expressionContext: { $var: { threshold: 15 } },
      };
      const result = (await handler.execute(
        {},
        {
          inputField: [10, 20, 30],
          conditions: [
            {
              field: '$item',
              operator: 'gt',
              value: '{{ $var.threshold }}',
            },
          ],
          combineMode: 'and',
        },
        ctxWithVars,
      )) as unknown as FilterResult;

      expect(result.output.match).toEqual([20, 30]);
    });

    it('should not silently match `is_null` on numeric thresholds when eval fails', async () => {
      // resolveIfExpression must return `undefined` (not `null`) so
      // `gt -1` does not silently match a failed-eval item via Number(null)=0.
      const result = await execFilter(
        {},
        {
          inputField: [1],
          conditions: [
            {
              field: '{{ $item.deeply.missing }}',
              operator: 'gt',
              value: -1,
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([]);
      expect(result.output.unmatched).toEqual([1]);
    });

    it('should support is_type with per-item field expression', async () => {
      const data = [{ val: 10 }, { val: 'hi' }, { val: true }];
      const result = await execFilter(
        {},
        {
          inputField: data,
          conditions: [
            {
              field: '{{ $item.val }}',
              operator: 'is_type',
              value: 'number',
            },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([{ val: 10 }]);
    });

    it('should accept regex pattern at the boundary length (200 chars)', async () => {
      // Boundary guard for `MAX_REGEX_LENGTH = 200` — 200 is allowed,
      // 201 is rejected (covered by the existing oversize test).
      const exactly200 = 'a'.repeat(200);
      const result = await execFilter(
        {},
        {
          inputField: [{ name: exactly200 }],
          conditions: [
            { field: '{{ $item.name }}', operator: 'regex', value: exactly200 },
          ],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toHaveLength(1);
    });
  });

  // ENG-RC-* — Phase 3 raw-echo migration.
  describe('config echoes rawConfig templates over evaluated config', () => {
    it('preserves raw inputField + condition.value templates', async () => {
      const result = (await handler.execute(
        { items: [1, 2, 3] },
        {
          inputField: 'items',
          conditions: [{ field: '$item', operator: 'gt', value: 1 }],
          combineMode: 'and',
          strictComparison: false,
        },
        {
          ...context,
          rawConfig: Object.freeze({
            inputField: '{{ $input.items }}',
            conditions: [
              { field: '$item', operator: 'gt', value: '{{ $threshold }}' },
            ],
            combineMode: 'and',
            strictComparison: false,
          }),
        },
      )) as unknown as {
        config: { inputField: unknown; conditions: unknown[] };
      };

      expect(result.config.inputField).toBe('{{ $input.items }}');
      expect((result.config.conditions[0] as { value: unknown }).value).toBe(
        '{{ $threshold }}',
      );
    });
  });

  // CONVENTIONS Principle 2 — execution metrics surfaced via `meta`.
  // user_memo/node-specs-improvement/logic/filter.md §3 P0/P1 follow-up.
  describe('meta metrics (matchedCount / unmatchedCount / totalCount / fellBackToEmpty / invalidRegexPatterns)', () => {
    const items = [
      { name: 'Alice', age: 30, status: 'active' },
      { name: 'Bob', age: 17, status: 'inactive' },
      { name: 'Charlie', age: 25, status: 'active' },
      { name: 'Diana', age: 15, status: 'active' },
    ];

    it('emits accurate matched / unmatched / total counts on a real array', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.meta).toEqual({
        matchedCount: 3,
        unmatchedCount: 1,
        totalCount: 4,
        fellBackToEmpty: false,
        invalidRegexPatterns: [],
      });
    });

    it('emits zero counts and `fellBackToEmpty: false` for an empty (real) input array', async () => {
      // Empty array is a real array — fellBackToEmpty stays false to
      // distinguish "no items" from "no array at all".
      const result = await execFilter(
        { items: [] },
        {
          inputField: 'items',
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
      );

      expect(result.meta).toEqual({
        matchedCount: 0,
        unmatchedCount: 0,
        totalCount: 0,
        fellBackToEmpty: false,
        invalidRegexPatterns: [],
      });
    });

    it('emits `fellBackToEmpty: true` when the resolved value is null (Principle 10)', async () => {
      const result = await execFilter(
        { items: null },
        {
          inputField: 'items',
          conditions: [{ field: 'x', operator: 'eq', value: 1 }],
          combineMode: 'and',
        },
      );

      expect(result.output.match).toEqual([]);
      expect(result.output.unmatched).toEqual([]);
      expect(result.meta).toEqual({
        matchedCount: 0,
        unmatchedCount: 0,
        totalCount: 0,
        fellBackToEmpty: true,
        invalidRegexPatterns: [],
      });
    });

    it('emits `fellBackToEmpty: true` when inputField resolves to undefined', async () => {
      // `{ items: undefined }` and "key absent" are both observed as
      // undefined by getNestedValue → unified fallback path.
      const result = await execFilter(
        {},
        {
          inputField: 'items',
          conditions: [{ field: 'x', operator: 'eq', value: 1 }],
          combineMode: 'and',
        },
      );

      expect(result.meta.fellBackToEmpty).toBe(true);
      expect(result.meta.totalCount).toBe(0);
    });

    it('preserves totalCount === matchedCount + unmatchedCount invariant', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'age', operator: 'gt', value: 18 }],
          combineMode: 'and',
        },
      );

      expect(result.meta.totalCount).toBe(
        result.meta.matchedCount + result.meta.unmatchedCount,
      );
      expect(result.meta.totalCount).toBe(items.length);
    });

    it('reports invalid regex patterns (compile failure)', async () => {
      const result = await execFilter(
        { items: [{ name: 'test' }] },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'regex', value: '[invalid' }],
          combineMode: 'and',
        },
      );

      expect(result.meta.invalidRegexPatterns).toEqual(['[invalid']);
      expect(result.output.match).toHaveLength(0);
    });

    it('reports invalid regex patterns (length cap exceeded)', async () => {
      const longPattern = 'a'.repeat(201);
      const result = await execFilter(
        { items: [{ name: 'aaa' }] },
        {
          inputField: 'items',
          conditions: [
            { field: 'name', operator: 'regex', value: longPattern },
          ],
          combineMode: 'and',
        },
      );

      expect(result.meta.invalidRegexPatterns).toEqual([longPattern]);
    });

    it('deduplicates repeated invalid patterns across items', async () => {
      // Same broken pattern triggered N times must surface once.
      const result = await execFilter(
        {},
        {
          inputField: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
          conditions: [
            { field: '{{ $item.name }}', operator: 'regex', value: '[bad' },
          ],
          combineMode: 'and',
        },
      );

      expect(result.meta.invalidRegexPatterns).toEqual(['[bad']);
    });

    it('emits empty `invalidRegexPatterns` when all regex compile cleanly', async () => {
      const result = await execFilter(
        { items },
        {
          inputField: 'items',
          conditions: [{ field: 'name', operator: 'regex', value: '^[A-C]' }],
          combineMode: 'and',
        },
      );

      expect(result.meta.invalidRegexPatterns).toEqual([]);
    });
  });
});
