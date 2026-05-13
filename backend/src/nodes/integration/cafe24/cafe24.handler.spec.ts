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

  describe('execute — pre-flight throws', () => {
    it('CAFE24_UNKNOWN_OPERATION on operation not in metadata', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_does_not_exist',
            fields: {},
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({
        code: 'CAFE24_UNKNOWN_OPERATION',
      });
    });

    it('CAFE24_MISSING_FIELDS when requiredFields not supplied', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_get',
            fields: {}, // product_no missing
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({
        code: 'CAFE24_MISSING_FIELDS',
      });
    });

    it('INTEGRATION_TYPE_MISMATCH when integration serviceType is not cafe24', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'mcp' }),
      );
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_list',
            fields: { shop_no: 1 },
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: 'INTEGRATION_TYPE_MISMATCH' });
    });

    it('INTEGRATION_NOT_CONNECTED when status !== connected', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_list',
            fields: { shop_no: 1 },
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: 'INTEGRATION_NOT_CONNECTED' });
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
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_list',
            fields: { shop_no: 1 },
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: 'CAFE24_INVALID_MALL_ID' });
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

    it('IntegrationError thrown by base layer is re-raised (pre-flight)', async () => {
      integrationsService.getForExecution.mockRejectedValue(
        new IntegrationError('INTEGRATION_NOT_FOUND', 'gone'),
      );

      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'product_list',
            fields: { shop_no: 1 },
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: 'INTEGRATION_NOT_FOUND' });
    });
  });
});
