import { SendEmailHandler } from './send-email.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

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
      await handler.shutdown();
      expect(closeMock).toHaveBeenCalled();
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

    it('logs a failed row and rethrows when SMTP fails', async () => {
      const { service, logUsage } = makeService();
      sendMailMock.mockRejectedValue(new Error('connection refused'));
      const handler = new SendEmailHandler(service as never);
      await expect(
        handler.execute(null, baseConfig, makeContext()),
      ).rejects.toThrow('connection refused');
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'SMTP_SEND_FAILED' }),
        }),
      );
      await handler.shutdown();
      expect(closeMock).toHaveBeenCalled();
    });

    it('rejects when integration type is not email', async () => {
      const { service, logUsage } = makeService({
        integration: {
          serviceType: 'slack',
          status: 'connected',
          name: 'Wrong',
          credentials: {},
        },
      });
      const handler = new SendEmailHandler(service as never);
      await expect(
        handler.execute(null, baseConfig, makeContext()),
      ).rejects.toThrow(/not "email"/);
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_TYPE_MISMATCH' }),
        }),
      );
    });

    it('rejects when integration is not connected', async () => {
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
      await expect(
        handler.execute(null, baseConfig, makeContext()),
      ).rejects.toThrow(/expired/);
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_NOT_CONNECTED' }),
        }),
      );
    });

    it('reports missing SMTP fields', async () => {
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
      await expect(
        handler.execute(null, baseConfig, makeContext()),
      ).rejects.toThrow(/missing fields/);
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTEGRATION_INCOMPLETE' }),
        }),
      );
    });

    it('throws clearly when workspace context is absent', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const ctx = makeContext();
      ctx.variables = {};
      await expect(handler.execute(null, baseConfig, ctx)).rejects.toThrow(
        /workspace context/,
      );
    });
  });
});
