import { MakeshopHandler } from './makeshop.handler';
import {
  MakeshopApiClient,
  MakeshopAuthFailedError,
  MakeshopRateLimitedError,
  MakeshopTransportFailedError,
} from './makeshop-api.client';
import { IntegrationError } from '../_base/integration-handler-base';
import type { ExecutionContext } from '../../core/node-handler.interface';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-makeshop-1',
    workspaceId: 'ws-1',
    serviceType: 'makeshop',
    name: 'My MakeShop',
    authType: 'oauth2',
    credentials: {
      shop_uid: 'myshop',
      client_id: 'cid',
      client_secret: 'csecret',
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      scopes: ['product.read'],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

describe('MakeshopHandler', () => {
  let integrationsService: {
    getForExecution: Mock;
    logUsage: Mock;
  };
  let apiClient: { call: Mock };
  let handler: MakeshopHandler;

  beforeEach(() => {
    integrationsService = {
      getForExecution: jest.fn(),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    apiClient = { call: jest.fn() };
    handler = new MakeshopHandler(
      integrationsService as never,
      apiClient as unknown as MakeshopApiClient,
    );
  });

  describe('validate', () => {
    // CLE-T-XVS8H7 — MakeShop 은 offset 이 아니라 page 로 넘긴다. `validate()` 는 pagination 을 보지 않는다. 엔진이 실행
    // 직전에 부르는 사전 검증이라(실패하면 `INVALID_NODE_CONFIG`) 여기서 거절하면 규칙을 어긴 설정이 약속한
    // `MAKESHOP_INVALID_PAGINATION` error 포트로 가지 못한다. 리터럴이든 식이든 `execute()` 가 본다.
    it.each([
      { limit: 50, offset: 30 },
      { offset: 50 },
      { limit: 0 },
      { limit: 2.5 },
      { limit: 50, offset: 'abc' },
      'abc',
      [],
    ])(
      'does not look at pagination %j (execute() rules on it)',
      (pagination) => {
        const r = handler.validate({
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          pagination,
        });
        expect(r.valid).toBe(true);
        expect(r.errors).toEqual([]);
      },
    );

    it.each([
      { limit: 50, offset: 100 },
      { limit: 50, offset: 0 },
      { offset: 0 },
      { limit: 20 },
      { limit: '{{ $vars.size }}', offset: '{{ $vars.from }}' },
    ])('accepts pagination %j', (pagination) => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'get-product',
        pagination,
      });
      expect(r.valid).toBe(true);
    });

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

    it('rejects unknown operation for a valid resource', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'nope-not-real',
      });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toMatch(/is not a supported 'product' operation/);
    });

    it('accepts a well-formed config', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'get-product',
        fields: {},
      });
      expect(r.valid).toBe(true);
    });

    it('rejects fields that is not an object', () => {
      const r = handler.validate({
        integrationId: 'id',
        resource: 'product',
        operation: 'get-product',
        fields: 'not-an-object',
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('execute — pre-flight errors route to port:error (D4)', () => {
    const expectErrorOutput = (result: unknown, expectedCode: string): void => {
      const r = result as Record<string, unknown>;
      expect(r.port).toBe('error');
      const output = r.output as { error: { code: string } };
      expect(output.error.code).toBe(expectedCode);
    };

    it('INTEGRATION_SERVICE_UNAVAILABLE when apiClient missing', async () => {
      const noClient = new MakeshopHandler(
        integrationsService as never,
        undefined,
      );
      const result = await noClient.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expectErrorOutput(result, 'INTEGRATION_SERVICE_UNAVAILABLE');
    });

    it('MAKESHOP_UNKNOWN_OPERATION on operation not in metadata', async () => {
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
      expectErrorOutput(result, 'MAKESHOP_UNKNOWN_OPERATION');
    });

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
            label: 'makeshop.product.product_does_not_exist',
          }),
        }),
      );
      const logCall = integrationsService.logUsage.mock.calls[0][0] as {
        api: { label?: string; method?: string | null; path?: string | null };
      };
      expect(logCall.api.method).toBeUndefined();
      expect(logCall.api.path).toBeUndefined();
    });

    it('MAKESHOP_MISSING_FIELDS when requiredFields not supplied', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-cart_free', // requires InquiryTimeFrom
          fields: {},
        },
        makeContext(),
      );
      expectErrorOutput(result, 'MAKESHOP_MISSING_FIELDS');
    });

    it('INTEGRATION_TYPE_MISMATCH when integration serviceType is not makeshop', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'cafe24' }),
      );
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
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
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expectErrorOutput(result, 'INTEGRATION_NOT_CONNECTED');
    });

    it('MAKESHOP_INVALID_SHOP_UID when credentials.shop_uid is malformed', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          credentials: {
            shop_uid: 'BAD shop!/../etc',
            client_id: 'cid',
            client_secret: 'csecret',
            access_token: 't',
            refresh_token: 'r',
          },
        }),
      );
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expectErrorOutput(result, 'MAKESHOP_INVALID_SHOP_UID');
    });

    it('IntegrationError from base layer routes to port:error (D4)', async () => {
      integrationsService.getForExecution.mockRejectedValue(
        new IntegrationError('INTEGRATION_NOT_FOUND', 'gone'),
      );
      const result = (await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const out = result.output as { error: { code: string } };
      expect(out.error.code).toBe('INTEGRATION_NOT_FOUND');
    });
  });

  // CLE-T-XVS8H7 — MakeShop 목록 API 는 offset 을 받지 않고 page 를 받는다. 노드 설정의 `pagination.{limit,offset}` 은
  // 그대로 두고 핸들러가 page = offset / limit + 1 로 바꿔 보낸다.
  describe('execute — pagination (offset → page)', () => {
    async function run(
      pagination: unknown,
      fields: Record<string, unknown> = {},
      operation = 'get-product',
    ) {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { list: [] },
        headers: {},
        retries: 0,
      });
      return handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation,
          fields,
          ...(pagination === undefined ? {} : { pagination }),
        },
        makeContext(),
      );
    }
    const sentQuery = (): Record<string, unknown> =>
      (apiClient.call.mock.calls[0][1] as { query: Record<string, unknown> })
        .query;

    it.each([
      [
        { limit: 50, offset: 0 },
        { limit: 50, page: 1 },
      ],
      [
        { limit: 50, offset: 50 },
        { limit: 50, page: 2 },
      ],
      [
        { limit: 50, offset: 100 },
        { limit: 50, page: 3 },
      ],
      [
        { limit: 1, offset: 9 },
        { limit: 1, page: 10 },
      ],
      [{ offset: 0 }, { page: 1 }],
      [
        { limit: '20', offset: '40' },
        { limit: 20, page: 3 },
      ],
    ])('%j → query %j (offset 은 보내지 않는다)', async (pagination, query) => {
      const result = await run(pagination);
      expect(result.port).toBe('success');
      expect(sentQuery()).toEqual(query);
      expect(sentQuery()).not.toHaveProperty('offset');
    });

    it('offset 이 없으면 page 를 만들지 않는다 — fields.page 가 그대로 간다', async () => {
      await run({ limit: 20 }, { page: '4' });
      expect(sentQuery()).toEqual({ limit: 20, page: '4' });
    });

    it('pagination 이 만든 limit · page 가 fields.limit · fields.page 보다 우선한다', async () => {
      await run({ limit: 50, offset: 50 }, { limit: '10', page: '9' });
      expect(sentQuery()).toEqual({ limit: 50, page: 2 });
    });

    it('pagination 이 없으면 fields 의 limit · page 를 그대로 보낸다', async () => {
      await run(undefined, { limit: '10', page: '9' });
      expect(sentQuery()).toEqual({ limit: '10', page: '9' });
    });

    it('설정 에코는 사용자가 적은 offset 을 그대로 둔다', async () => {
      const result = await run({ limit: 50, offset: 100 });
      expect(result.config.pagination).toEqual({ limit: 50, offset: 100 });
    });

    // 페이지네이션이 없는 operation 은 pagination 을 읽지 않는다 — 목록 operation 에서 쓰던 값이 operation 을 바꾼 뒤에도
    // 남을 수 있다(편집기는 지우지 않고 입력란만 숨긴다). 규칙을 어긴 값이어도 호출은 성공하고 limit · page 는 가지 않는다.
    it.each([
      { limit: 50, offset: 30 },
      { offset: 50 },
      { limit: 0, offset: 0 },
      'abc',
      [],
    ])(
      '페이지네이션이 없는 operation 에서는 pagination %j 를 보지 않는다',
      async (pagination) => {
        const result = await run(
          pagination,
          { type: 'BRAND', name: 'Acme' },
          'post-brand-create',
        );
        expect(result.port).toBe('success');
        expect(apiClient.call).toHaveBeenCalledTimes(1);
        expect(sentQuery()).toEqual({});
        expect(sentQuery()).not.toHaveProperty('limit');
        expect(sentQuery()).not.toHaveProperty('page');
        expect(sentQuery()).not.toHaveProperty('offset');
      },
    );

    it.each([['abc'], [[]], [42], [true]])(
      'pagination %j 은 객체가 아니라 MAKESHOP_INVALID_PAGINATION',
      async (pagination) => {
        const result = await run(pagination);
        expect(result.port).toBe('error');
        const output = result.output as {
          error: { code: string; message: string };
        };
        expect(output.error.code).toBe('MAKESHOP_INVALID_PAGINATION');
        expect(output.error.message).toMatch(/pagination must be an object/);
        expect(apiClient.call).not.toHaveBeenCalled();
        expect(integrationsService.getForExecution).not.toHaveBeenCalled();
      },
    );

    it.each([
      [{ limit: 50, offset: 30 }, /multiple of pagination\.limit/],
      [{ limit: 50, offset: 49 }, /multiple of pagination\.limit/],
      [{ offset: 50 }, /requires pagination\.limit/],
      [{ limit: 0, offset: 0 }, /pagination\.limit must be a positive integer/],
      [
        { limit: 50, offset: -50 },
        /pagination\.offset must be a non-negative integer/,
      ],
      [{ limit: 2.5 }, /pagination\.limit must be a positive integer/],
      [
        { limit: 50, offset: 'abc' },
        /pagination\.offset must be a non-negative integer/,
      ],
    ])(
      '%j → MAKESHOP_INVALID_PAGINATION, 호출 · 통합 조회 없이 error 포트',
      async (pagination, message) => {
        const result = await run(pagination);
        expect(result.port).toBe('error');
        const output = result.output as {
          error: { code: string; message: string };
        };
        expect(output.error.code).toBe('MAKESHOP_INVALID_PAGINATION');
        expect(output.error.message).toMatch(message);
        expect(apiClient.call).not.toHaveBeenCalled();
        expect(integrationsService.getForExecution).not.toHaveBeenCalled();
      },
    );
  });

  describe('execute — runtime', () => {
    it('happy path — dispatches to ApiClient with parsed metadata, returns success envelope', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { list: [{ product_id: 1 }] },
        headers: {},
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          fields: { limit: '50', page: '1' },
          pagination: { limit: 50, offset: 0 },
        },
        makeContext(),
      );

      // ApiClient invoked with metadata-driven path / query / method.
      const callArgs = apiClient.call.mock.calls[0];
      // pagination 이 있으면 limit · page 는 그것에서 만든다(offset 0 → page 1). offset 은 보내지 않는다(CLE-T-XVS8H7).
      expect(callArgs[1]).toEqual({
        method: 'GET',
        path: 'product',
        query: { limit: 50, page: 1 },
        body: undefined,
      });

      expect(result.port).toBe('success');
      expect(result.output).toEqual({
        response: { list: [{ product_id: 1 }] },
      });
      const meta = result.meta as Record<string, unknown>;
      expect(meta.statusCode).toBe(200);
      expect(typeof meta.durationMs).toBe('number');

      // Config echo preserves raw input (Principle 7).
      const cfg = result.config;
      expect(cfg.resource).toBe('product');
      expect(cfg.operation).toBe('get-product');
      expect(cfg.fields).toEqual({ limit: '50', page: '1' });

      // Usage log (success) with api identity (INT-US-05).
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          api: expect.objectContaining({
            label: 'makeshop.product.get-product',
            method: 'GET',
            path: 'product',
          }),
        }),
      );
    });

    it('POST write op — body fields routed to body (flat, no envelope)', async () => {
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
          operation: 'post-brand-create',
          fields: { type: 'BRAND', name: 'Acme' },
        },
        makeContext(),
      );

      const callOpts = apiClient.call.mock.calls[0][1] as {
        method: string;
        path: string;
        body: Record<string, unknown>;
      };
      expect(callOpts.method).toBe('POST');
      expect(callOpts.path).toBe('brand/create');
      // Flat body — NOT wrapped in { request: {...} }.
      expect(callOpts.body).toEqual({ type: 'BRAND', name: 'Acme' });
      expect(callOpts.body).not.toHaveProperty('request');
    });

    it('MakeShop 4xx (404) — routes to error port with MAKESHOP_404 + preserves response body', async () => {
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
          operation: 'get-product',
          fields: {},
        },
        makeContext(),
      );

      expect(result.port).toBe('error');
      const out = result.output as {
        error: Record<string, unknown>;
        response: unknown;
      };
      expect(out.error.code).toBe('MAKESHOP_404');
      const details = out.error.details as Record<string, unknown>;
      expect(details.statusCode).toBe(404);
      expect(details.shopUid).toBe('myshop');
      expect(details.makeshopErrorCode).toBe('404');
      expect(out.response).toEqual({
        error: { code: '404', message: 'Not Found' },
      });
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('MakeShop 422 — MAKESHOP_422', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 422,
        body: {},
        headers: {},
        retries: 0,
      });
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('error');
      expect((result.output as { error: { code: string } }).error.code).toBe(
        'MAKESHOP_422',
      );
    });

    it('MakeShop 5xx — MAKESHOP_5XX', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 503,
        body: {},
        headers: {},
        retries: 0,
      });
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('error');
      expect((result.output as { error: { code: string } }).error.code).toBe(
        'MAKESHOP_5XX',
      );
    });

    it('MakeshopAuthFailedError — error port + MAKESHOP_AUTH_FAILED', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new MakeshopAuthFailedError(401, 'myshop', { error: 'Unauthorized' }),
      );
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('MAKESHOP_AUTH_FAILED');
    });

    it('MakeshopRateLimitedError — MAKESHOP_RATE_LIMITED + retries detail', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new MakeshopRateLimitedError(2, 5, 'myshop'),
      );
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('MAKESHOP_RATE_LIMITED');
      const details = out.error.details as Record<string, unknown>;
      expect(details.retries).toBe(2);
      expect(details.lastRetryAfterSec).toBe(5);
    });

    it('MakeshopTransportFailedError — MAKESHOP_TRANSPORT_FAILED + statusCode 0', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(
        new MakeshopTransportFailedError(new Error('ECONNRESET')),
      );
      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('error');
      const out = result.output as { error: Record<string, unknown> };
      expect(out.error.code).toBe('MAKESHOP_TRANSPORT_FAILED');
      expect((result.meta as Record<string, unknown>).statusCode).toBe(0);
    });

    it('logUsage failure does not crash the handler — result port still success', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { list: [] },
        headers: {},
        retries: 0,
      });
      integrationsService.logUsage.mockRejectedValue(new Error('db down'));

      const result = await handler.execute(
        null,
        { integrationId: 'id', resource: 'product', operation: 'get-product' },
        makeContext(),
      );
      expect(result.port).toBe('success');
      expect(integrationsService.logUsage).toHaveBeenCalled();
    });
  });

  // Re-run dry-run (CLE-EXEC-RERUN 「부수효과 판정」) — makeshop mocks POST and
  // the state-changing GETs, and passes other GET operations through.
  describe('execute — dry-run (§7)', () => {
    function makeDryRunContext(): ExecutionContext {
      const ctx = makeContext();
      ctx.variables = { ...ctx.variables, __dryRun: true };
      return ctx;
    }

    it('WRITE op (POST) — returns _dryRun mock on success port, no ApiClient call', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'post-brand-create',
          fields: { type: 'BRAND', name: 'Acme' },
        },
        makeDryRunContext(),
      );

      expect(apiClient.call).not.toHaveBeenCalled();
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
        kind: 'makeshop',
        operation: 'post-brand-create',
        method: 'POST',
        resource: 'product',
      });
      // A mocked call reaches no external API, so it leaves no activity log.
      expect(integrationsService.logUsage).not.toHaveBeenCalled();
    });

    it('state-changing GET (cart_free_config/update) — mocked like a write', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'shop',
          operation: 'get-cart_free_config-update',
          fields: { use: 'Y' },
        },
        makeDryRunContext(),
      );

      expect(apiClient.call).not.toHaveBeenCalled();
      expect(integrationsService.logUsage).not.toHaveBeenCalled();
      expect(result.port).toBe('success');
      const output = result.output as {
        _dryRun?: boolean;
        wouldHaveCalled?: Record<string, unknown>;
      };
      expect(output._dryRun).toBe(true);
      expect(output.wouldHaveCalled).toEqual({
        kind: 'makeshop',
        operation: 'get-cart_free_config-update',
        method: 'GET',
        resource: 'shop',
      });
    });

    it('READ op (GET) — ApiClient IS called normally even in dry-run', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { list: [{ product_id: 1 }] },
        headers: {},
        retries: 0,
      });

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          fields: {},
        },
        makeDryRunContext(),
      );

      expect(apiClient.call).toHaveBeenCalledTimes(1);
      expect(apiClient.call.mock.calls[0][1]).toEqual(
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.port).toBe('success');
      const output = result.output as { _dryRun?: boolean; response?: unknown };
      expect(output._dryRun).toBeUndefined();
      expect(output.response).toEqual({ list: [{ product_id: 1 }] });
      // A real call is logged as usual.
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });
  });

  // [노드 취소](CLE-EXEC-CANCEL#fetch-자체-타임아웃과의-연쇄) — the handler is the only place that knows the
  // execution's abortSignal; if it stops forwarding it, the client's cascade
  // becomes dead code and nothing else fails. Pinned here for that reason.
  describe('abortSignal forwarding (CLE-EXEC-CANCEL 「fetch 자체 타임아웃과의 연쇄」)', () => {
    it('rethrows AbortError so the ENGINE can classify the node as cancelled', async () => {
      // The client rethrows AbortError (bypassing its transport wrapper), but
      // that only matters if the handler lets it through too. Swallowing it here
      // maps to `port:'error'` + `*_TRANSPORT_FAILED`, and rule 19's `cancelled`
      // classification in `executeNode` is never reached — so the node is
      // recorded `failed` and no `execution.node.cancelled` event fires.
      //
      // Forwarding the signal (tested above) is only half the wiring; this is
      // the other half, and it is invisible from the client's own suite.
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const abortErr = Object.assign(new Error('aborted'), {
        name: 'AbortError',
      });
      apiClient.call.mockRejectedValue(abortErr);

      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'get-product',
            fields: {},
          },
          makeContext(),
        ),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });

    // The shared `isAbortErrorLike` matches on `name`, so an AbortError that is
    // not an `Error` instance (another realm's DOMException under jest's VM)
    // passes through too. The old `instanceof Error` check dropped it into
    // `*_TRANSPORT_FAILED`. One test per catch: the API call has its own catch,
    // and a failure before it reaches only the outer one.
    it('rethrows an AbortError that is not an Error instance (API call)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const foreign = { name: 'AbortError', message: 'aborted' };
      expect(foreign instanceof Error).toBe(false);
      apiClient.call.mockRejectedValue(foreign);

      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'get-product',
            fields: {},
          },
          makeContext(),
        ),
      ).rejects.toBe(foreign);
    });

    it('rethrows an AbortError that is not an Error instance (before the API call)', async () => {
      const foreign = { name: 'AbortError', message: 'aborted' };
      integrationsService.getForExecution.mockRejectedValue(foreign);

      await expect(
        handler.execute(
          null,
          {
            integrationId: 'id',
            resource: 'product',
            operation: 'get-product',
            fields: {},
          },
          makeContext(),
        ),
      ).rejects.toBe(foreign);
    });

    it('still maps ordinary transport failures to the error port', async () => {
      // The boundary: only AbortError bypasses D4. A real transport fault must
      // keep returning an error-port output rather than throwing.
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockRejectedValue(new Error('ECONNRESET'));

      const result = await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          fields: {},
        },
        makeContext(),
      );
      expect(result.output.error).toBeDefined();
    });

    it('passes context.abortSignal into the client call', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({ status: 200, body: { ok: true } });
      const controller = new AbortController();

      await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          fields: {},
        },
        { ...makeContext(), abortSignal: controller.signal },
      );

      expect(apiClient.call).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it('passes undefined when the execution has no abortSignal', async () => {
      // The boundary: forwarding must not invent a signal, or callers outside a
      // node run would gain one they never set.
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      apiClient.call.mockResolvedValue({ status: 200, body: { ok: true } });

      await handler.execute(
        null,
        {
          integrationId: 'id',
          resource: 'product',
          operation: 'get-product',
          fields: {},
        },
        makeContext(),
      );

      expect(apiClient.call).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: undefined }),
      );
    });
  });
});
