import { FilterHandler } from './filter.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

type FilterResult = { match: unknown[]; unmatched: unknown[] };

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
    };
  });

  async function execFilter(
    input: unknown,
    config: Record<string, unknown>,
  ): Promise<FilterResult> {
    return (await handler.execute(input, config, context)) as FilterResult;
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
      expect(result.errors).toContain('inputField is required');
    });

    it('should return invalid when conditions is missing', () => {
      const result = handler.validate({
        inputField: 'items',
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('conditions must be a non-empty array');
    });

    it('should return invalid when conditions is empty', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('conditions must be a non-empty array');
    });

    it('should return invalid for missing field in condition', () => {
      const result = handler.validate({
        inputField: 'items',
        conditions: [{ operator: 'eq', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
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

    it('should throw error for non-array input', async () => {
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

    it('should throw error when inputField path is missing', async () => {
      await expect(
        execFilter(
          { other: [] },
          {
            inputField: 'items',
            conditions: [{ field: 'x', operator: 'eq', value: 1 }],
            combineMode: 'and',
          },
        ),
      ).rejects.toThrow('does not resolve to an array');
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
});
