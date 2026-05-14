import { VariableDeclarationHandler } from './variable-declaration.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';

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
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
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
      // Schema warningRule "최소 1개 이상의 변수를 정의해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('변수'))).toBe(true);
    });

    it('should return invalid when variables is empty', () => {
      const result = handler.validate({ variables: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('변수'))).toBe(true);
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

  // ENG-RC-* — Phase 3 raw-echo migration.
  describe('config echoes rawConfig defaultValue templates', () => {
    it('preserves `{{ ... }}` defaultValue templates', async () => {
      const rawVariables = [
        { name: 'today', type: 'string', defaultValue: '{{ $today }}' },
      ];
      const evaluatedVariables = [
        { name: 'today', type: 'string', defaultValue: '2026-05-08' },
      ];
      const result = (await handler.execute(
        {},
        { variables: evaluatedVariables },
        {
          ...context,
          rawConfig: Object.freeze({ variables: rawVariables }),
        },
      )) as unknown as { config: { variables: unknown } };

      expect(result.config.variables).toEqual(rawVariables);
      // Evaluated value still flows into context.variables for runtime use.
      expect(context.variables.today).toBe('2026-05-08');
    });
  });

  // Phase 2 (C) — meta observability fields. Principle 2 (meta는 실행 메트릭).
  describe('meta observability', () => {
    it('reports newly declared variables in meta.declared', async () => {
      const result = await handler.execute(
        {},
        {
          variables: [
            { name: 'counter', type: 'number', defaultValue: 0 },
            { name: 'label', type: 'string', defaultValue: 'hi' },
          ],
        },
        context,
      );

      expect(result.meta).toBeDefined();
      expect(result.meta?.declared).toEqual(['counter', 'label']);
      expect(result.meta?.skipped).toEqual([]);
      expect(result.meta?.coercionWarnings).toEqual([]);
    });

    it('reports already-existing variables in meta.skipped', async () => {
      context.variables['counter'] = 42;

      const result = await handler.execute(
        {},
        {
          variables: [
            { name: 'counter', type: 'number', defaultValue: 0 },
            { name: 'fresh', type: 'string', defaultValue: 'new' },
          ],
        },
        context,
      );

      expect(result.meta?.declared).toEqual(['fresh']);
      expect(result.meta?.skipped).toEqual(['counter']);
      // skipped variable retains its original value (silent skip).
      expect(context.variables['counter']).toBe(42);
    });

    it('reports failed number coercion in meta.coercionWarnings', async () => {
      const result = await handler.execute(
        {},
        {
          variables: [
            { name: 'broken', type: 'number', defaultValue: 'abc' },
            { name: 'ok', type: 'number', defaultValue: 7 },
          ],
        },
        context,
      );

      expect(result.meta?.declared).toEqual(['broken', 'ok']);
      expect(result.meta?.coercionWarnings).toEqual([
        {
          name: 'broken',
          attemptedType: 'number',
          error: expect.stringContaining('number'),
        },
      ]);
      // coerce failure stores null silently (still considered declared).
      expect(context.variables['broken']).toBeNull();
      expect(context.variables['ok']).toBe(7);
    });

    it('does NOT warn when defaultValue is omitted (raw=null path)', async () => {
      // `defaultValue ?? null` → coerce(null, ...) returns null by design.
      // This is the explicit null-init contract, not a coercion failure.
      const result = await handler.execute(
        {},
        { variables: [{ name: 'x', type: 'number' }] },
        context,
      );

      expect(result.meta?.declared).toEqual(['x']);
      expect(result.meta?.coercionWarnings).toEqual([]);
      expect(context.variables['x']).toBeNull();
    });
  });
});
