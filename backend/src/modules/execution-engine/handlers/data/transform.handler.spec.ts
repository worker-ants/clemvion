import { TransformHandler } from './transform.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('TransformHandler', () => {
  let handler: TransformHandler;
  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
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
      expect(result.errors[0]).toContain('operations');
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
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
      )) as { output: Record<string, unknown> };
      expect(result.output.val).toBe(10);
    });

    it('should round', async () => {
      const result = (await handler.execute(
        { val: 3.7 },
        { operations: [{ type: 'math_op', field: 'val', operation: 'round' }] },
        context,
      )) as { output: Record<string, unknown> };
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
});
