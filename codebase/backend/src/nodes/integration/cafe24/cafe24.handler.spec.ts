import { Cafe24Handler } from './cafe24.handler';
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
} from './cafe24-api.client';
import { IntegrationError } from '../_base/integration-handler-base';
import type { ExecutionContext } from '../../core/node-handler.interface';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-cafe24-1',
    workspaceId: 'ws-1',
    serviceType: 'cafe24',
    name: 'My Cafe24',
    authType: 'oauth2',
    credentials: {
      mall_id: 'myshop',
      app_type: 'public',
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      scopes: ['mall.read_product'],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cafe24_operator_id: 'operator-1',
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  } as Integration;
}

function makeContext(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };
}

describe('Cafe24Handler', () => {
  let integrationsService: {
    getForExecution: Mock;
    logUsage: Mock;
  };
  let apiClient: { call: Mock };
  let handler: Cafe24Handler;

  beforeEach(() => {
    integrationsService = {
      getForExecution: jest.fn(),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    apiClient = { call: jest.fn() };
    handler = new Cafe24Handler(
      integrationsService as never,
      apiClient as unknown as Cafe24ApiClient,
    );
  });

  describe('validate', () => {
    it('rejects missing integrationId / resource / operation', () => {
      const r = handler.validate({});
      expect(r.valid).toBe(false);
      expect(r.errors).toEqual(
        expect.arrayContaining([
          'integrationId is required and must be a string',
          'resource is required and must be a string',
          'operation is required and must be a string',
        ]),
      );
    });

    it('rejects unknown resource enum', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'not_a_resource',
        operation: 'op',
      });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toMatch(/resource must be one of/);
    });

    it('accepts a well-formed config', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'product_list',
        fields: { shop_no: 1 },
      });
      expect(r.valid).toBe(true);
    });

    it('rejects fields that is not an object', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'product_list',
        fields: 'not-an-object',
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('execute — pre-flight errors route to port:error (D4)', () => {
    // D4 (2026-05-17) — handler.validate() 가 잡지 못한 IntegrationError 는
    // catch + port:'error' 로 라우팅. Integration 4종 모두 동일 패턴.
    const expectErrorOutput = (result: unknown, expectedCode: string): void => {
      const r = result as Record<string, unknown>;
      expect(r.port).toBe('error');
      const output = r.output as { error: { code: string } };
      expect(output.error.code).toBe(expectedCode);
    };

    it('CAFE24_UNKNOWN_OPERATION on operation not in metadata', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_does_not_exist',
          fields: {},
        },
        makeContext(),
      );
      expectErrorOutput(result, 'CAFE24_UNKNOWN_OPERATION');
    });

    // W5 — operation lookup failure: api.label present, method/path still null (INT-US-05)
    it('logs apiInfo.label only (method/path null) when operation lookup fails (INT-US-05)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_does_not_exist',
          fields: {},
        },
        makeContext(),
      );
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          api: expect.objectContaining({
            label: 'cafe24.product.product_does_not_exist',
          }),
        }),
      );
      // method and path should NOT be set (still undefined/null) since lookup failed
      const logCall = integrationsService.logUsage.mock.calls[0][0] as {
        api: { label?: string; method?: string | null; path?: string | null };
      };
      expect(logCall.api.method).toBeUndefined();
      expect(logCall.api.path).toBeUndefined();
    });

    it('CAFE24_MISSING_FIELDS when requiredFields not supplied', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_get',
          fields: {}, // product_no missing
        },
        makeContext(),
      );
      expectErrorOutput(result, 'CAFE24_MISSING_FIELDS');
    });

    // spec/conventions/cafe24-api-metadata.md §2 "constraints 의 의미" — constraints
    // violation routes through the same CAFE24_MISSING_FIELDS code (no new code).
    // customer_list declares `oneOf: [member_id, group_no, since]`.
    it('CAFE24_MISSING_FIELDS when constraints oneOf is violated (customer_list)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'customer',
          operation: 'customer_list',
          fields: { shop_no: 1 }, // shop_no satisfies requiredFields,
          //                          but neither cellphone nor member_id provided
        },
        makeContext(),
      );
      expectErrorOutput(result, 'CAFE24_MISSING_FIELDS');
      const out = result.output as { error: { message: string } };
      expect(out.error.message).toContain('oneOf');
      expect(out.error.message).toMatch(/cellphone|member_id/);
    });

    it('constraints oneOf satisfied — proceeds past validation (customer_list)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        headers: {},
        body: { customers: [] },
      });
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'customer',
          operation: 'customer_list',
          fields: { shop_no: 1, member_id: 'alice' },
        },
        makeContext(),
      );
      // No CAFE24_MISSING_FIELDS — success path because oneOf satisfied.
      const out = result as { port?: string };
      expect(out.port).toBe('success');
    });

    it('INTEGRATION_TYPE_MISMATCH when integration serviceType is not cafe24', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'mcp' }),
      );
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );
      expectErrorOutput(result, 'INTEGRATION_TYPE_MISMATCH');
    });

    it('INTEGRATION_NOT_CONNECTED when status !== connected', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );
      expectErrorOutput(result, 'INTEGRATION_NOT_CONNECTED');
    });

    it('CAFE24_INVALID_MALL_ID when credentials.mall_id is malformed', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          credentials: {
            mall_id: 'BAD shop!',
            app_type: 'public',
            access_token: 't',
            refresh_token: 'r',
          },
        }),
      );
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );
      expectErrorOutput(result, 'CAFE24_INVALID_MALL_ID');
    });
  });

  describe('execute — runtime', () => {
    it('happy path — dispatches to ApiClient with parsed metadata, returns success envelope', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { products: [{ product_no: 1 }] },
        headers: {},
        callUsage: 12,
        callRemain: 0,
        callLimit: '5/40',
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1, display: 'T' },
          pagination: { limit: 50, offset: 0 },
        },
        makeContext(),
      );

      // ApiClient invoked with metadata-driven path / query / method.
      const callArgs = apiClient.call.mock.calls[0];
      expect(callArgs[1]).toEqual({
        method: 'GET',
        path: 'products',
        query: { shop_no: 1, display: 'T', limit: 50, offset: 0 },
        body: undefined,
      });

      expect(result.port).toBe('success');
      expect(result.output).toEqual({
        response: { products: [{ product_no: 1 }] },
      });
      const meta = result.meta as Record<string, unknown>;
      expect(meta.statusCode).toBe(200);
      expect(typeof meta.durationMs).toBe('number');
      expect(meta.callUsage).toBe(12);
      expect(meta.callLimit).toBe('5/40');

      // Config echo preserves raw input (Principle 7).
      const cfg = result.config;
      expect(cfg.resource).toBe('product');
      expect(cfg.operation).toBe('product_list');
      expect(cfg.fields).toEqual({ shop_no: 1, display: 'T' });

      // Usage log (success).
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );

      // W3 — api field value assertion (INT-US-05)
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          api: expect.objectContaining({
            label: 'cafe24.product.product_list',
            method: 'GET',
            path: expect.stringContaining('products'),
          }),
        }),
      );
    });

    it('path placeholders are substituted from fields', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { product: { product_no: 42 } },
        headers: {},
        retries: 0,
      });

      await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_get',
          fields: { product_no: 42, shop_no: 1 },
        },
        makeContext(),
      );

      const callOpts = apiClient.call.mock.calls[0][1] as {
        path: string;
        query: Record<string, unknown>;
      };
      expect(callOpts.path).toBe('products/42');
      expect(callOpts.query).toEqual({ shop_no: 1 });
    });

    it('PUT — body fields routed to body, path fields to URL', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: {},
        headers: {},
        retries: 0,
      });

      await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_update',
          fields: {
            product_no: 1001,
            product_name: 'New name',
            price: '10000.00',
          },
        },
        makeContext(),
      );

      const callOpts = apiClient.call.mock.calls[0][1] as {
        method: string;
        path: string;
        body: Record<string, unknown>;
      };
      expect(callOpts.method).toBe('PUT');
      expect(callOpts.path).toBe('products/1001');
      expect(callOpts.body).toEqual({
        product_name: 'New name',
        price: '10000.00',
      });
    });

    it('Cafe24 4xx (404) — routes to error port with CAFE24_404', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 404,
        body: { error: { code: '404', message: 'Not Found' } },
        headers: {},
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_get',
          fields: { product_no: 9999 },
        },
        makeContext(),
      );

      expect(result.port).toBe('error');
      const out = result.output as {
        error: Record<string, unknown>;
        response: unknown;
      };
      expect(out.error.code).toBe('CAFE24_404');
      expect((out.error.details as Record<string, unknown>).statusCode).toBe(
        404,
      );
      expect(
        (out.error.details as Record<string, unknown>).cafe24ErrorCode,
      ).toBe('404');
      expect(out.response).toEqual({
        error: { code: '404', message: 'Not Found' },
      });
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('Cafe24AuthFailedError — error port + CAFE24_AUTH_FAILED', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new Cafe24AuthFailedError(401, 'myshop', {
          error: 'Unauthorized',
        }),
      );

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );

      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('CAFE24_AUTH_FAILED');
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('Cafe24RateLimitedError — error port + CAFE24_RATE_LIMITED + retries detail', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new Cafe24RateLimitedError(2, 5, 'myshop'),
      );

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'order',
          operation: 'order_list',
          fields: {
            shop_no: 1,
            start_date: '2026-01-01',
            end_date: '2026-01-31',
          },
        },
        makeContext(),
      );

      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('CAFE24_RATE_LIMITED');
      const details = out.error.details as Record<string, unknown>;
      expect(details.retries).toBe(2);
      expect(details.lastRetryAfterSec).toBe(5);
    });

    it('Cafe24TransportFailedError — error port + CAFE24_TRANSPORT_FAILED', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new Cafe24TransportFailedError(new Error('ECONNRESET')),
      );

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );

      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('CAFE24_TRANSPORT_FAILED');
      expect((result.meta as Record<string, unknown>).statusCode).toBe(0);
    });

    it('IntegrationError from base layer routes to port:error (D4)', async () => {
      integrationsService.getForExecution.mockRejectedValue(
        new IntegrationError('INTEGRATION_NOT_FOUND', 'gone'),
      );

      const result = (await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const out = result.output as { error: { code: string } };
      expect(out.error.code).toBe('INTEGRATION_NOT_FOUND');
    });

    // B-5-6: logUsage 가 DB 다운 등으로 실패해도 result port 는 정상.
    // logUsage 는 진단용이며 실패가 노드 실행 자체를 깨면 안 된다.
    it('logUsage failure does not crash the handler — result port still success', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { products: [] },
        headers: {},
        retries: 0,
      });
      integrationsService.logUsage.mockRejectedValue(new Error('db down'));

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeContext(),
      );

      // result.port should still be 'success' — logUsage failure swallowed.
      expect(result.port).toBe('success');
      expect(integrationsService.logUsage).toHaveBeenCalled();
    });
  });

  // Re-run dry-run (spec/5-system/13-replay-rerun.md §7) — cafe24 mocks WRITE
  // operations (POST/PUT/DELETE) and passes READ (GET) operations through.
  describe('execute — dry-run (§7)', () => {
    function makeDryRunContext(): ExecutionContext {
      const ctx = makeContext();
      ctx.variables = { ...ctx.variables, __dryRun: true };
      return ctx;
    }

    it('WRITE op (PUT) — returns _dryRun mock on success port, no ApiClient call', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_update',
          fields: {
            product_no: 1001,
            product_name: 'New name',
            price: '10000.00',
          },
        },
        makeDryRunContext(),
      );

      // No external commerce API call in the mocked write path.
      expect(apiClient.call).not.toHaveBeenCalled();
      // Integration resolve is also short-circuited (mock is pre-resolve).
      expect(integrationsService.getForExecution).not.toHaveBeenCalled();

      expect(result.port).toBe('success');
      const output = result.output as {
        _dryRun?: boolean;
        skippedReason?: string;
        wouldHaveCalled?: Record<string, unknown>;
      };
      expect(output._dryRun).toBe(true);
      expect(output.skippedReason).toBe('dry-run mode');
      expect(output.wouldHaveCalled).toEqual({
        kind: 'cafe24',
        operation: 'product_update',
        method: 'PUT',
        resource: 'product',
      });

      // Config echo still mirrors the real success shape.
      expect(result.config.resource).toBe('product');
      expect(result.config.operation).toBe('product_update');

      // Usage logged as success (flow proceeds, §7.2).
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('READ op (GET) — ApiClient IS called normally even in dry-run', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { products: [{ product_no: 1 }] },
        headers: {},
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_list',
          fields: { shop_no: 1 },
        },
        makeDryRunContext(),
      );

      // GET passes through — real call performed, no dry-run mock.
      expect(apiClient.call).toHaveBeenCalledTimes(1);
      expect(apiClient.call.mock.calls[0][1]).toEqual(
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.port).toBe('success');
      const output = result.output as { _dryRun?: boolean; response?: unknown };
      expect(output._dryRun).toBeUndefined();
      expect(output.response).toEqual({ products: [{ product_no: 1 }] });
    });

    it('non-dry-run WRITE op — unchanged, real ApiClient call performed', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: {},
        headers: {},
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'product_update',
          fields: {
            product_no: 1001,
            product_name: 'New name',
            price: '10000.00',
          },
        },
        makeContext(),
      );

      expect(apiClient.call).toHaveBeenCalledTimes(1);
      expect(apiClient.call.mock.calls[0][1]).toEqual(
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(result.port).toBe('success');
      const output = result.output as { _dryRun?: boolean };
      expect(output._dryRun).toBeUndefined();
    });
  });
});
