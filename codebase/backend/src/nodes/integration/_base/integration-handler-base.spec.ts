import {
  IntegrationError,
  IntegrationHandlerBase,
  type IntegrationUsageParams,
  sanitizeConfigEcho,
  sanitizeMessage,
  toLogError,
} from './integration-handler-base.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import type { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import { IntegrationCredentialsUnreadableError } from '../../../modules/integrations/integrations.service.js';
import { integrationNotFoundError } from '../../../modules/integrations/integration-visibility.js';
import {
  asIntegrationsService,
  makeIntegrationsServiceMock,
} from '../../../modules/integrations/__test-utils__/integrations-service.mock.js';

// Concrete subclass so we can exercise protected helpers from a test.
class TestHandler extends IntegrationHandlerBase {
  callAcquire(id: string, context: ExecutionContext): Promise<Integration> {
    return this.acquireIntegration(id, context);
  }

  callAssert(integration: Integration, expectedType: string): void {
    this.assertUsable(integration, expectedType);
  }

  callLog(
    integration: Integration,
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void> {
    return this.logUsage(integration, context, params);
  }
}

const asIntegration = (value: Record<string, unknown>): Integration =>
  value as unknown as Integration;

function ctx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
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
    ...overrides,
  };
}

describe('IntegrationHandlerBase.acquireIntegration', () => {
  it('throws when integrations service is absent', async () => {
    const handler = new TestHandler();
    await expect(handler.callAcquire('int-1', ctx())).rejects.toThrow(
      /not available/,
    );
  });

  it('throws when workspaceId missing in context — 조회하지 않는다', async () => {
    const service = makeIntegrationsServiceMock();
    const handler = new TestHandler(asIntegrationsService(service));
    await expect(
      handler.callAcquire('int-1', ctx({ variables: {} })),
    ).rejects.toThrow(/workspace context/);
    expect(service.getForExecution).not.toHaveBeenCalled();
  });

  it('returns the integration getForExecution returned', async () => {
    const integration = asIntegration({
      id: 'int-1',
      serviceType: 'http',
      status: 'connected',
    });
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(integration);
    const handler = new TestHandler(asIntegrationsService(service));
    await expect(handler.callAcquire('int-1', ctx())).resolves.toBe(
      integration,
    );
  });

  it.each<[string, Error]>([
    ['없는 통합과 같은 거절(404)', integrationNotFoundError()],
    ['자격 증명 읽기 실패', new IntegrationCredentialsUnreadableError('int-1')],
    ['조회 중 일시 오류', new Error('connection reset')],
  ])('%s 는 그대로 던진다', async (_label, error) => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(error);
    const handler = new TestHandler(asIntegrationsService(service));
    await expect(handler.callAcquire('int-1', ctx())).rejects.toBe(error);
  });
});

