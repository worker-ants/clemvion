import { PdfHandler } from './pdf.handler';
import { ExecutionContext } from '../node-handler.interface';

function ctx(): ExecutionContext {
  return {
    executionId: 'exec-pdf',
    workflowId: 'wf-pdf',
    variables: {},
    nodeOutputCache: {},
  };
}

describe('PdfHandler', () => {
  const handler = new PdfHandler();

  describe('validate', () => {
    it('requires template string', () => {
      expect(handler.validate({}).valid).toBe(false);
      expect(handler.validate({ template: 123 }).valid).toBe(false);
      expect(handler.validate({ template: '<h1>x</h1>' }).valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('returns structured NodeHandlerOutput with requires_playwright status', async () => {
      const result = (await handler.execute(
        null,
        {
          template: '<h1>Doc</h1>',
          fileName: 'invoice.pdf',
          pageSize: 'Letter',
          orientation: 'landscape',
        },
        ctx(),
      )) as Record<string, unknown>;

      expect(result.status).toBe('requires_playwright');
      expect(result.config).toMatchObject({
        fileName: 'invoice.pdf',
        pageSize: 'Letter',
        orientation: 'landscape',
      });
      const output = result.output as Record<string, unknown>;
      expect(output.type).toBe('pdf');
      expect(output.template).toBe('<h1>Doc</h1>');
      expect(output.fileName).toBe('invoice.pdf');
      expect(output.pageSize).toBe('Letter');
      expect(output.orientation).toBe('landscape');
    });

    it('applies default fileName/pageSize/orientation when omitted', async () => {
      const result = (await handler.execute(
        null,
        { template: '<p>hi</p>' },
        ctx(),
      )) as Record<string, unknown>;

      expect(result.config).toEqual({
        fileName: 'document.pdf',
        pageSize: 'A4',
        orientation: 'portrait',
      });
      const output = result.output as Record<string, unknown>;
      expect(output.fileName).toBe('document.pdf');
      expect(output.pageSize).toBe('A4');
      expect(output.orientation).toBe('portrait');
    });
  });
});
