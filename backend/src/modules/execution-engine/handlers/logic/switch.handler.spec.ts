import { SwitchHandler } from './switch.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('SwitchHandler', () => {
  let handler: SwitchHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new SwitchHandler();
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
        switchValue: 'status',
        cases: [{ id: 'case-1', value: 'active' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid when switchValue is a non-string (expression-resolved)', () => {
      const result = handler.validate({
        switchValue: 42,
        cases: [{ id: 'case-1', value: 42 }],
      });
      expect(result.valid).toBe(true);
    });

    it('should return invalid when switchValue is missing', () => {
      const result = handler.validate({
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('switchValue is required');
    });

    it('should return invalid when cases is not an array', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: 'not-array',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cases must be a non-empty array');
    });

    it('should return invalid when a case has no id', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [{ value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].id is required and must be a string',
      );
    });

    it('should return invalid when a case has empty string id', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [{ id: '', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].id is required and must be a string',
      );
    });

    it('should return invalid when cases is empty array', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cases must be a non-empty array');
    });

    it('should return invalid when switchValue is null', () => {
      const result = handler.validate({
        switchValue: null,
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('switchValue is required');
    });

    it('should return invalid when hasDefault is not a boolean', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [{ id: 'case-1', value: 'a' }],
        hasDefault: 'yes',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('hasDefault must be a boolean');
    });

    it('should return invalid when switchValue is an empty string', () => {
      const result = handler.validate({
        switchValue: '  ',
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('switchValue is required');
    });

    it('should return invalid when valueType is not a valid type', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [{ id: 'case-1', value: 'a', valueType: 'integer' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].valueType must be one of: string, number, boolean',
      );
    });

    it('should return invalid when case ids are duplicated', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [
          { id: 'dup', value: 'a' },
          { id: 'dup', value: 'b' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cases[1].id 'dup' is duplicated");
    });
  });

  describe('execute', () => {
    it('should match a case by string path lookup', async () => {
      const result = await handler.execute(
        { status: 'active' },
        {
          switchValue: 'status',
          cases: [
            { id: 'case-1', label: 'Active', value: 'active' },
            { id: 'case-2', label: 'Inactive', value: 'inactive' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: 'status',
        value: 'active',
        data: { status: 'active' },
      });
    });

    it('should match a case by nested path lookup', async () => {
      const result = await handler.execute(
        { user: { role: 'admin' } },
        {
          switchValue: 'user.role',
          cases: [
            { id: 'case-1', label: 'Admin', value: 'admin' },
            { id: 'case-2', label: 'User', value: 'user' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: 'user.role',
        value: 'admin',
        data: { user: { role: 'admin' } },
      });
    });

    it('should use non-string switchValue directly (expression-resolved)', async () => {
      const result = await handler.execute(
        { someField: 'ignored' },
        {
          switchValue: 2,
          cases: [
            { id: 'case-1', label: 'One', value: 1 },
            { id: 'case-2', label: 'Two', value: 2 },
            { id: 'case-3', label: 'Three', value: 3 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-2',
        expression: undefined,
        value: 2,
        data: { someField: 'ignored' },
      });
    });

    it('should fall through to default when no case matches', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 'missing',
          cases: [{ id: 'case-1', label: 'A', value: 'a' }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: 'missing',
        value: undefined,
        data: {},
      });
    });

    it('should throw when no case matches and no default', async () => {
      await expect(
        handler.execute(
          {},
          {
            switchValue: 'missing',
            cases: [{ id: 'case-1', label: 'A', value: 'a' }],
            hasDefault: false,
          },
          context,
        ),
      ).rejects.toThrow(
        'No matching case found and no default case configured',
      );
    });

    it('should handle boolean switchValue from expression resolution', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: true,
          cases: [
            { id: 'case-1', label: 'True', value: true },
            { id: 'case-2', label: 'False', value: false },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: undefined,
        value: true,
        data: {},
      });
    });

    it('should fall through to default when hasDefault is omitted', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 'missing',
          cases: [{ id: 'case-1', label: 'A', value: 'a' }],
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: 'missing',
        value: undefined,
        data: {},
      });
    });

    it('should handle null intermediate path gracefully', async () => {
      const result = await handler.execute(
        { user: null },
        {
          switchValue: 'user.role',
          cases: [{ id: 'case-1', label: 'Admin', value: 'admin' }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: 'user.role',
        value: undefined,
        data: { user: null },
      });
    });

    it('should match first case when duplicate values exist', async () => {
      const result = await handler.execute(
        { x: 1 },
        {
          switchValue: 'x',
          cases: [
            { id: 'first', label: 'First', value: 1 },
            { id: 'second', label: 'Second', value: 1 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'first',
        expression: 'x',
        value: 1,
        data: { x: 1 },
      });
    });

    it('should match number via path lookup with valueType number', async () => {
      const result = await handler.execute(
        { x: 42 },
        {
          switchValue: 'x',
          cases: [
            {
              id: 'case-1',
              label: 'FortyTwo',
              value: '42',
              valueType: 'number',
            },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: 'x',
        value: 42,
        data: { x: 42 },
      });
    });

    it('should use strict equality when valueType is not specified', async () => {
      const result = await handler.execute(
        { x: '1' },
        {
          switchValue: 'x',
          cases: [{ id: 'case-1', label: 'Num', value: 1 }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: 'x',
        value: '1',
        data: { x: '1' },
      });
    });

    it('should handle falsy number switchValue (0)', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 0,
          cases: [
            { id: 'case-0', label: 'Zero', value: 0 },
            { id: 'case-1', label: 'One', value: 1 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-0',
        expression: undefined,
        value: 0,
        data: {},
      });
    });

    it('should throw when hasDefault is false and null intermediate path', async () => {
      await expect(
        handler.execute(
          { user: null },
          {
            switchValue: 'user.role',
            cases: [{ id: 'case-1', label: 'Admin', value: 'admin' }],
            hasDefault: false,
          },
          context,
        ),
      ).rejects.toThrow(
        'No matching case found and no default case configured',
      );
    });

    it('should coerce case value to number when valueType is number', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 42,
          cases: [
            {
              id: 'case-1',
              label: 'FortyTwo',
              value: '42',
              valueType: 'number',
            },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: undefined,
        value: 42,
        data: {},
      });
    });

    it('should coerce case value to boolean when valueType is boolean', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: true,
          cases: [
            { id: 'case-1', label: 'Yes', value: 'true', valueType: 'boolean' },
            { id: 'case-2', label: 'No', value: 'false', valueType: 'boolean' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: undefined,
        value: true,
        data: {},
      });
    });

    it('should not coerce when valueType is string (default)', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 42,
          cases: [
            { id: 'case-1', label: 'Str42', value: '42', valueType: 'string' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: undefined,
        value: 42,
        data: {},
      });
    });

    it('should not coerce when valueType is omitted', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 42,
          cases: [{ id: 'case-1', label: 'Str42', value: '42' }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: undefined,
        value: 42,
        data: {},
      });
    });

    it('should keep original string when number coercion fails', async () => {
      const result = await handler.execute(
        { x: 'abc' },
        {
          switchValue: 'x',
          cases: [
            { id: 'case-1', label: 'NaN', value: 'abc', valueType: 'number' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: 'x',
        value: 'abc',
        data: { x: 'abc' },
      });
    });

    it('should keep original string when boolean coercion gets non-boolean string', async () => {
      const result = await handler.execute(
        { x: 'yes' },
        {
          switchValue: 'x',
          cases: [
            { id: 'case-1', label: 'Yes', value: 'yes', valueType: 'boolean' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'case-1',
        expression: 'x',
        value: 'yes',
        data: { x: 'yes' },
      });
    });

    it('should not traverse prototype properties', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: '__proto__.constructor',
          cases: [{ id: 'case-1', label: 'Match', value: 'Function' }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toEqual({
        port: 'default',
        expression: '__proto__.constructor',
        value: undefined,
        data: {},
      });
    });
  });
});
