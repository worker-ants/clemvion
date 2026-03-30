import { ManualTriggerHandler } from './manual-trigger.handler';
import type { ExecutionContext } from '../node-handler.interface';

describe('ManualTriggerHandler', () => {
  let handler: ManualTriggerHandler;

  const mockContext: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
  };

  beforeEach(() => {
    handler = new ManualTriggerHandler();
  });

  describe('validate', () => {
    it('should always return valid', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid regardless of config content', () => {
      const result = handler.validate({ foo: 'bar', nested: { x: 1 } });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should pass through input unchanged', async () => {
      const input = { userId: 123, action: 'signup' };
      const result = await handler.execute(input, {}, mockContext);
      expect(result).toEqual(input);
    });

    it('should pass through null input', async () => {
      const result = await handler.execute(null, {}, mockContext);
      expect(result).toBeNull();
    });

    it('should pass through undefined input', async () => {
      const result = await handler.execute(undefined, {}, mockContext);
      expect(result).toBeUndefined();
    });

    it('should pass through complex nested input', async () => {
      const input = { data: { items: [1, 2, 3], nested: { deep: true } } };
      const result = await handler.execute(input, {}, mockContext);
      expect(result).toBe(input); // Same reference, not a copy
    });
  });
});
