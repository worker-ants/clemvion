import { SendEmailHandler } from './send-email.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

const sendMailMock = jest.fn();
const closeMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: (...args: unknown[]) => sendMailMock(...args),
    close: () => closeMock(),
  })),
}));

function makeContext(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };
}

describe('SendEmailHandler', () => {
  const baseConfig = {
    integrationId: 'int-1',
    to: 'recipient@example.com',
    subject: 'hi',
    body: 'hello',
  };

  beforeEach(() => {
    sendMailMock.mockReset();
    closeMock.mockReset();
    sendMailMock.mockResolvedValue({
      messageId: 'msg-123',
      accepted: ['recipient@example.com'],
      rejected: [],
    });
  });

  // -----------------------------------------------------------------
  // validate
  // -----------------------------------------------------------------
  describe('validate', () => {
    const handler = new SendEmailHandler();

    it('accepts a comma-separated string for to', () => {
      expect(
        handler.validate({ ...baseConfig, to: 'a@example.com, b@example.com' })
          .valid,
      ).toBe(true);
    });

    it('accepts a non-empty array for to', () => {
      expect(
        handler.validate({ ...baseConfig, to: ['a@example.com'] }).valid,
      ).toBe(true);
    });

    it('accepts an expression template string for to', () => {
      expect(
        handler.validate({ ...baseConfig, to: '{{ $input.recipients }}' })
          .valid,
      ).toBe(true);
    });

    it('rejects missing integrationId', () => {
      const { integrationId: _drop, ...rest } = baseConfig;
      void _drop;
      const result = handler.validate(rest);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('integrationId');
    });

    it('rejects missing to', () => {
      const { to: _drop, ...rest } = baseConfig;
      void _drop;
      const result = handler.validate(rest);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('to');
    });

    it('rejects empty string for to', () => {
      const result = handler.validate({ ...baseConfig, to: '   ' });
      expect(result.valid).toBe(false);
    });

    it('rejects empty array for to', () => {
      const result = handler.validate({ ...baseConfig, to: [] });
      expect(result.valid).toBe(false);
    });

    it('allows cc to be absent', () => {
      expect(handler.validate({ ...baseConfig, cc: '' }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, cc: [] }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, cc: undefined }).valid).toBe(
        true,
      );
    });

    it('rejects invalid cc type', () => {
      const result = handler.validate({
        ...baseConfig,
        cc: 42 as unknown as string,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('cc');
    });

    it('allows bcc to be absent', () => {
      expect(handler.validate({ ...baseConfig, bcc: '' }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, bcc: [] }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, bcc: undefined }).valid).toBe(
        true,
      );
    });

    it('accepts a non-empty array for bcc', () => {
      expect(
        handler.validate({ ...baseConfig, bcc: ['d@example.com'] }).valid,
      ).toBe(true);
    });

    it('rejects invalid bcc type', () => {
      const result = handler.validate({
        ...baseConfig,
        bcc: 42 as unknown as string,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('bcc');
    });

    it('rejects invalid bodyType', () => {
      const result = handler.validate({ ...baseConfig, bodyType: 'markdown' });
      expect(result.valid).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // execute — stub behaviour (no IntegrationsService wired)
  // -----------------------------------------------------------------
  describe('execute (no integrations service)', () => {
    it('falls back to requires_integration stub', async () => {
      const handler = new SendEmailHandler();
      const out = (await handler.execute(null, baseConfig, makeContext())) as {
        status: string;
        config: { to: string[] };
      };
      expect(out.status).toBe('requires_integration');
      expect(out.config.to).toEqual(['recipient@example.com']);
    });
  });

  // -----------------------------------------------------------------
  // execute — full SMTP path
  // -----------------------------------------------------------------
  describe('execute (with integrations service)', () => {
    function makeService(
      overrides: {
        integration?: unknown;
        logUsage?: jest.Mock;
      } = {},
    ) {
      const logUsage =
        overrides.logUsage ?? jest.fn().mockResolvedValue(undefined);
      const integration = overrides.integration ?? {
        id: 'int-1',
        workspaceId: 'ws-1',
        serviceType: 'email',
        status: 'connected',
        name: 'Company SMTP',
        authType: 'smtp',
        credentials: {
          host: 'smtp.example.com',
          port: 587,
          secure: 'starttls',
          username: 'user',
          password: 'pw',
          default_from: 'noreply@example.com',
        },
      };
      const service = {
        getForExecution: jest.fn().mockResolvedValue(integration),
        logUsage,
      };
      return { service, logUsage };
    }

    it('sends the email and logs a success usage row', async () => {
      const { service, logUsage } = makeService();
      const handler = new SendEmailHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          ...baseConfig,
          to: 'a@example.com, b@example.com',
          cc: 'c@example.com',
        },
        makeContext(),
      )) as {
        config: { to: string[]; cc: string[] };
        output: { messageId: string };
        meta: { durationMs: number; deliveryStatus: string };
      };

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: ['a@example.com', 'b@example.com'],
          cc: ['c@example.com'],
          subject: 'hi',
          text: 'hello',
        }),
      );
      expect(out.meta.deliveryStatus).toBe('sent');
      expect(out.output.messageId).toBe('msg-123');
      expect(out.config.to).toEqual(['a@example.com', 'b@example.com']);
      expect(out.config.cc).toEqual(['c@example.com']);
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          integrationId: 'int-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        }),
      );
      // Transporter is now cached across calls; close() only fires on shutdown.
      handler.shutdown();
      expect(closeMock).toHaveBeenCalled();
    });

    it('passes bcc through to sendMail when provided', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const out = (await handler.execute(
        null,
        { ...baseConfig, bcc: ['d@example.com', 'e@example.com'] },
        makeContext(),
      )) as { config: { bcc: string[] } };

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bcc: ['d@example.com', 'e@example.com'],
        }),
      );
      expect(out.config.bcc).toEqual(['d@example.com', 'e@example.com']);
    });

    it('omits bcc from sendMail when empty', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      await handler.execute(null, { ...baseConfig, bcc: [] }, makeContext());
      const call = sendMailMock.mock.calls[0]?.[0] as { bcc?: unknown };
      expect(call.bcc).toBeUndefined();
    });

    it('executes with empty cc array (regression for INVALID_NODE_CONFIG)', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const out = (await handler.execute(
        null,
        { ...baseConfig, cc: [], bcc: [] },
        makeContext(),
      )) as { meta: { deliveryStatus: string } };
      expect(out.meta.deliveryStatus).toBe('sent');
    });

    it('routes bodyType=html to html field', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      await handler.execute(
        null,
        { ...baseConfig, bodyType: 'html', body: '<b>hi</b>' },
        makeContext(),
      );
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ html: '<b>hi</b>' }),
      );
    });

    // Post Stage 4 follow-up: runtime failures route to the `error` port with
    // `output.error:{code,message,details}` instead of throwing (CONVENTIONS §3.2).
    it('routes to error port with EMAIL_SEND_FAILED when SMTP rejects', async () => {
      const { service, logUsage } = makeService();
      sendMailMock.mockRejectedValue(new Error('connection refused'));
      const handler = new SendEmailHandler(service as never);
      const result = (await handler.execute(
        null,
        baseConfig,
        makeContext(),
      )) as {
        port: string;
        output: { error: { code: string; message: string } };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe('EMAIL_SEND_FAILED');
      expect(result.output.error.message).toContain('connection refused');
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'EMAIL_SEND_FAILED' }),
        }),
      );
      handler.shutdown();
      expect(closeMock).toHaveBeenCalled();
    });

    it('routes to error port when integration type is not email', async () => {
      const { service, logUsage } = makeService({
        integration: {
          serviceType: 'http',
          status: 'connected',
          name: 'Wrong',
          credentials: {},
        },
      });
      const handler = new SendEmailHandler(service as never);
      const result = (await handler.execute(
        null,
        baseConfig,
        makeContext(),
      )) as {
        port: string;
        output: {
          error: {
            code: string;
            message: string;
            details: { integrationCode?: string };
          };
        };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.message).toMatch(/not "email"/);
      expect(result.output.error.details.integrationCode).toBe(
        'INTEGRATION_TYPE_MISMATCH',
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_TYPE_MISMATCH' }),
        }),
      );
    });

    it('routes to error port when integration is not connected', async () => {
      const { service, logUsage } = makeService({
        integration: {
          serviceType: 'email',
          status: 'expired',
          name: 'Stale',
          statusReason: null,
          credentials: {},
        },
      });
      const handler = new SendEmailHandler(service as never);
      const result = (await handler.execute(
        null,
        baseConfig,
        makeContext(),
      )) as {
        port: string;
        output: {
          error: { message: string; details: { integrationCode?: string } };
        };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.message).toMatch(/expired/);
      expect(result.output.error.details.integrationCode).toBe(
        'INTEGRATION_NOT_CONNECTED',
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_NOT_CONNECTED' }),
        }),
      );
    });

    it('routes to error port when SMTP credentials are incomplete', async () => {
      const { service, logUsage } = makeService({
        integration: {
          serviceType: 'email',
          status: 'connected',
          name: 'Half Set',
          credentials: {
            host: 'smtp.example.com',
            port: 587,
            secure: 'starttls',
            // username/password/default_from missing
          },
        },
      });
      const handler = new SendEmailHandler(service as never);
      const result = (await handler.execute(
        null,
        baseConfig,
        makeContext(),
      )) as {
        port: string;
        output: {
          error: { message: string; details: { integrationCode?: string } };
        };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.message).toMatch(/missing fields/);
      expect(result.output.error.details.integrationCode).toBe(
        'INTEGRATION_INCOMPLETE',
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_INCOMPLETE' }),
        }),
      );
    });

    it('routes to error port when workspace context is absent', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const ctx = makeContext();
      ctx.variables = {};
      const result = (await handler.execute(null, baseConfig, ctx)) as {
        port: string;
        output: { error: { message: string } };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.message).toMatch(/workspace context/);
    });
  });
});
