import { ManualTriggerHandler } from './manual-trigger.handler';
import type { ExecutionContext } from '../../core/node-handler.interface';

function makeContext(rawConfig?: Record<string, unknown>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    ...(rawConfig ? { rawConfig: Object.freeze({ ...rawConfig }) } : {}),
  };
}

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
    it('returns valid when parameters is undefined (backward compat)', () => {
      expect(handler.validate({})).toEqual({ valid: true, errors: [] });
    });

    it('returns valid for a well-formed parameters schema', () => {
      const result = handler.validate({
        parameters: [
          { name: 'orderId', type: 'string', required: true },
          { name: 'amount', type: 'number' },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns invalid for duplicate parameter names', () => {
      const result = handler.validate({
        parameters: [
          { name: 'x', type: 'string' },
          { name: 'x', type: 'number' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('parameters.x');
    });

    it('returns invalid for invalid identifier', () => {
      const result = handler.validate({
        parameters: [{ name: '1bad', type: 'string' }],
      });
      expect(result.valid).toBe(false);
    });

    it('returns invalid when parameters is not an array', () => {
      const result = handler.validate({ parameters: { not: 'array' } });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute', () => {
    it('exposes resolved parameters on structured output', async () => {
      const result = (await handler.execute(
        { parameters: { name: 'Alice', count: 3 } },
        { parameters: [{ name: 'name', type: 'string' }] },
        mockContext,
      )) as {
        config: unknown;
        output: { parameters: Record<string, unknown> };
      };

      expect(result.output.parameters).toEqual({ name: 'Alice', count: 3 });
    });

    it('preserves webhook-style sibling fields (body, headers, query, method)', async () => {
      const result = (await handler.execute(
        {
          parameters: { orderId: 'abc' },
          body: { raw: true },
          headers: { 'x-source': 'github' },
          query: { q: '1' },
          method: 'POST',
        },
        { parameters: [{ name: 'orderId', type: 'string' }] },
        mockContext,
      )) as {
        output: {
          parameters: Record<string, unknown>;
          body: unknown;
          headers: unknown;
          query: unknown;
          method: string;
        };
      };

      expect(result.output.parameters).toEqual({ orderId: 'abc' });
      expect(result.output.body).toEqual({ raw: true });
      expect(result.output.method).toBe('POST');
    });

    it('returns parameters: {} when input is null/undefined', async () => {
      const result = (await handler.execute(null, {}, mockContext)) as {
        output: { parameters: Record<string, unknown> };
      };
      expect(result.output.parameters).toEqual({});
    });

    it('echoes declared schema under config.parameters', async () => {
      const schema = [{ name: 'x', type: 'string' }];
      const result = (await handler.execute(
        { parameters: { x: 'y' } },
        { parameters: schema },
        mockContext,
      )) as { config: { parameters: unknown } };
      expect(result.config.parameters).toEqual(schema);
    });

    it('echoes rawConfig.parameters (raw defaultValue templates) over evaluated config', async () => {
      // Workflow author entered `defaultValue: '{{ $today }}'`; engine
      // evaluated it to a concrete date before dispatching. Principle 7
      // requires `config` echo to keep the raw template.
      const rawSchema = [
        { name: 'date', type: 'string', defaultValue: '{{ $today }}' },
      ];
      const evaluatedSchema = [
        { name: 'date', type: 'string', defaultValue: '2026-05-08' },
      ];
      const result = (await handler.execute(
        { parameters: { date: '2026-05-08' } },
        { parameters: evaluatedSchema },
        makeContext({ parameters: rawSchema }),
      )) as { config: { parameters: unknown } };
      expect(result.config.parameters).toEqual(rawSchema);
    });
  });
});