describe('IntegrationHandlerBase.assertUsable', () => {
  const handler = new TestHandler();

  it('rejects type mismatch via IntegrationError(TYPE_MISMATCH)', () => {
    expect(() =>
      handler.callAssert(
        asIntegration({ serviceType: 'http', status: 'connected', name: 'X' }),
        'email',
      ),
    ).toThrow(
      expect.objectContaining({ code: 'INTEGRATION_TYPE_MISMATCH' }) as Error,
    );
  });

  it('rejects non-connected status', () => {
    expect(() =>
      handler.callAssert(
        asIntegration({
          serviceType: 'http',
          status: 'expired',
          statusReason: null,
          name: 'Stale',
        }),
        'http',
      ),
    ).toThrow(
      expect.objectContaining({ code: 'INTEGRATION_NOT_CONNECTED' }) as Error,
    );
  });

  it('passes a connected integration of the expected type', () => {
    expect(() =>
      handler.callAssert(
        asIntegration({ serviceType: 'http', status: 'connected', name: 'T' }),
        'http',
      ),
    ).not.toThrow();
  });

  it('IntegrationError 에는 코드와 메시지만 싣는다 — 통합(자격 증명 평문)을 싣지 않는다', () => {
    let thrown: unknown;
    try {
      handler.callAssert(
        asIntegration({
          id: 'int-1',
          serviceType: 'http',
          status: 'connected',
          name: 'X',
          credentials: { token: 'plain-secret' },
        }),
        'email',
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(IntegrationError);
    expect(Object.keys(thrown as object).sort()).toEqual(['code', 'name']);
    expect(JSON.stringify(thrown)).not.toContain('plain-secret');
  });
});

describe('IntegrationHandlerBase.acquireIntegration — 실행 시점 조회 인자(use)', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const connected = { id: ID, serviceType: 'http', status: 'connected' };

  it.each<[string, Partial<ExecutionContext>, boolean]>([
    [
      '원본이 평가값과 같은 문자열 → 리터럴',
      { rawConfig: { integrationId: ID } },
      false,
    ],
    [
      '원본이 템플릿 → 표현식',
      { rawConfig: { integrationId: '{{ $vars.id }}' } },
      true,
    ],
    ['rawConfig 없음 → 표현식', { rawConfig: undefined }, true],
    ['원본 integrationId 없음 → 표현식', { rawConfig: {} }, true],
    ['원본이 문자열 아님 → 표현식', { rawConfig: { integrationId: 7 } }, true],
  ])('%s', async (_label, override, fromExpression) => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(connected as never);
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callAcquire(ID, ctx({ nodeId: 'node-1', ...override }));
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: 'node-1',
      fromExpression,
    });
  });

  it('context.nodeId 가 없으면 nodeId 는 null 이다(작성자 불명으로 판정)', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(connected as never);
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callAcquire(ID, ctx({ rawConfig: { integrationId: ID } }));
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: null,
      fromExpression: false,
    });
  });

  it('variables 의 nodeId · fromExpression 은 읽지 않는다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(connected as never);
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callAcquire(
      ID,
      ctx({
        nodeId: 'node-1',
        rawConfig: { integrationId: '{{ x }}' },
        variables: {
          __workspaceId: 'ws-1',
          nodeId: 'forged',
          fromExpression: false,
        },
      }),
    );
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: 'node-1',
      fromExpression: true,
    });
  });
});

describe('IntegrationHandlerBase.logUsage — 얻은 통합만 기록한다(REQ-INTMGMT-062)', () => {
  const integration = asIntegration({
    id: 'int-1',
    serviceType: 'http',
    status: 'connected',
  });

  it('is a no-op when integrations service is absent', async () => {
    const handler = new TestHandler();
    await expect(
      handler.callLog(integration, ctx(), { status: 'success', durationMs: 1 }),
    ).resolves.toBeUndefined();
  });

  it('is skipped (with warn) when nodeExecutionId missing', async () => {
    const service = makeIntegrationsServiceMock();
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callLog(integration, ctx({ nodeExecutionId: undefined }), {
      status: 'success',
      durationMs: 1,
    });
    expect(service.logUsage).not.toHaveBeenCalled();
  });

  it('forwards the acquired integration and full payload to service.logUsage', async () => {
    const service = makeIntegrationsServiceMock();
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callLog(integration, ctx(), {
      status: 'failed',
      durationMs: 120,
      error: { code: 'X', message: 'oops' },
    });
    expect(service.logUsage).toHaveBeenCalledWith(integration, {
      nodeExecutionId: 'ne-1',
      workflowId: 'wf-1',
      status: 'failed',
      durationMs: 120,
      error: { code: 'X', message: 'oops' },
      api: undefined,
    });
  });

  it('forwards api identification fields to service.logUsage (INT-US-05)', async () => {
    const service = makeIntegrationsServiceMock();
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callLog(integration, ctx(), {
      status: 'success',
      durationMs: 42,
      api: {
        label: 'cafe24.orders.order_list',
        method: 'GET',
        path: '/admin/orders',
      },
    });
    expect(service.logUsage).toHaveBeenCalledWith(
      integration,
      expect.objectContaining({
        api: {
          label: 'cafe24.orders.order_list',
          method: 'GET',
          path: '/admin/orders',
        },
      }),
    );
  });

  it('swallows service failures so the node execution is not broken', async () => {
    const service = makeIntegrationsServiceMock();
    service.logUsage.mockRejectedValue(new Error('db down'));
    const handler = new TestHandler(asIntegrationsService(service));
    await expect(
      handler.callLog(integration, ctx(), { status: 'success', durationMs: 1 }),
    ).resolves.toBeUndefined();
  });

  it('통합 ID 로는 부를 수 없다 — 서명이 얻은 통합을 요구한다', () => {
    const handler = new TestHandler();
    const call = () =>
      handler.callLog(
        // @ts-expect-error — 통합 ID 문자열은 얻은 통합이 아니다
        'int-1',
        ctx(),
        { status: 'failed', durationMs: 1 },
      );
    expect(call).toBeInstanceOf(Function);
    const params: IntegrationUsageParams = {
      status: 'failed',
      durationMs: 1,
      // @ts-expect-error — 사용 기록 인자에는 통합 ID 가 없다
      integrationId: 'int-1',
    };
    expect(params.status).toBe('failed');
  });
});

