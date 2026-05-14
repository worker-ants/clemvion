import { ManualTriggerHandler } from './manual-trigger.handler';
import type { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';

function makeContext(rawConfig?: Record<string, unknown>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
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
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
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
      )) as unknown as {
        config: unknown;
        output: { parameters: Record<string, unknown> };
      };

      expect(result.output.parameters).toEqual({ name: 'Alice', count: 3 });
    });

    it('groups webhook transport fields under output.request and tags meta.source: webhook', async () => {
      const result = (await handler.execute(
        {
          __triggerSource: 'webhook',
          parameters: { orderId: 'abc' },
          body: { raw: true },
          headers: { 'x-source': 'github' },
          query: { q: '1' },
          method: 'POST',
        },
        { parameters: [{ name: 'orderId', type: 'string' }] },
        mockContext,
      )) as unknown as {
        output: {
          parameters: Record<string, unknown>;
          request: {
            method: string;
            headers: Record<string, string>;
            query: Record<string, string>;
            body: unknown;
          };
          // Flat webhook transport fields must NOT spread on output anymore
          body?: unknown;
          headers?: unknown;
          query?: unknown;
          method?: unknown;
        };
        meta: { source: string };
      };

      expect(result.output.parameters).toEqual({ orderId: 'abc' });
      expect(result.output.request).toEqual({
        method: 'POST',
        headers: { 'x-source': 'github' },
        query: { q: '1' },
        body: { raw: true },
      });
      expect(result.output.body).toBeUndefined();
      expect(result.output.headers).toBeUndefined();
      expect(result.output.query).toBeUndefined();
      expect(result.output.method).toBeUndefined();
      expect(result.meta.source).toBe('webhook');
    });

    it('detects webhook by transport-shape when __triggerSource is absent', async () => {
      // Backward-resilient detection — if an adapter forgets to stamp the
      // marker but the input clearly carries HTTP transport fields, treat it
      // as a webhook so output.request is still produced.
      const result = (await handler.execute(
        {
          parameters: { orderId: 'abc' },
          body: { raw: true },
          headers: { 'x-source': 'github' },
          query: {},
          method: 'POST',
        },
        { parameters: [{ name: 'orderId', type: 'string' }] },
        mockContext,
      )) as unknown as {
        output: {
          parameters: Record<string, unknown>;
          request: { method: string; body: unknown };
        };
        meta: { source: string };
      };
      expect(result.output.request.method).toBe('POST');
      expect(result.output.request.body).toEqual({ raw: true });
      expect(result.meta.source).toBe('webhook');
    });

    it('emits meta.source: schedule when __triggerSource is schedule', async () => {
      const result = (await handler.execute(
        { __triggerSource: 'schedule', parameters: { foo: 1 } },
        {},
        mockContext,
      )) as unknown as {
        output: { parameters: Record<string, unknown>; request?: unknown };
        meta: { source: string };
      };
      expect(result.output.parameters).toEqual({ foo: 1 });
      expect(result.output.request).toBeUndefined();
      expect(result.meta.source).toBe('schedule');
    });

    it('emits meta.source: manual when __triggerSource is manual', async () => {
      const result = (await handler.execute(
        { __triggerSource: 'manual', parameters: { foo: 1 } },
        {},
        mockContext,
      )) as unknown as {
        output: { parameters: Record<string, unknown>; request?: unknown };
        meta: { source: string };
      };
      expect(result.output.request).toBeUndefined();
      expect(result.meta.source).toBe('manual');
    });

    it('defaults meta.source to manual when no marker and no transport fields', async () => {
      const result = (await handler.execute(
        { parameters: { foo: 1 } },
        {},
        mockContext,
      )) as unknown as {
        output: { parameters: Record<string, unknown>; request?: unknown };
        meta: { source: string };
      };
      expect(result.meta.source).toBe('manual');
      expect(result.output.request).toBeUndefined();
    });

    it('does not leak the __triggerSource marker onto output', async () => {
      const result = (await handler.execute(
        { __triggerSource: 'webhook', parameters: {}, method: 'GET' },
        {},
        mockContext,
      )) as unknown as {
        output: Record<string, unknown>;
      };
      expect(result.output.__triggerSource).toBeUndefined();
    });

    it('returns parameters: {} when input is null/undefined', async () => {
      const result = (await handler.execute(
        null,
        {},
        mockContext,
      )) as unknown as {
        output: { parameters: Record<string, unknown> };
        meta: { source: string };
      };
      expect(result.output.parameters).toEqual({});
      expect(result.meta.source).toBe('manual');
    });

    it('echoes declared schema under config.parameters', async () => {
      const schema = [{ name: 'x', type: 'string' }];
      const result = (await handler.execute(
        { parameters: { x: 'y' } },
        { parameters: schema },
        mockContext,
      )) as unknown as { config: { parameters: unknown } };
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
      )) as unknown as { config: { parameters: unknown } };
      expect(result.config.parameters).toEqual(rawSchema);
    });
  });
});
