import { TemplateHandler } from './template.handler.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('TemplateHandler', () => {
  let handler: TemplateHandler;

  beforeEach(() => {
    handler = new TemplateHandler();
  });

  describe('validate', () => {
    it('should pass with valid template and outputFormat', () => {
      const result = handler.validate({
        template: '<h1>Hello</h1>',
        outputFormat: 'html',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with template only (outputFormat optional)', () => {
      const result = handler.validate({ template: 'Hello World' });
      expect(result.valid).toBe(true);
    });

    it('should warn when template is missing (schema warningRule)', () => {
      const result = handler.validate({ outputFormat: 'html' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Template');
    });

    it('should warn when template is empty string (schema warningRule)', () => {
      const result = handler.validate({ template: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Template');
    });

    it('should fail when template is not a string', () => {
      const result = handler.validate({ template: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('template must be a string');
    });

    it('should fail for invalid outputFormat', () => {
      const result = handler.validate({
        template: 'test',
        outputFormat: 'pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'outputFormat must be one of: html, markdown, text',
      );
    });

    it('should accept all valid outputFormat values', () => {
      for (const format of ['html', 'markdown', 'text']) {
        const result = handler.validate({
          template: 'test',
          outputFormat: format,
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('execute', () => {
    const context = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };

    // Principle 1.1: `rendered` (resolved template string) is runtime ⇒ output;
    // `outputFormat` / `template` source are literal config ⇒ config.
    it('should return rendered content under output.rendered with html format', async () => {
      const result = await handler.execute(
        {},
        { template: '<h1>Hello Alice</h1>', outputFormat: 'html' },
        context,
      );
      expect(result).toMatchObject({
        output: { rendered: '<h1>Hello Alice</h1>' },
        config: { outputFormat: 'html', template: '<h1>Hello Alice</h1>' },
      });
      expect(
        (result as { output: Record<string, unknown> }).output.type,
      ).toBeUndefined();
    });

    it('should default outputFormat to text', async () => {
      const result = await handler.execute(
        {},
        { template: 'Plain text content' },
        context,
      );
      expect(result).toMatchObject({
        output: { rendered: 'Plain text content' },
        config: { outputFormat: 'text' },
      });
    });

    it('should handle markdown format', async () => {
      const result = await handler.execute(
        {},
        { template: '# Title', outputFormat: 'markdown' },
        context,
      );
      expect(result).toMatchObject({
        output: { rendered: '# Title' },
        config: { outputFormat: 'markdown' },
      });
    });

    it('should pass through already-resolved variable content', async () => {
      const result = await handler.execute(
        {},
        { template: 'Score: 95, User: Alice', outputFormat: 'text' },
        context,
      );
      expect(result).toMatchObject({
        output: { rendered: 'Score: 95, User: Alice' },
        config: { outputFormat: 'text' },
      });
    });

    it('should handle multiline template content', async () => {
      const template = '<h1>Title</h1>\n<p>Paragraph</p>';
      const result = await handler.execute(
        {},
        { template, outputFormat: 'html' },
        context,
      );
      expect(result).toMatchObject({
        output: { rendered: template },
        config: { outputFormat: 'html' },
      });
    });

    // REQ-TEMPLATE-017 (CLE-T-P69YCH) — 실행 엔진은 스키마 기본값(`html`)을
    // 채우지 않는다. 저장된 설정에 `outputFormat` 이 없으면 핸들러가 `text` 로
    // 처리하고 에코에도 `text` 를 싣는다. 엔진 경로처럼 rawConfig 를 넘겨 확인한다.
    describe('outputFormat fallback (REQ-TEMPLATE-017)', () => {
      it.each([
        ['missing', {}],
        ['undefined', { outputFormat: undefined }],
        ['null', { outputFormat: null }],
      ])(
        'echoes text when the stored outputFormat is %s',
        async (_label, extra) => {
          const stored = { template: '<b>Hi</b>', ...extra };
          const result = (await handler.execute({}, stored, {
            ...context,
            rawConfig: Object.freeze({ ...stored }),
          })) as { config: Record<string, unknown> };
          expect(result.config.outputFormat).toBe('text');
          expect(JSON.parse(JSON.stringify(result.config))).toMatchObject({
            outputFormat: 'text',
          });
        },
      );

      it('keeps an explicit outputFormat instead of the fallback', async () => {
        const stored = { template: '<b>Hi</b>', outputFormat: 'html' };
        const result = (await handler.execute({}, stored, {
          ...context,
          rawConfig: Object.freeze({ ...stored }),
        })) as { config: Record<string, unknown> };
        expect(result.config.outputFormat).toBe('html');
      });
    });

    // REQ-TEMPLATE-018 (CLE-T-KESVNR) — `output.rendered` 는 정화하거나 escape
    // 하지 않은 치환 결과다. 정화는 그리는 쪽이 맡는다(REQ-TEMPLATE-019).
    describe('rendered is not sanitized or escaped (REQ-TEMPLATE-018)', () => {
      const unsafe =
        '<script>alert(1)</script><img src="x" onerror="alert(2)">' +
        '<a href="javascript:alert(3)">x</a> & < > " \' &amp;';

      it.each(['html', 'markdown', 'text'])(
        'passes markup through untouched for %s',
        async (outputFormat) => {
          const result = (await handler.execute(
            {},
            { template: unsafe, outputFormat },
            context,
          )) as { output: { rendered: unknown } };
          expect(result.output.rendered).toBe(unsafe);
        },
      );
    });

    // CLE-NODE-OUTPUT Principle 7 규칙 4 — 표시 전용에서도 `buttons` 원문을
    // 설정 에코에 싣는다(CLE-T-961M2W). 대기 판단은 status · buttonConfig 로 한다.
    describe('config.buttons echo', () => {
      type Result = {
        config: Record<string, unknown>;
        status?: string;
        meta?: Record<string, unknown>;
      };

      it('echoes buttons on the display-only path', async () => {
        const result = (await handler.execute(
          {},
          { template: 'Hi', outputFormat: 'text', buttons: [] },
          context,
        )) as unknown as Result;
        expect(result.status).toBeUndefined();
        expect(Object.keys(result.config)).toContain('buttons');
        expect(result.config.buttons).toEqual([]);
        expect(result.config.buttonConfig).toBeUndefined();
      });

      it('echoes the raw buttons value, not the evaluated one', async () => {
        const result = (await handler.execute(
          {},
          { template: 'Hi', outputFormat: 'text', buttons: [] },
          {
            ...context,
            rawConfig: Object.freeze({
              template: 'Hi',
              outputFormat: 'text',
              buttons: '{{ $input.choices }}',
            }),
          },
        )) as unknown as Result;
        expect(result.status).toBeUndefined();
        expect(result.config.buttons).toBe('{{ $input.choices }}');
      });

      it('leaves buttons out of the serialized echo when unset', async () => {
        const result = (await handler.execute(
          {},
          { template: 'Hi', outputFormat: 'text' },
          {
            ...context,
            rawConfig: Object.freeze({ template: 'Hi', outputFormat: 'text' }),
          },
        )) as unknown as Result;
        const serialized = JSON.parse(JSON.stringify(result.config)) as Record<
          string,
          unknown
        >;
        expect(Object.keys(serialized)).not.toContain('buttons');
      });

      it('keeps the waiting path: raw buttons on config, evaluated on buttonConfig', async () => {
        const evaluated = [{ id: 'yes', label: 'Yes' }];
        const raw = [{ id: 'yes', label: '{{ $var.yesLabel }}' }];
        const result = (await handler.execute(
          {},
          { template: 'Hi', outputFormat: 'text', buttons: evaluated },
          {
            ...context,
            rawConfig: Object.freeze({
              template: 'Hi',
              outputFormat: 'text',
              buttons: raw,
            }),
          },
        )) as unknown as Result;
        expect(result.status).toBe('waiting_for_input');
        expect(result.meta).toEqual({
          interactionType: 'buttons',
          durationMs: 0,
        });
        expect(result.config.buttons).toEqual(raw);
        expect(result.config.buttonConfig).toEqual({ buttons: evaluated });
      });
    });
  });
});
