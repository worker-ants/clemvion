import { TransformHandler } from './transform.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('TransformHandler', () => {
  let handler: TransformHandler;
  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    recursionDepth: 0,
  };

  beforeEach(() => {
    handler = new TransformHandler();
  });

  describe('validate', () => {
    it('should pass with valid operations array', () => {
      const result = handler.validate({
        operations: [{ type: 'set_field', field: 'x', value: 1 }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when operations is missing', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "하나 이상의 변환 작업을 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('변환'))).toBe(true);
    });

    it('should fail when operations is not an array', () => {
      const result = handler.validate({ operations: 'not-array' });
      expect(result.valid).toBe(false);
    });

    it('should fail when operation type is invalid', () => {
      const result = handler.validate({
        operations: [{ type: 'invalid_op' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('type');
    });
  });

  describe('execute - rename_field', () => {
    it('should rename a field', async () => {
      const result = await handler.execute(
        { oldName: 'value' },
        {
          operations: [
            { type: 'rename_field', from: 'oldName', to: 'newName' },
          ],
        },
        context,
      );
      expect((result as any).output).toEqual({ newName: 'value' });
    });

    it('should not modify data when source field does not exist', async () => {
      const result = await handler.execute(
        { other: 'value' },
        {
          operations: [
            { type: 'rename_field', from: 'missing', to: 'newName' },
          ],
        },
        context,
      );
      expect((result as any).output).toEqual({ other: 'value' });
    });
  });

  describe('execute - remove_field', () => {
    it('should remove a field', async () => {
      const result = await handler.execute(
        { a: 1, b: 2 },
        { operations: [{ type: 'remove_field', field: 'a' }] },
        context,
      );
      expect((result as any).output).toEqual({ b: 2 });
    });
  });

  describe('execute - set_field', () => {
    it('should set a field value', async () => {
      const result = await handler.execute(
        { a: 1 },
        { operations: [{ type: 'set_field', field: 'b', value: 42 }] },
        context,
      );
      expect((result as any).output).toEqual({ a: 1, b: 42 });
    });

    it('should overwrite existing field value', async () => {
      const result = await handler.execute(
        { a: 1 },
        { operations: [{ type: 'set_field', field: 'a', value: 99 }] },
        context,
      );
      expect((result as any).output).toEqual({ a: 99 });
    });
  });

  describe('execute - type_convert', () => {
    it('should convert to string', async () => {
      const result = (await handler.execute(
        { num: 42 },
        {
          operations: [
            { type: 'type_convert', field: 'num', targetType: 'string' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.num).toBe('42');
    });

    it('should convert to number', async () => {
      const result = (await handler.execute(
        { str: '42' },
        {
          operations: [
            { type: 'type_convert', field: 'str', targetType: 'number' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.str).toBe(42);
    });

    it('should convert to boolean', async () => {
      const result = (await handler.execute(
        { val: 1 },
        {
          operations: [
            { type: 'type_convert', field: 'val', targetType: 'boolean' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(true);
    });

    it('should not modify data when field does not exist', async () => {
      const result = await handler.execute(
        { a: 1 },
        {
          operations: [
            { type: 'type_convert', field: 'missing', targetType: 'string' },
          ],
        },
        context,
      );
      expect((result as any).output).toEqual({ a: 1 });
    });
  });

  describe('execute - string_op', () => {
    it('should trim a string', async () => {
      const result = (await handler.execute(
        { text: '  hello  ' },
        {
          operations: [{ type: 'string_op', field: 'text', operation: 'trim' }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('hello');
    });

    it('should uppercase a string', async () => {
      const result = (await handler.execute(
        { text: 'hello' },
        {
          operations: [
            { type: 'string_op', field: 'text', operation: 'uppercase' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('HELLO');
    });

    it('should lowercase a string', async () => {
      const result = (await handler.execute(
        { text: 'HELLO' },
        {
          operations: [
            { type: 'string_op', field: 'text', operation: 'lowercase' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('hello');
    });

    it('should replace substrings', async () => {
      const result = (await handler.execute(
        { text: 'hello world' },
        {
          operations: [
            {
              type: 'string_op',
              field: 'text',
              operation: 'replace',
              args: { search: 'world', replacement: 'there' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('hello there');
    });
  });

  describe('execute - math_op', () => {
    it('should add', async () => {
      const result = (await handler.execute(
        { val: 10 },
        {
          operations: [
            { type: 'math_op', field: 'val', operation: 'add', operand: 5 },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(15);
    });

    it('should subtract', async () => {
      const result = (await handler.execute(
        { val: 10 },
        {
          operations: [
            {
              type: 'math_op',
              field: 'val',
              operation: 'subtract',
              operand: 3,
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(7);
    });

    it('should multiply', async () => {
      const result = (await handler.execute(
        { val: 4 },
        {
          operations: [
            {
              type: 'math_op',
              field: 'val',
              operation: 'multiply',
              operand: 3,
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(12);
    });

    it('should divide', async () => {
      const result = (await handler.execute(
        { val: 10 },
        {
          operations: [
            { type: 'math_op', field: 'val', operation: 'divide', operand: 2 },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(5);
    });

    it('should not divide by zero', async () => {
      const result = (await handler.execute(
        { val: 10 },
        {
          operations: [
            { type: 'math_op', field: 'val', operation: 'divide', operand: 0 },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(10);
    });

    it('should round', async () => {
      const result = (await handler.execute(
        { val: 3.7 },
        { operations: [{ type: 'math_op', field: 'val', operation: 'round' }] },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(4);
    });
  });

  describe('execute - sequential operations', () => {
    it('should apply multiple operations in order', async () => {
      const result = await handler.execute(
        { name: '  John  ', age: '25' },
        {
          operations: [
            { type: 'string_op', field: 'name', operation: 'trim' },
            { type: 'type_convert', field: 'age', targetType: 'number' },
            { type: 'set_field', field: 'active', value: true },
            { type: 'math_op', field: 'age', operation: 'add', operand: 1 },
          ],
        },
        context,
      );
      expect((result as any).output).toEqual({
        name: 'John',
        age: 26,
        active: true,
      });
    });
  });

  describe('execute - does not mutate original input', () => {
    it('should not modify the original input object', async () => {
      const input = { a: 1, b: 2 };
      await handler.execute(
        input,
        { operations: [{ type: 'remove_field', field: 'a' }] },
        context,
      );
      expect(input).toEqual({ a: 1, b: 2 });
    });
  });

  describe('execute - nested paths', () => {
    it('should set/get/delete via dot notation', async () => {
      const result = (await handler.execute(
        { user: { profile: { name: 'Kim', age: 30 } } },
        {
          operations: [
            { type: 'set_field', field: 'user.profile.age', value: 31 },
            { type: 'remove_field', field: 'user.profile.name' },
            {
              type: 'rename_field',
              from: 'user.profile.age',
              to: 'user.years',
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ user: { profile: {}, years: 31 } });
    });

    it('should support bracket notation for arrays', async () => {
      const result = (await handler.execute(
        { items: [{ v: 1 }, { v: 2 }] },
        {
          operations: [{ type: 'set_field', field: 'items[0].v', value: 99 }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ items: [{ v: 99 }, { v: 2 }] });
    });
  });

  describe('execute - string_op extensions', () => {
    it('should split a string', async () => {
      const result = (await handler.execute(
        { csv: 'a,b,c' },
        {
          operations: [
            {
              type: 'string_op',
              field: 'csv',
              operation: 'split',
              args: { separator: ',' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.csv).toEqual(['a', 'b', 'c']);
    });

    it('should join an array', async () => {
      const result = (await handler.execute(
        { parts: ['x', 'y', 'z'] },
        {
          operations: [
            {
              type: 'string_op',
              field: 'parts',
              operation: 'join',
              args: { separator: '-' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.parts).toBe('x-y-z');
    });

    it('should replace first occurrence when all=false', async () => {
      const result = (await handler.execute(
        { text: 'a-a-a' },
        {
          operations: [
            {
              type: 'string_op',
              field: 'text',
              operation: 'replace',
              args: { search: 'a', replacement: 'Z', all: false },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('Z-a-a');
    });

    it('should replace via regex', async () => {
      const result = (await handler.execute(
        { text: 'abc123xyz' },
        {
          operations: [
            {
              type: 'string_op',
              field: 'text',
              operation: 'replace',
              args: { search: '\\d+', replacement: '#', regex: true },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('abc#xyz');
    });
  });

  describe('execute - math_op extensions', () => {
    it('should ceil', async () => {
      const result = (await handler.execute(
        { val: 3.2 },
        { operations: [{ type: 'math_op', field: 'val', operation: 'ceil' }] },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(4);
    });

    it('should floor', async () => {
      const result = (await handler.execute(
        { val: 3.9 },
        {
          operations: [{ type: 'math_op', field: 'val', operation: 'floor' }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.val).toBe(3);
    });
  });

  describe('execute - type_convert extensions', () => {
    it('should parse JSON string to array', async () => {
      const result = (await handler.execute(
        { raw: '[1,2,3]' },
        {
          operations: [
            { type: 'type_convert', field: 'raw', targetType: 'array' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.raw).toEqual([1, 2, 3]);
    });

    it('should parse JSON string to object', async () => {
      const result = (await handler.execute(
        { raw: '{"a":1}' },
        {
          operations: [
            { type: 'type_convert', field: 'raw', targetType: 'object' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.raw).toEqual({ a: 1 });
    });

    it('should keep original on invalid JSON', async () => {
      const result = (await handler.execute(
        { raw: 'not-json' },
        {
          operations: [
            { type: 'type_convert', field: 'raw', targetType: 'array' },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.raw).toBe('not-json');
    });
  });

  describe('execute - date_op', () => {
    it('should format a date', async () => {
      const result = (await handler.execute(
        { d: '2024-01-15T10:30:00Z' },
        {
          operations: [
            {
              type: 'date_op',
              field: 'd',
              operation: 'format',
              args: { pattern: 'YYYY-MM-DD' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.d).toBe('2024-01-15');
    });

    it('should add days', async () => {
      const result = (await handler.execute(
        { d: '2024-01-15T00:00:00.000Z' },
        {
          operations: [
            {
              type: 'date_op',
              field: 'd',
              operation: 'add',
              args: { amount: 5, unit: 'days' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.d).toBe('2024-01-20T00:00:00.000Z');
    });

    it('should subtract hours', async () => {
      const result = (await handler.execute(
        { d: '2024-01-15T05:00:00.000Z' },
        {
          operations: [
            {
              type: 'date_op',
              field: 'd',
              operation: 'subtract',
              args: { amount: 2, unit: 'hours' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.d).toBe('2024-01-15T03:00:00.000Z');
    });

    it('should diff between dates', async () => {
      const result = (await handler.execute(
        { start: '2024-01-20', end: '2024-01-15' },
        {
          operations: [
            {
              type: 'date_op',
              field: 'start',
              operation: 'diff',
              args: { compareField: 'end', unit: 'days' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.start).toBe(5);
    });

    it('should keep value on invalid date', async () => {
      const result = (await handler.execute(
        { d: 'not-a-date' },
        {
          operations: [
            {
              type: 'date_op',
              field: 'd',
              operation: 'format',
              args: { pattern: 'YYYY-MM-DD' },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.d).toBe('not-a-date');
    });
  });

  describe('execute - array_filter', () => {
    it('should filter by equality', async () => {
      const result = (await handler.execute(
        { items: [{ active: true }, { active: false }, { active: true }] },
        {
          operations: [
            {
              type: 'array_filter',
              field: 'items',
              condition: { field: 'active', operator: 'eq', value: true },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.items).toEqual([{ active: true }, { active: true }]);
    });

    it('should filter by gt', async () => {
      const result = (await handler.execute(
        { nums: [{ v: 1 }, { v: 5 }, { v: 10 }] },
        {
          operations: [
            {
              type: 'array_filter',
              field: 'nums',
              condition: { field: 'v', operator: 'gt', value: 3 },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.nums).toEqual([{ v: 5 }, { v: 10 }]);
    });

    it('should skip when target is not an array', async () => {
      const result = (await handler.execute(
        { items: 'not-array' },
        {
          operations: [
            {
              type: 'array_filter',
              field: 'items',
              condition: { field: 'a', operator: 'eq', value: 1 },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.items).toBe('not-array');
    });
  });

  describe('execute - array_sort', () => {
    it('should sort ascending by primitive', async () => {
      const result = (await handler.execute(
        { nums: [3, 1, 2] },
        {
          operations: [{ type: 'array_sort', field: 'nums', order: 'asc' }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.nums).toEqual([1, 2, 3]);
    });

    it('should sort descending by sortBy', async () => {
      const result = (await handler.execute(
        { items: [{ v: 1 }, { v: 3 }, { v: 2 }] },
        {
          operations: [
            {
              type: 'array_sort',
              field: 'items',
              sortBy: 'v',
              order: 'desc',
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.items).toEqual([{ v: 3 }, { v: 2 }, { v: 1 }]);
    });

    it('should sort strings via localeCompare', async () => {
      const result = (await handler.execute(
        { words: ['banana', 'apple', 'cherry'] },
        {
          operations: [{ type: 'array_sort', field: 'words', order: 'asc' }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.words).toEqual(['apple', 'banana', 'cherry']);
    });
  });

  describe('execute - object_pick', () => {
    it('should pick root keys', async () => {
      const result = (await handler.execute(
        { a: 1, b: 2, c: 3 },
        {
          operations: [{ type: 'object_pick', keys: ['a', 'c'] }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ a: 1, c: 3 });
    });

    it('should pick nested object keys', async () => {
      const result = (await handler.execute(
        { user: { name: 'Kim', age: 30, email: 'k@e.com' } },
        {
          operations: [
            { type: 'object_pick', field: 'user', keys: ['name', 'age'] },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ user: { name: 'Kim', age: 30 } });
    });
  });

  describe('execute - object_omit', () => {
    it('should omit root keys', async () => {
      const result = (await handler.execute(
        { a: 1, b: 2, c: 3 },
        {
          operations: [{ type: 'object_omit', keys: ['b'] }],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ a: 1, c: 3 });
    });

    it('should omit nested object keys', async () => {
      const result = (await handler.execute(
        { user: { name: 'Kim', password: 'secret' } },
        {
          operations: [
            { type: 'object_omit', field: 'user', keys: ['password'] },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({ user: { name: 'Kim' } });
    });
  });

  describe('execute - security & edge cases', () => {
    it('should block prototype pollution via set_field', async () => {
      await handler.execute(
        {},
        {
          operations: [
            { type: 'set_field', field: '__proto__.polluted', value: true },
          ],
        },
        context,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('should block prototype pollution via object_omit root', async () => {
      const result = (await handler.execute(
        { a: 1 },
        {
          operations: [
            {
              type: 'object_omit',
              keys: ['__proto__', 'constructor', 'a'],
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output).toEqual({});
    });

    it('should reject overly long regex patterns in array_filter', async () => {
      const longPattern = 'a'.repeat(300);
      const result = (await handler.execute(
        { xs: [{ v: 'aaaa' }] },
        {
          operations: [
            {
              type: 'array_filter',
              field: 'xs',
              condition: {
                field: 'v',
                operator: 'regex',
                value: longPattern,
              },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.xs).toEqual([]);
    });

    it('should reject overly long regex patterns in string_op replace', async () => {
      const longPattern = 'a'.repeat(300);
      const result = (await handler.execute(
        { text: 'aaa' },
        {
          operations: [
            {
              type: 'string_op',
              field: 'text',
              operation: 'replace',
              args: {
                search: longPattern,
                replacement: 'X',
                regex: true,
              },
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.text).toBe('aaa');
    });
  });

  describe('execute - integration chain', () => {
    it('should filter → sort → pick', async () => {
      const result = (await handler.execute(
        {
          users: [
            { name: 'A', score: 30, active: true, email: 'a@e' },
            { name: 'B', score: 50, active: false, email: 'b@e' },
            { name: 'C', score: 70, active: true, email: 'c@e' },
            { name: 'D', score: 90, active: true, email: 'd@e' },
          ],
        },
        {
          operations: [
            {
              type: 'array_filter',
              field: 'users',
              condition: { field: 'active', operator: 'eq', value: true },
            },
            {
              type: 'array_sort',
              field: 'users',
              sortBy: 'score',
              order: 'desc',
            },
          ],
        },
        context,
      )) as unknown as { output: Record<string, unknown> };
      expect(result.output.users).toEqual([
        { name: 'D', score: 90, active: true, email: 'd@e' },
        { name: 'C', score: 70, active: true, email: 'c@e' },
        { name: 'A', score: 30, active: true, email: 'a@e' },
      ]);
    });
  });
});
