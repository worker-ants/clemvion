import { FormHandler } from './form.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

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
      expect(result.errors).toContain(
        'fields is required and must be a non-empty array',
      );
    });

    it('rejects empty fields array', () => {
      const result = handler.validate({ fields: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array fields', () => {
      const result = handler.validate({ fields: 'not-array' });
      expect(result.valid).toBe(false);
    });

    it('rejects null fields', () => {
      const result = handler.validate({ fields: null });
      expect(result.valid).toBe(false);
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
      const result = (await handler.execute(null, baseConfig, context)) as {
        status: string;
      };
      expect(result.status).toBe('waiting_for_input');
    });

    it('includes interactionType + durationMs in meta', async () => {
      const result = (await handler.execute(null, baseConfig, context)) as {
        meta: Record<string, unknown>;
      };
      expect(result.meta).toMatchObject({
        interactionType: 'form',
        durationMs: 0,
      });
    });

    it('echoes the full config back', async () => {
      const result = (await handler.execute(null, baseConfig, context)) as {
        config: Record<string, unknown>;
      };
      expect(result.config).toEqual(baseConfig);
    });

    it('returns empty object output (Principle 4.3 — waiting form has no runtime value)', async () => {
      const result = (await handler.execute(null, baseConfig, context)) as {
        output: unknown;
      };
      expect(result.output).toEqual({});
    });

    it('does not depend on input', async () => {
      const result = (await handler.execute(
        { some: 'input' },
        baseConfig,
        context,
      )) as { status: string; config: Record<string, unknown> };
      expect(result.status).toBe('waiting_for_input');
      expect(result.config).toEqual(baseConfig);
    });
  });
});
