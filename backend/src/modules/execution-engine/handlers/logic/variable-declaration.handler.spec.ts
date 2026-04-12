import { VariableDeclarationHandler } from './variable-declaration.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('VariableDeclarationHandler', () => {
  let handler: VariableDeclarationHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new VariableDeclarationHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
    };
  });

  describe('validate', () => {
    it('should return valid for correct config', () => {
      const result = handler.validate({
        variables: [
          { name: 'counter', type: 'number', defaultValue: 0 },
          { name: 'label', type: 'string', defaultValue: 'hello' },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when variables is missing', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('variables must be an array');
    });

    it('should return invalid when variables is empty', () => {
      const result = handler.validate({ variables: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('variables must not be empty');
    });

    it('should return invalid when variable name is missing', () => {
      const result = handler.validate({
        variables: [{ type: 'string', defaultValue: '' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'variables[0].name is required and must be a string',
      );
    });

    it('should return invalid when variable type is missing', () => {
      const result = handler.validate({
        variables: [{ name: 'x', defaultValue: '' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'variables[0].type is required and must be a string',
      );
    });
  });

  describe('execute', () => {
    it('should set variables with default values in context', async () => {
      const input = { some: 'data' };
      const result = await handler.execute(
        input,
        {
          variables: [
            { name: 'counter', type: 'number', defaultValue: 0 },
            { name: 'label', type: 'string', defaultValue: 'hello' },
          ],
        },
        context,
      );

      expect((result as any).output).toBe(input);
      expect(context.variables['counter']).toBe(0);
      expect(context.variables['label']).toBe('hello');
    });

    it('should set null when no defaultValue is provided', async () => {
      await handler.execute(
        {},
        {
          variables: [{ name: 'x', type: 'number' }],
        },
        context,
      );

      expect(context.variables['x']).toBeNull();
    });

    it('should not overwrite existing variables', async () => {
      context.variables['counter'] = 42;

      await handler.execute(
        {},
        {
          variables: [{ name: 'counter', type: 'number', defaultValue: 0 }],
        },
        context,
      );

      expect(context.variables['counter']).toBe(42);
    });

    it('should pass through input unchanged', async () => {
      const input = { nested: { output: [1, 2, 3] } };
      const result = await handler.execute(
        input,
        {
          variables: [{ name: 'v', type: 'string', defaultValue: '' }],
        },
        context,
      );

      expect((result as any).output).toBe(input);
    });

    it('should coerce string defaultValue to number type', async () => {
      await handler.execute(
        {},
        {
          variables: [{ name: 'counter', type: 'number', defaultValue: '1' }],
        },
        context,
      );

      expect(context.variables['counter']).toBe(1);
      expect(typeof context.variables['counter']).toBe('number');
    });

    it('should coerce string defaultValue to boolean type', async () => {
      await handler.execute(
        {},
        {
          variables: [
            { name: 'flag1', type: 'boolean', defaultValue: 'true' },
            { name: 'flag2', type: 'boolean', defaultValue: 'false' },
          ],
        },
        context,
      );

      expect(context.variables['flag1']).toBe(true);
      expect(context.variables['flag2']).toBe(false);
    });

    it('should coerce JSON string defaultValue to array type', async () => {
      await handler.execute(
        {},
        {
          variables: [
            {
              name: 'items',
              type: 'array',
              defaultValue: '[{"id":1,"value":"a"},{"id":2,"value":"b"}]',
            },
          ],
        },
        context,
      );

      expect(Array.isArray(context.variables['items'])).toBe(true);
      expect(context.variables['items']).toMatchObject([
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
      ]);
    });

    it('should coerce JSON string defaultValue to object type', async () => {
      await handler.execute(
        {},
        {
          variables: [
            {
              name: 'config',
              type: 'object',
              defaultValue: '{"key":"value"}',
            },
          ],
        },
        context,
      );

      expect(context.variables['config']).toMatchObject({ key: 'value' });
    });

    it('should return null for invalid number string', async () => {
      await handler.execute(
        {},
        {
          variables: [{ name: 'x', type: 'number', defaultValue: 'abc' }],
        },
        context,
      );

      expect(context.variables['x']).toBeNull();
    });

    it('should keep already-typed values unchanged', async () => {
      await handler.execute(
        {},
        {
          variables: [
            { name: 'n', type: 'number', defaultValue: 42 },
            { name: 'arr', type: 'array', defaultValue: [1, 2] },
          ],
        },
        context,
      );

      expect(context.variables['n']).toBe(42);
      expect(context.variables['arr']).toMatchObject([1, 2]);
    });

    it('should declare multiple variables at once', async () => {
      await handler.execute(
        {},
        {
          variables: [
            { name: 'a', type: 'number', defaultValue: 1 },
            { name: 'b', type: 'string', defaultValue: 'test' },
            { name: 'c', type: 'boolean', defaultValue: true },
            { name: 'd', type: 'array', defaultValue: [1, 2] },
          ],
        },
        context,
      );

      expect(context.variables['a']).toBe(1);
      expect(context.variables['b']).toBe('test');
      expect(context.variables['c']).toBe(true);
      expect(context.variables['d']).toMatchObject([1, 2]);
    });
  });
});
