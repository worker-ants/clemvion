import { SendEmailHandler } from './send-email.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';

const sendMailMock = jest.fn();
const closeMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: (...args: unknown[]) => sendMailMock(...args),
    close: () => closeMock(),
  })),
}));

function makeContext(rawConfig?: Record<string, unknown>): ExecutionContext {
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
    ...(rawConfig ? { rawConfig: Object.freeze({ ...rawConfig }) } : {}),
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
      // Schema warningRule "Email integration 을 선택해야 합니다." fires.
      expect(result.errors.join(' ')).toContain('integration');
    });

    it('rejects missing to', () => {
      const { to: _drop, ...rest } = baseConfig;
      void _drop;
      const result = handler.validate(rest);
      expect(result.valid).toBe(false);
      // Schema warningRule "수신자 (To) 를 한 명 이상 입력해야 합니다." fires
      // alongside the imperative recipient sum-type guard. Both contain "To".
      expect(result.errors.join(' ')).toMatch(/to|To|수신자/);
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
        cc: 42,
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
        bcc: 42,
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
      const out = (await handler.execute(
        null,
        baseConfig,
        makeContext(baseConfig),
      )) as unknown as {
        status: string;
        config: { to: unknown };
        output: { subject?: string; body?: string; bodyType?: string };
      };
      expect(out.status).toBe('requires_integration');
      // Principle 7 — `config.to` echoes the **raw** value the user entered,
      // not the normalised array.
      expect(out.config.to).toBe('recipient@example.com');
      expect(out.output.subject).toBe('hi');
      expect(out.output.body).toBe('hello');
      expect(out.output.bodyType).toBe('text');
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
      const sendConfig = {
        ...baseConfig,
        to: 'a@example.com, b@example.com',
        cc: 'c@example.com',
      };
      const out = (await handler.execute(
        null,
        sendConfig,
        makeContext(sendConfig),
      )) as unknown as {
        config: { to: unknown; cc: unknown };
        output: {
          messageId: string;
          subject: string;
          body: string;
          bodyType: string;
        };
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
      // Principle 7 — config echoes the raw template (string), evaluated
      // values are surfaced on output.*.
      expect(out.config.to).toBe('a@example.com, b@example.com');
      expect(out.config.cc).toBe('c@example.com');
      expect(out.output.subject).toBe('hi');
      expect(out.output.body).toBe('hello');
      expect(out.output.bodyType).toBe('text');
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
      const sendConfig = {
        ...baseConfig,
        bcc: ['d@example.com', 'e@example.com'],
      };
      const out = (await handler.execute(
        null,
        sendConfig,
        makeContext(sendConfig),
      )) as unknown as { config: { bcc: string[] } };

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
      )) as unknown as { meta: { deliveryStatus: string } };
      expect(out.meta.deliveryStatus).toBe('sent');
    });

    it('routes bodyType=html to html field', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const cfg = { ...baseConfig, bodyType: 'html', body: '<b>hi</b>' };
      const out = (await handler.execute(
        null,
        cfg,
        makeContext(cfg),
      )) as unknown as {
        output: { body?: string; bodyType?: string };
      };
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ html: '<b>hi</b>' }),
      );
      expect(out.output.body).toBe('<b>hi</b>');
      expect(out.output.bodyType).toBe('html');
    });

    // Principle 7 — config echoes raw templates (`{{ name }}` preserved),
    // output surfaces evaluated values. Engine resolves expressions before
    // dispatching, so `config` arg has evaluated values; `context.rawConfig`
    // carries the unresolved snapshot.
    it('echoes rawConfig templates on config and evaluated values on output', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const rawConfig = {
        integrationId: 'int-1',
        to: '{{ $input.email }}',
        subject: 'Hello {{ $input.name }}',
        body: 'Welcome {{ $input.name }}!',
        bodyType: 'text',
      };
      // What `config` arg looks like after the engine evaluates expressions.
      const evaluated = {
        ...rawConfig,
        to: 'alice@example.com',
        subject: 'Hello Alice',
        body: 'Welcome Alice!',
      };
      const out = (await handler.execute(
        null,
        evaluated,
        makeContext(rawConfig),
      )) as unknown as {
        config: { subject: string; body: string; to: unknown };
        output: { subject: string; body: string };
      };

      expect(out.config.to).toBe('{{ $input.email }}');
      expect(out.config.subject).toBe('Hello {{ $input.name }}');
      expect(out.config.body).toBe('Welcome {{ $input.name }}!');
      expect(out.output.subject).toBe('Hello Alice');
      expect(out.output.body).toBe('Welcome Alice!');
    });

    // -----------------------------------------------------------------
    // Phase 4 (C) — attachments forwarded to nodemailer
    // -----------------------------------------------------------------
    it('forwards config.attachments to nodemailer.sendMail', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const cfg = {
        ...baseConfig,
        attachments: [
          { filename: 'a.pdf', content: 'BASE64==', encoding: 'base64' },
          { filename: 'b.txt', content: 'plain text' },
        ],
      };
      await handler.execute(null, cfg, makeContext(cfg));
      const call = sendMailMock.mock.calls[0]?.[0] as {
        attachments?: Array<{
          filename?: string;
          content?: string;
          encoding?: string;
        }>;
        disableFileAccess?: boolean;
        disableUrlAccess?: boolean;
      };
      expect(call.attachments).toEqual([
        { filename: 'a.pdf', content: 'BASE64==', encoding: 'base64' },
        { filename: 'b.txt', content: 'plain text' },
      ]);
      // Defence-in-depth flags must be set on every send.
      expect(call.disableFileAccess).toBe(true);
      expect(call.disableUrlAccess).toBe(true);
    });

    it('omits attachments key when the array is empty (silent no-op preserved)', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      await handler.execute(
        null,
        { ...baseConfig, attachments: [] },
        makeContext(),
      );
      const call = sendMailMock.mock.calls[0]?.[0] as {
        attachments?: unknown;
        disableFileAccess?: boolean;
      };
      expect(call.attachments).toBeUndefined();
      // Even with no attachments, sandbox flags are still asserted.
      expect(call.disableFileAccess).toBe(true);
    });

    it('strips unsafe path/href fields from attachment items (security)', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const cfg = {
        ...baseConfig,
        attachments: [
          {
            filename: 'evil.txt',
            content: 'ok',
            // Attacker-controlled fields that must NEVER reach nodemailer.
            path: '/etc/passwd',
            href: 'http://evil.example.com/secret',
          },
        ],
      };
      await handler.execute(null, cfg, makeContext(cfg));
      const call = sendMailMock.mock.calls[0]?.[0] as {
        attachments?: Array<Record<string, unknown>>;
      };
      expect(call.attachments).toHaveLength(1);
      const att = call.attachments![0];
      expect(att.filename).toBe('evil.txt');
      expect(att.content).toBe('ok');
      expect(att.path).toBeUndefined();
      expect(att.href).toBeUndefined();
    });

    it('caps oversized bodies at 256KB and sets bodyTruncated', async () => {
      const { service } = makeService();
      const handler = new SendEmailHandler(service as never);
      const huge = 'x'.repeat(300 * 1024);
      const cfg = { ...baseConfig, body: huge };
      const out = (await handler.execute(
        null,
        cfg,
        makeContext(cfg),
      )) as unknown as {
        output: { body: string; bodyTruncated?: boolean };
      };
      // sendMail still receives the full body — truncation only bounds the
      // echoed `output.body`.
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: huge }),
      );
      expect(out.output.bodyTruncated).toBe(true);
      expect(typeof out.output.body).toBe('string');
      expect(Buffer.byteLength(out.output.body, 'utf8')).toBeLessThanOrEqual(
        256 * 1024,
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
        makeContext(baseConfig),
      )) as unknown as {
        port: string;
        output: {
          subject?: string;
          body?: string;
          bodyType?: string;
          error: { code: string; message: string };
        };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe('EMAIL_SEND_FAILED');
      expect(result.output.error.message).toContain('connection refused');
      // Error port still surfaces the evaluated body for downstream debugging.
      expect(result.output.subject).toBe('hi');
      expect(result.output.body).toBe('hello');
      expect(result.output.bodyType).toBe('text');
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
      )) as unknown as {
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
      )) as unknown as {
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
      )) as unknown as {
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
      const result = (await handler.execute(
        null,
        baseConfig,
        ctx,
      )) as unknown as {
        port: string;
        output: { error: { message: string } };
      };
      expect(result.port).toBe('error');
      expect(result.output.error.message).toMatch(/workspace context/);
    });
  });
});
