import {
  IntegrationError,
  IntegrationHandlerBase,
  sanitizeMessage,
  toLogError,
} from './integration-handler-base.js';
import { ExecutionContext } from '../node-handler.interface.js';

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
    ...overrides,
  };
}

describe('IntegrationHandlerBase.resolveIntegration', () => {
  it('throws when integrations service is absent', async () => {
    const handler = new TestHandler();
    await expect(
      handler.callResolve('int-1', ctx(), 'slack'),
    ).rejects.toThrow(/not available/);
  });

  it('throws when workspaceId missing in context', async () => {
    const service = { getForExecution: jest.fn(), logUsage: jest.fn() };
    const handler = new TestHandler(service as never);
    await expect(
      handler.callResolve(
        'int-1',
        ctx({ variables: {} }),
        'slack',
      ),
    ).rejects.toThrow(/workspace context/);
  });

  it('rejects type mismatch via IntegrationError(TYPE_MISMATCH)', async () => {
    const service = {
      getForExecution: jest
        .fn()
        .mockResolvedValue({ serviceType: 'slack', status: 'connected', name: 'X' }),
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
        serviceType: 'slack',
        status: 'expired',
        statusReason: null,
        name: 'Stale',
      }),
      logUsage: jest.fn(),
    };
    const handler = new TestHandler(service as never);
    await expect(
      handler.callResolve('int-1', ctx(), 'slack'),
    ).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONNECTED',
    });
  });

  it('returns the integration when all checks pass', async () => {
    const integration = {
      id: 'int-1',
      serviceType: 'slack',
      status: 'connected',
      name: 'Team',
    };
    const service = {
      getForExecution: jest.fn().mockResolvedValue(integration),
      logUsage: jest.fn(),
    };
    const handler = new TestHandler(service as never);
    await expect(handler.callResolve('int-1', ctx(), 'slack')).resolves.toBe(
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

  it('extracts Slack err.data.error into SLACK_<CODE>', () => {
    const err = { data: { error: 'not_authed' }, message: 'Request failed' };
    expect(toLogError(err)).toEqual({
      code: 'SLACK_NOT_AUTHED',
      message: 'not_authed',
    });
  });

  it('falls back to INTEGRATION_CALL_FAILED with sanitized message', () => {
    const err = new Error('password=supersecret123456 on host db');
    const result = toLogError(err);
    expect(result.code).toBe('INTEGRATION_CALL_FAILED');
    expect(result.message).toContain('password=***');
    expect(result.message).not.toContain('supersecret');
  });
});

describe('sanitizeMessage', () => {
  it('masks Bearer tokens', () => {
    expect(
      sanitizeMessage('Authorization Bearer AKIAIOSFODNN7EXAMPLE rejected'),
    ).toContain('Bearer ***');
  });

  it('masks Slack tokens', () => {
    expect(sanitizeMessage('token=xoxb-1234567890-abcd')).toContain('***');
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
