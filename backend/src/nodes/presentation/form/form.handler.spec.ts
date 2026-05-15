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
      // Schema warningRule "최소 1개 이상의 필드를 정의해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
    });

    it('rejects empty fields array', () => {
      const result = handler.validate({ fields: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
    });

    it('rejects non-array fields', () => {
      const result = handler.validate({ fields: 'not-array' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('fields must be an array');
    });

    it('rejects null fields', () => {
      const result = handler.validate({ fields: null });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
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
