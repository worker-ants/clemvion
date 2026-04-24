import {
  sendEmailNodeConfigSchema,
  sendEmailNodeMetadata,
  sendEmailNodeOutputSchema,
  sendEmailNodePorts,
} from './send-email.schema';

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
});
