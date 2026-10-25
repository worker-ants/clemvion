import {
  IntegrationError,
  IntegrationHandlerBase,
  sanitizeConfigEcho,
  sanitizeMessage,
  toLogError,
} from './integration-handler-base.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import { IntegrationCredentialsUnreadableError } from '../../../modules/integrations/integrations.service.js';
import { integrationNotFoundError } from '../../../modules/integrations/integration-visibility.js';
import {
  asIntegrationsService,
  makeIntegrationsServiceMock,
} from '../../../modules/integrations/__test-utils__/integrations-service.mock.js';

// Concrete subclass so we can exercise protected helpers from a test.
class TestHandler extends IntegrationHandlerBase {
  callResolve(
    id: string,
    context: ExecutionContext,
    expectedType: string,
  ): Promise<unknown> {
    return this.resolveIntegration(id, context, expectedType);
  }

  callLog(
    context: ExecutionContext,
    params: Parameters<IntegrationHandlerBase['logUsage']>[1],
  ): Promise<void> {
    return this.logUsage(context, params);
  }
}

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

describe('IntegrationHandlerBase.resolveIntegration', () => {
  it('throws when integrations service is absent', async () => {
    const handler = new TestHandler();
    await expect(handler.callResolve('int-1', ctx(), 'http')).rejects.toThrow(
      /not available/,
    );
  });

  it('throws when workspaceId missing in context', async () => {
    const service = { getForExecution: jest.fn(), logUsage: jest.fn() };
    const handler = new TestHandler(service as never);
    await expect(
      handler.callResolve('int-1', ctx({ variables: {} }), 'http'),
    ).rejects.toThrow(/workspace context/);
  });

  it('rejects type mismatch via IntegrationError(TYPE_MISMATCH)', async () => {
    const service = {
      getForExecution: jest.fn().mockResolvedValue({
        serviceType: 'http',
        status: 'connected',
        name: 'X',
      }),
      logUsage: jest.fn(),
    };
    const handler = new TestHandler(service as never);
    await expect(
      handler.callResolve('int-1', ctx(), 'email'),
    ).rejects.toMatchObject({
      code: 'INTEGRATION_TYPE_MISMATCH',
    });
  });

  it('rejects non-connected status', async () => {
    const service = {
      getForExecution: jest.fn().mockResolvedValue({
        serviceType: 'http',
        status: 'expired',
        statusReason: null,
        name: 'Stale',
      }),
      logUsage: jest.fn(),
    };
    const handler = new TestHandler(service as never);
    await expect(
      handler.callResolve('int-1', ctx(), 'http'),
    ).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONNECTED',
    });
  });

  it('returns the integration when all checks pass', async () => {
    const integration = {
      id: 'int-1',
      serviceType: 'http',
      status: 'connected',
      name: 'Team',
    };
    const service = {
      getForExecution: jest.fn().mockResolvedValue(integration),
      logUsage: jest.fn(),
    };
    const handler = new TestHandler(service as never);
    await expect(handler.callResolve('int-1', ctx(), 'http')).resolves.toBe(
      integration,
    );
  });
});

describe('IntegrationHandlerBase.acquireIntegration — 실행 시점 조회 인자(use)', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const connected = { id: ID, serviceType: 'http', status: 'connected' };

  it.each<[string, Partial<ExecutionContext>, boolean]>([
    ['원본이 평가값과 같은 문자열 → 리터럴', { rawConfig: { integrationId: ID } }, false],
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
    await handler.callResolve(ID, ctx({ nodeId: 'node-1', ...override }), 'http');
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: 'node-1',
      fromExpression,
    });
  });

  it('context.nodeId 가 없으면 nodeId 는 null 이다(작성자 불명으로 판정)', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(connected as never);
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callResolve(
      ID,
      ctx({ rawConfig: { integrationId: ID } }),
      'http',
    );
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: null,
      fromExpression: false,
    });
  });

  it('variables 의 nodeId · fromExpression 은 읽지 않는다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue(connected as never);
    const handler = new TestHandler(asIntegrationsService(service));
    await handler.callResolve(
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
      'http',
    );
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: 'node-1',
      fromExpression: true,
    });
  });
});

