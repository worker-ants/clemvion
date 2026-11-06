import { FormHandler } from './form.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('FormHandler', () => {
  let handler: FormHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new FormHandler();
    context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
  });

  describe('validate', () => {
    it('returns valid when fields is a non-empty array', () => {
      const result = handler.validate({
        fields: [{ name: 'email', type: 'text' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing fields', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "At least one field must be defined." fires.
      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
    });

    it('rejects empty fields array', () => {
      const result = handler.validate({ fields: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
    });

    it('rejects non-array fields', () => {
      const result = handler.validate({ fields: 'not-array' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('fields must be an array');
    });

    it('rejects null fields', () => {
      const result = handler.validate({ fields: null });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
    });
  });

  describe('execute', () => {
    const baseConfig = {
      fields: [
        { name: 'email', type: 'text' },
        { name: 'age', type: 'number' },
      ],
      title: 'Sign Up',
      submitLabel: 'Submit',
    };

    it('returns status waiting_for_input', async () => {
      const result = (await handler.execute(
        null,
        baseConfig,
        context,
      )) as unknown as {
        status: string;
      };
      expect(result.status).toBe('waiting_for_input');
    });

    it('includes interactionType + durationMs in meta', async () => {
      const result = (await handler.execute(
        null,
        baseConfig,
        context,
      )) as unknown as {
        meta: Record<string, unknown>;
      };
      expect(result.meta).toMatchObject({
        interactionType: 'form',
        durationMs: 0,
      });
    });

    it('echoes the full config back', async () => {
      const result = (await handler.execute(
        null,
        baseConfig,
        context,
      )) as unknown as {
        config: Record<string, unknown>;
      };
      expect(result.config).toEqual(baseConfig);
    });

    it('returns empty object output (Principle 4.3 — waiting form has no runtime value)', async () => {
      const result = (await handler.execute(
        null,
        baseConfig,
        context,
      )) as unknown as {
        output: unknown;
      };
      expect(result.output).toEqual({});
    });

    // Principle 7 — config 에코는 스키마 필드(title · description · submitLabel · fields)만 명시 나열한다.
    // 스키마 밖 키(자격 증명 모양 포함)를 펼침으로 함께 내보내지 않는다.
    describe('config echo lists only schema fields', () => {
      const ALLOWED_KEYS = ['description', 'fields', 'submitLabel', 'title'];
      const SECRET = 'sk-live-0123456789abcdef0123456789abcdef';
      const configWithExtras = {
        ...baseConfig,
        description: 'Tell us about you',
        apiKey: SECRET,
        password: 'hunter2',
        credentials: { token: SECRET },
        someFutureKey: 'not-in-schema',
      };

      it.each([
        ['context.rawConfig is set (engine dispatch)', true],
        ['context.rawConfig is absent (direct call fallback)', false],
      ])('drops unlisted keys when %s', async (_label, withRawConfig) => {
        const ctx: ExecutionContext = withRawConfig
          ? { ...context, rawConfig: Object.freeze({ ...configWithExtras }) }
          : context;
        const result = (await handler.execute(
          null,
          configWithExtras,
          ctx,
        )) as unknown as { config: Record<string, unknown> };

        for (const key of Object.keys(result.config)) {
          expect(ALLOWED_KEYS).toContain(key);
        }
        expect(result.config).not.toHaveProperty('apiKey');
        expect(result.config).not.toHaveProperty('password');
        expect(result.config).not.toHaveProperty('credentials');
        expect(result.config).not.toHaveProperty('someFutureKey');
        expect(JSON.stringify(result.config)).not.toContain(SECRET);
        expect(JSON.stringify(result.config)).not.toContain('hunter2');
        // 스키마 필드는 그대로 에코한다.
        expect(result.config).toEqual({
          title: 'Sign Up',
          description: 'Tell us about you',
          submitLabel: 'Submit',
          fields: baseConfig.fields,
        });
      });

      it('echoes the raw template, not the evaluated config', async () => {
        const rawConfig = {
          title: 'Hi {{ $input.name }}',
          submitLabel: 'Send',
          fields: [
            { name: 'name', type: 'text', defaultValue: '{{ $input.name }}' },
            { name: 'age', type: 'number' },
          ],
        };
        const evaluatedConfig = {
          title: 'Hi Alice',
          submitLabel: 'Send',
          fields: [
            { name: 'name', type: 'text', defaultValue: 'Alice' },
            { name: 'age', type: 'number' },
          ],
        };
        const result = (await handler.execute(null, evaluatedConfig, {
          ...context,
          rawConfig: Object.freeze({ ...rawConfig }),
        })) as unknown as {
          config: { title: string; fields: Array<{ defaultValue?: unknown }> };
          output: unknown;
        };

        expect(result.config.fields[0].defaultValue).toBe('{{ $input.name }}');
        expect(result.config.title).toBe('Hi {{ $input.name }}');
        // 대기 출력은 여전히 빈 객체다(REQ-FORM-007).
        expect(result.output).toEqual({});
      });
    });

    it('does not depend on input', async () => {
      const result = (await handler.execute(
        { some: 'input' },
        baseConfig,
        context,
      )) as unknown as { status: string; config: Record<string, unknown> };
      expect(result.status).toBe('waiting_for_input');
      expect(result.config).toEqual(baseConfig);
    });
  });
});
