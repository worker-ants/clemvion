import { TemplateHandler } from './template.handler.js';

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

    it('should fail when template is missing', () => {
      const result = handler.validate({ outputFormat: 'html' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('template');
    });

    it('should fail when template is not a string', () => {
      const result = handler.validate({ template: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('template');
    });

    it('should fail when template is empty string', () => {
      const result = handler.validate({ template: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('template');
    });

    it('should fail for invalid outputFormat', () => {
      const result = handler.validate({
        template: 'test',
        outputFormat: 'pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('outputFormat');
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
    };

    it('should return pre-resolved template content with html format', async () => {
      const result = await handler.execute(
        {},
        { template: '<h1>Hello Alice</h1>', outputFormat: 'html' },
        context,
      );
      expect(result).toEqual({
        type: 'template',
        format: 'html',
        content: '<h1>Hello Alice</h1>',
      });
    });

    it('should default outputFormat to text', async () => {
      const result = await handler.execute(
        {},
        { template: 'Plain text content' },
        context,
      );
      expect(result).toEqual({
        type: 'template',
        format: 'text',
        content: 'Plain text content',
      });
    });

    it('should handle markdown format', async () => {
      const result = await handler.execute(
        {},
        { template: '# Title', outputFormat: 'markdown' },
        context,
      );
      expect(result).toEqual({
        type: 'template',
        format: 'markdown',
        content: '# Title',
      });
    });

    it('should pass through already-resolved variable content', async () => {
      const result = await handler.execute(
        {},
        { template: 'Score: 95, User: Alice', outputFormat: 'text' },
        context,
      );
      expect(result).toEqual({
        type: 'template',
        format: 'text',
        content: 'Score: 95, User: Alice',
      });
    });

    it('should handle multiline template content', async () => {
      const template = '<h1>Title</h1>\n<p>Paragraph</p>';
      const result = await handler.execute(
        {},
        { template, outputFormat: 'html' },
        context,
      );
      expect(result).toEqual({
        type: 'template',
        format: 'html',
        content: template,
      });
    });
  });
});
