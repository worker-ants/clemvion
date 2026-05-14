import {
  IntegrationError,
  IntegrationHandlerBase,
  sanitizeConfigEcho,
  sanitizeMessage,
  toLogError,
} from './integration-handler-base.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

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
    });
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
