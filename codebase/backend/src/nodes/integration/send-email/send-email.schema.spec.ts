import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  sendEmailNodeConfigSchema,
  sendEmailNodeMetadata,
  sendEmailNodeOutputSchema,
  sendEmailNodePorts,
  validateSendEmailConfig,
} from './send-email.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('sendEmailNodeConfigSchema ui.required', () => {
  // warningRules SSOT 와 frontend asterisk 표시가 어긋나지 않도록 잠금.
  type Props = Record<string, { ui?: { required?: boolean } }>;
  const properties = (
    z.toJSONSchema(sendEmailNodeConfigSchema) as unknown as {
      properties?: Props;
    }
  ).properties;

  it.each([
    ['integrationId', 'send_email:no-integration'],
    ['to', 'send_email:no-recipient'],
    ['subject', 'send_email:no-subject'],
    ['body', 'send_email:no-body'],
  ])('marks %s as required (mirrors %s)', (key) => {
    expect(properties?.[key]?.ui?.required).toBe(true);
  });
});

describe('Send Email node schema', () => {
  describe('sendEmailNodeConfigSchema defaults', () => {
    it('빈 config 는 기본값으로 채워짐 (subject/body 모두 "", 배열 필드 []) ', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.subject).toBe('');
      expect(parsed.body).toBe('');
      expect(parsed.to).toEqual([]);
      expect(parsed.cc).toEqual([]);
      expect(parsed.bcc).toEqual([]);
      expect(parsed.bodyType).toBe('text');
      expect(parsed.attachments).toEqual([]);
      expect(parsed.integrationId).toBeUndefined();
    });

    // subject/body 를 `.default('')` 로 둔 이유: LLM 이 `.optional()` 을
    // "선택 사항" 으로 오인해 인자 자체를 누락하는 사례를 차단.
    // 누락 시 zod 가 '' 를 채워주므로 핸들러 validate 가 "required 미충족" 을
    // 명시적으로 반환할 수 있다.
    it('subject 를 omit 하면 빈 문자열 기본값 (LLM omit 방지)', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.subject).toBe('');
    });

    it('body 를 omit 하면 빈 문자열 기본값', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.body).toBe('');
    });

    it('명시적으로 subject="" 를 전달해도 유효 (handler 가 runtime-required 체크)', () => {
      const result = sendEmailNodeConfigSchema.safeParse({ subject: '' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe('');
      }
    });
  });

  describe('sendEmailNodeConfigSchema bodyType', () => {
    it("bodyType 은 'text' / 'html' 만 허용", () => {
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'text' }).success,
      ).toBe(true);
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'html' }).success,
      ).toBe(true);
    });

    it('bodyType 이 그 외 값이면 거부 (markdown 등)', () => {
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'markdown' }).success,
      ).toBe(false);
    });
  });

  describe('sendEmailNodeConfigSchema arrays', () => {
    it('to/cc/bcc 에 string 배열 허용', () => {
      const parsed = sendEmailNodeConfigSchema.parse({
        to: ['a@x.com'],
        cc: ['b@x.com', 'c@x.com'],
        bcc: [],
      });
      expect(parsed.to).toEqual(['a@x.com']);
      expect(parsed.cc).toEqual(['b@x.com', 'c@x.com']);
      expect(parsed.bcc).toEqual([]);
    });

    it('attachments: filename + content 객체 배열 허용', () => {
      const parsed = sendEmailNodeConfigSchema.parse({
        attachments: [
          { filename: 'a.pdf', content: 'base64data' },
          { filename: 'b.txt', content: 'https://example.com/file' },
        ],
      });
      expect(parsed.attachments).toHaveLength(2);
      expect(parsed.attachments[0].filename).toBe('a.pdf');
    });
  });

  describe('sendEmailNodeOutputSchema', () => {
    // 성공/실패 분기 — output 스키마는 성공 필드(messageId 등) 와 error 필드를
    // 모두 optional 로 허용. config 스키마의 `.default('')` 와는 의도적으로 비대칭
    // (config 는 LLM omit 방지, output 은 성공·실패 양쪽 path 표현).
    it('성공 shape 수용 (messageId + accepted + deliveryStatus)', () => {
      const result = sendEmailNodeOutputSchema.safeParse({
        config: { integrationId: 'i1', to: ['a@x.com'], subject: 'hi' },
        output: { messageId: 'm-1', accepted: ['a@x.com'], rejected: [] },
        meta: { durationMs: 123, deliveryStatus: 'sent' },
        port: 'out',
        status: 'success',
      });
      expect(result.success).toBe(true);
    });

    it('실패 shape 수용 (error envelope + port=error)', () => {
      const result = sendEmailNodeOutputSchema.safeParse({
        config: { to: ['a@x.com'] },
        output: {
          error: {
            code: 'SMTP_AUTH_FAILED',
            message: 'invalid credentials',
            details: { smtpCode: 535 },
          },
        },
        meta: { deliveryStatus: 'failed' },
        port: 'error',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('static metadata', () => {
    it('ports: inputs=[in], outputs=[out, error]', () => {
      expect(sendEmailNodePorts.outputs.map((p) => p.id)).toEqual([
        'out',
        'error',
      ]);
    });

    it('metadata: type=send_email, category=integration', () => {
      expect(sendEmailNodeMetadata.type).toBe('send_email');
      expect(sendEmailNodeMetadata.category).toBe('integration');
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        sendEmailNodeMetadata.warningRules,
      ).map((w) => w.id);

    describe('send_email:no-integration', () => {
      it('fires when integrationId is missing', () => {
        expect(firedIds({})).toContain('send_email:no-integration');
      });

      it('does NOT fire when integrationId is set', () => {
        expect(firedIds({ integrationId: 'i-1' })).not.toContain(
          'send_email:no-integration',
        );
      });
    });

    describe('send_email:no-recipient', () => {
      it('fires when to is missing', () => {
        expect(firedIds({})).toContain('send_email:no-recipient');
      });

      it('fires when to is empty array', () => {
        expect(firedIds({ to: [] })).toContain('send_email:no-recipient');
      });

      it('does NOT fire when to has at least one element', () => {
        expect(firedIds({ to: ['a@example.com'] })).not.toContain(
          'send_email:no-recipient',
        );
      });
    });

    describe('send_email:no-subject', () => {
      it('fires when subject is empty string', () => {
        expect(firedIds({ subject: '' })).toContain('send_email:no-subject');
      });

      it('does NOT fire when subject is set', () => {
        expect(firedIds({ subject: 'hi' })).not.toContain(
          'send_email:no-subject',
        );
      });
    });

    describe('send_email:no-body', () => {
      it('fires when body is empty string', () => {
        expect(firedIds({ body: '' })).toContain('send_email:no-body');
      });

      it('does NOT fire when body is set', () => {
        expect(firedIds({ body: 'hello' })).not.toContain('send_email:no-body');
      });
    });
  });

  describe('validateSendEmailConfig (imperative)', () => {
    it('returns [] when to is a non-empty string', () => {
      expect(validateSendEmailConfig({ to: 'a@example.com' })).toEqual([]);
    });

    it('returns [] when to is a non-empty array of strings', () => {
      expect(
        validateSendEmailConfig({ to: ['a@example.com', 'b@example.com'] }),
      ).toEqual([]);
    });

    it('rejects to when missing', () => {
      expect(validateSendEmailConfig({})).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
    });

    it('rejects to when array contains empty / non-string entries', () => {
      expect(validateSendEmailConfig({ to: [''] })).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
      expect(validateSendEmailConfig({ to: [123 as never] })).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
    });

    it('skips cc/bcc validation when they are unset / empty', () => {
      expect(
        validateSendEmailConfig({ to: 'a@example.com', cc: [], bcc: '' }),
      ).toEqual([]);
    });

    it('rejects cc when set but malformed (array with non-string)', () => {
      const errors = validateSendEmailConfig({
        to: 'a@example.com',
        cc: [123 as never],
      });
      expect(errors).toContain(
        'cc must be a string or array of email addresses',
      );
    });
  });

  describe('evaluateMetadataBlockingErrors integration (send_email)', () => {
    it('emits all four declarative warnings on a freshly-created node', () => {
      const errors = evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {});
      expect(errors).toContain('Email integration must be selected.');
      expect(errors).toContain(
        'Recipient (To) must include at least one address.',
      );
      expect(errors).toContain('Subject must be entered.');
      expect(errors).toContain('Body must be entered.');
    });

    it('returns [] when fully configured', () => {
      expect(
        evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {
          integrationId: 'i-1',
          to: ['a@example.com'],
          subject: 'hi',
          body: 'hello',
        }),
      ).toEqual([]);
    });
  });
});
