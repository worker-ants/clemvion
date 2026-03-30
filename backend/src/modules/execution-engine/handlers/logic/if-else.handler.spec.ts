import { IfElseHandler } from './if-else.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('IfElseHandler', () => {
  let handler: IfElseHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new IfElseHandler();
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
        conditions: [{ field: 'age', operator: 'gt', value: 18 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when conditions is missing', () => {
      const result = handler.validate({ combineMode: 'and' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('conditions must be a non-empty array');
    });

    it('should return invalid when conditions is empty', () => {
      const result = handler.validate({
        conditions: [],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('conditions must be a non-empty array');
    });

    it('should return invalid for missing field in condition', () => {
      const result = handler.validate({
        conditions: [{ operator: 'eq', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
    });

    it('should return invalid for unknown operator', () => {
      const result = handler.validate({
        conditions: [{ field: 'x', operator: 'unknown', value: 1 }],
        combineMode: 'and',
      });
      expect(result.valid).toBe(false);
    });

    it('should return invalid for bad combineMode', () => {
      const result = handler.validate({
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
        combineMode: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('combineMode must be "and" or "or"');
    });
  });

  describe('execute', () => {
    it('should route to "true" port when eq condition passes', async () => {
      const result = await handler.execute(
        { status: 'active' },
        {
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { status: 'active' },
      });
    });

    it('should route to "false" port when eq condition fails', async () => {
      const result = await handler.execute(
        { status: 'inactive' },
        {
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'false',
        data: { status: 'inactive' },
      });
    });

    it('should handle neq operator', async () => {
      const result = await handler.execute(
        { value: 5 },
        {
          conditions: [{ field: 'value', operator: 'neq', value: 10 }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { value: 5 } });
    });

    it('should handle gt operator', async () => {
      const result = await handler.execute(
        { age: 25 },
        {
          conditions: [{ field: 'age', operator: 'gt', value: 18 }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { age: 25 } });
    });

    it('should handle gte operator', async () => {
      const result = await handler.execute(
        { age: 18 },
        {
          conditions: [{ field: 'age', operator: 'gte', value: 18 }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { age: 18 } });
    });

    it('should handle lt operator', async () => {
      const result = await handler.execute(
        { score: 3 },
        {
          conditions: [{ field: 'score', operator: 'lt', value: 5 }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { score: 3 } });
    });

    it('should handle lte operator', async () => {
      const result = await handler.execute(
        { score: 5 },
        {
          conditions: [{ field: 'score', operator: 'lte', value: 5 }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { score: 5 } });
    });

    it('should handle contains operator', async () => {
      const result = await handler.execute(
        { name: 'hello world' },
        {
          conditions: [
            { field: 'name', operator: 'contains', value: 'world' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { name: 'hello world' },
      });
    });

    it('should handle not_contains operator', async () => {
      const result = await handler.execute(
        { name: 'hello' },
        {
          conditions: [
            { field: 'name', operator: 'not_contains', value: 'world' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { name: 'hello' } });
    });

    it('should handle starts_with operator', async () => {
      const result = await handler.execute(
        { url: 'https://example.com' },
        {
          conditions: [
            { field: 'url', operator: 'starts_with', value: 'https' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { url: 'https://example.com' },
      });
    });

    it('should handle ends_with operator', async () => {
      const result = await handler.execute(
        { file: 'document.pdf' },
        {
          conditions: [
            { field: 'file', operator: 'ends_with', value: '.pdf' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { file: 'document.pdf' },
      });
    });

    it('should handle is_empty operator with empty string', async () => {
      const result = await handler.execute(
        { field: '' },
        {
          conditions: [{ field: 'field', operator: 'is_empty', value: null }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { field: '' } });
    });

    it('should handle is_empty operator with null', async () => {
      const result = await handler.execute(
        { field: null },
        {
          conditions: [{ field: 'field', operator: 'is_empty', value: null }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { field: null } });
    });

    it('should handle is_empty operator with empty array', async () => {
      const result = await handler.execute(
        { items: [] },
        {
          conditions: [{ field: 'items', operator: 'is_empty', value: null }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { items: [] } });
    });

    it('should handle is_not_empty operator', async () => {
      const result = await handler.execute(
        { name: 'test' },
        {
          conditions: [
            { field: 'name', operator: 'is_not_empty', value: null },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { name: 'test' } });
    });

    it('should handle is_null operator', async () => {
      const result = await handler.execute(
        { value: null },
        {
          conditions: [{ field: 'value', operator: 'is_null', value: null }],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: { value: null } });
    });

    it('should handle is_null with undefined field', async () => {
      const result = await handler.execute(
        {},
        {
          conditions: [
            { field: 'missing', operator: 'is_null', value: null },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({ port: 'true', data: {} });
    });

    it('should combine conditions with "and" mode', async () => {
      const result = await handler.execute(
        { age: 25, status: 'active' },
        {
          conditions: [
            { field: 'age', operator: 'gt', value: 18 },
            { field: 'status', operator: 'eq', value: 'active' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { age: 25, status: 'active' },
      });
    });

    it('should fail "and" mode when one condition fails', async () => {
      const result = await handler.execute(
        { age: 15, status: 'active' },
        {
          conditions: [
            { field: 'age', operator: 'gt', value: 18 },
            { field: 'status', operator: 'eq', value: 'active' },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'false',
        data: { age: 15, status: 'active' },
      });
    });

    it('should pass "or" mode when one condition passes', async () => {
      const result = await handler.execute(
        { age: 15, status: 'active' },
        {
          conditions: [
            { field: 'age', operator: 'gt', value: 18 },
            { field: 'status', operator: 'eq', value: 'active' },
          ],
          combineMode: 'or',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { age: 15, status: 'active' },
      });
    });

    it('should handle nested field access', async () => {
      const result = await handler.execute(
        { user: { profile: { age: 30 } } },
        {
          conditions: [
            { field: 'user.profile.age', operator: 'gte', value: 21 },
          ],
          combineMode: 'and',
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { user: { profile: { age: 30 } } },
      });
    });

    it('should default combineMode to "and"', async () => {
      const result = await handler.execute(
        { a: 1, b: 2 },
        {
          conditions: [
            { field: 'a', operator: 'eq', value: 1 },
            { field: 'b', operator: 'eq', value: 2 },
          ],
        },
        context,
      );
      expect(result).toEqual({
        port: 'true',
        data: { a: 1, b: 2 },
      });
    });
  });
});