describe('toLogError', () => {
  it('passes through IntegrationError code/message', () => {
    const err = new IntegrationError('SOMETHING', 'bad');
    expect(toLogError(err)).toEqual({ code: 'SOMETHING', message: 'bad' });
  });

  it('falls back to INTEGRATION_CALL_FAILED with sanitized message', () => {
    const err = new Error('password=supersecret123456 on host db');
    const result = toLogError(err);
    expect(result.code).toBe('INTEGRATION_CALL_FAILED');
    expect(result.message).toContain('password=***');
    expect(result.message).not.toContain('supersecret');
  });
});

describe('sanitizeConfigEcho (CONVENTIONS §7)', () => {
  it('redacts every credential-like top-level key', () => {
    const out = sanitizeConfigEcho({
      url: 'https://api.example.com',
      password: 'topsecret',
      apiKey: 'sk-abc',
      token: 'jwt.token',
      refresh_token: 'r-1',
      clientSecret: 'cs-1',
    });
    expect(out).toEqual({
      url: 'https://api.example.com',
      password: '***',
      apiKey: '***',
      token: '***',
      refresh_token: '***',
      clientSecret: '***',
    });
  });

  it('recursively redacts nested credential keys', () => {
    const out = sanitizeConfigEcho({
      auth: {
        type: 'oauth',
        access_token: 'at-1',
        scopes: ['read', 'write'],
      },
    });
    expect((out.auth as Record<string, unknown>).access_token).toBe('***');
    expect((out.auth as Record<string, unknown>).type).toBe('oauth');
  });

  it('preserves primitives and null', () => {
    expect(sanitizeConfigEcho(null)).toBeNull();
    expect(sanitizeConfigEcho(undefined)).toBeUndefined();
    expect(sanitizeConfigEcho(42)).toBe(42);
    expect(sanitizeConfigEcho('foo')).toBe('foo');
    expect(sanitizeConfigEcho([1, 2, 'x'])).toEqual([1, 2, 'x']);
  });

  it('does not mutate the original object', () => {
    const original = { password: 'orig', nested: { api_key: 'key' } };
    sanitizeConfigEcho(original);
    expect(original.password).toBe('orig');
    expect(original.nested.api_key).toBe('key');
  });
});

describe('sanitizeMessage', () => {
  it('masks Bearer tokens', () => {
    expect(
      sanitizeMessage('Authorization Bearer AKIAIOSFODNN7EXAMPLE rejected'),
    ).toContain('Bearer ***');
  });

  it('masks long opaque blobs', () => {
    expect(
      sanitizeMessage('error near AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA in query'),
    ).toContain('***');
  });

  it('leaves short plain text alone', () => {
    expect(sanitizeMessage('connection refused')).toBe('connection refused');
  });
});
