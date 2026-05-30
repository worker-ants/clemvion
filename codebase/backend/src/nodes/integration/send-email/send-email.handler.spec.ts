import { SendEmailHandler } from './send-email.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import { isSmtpHostBlocked } from '../../../common/utils/smtp-host-guard.js';

const sendMailMock = jest.fn();
const closeMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: (...args: unknown[]) => sendMailMock(...args),
    close: () => closeMock(),
  })),
}));
// SSRF 가드는 smtp-host-guard.spec.ts 가 검증한다. 핸들러 테스트에서는 실제
// DNS 조회를 피하기 위해 모킹하고 분기만 제어한다 (기본 false = 허용).
jest.mock('../../../common/utils/smtp-host-guard.js', () => ({
  isSmtpHostBlocked: jest.fn().mockResolvedValue(false),
}));
const mockedIsSmtpHostBlocked = isSmtpHostBlocked as unknown as jest.Mock;

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
    to: ['recipient@example.com'],
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

    // array-only 정준화 (spec §8.1) — raw string 은 zod 와 validator 양쪽에서 reject.
    it('rejects a comma-separated string for to (array-only 정준화)', () => {
      expect(
        handler.validate({ ...baseConfig, to: 'a@example.com, b@example.com' })
          .valid,
      ).toBe(false);
    });

    it('accepts a non-empty array for to', () => {
      expect(
        handler.validate({ ...baseConfig, to: ['a@example.com'] }).valid,
      ).toBe(true);
    });

    it('accepts an array with a single expression template element', () => {
      // raw 가 단일 string 이 아니라 array 안에 표현식 — `to: ["{{ $input.recipients }}"]`.
      // 표현식 평가는 runtime, validate 는 raw 형태만 본다.
      expect(
        handler.validate({
          ...baseConfig,
          to: ['{{ $input.recipients }}'],
        }).valid,
      ).toBe(true);
    });

    it('rejects a single expression string for to (array-only)', () => {
      expect(
        handler.validate({ ...baseConfig, to: '{{ $input.recipients }}' })
          .valid,
      ).toBe(false);
    });

    it('rejects missing integrationId', () => {
      const { integrationId: _drop, ...rest } = baseConfig;
      void _drop;
      const result = handler.validate(rest);
      expect(result.valid).toBe(false);
      // Schema warningRule "Email integration must be selected." fires.
      expect(result.errors.join(' ')).toContain('integration');
    });

    it('rejects missing to', () => {
      const { to: _drop, ...rest } = baseConfig;
      void _drop;
      const result = handler.validate(rest);
      expect(result.valid).toBe(false);
      // Schema warningRule "Recipient (To) must include at least one address." fires
      // alongside the imperative recipient sum-type guard. Both contain "To".
      expect(result.errors.join(' ')).toMatch(/to|To|수신자/);
    });

    it('rejects whitespace-only array element for to', () => {
      const result = handler.validate({ ...baseConfig, to: ['   '] });
      expect(result.valid).toBe(false);
    });

    it('rejects empty array for to', () => {
      const result = handler.validate({ ...baseConfig, to: [] });
      expect(result.valid).toBe(false);
    });

    it('allows cc to be absent (undefined / empty array)', () => {
      // array-only 정준화 (spec §8.1): absent = unset 또는 빈 배열.
      expect(handler.validate({ ...baseConfig, cc: [] }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, cc: undefined }).valid).toBe(
        true,
      );
    });

    it('rejects cc when raw is a string (array-only) + 에러 메시지에 cc 포함', () => {
      // 종전 sum-type 에서는 통과. 이제 일관되게 reject.
      const emptyResult = handler.validate({ ...baseConfig, cc: '' });
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.errors.join(' ')).toContain('cc');
      const stringResult = handler.validate({ ...baseConfig, cc: 'c@x.com' });
      expect(stringResult.valid).toBe(false);
      expect(stringResult.errors.join(' ')).toContain('cc');
    });

    it('rejects invalid cc type (number)', () => {
      const result = handler.validate({
        ...baseConfig,
        cc: 42,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('cc');
    });

    it('allows bcc to be absent (undefined / empty array)', () => {
      // array-only 정준화 (spec §8.1): absent 의 의미는 unset 또는 빈 배열.
      // 종전엔 빈 string 도 absent 로 봤지만, 이제는 raw string 자체가 invalid.
      expect(handler.validate({ ...baseConfig, bcc: [] }).valid).toBe(true);
      expect(handler.validate({ ...baseConfig, bcc: undefined }).valid).toBe(
        true,
      );
    });

    it('rejects bcc when raw is a string (array-only) + 에러 메시지에 bcc 포함', () => {
      // 종전 sum-type 에서는 통과. 이제 일관되게 reject.
      const emptyResult = handler.validate({ ...baseConfig, bcc: '' });
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.errors.join(' ')).toContain('bcc');
      const stringResult = handler.validate({ ...baseConfig, bcc: 'd@x.com' });
      expect(stringResult.valid).toBe(false);
      expect(stringResult.errors.join(' ')).toContain('bcc');
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
      // Principle 7 — `config.to` echoes the **raw** array the user entered.
      // After 2026-05-19 정준화 (spec §8.1) raw is array-only.
      expect(out.config.to).toEqual(['recipient@example.com']);
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
        to: ['a@example.com', 'b@example.com'],
        cc: ['c@example.com'],
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
      // Principle 7 — config echoes the raw array (array-only 정준화),
      // evaluated values are surfaced on output.*.
      expect(out.config.to).toEqual(['a@example.com', 'b@example.com']);
      expect(out.config.cc).toEqual(['c@example.com']);
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
      // W3 — api field value assertion (INT-US-05): SEND + SMTP host
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          api: expect.objectContaining({
            method: 'SEND',
            path: 'smtp.example.com',
          }),
        }),
      );
      // Transporter is now cached across calls; close() only fires on shutdown.
      handler.shutdown();
      expect(closeMock).toHaveBeenCalled();
    });

    it('routes to error port (EMAIL_HOST_BLOCKED) when the SSRF guard blocks the host', async () => {
      mockedIsSmtpHostBlocked.mockResolvedValueOnce(true);
      const { service } = makeService({
        integration: {
          id: 'int-1',
          workspaceId: 'ws-1',
          serviceType: 'email',
          status: 'connected',
          name: 'Internal SMTP',
          authType: 'smtp',
          credentials: {
            host: '169.254.169.254',
            port: 587,
            secure: 'starttls',
            username: 'user',
            password: 'pw',
            default_from: 'noreply@example.com',
          },
        },
      });
      const handler = new SendEmailHandler(service as never);
      const out = (await handler.execute(
        null,
        baseConfig,
        makeContext(),
      )) as unknown as {
        output: { error?: { code: string } };
        meta: { deliveryStatus: string };
        port?: string;
      };

      expect(out.port).toBe('error');
      expect(out.output.error?.code).toBe('EMAIL_HOST_BLOCKED');
      expect(out.meta.deliveryStatus).toBe('failed');
      // 차단 시 실제 발송을 시도하지 않아야 한다.
      expect(sendMailMock).not.toHaveBeenCalled();
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
        to: ['{{ $input.email }}'],
        subject: 'Hello {{ $input.name }}',
        body: 'Welcome {{ $input.name }}!',
        bodyType: 'text',
      };
      // What `config` arg looks like after the engine evaluates expressions.
      const evaluated = {
        ...rawConfig,
        to: ['alice@example.com'],
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

      expect(out.config.to).toEqual(['{{ $input.email }}']);
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
      // W3 — api field on failure (INT-US-05)
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          api: expect.objectContaining({
            method: 'SEND',
            path: 'smtp.example.com',
          }),
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

    // SUMMARY#14 — abortSignal 사전 체크 경로 단위 테스트
    it('throws AbortError when context.abortSignal is already aborted', async () => {
      const handler = new SendEmailHandler();
      const controller = new AbortController();
      controller.abort();
      const abortedCtx: ExecutionContext = {
        ...makeContext(),
        abortSignal: controller.signal,
      };
      await expect(
        handler.execute(null, baseConfig, abortedCtx),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