describe('IntegrationHandlerBase — 조회가 거절된 통합은 활동 로그를 남기지 않는다(REQ-INTMGMT-053)', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const usage = {
    integrationId: ID,
    status: 'failed' as const,
    durationMs: 3,
  };

  it('없는 통합과 같은 거절 뒤 같은 컨텍스트의 logUsage 는 기록하지 않는다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(integrationNotFoundError());
    const handler = new TestHandler(asIntegrationsService(service));
    const context = ctx({ nodeId: 'node-1' });
    await expect(handler.callResolve(ID, context, 'http')).rejects.toThrow(
      'Integration not found',
    );
    await handler.callLog(context, usage);
    expect(service.logUsage).not.toHaveBeenCalled();
  });

  it('거절은 그 컨텍스트에만 걸린다 — 다른 노드 실행은 기록한다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(integrationNotFoundError());
    const handler = new TestHandler(asIntegrationsService(service));
    await expect(
      handler.callResolve(ID, ctx({ nodeId: 'node-1' }), 'http'),
    ).rejects.toThrow();
    await handler.callLog(ctx({ nodeExecutionId: 'ne-2' }), usage);
    expect(service.logUsage).toHaveBeenCalledTimes(1);
  });

  it('거절된 ID 가 아닌 통합은 같은 컨텍스트에서도 기록한다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(integrationNotFoundError());
    const handler = new TestHandler(asIntegrationsService(service));
    const context = ctx({ nodeId: 'node-1' });
    await expect(handler.callResolve(ID, context, 'http')).rejects.toThrow();
    await handler.callLog(context, { ...usage, integrationId: 'other' });
    expect(service.logUsage).toHaveBeenCalledTimes(1);
  });

  it('자격 증명을 읽지 못한 통합은 지금처럼 기록한다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(
      new IntegrationCredentialsUnreadableError(ID),
    );
    const handler = new TestHandler(asIntegrationsService(service));
    const context = ctx({ nodeId: 'node-1' });
    await expect(handler.callResolve(ID, context, 'http')).rejects.toThrow();
    await handler.callLog(context, usage);
    expect(service.logUsage).toHaveBeenCalledTimes(1);
  });

  it('통합을 얻은 뒤 검증(3단계)에서 실패하면 기록한다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockResolvedValue({
      id: ID,
      serviceType: 'email',
      status: 'connected',
    } as never);
    const handler = new TestHandler(asIntegrationsService(service));
    const context = ctx({ nodeId: 'node-1' });
    await expect(handler.callResolve(ID, context, 'http')).rejects.toMatchObject(
      { code: 'INTEGRATION_TYPE_MISMATCH' },
    );
    await handler.callLog(context, usage);
    expect(service.logUsage).toHaveBeenCalledTimes(1);
  });
});

describe('IntegrationHandlerBase.logUsage', () => {
  it('is a no-op when integrations service is absent', async () => {
    const handler = new TestHandler();
    await expect(
      handler.callLog(ctx(), {
        integrationId: 'int-1',
        status: 'success',
        durationMs: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it('is skipped (with warn) when nodeExecutionId missing', async () => {
    const logUsage = jest.fn();
    const handler = new TestHandler({
      getForExecution: jest.fn(),
      logUsage,
    } as never);
    await handler.callLog(ctx({ nodeExecutionId: undefined }), {
      integrationId: 'int-1',
      status: 'success',
      durationMs: 1,
    });
    expect(logUsage).not.toHaveBeenCalled();
  });

  it('forwards full payload to service.logUsage', async () => {
    const logUsage = jest.fn().mockResolvedValue(undefined);
    const handler = new TestHandler({
      getForExecution: jest.fn(),
      logUsage,
    } as never);
    await handler.callLog(ctx(), {
      integrationId: 'int-1',
      status: 'failed',
      durationMs: 120,
      error: { code: 'X', message: 'oops' },
    });
    expect(logUsage).toHaveBeenCalledWith({
      integrationId: 'int-1',
      nodeExecutionId: 'ne-1',
      workflowId: 'wf-1',
      status: 'failed',
      durationMs: 120,
      error: { code: 'X', message: 'oops' },
      api: undefined,
    });
  });

  it('forwards api identification fields to service.logUsage (INT-US-05)', async () => {
    const logUsage = jest.fn().mockResolvedValue(undefined);
    const handler = new TestHandler({
      getForExecution: jest.fn(),
      logUsage,
    } as never);
    await handler.callLog(ctx(), {
      integrationId: 'int-1',
      status: 'success',
      durationMs: 42,
      api: {
        label: 'cafe24.orders.order_list',
        method: 'GET',
        path: '/admin/orders',
      },
    });
    expect(logUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        api: {
          label: 'cafe24.orders.order_list',
          method: 'GET',
          path: '/admin/orders',
        },
      }),
    );
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
