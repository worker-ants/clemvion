import { TemplateHandler } from './template.handler.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('TemplateHandler - Buttons', () => {
  let handler: TemplateHandler;

  beforeEach(() => {
    handler = new TemplateHandler();
  });

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

  describe('validate with buttons', () => {
    it('should pass with valid buttons', () => {
      const result = handler.validate({
        template: '<p>Hello</p>',
        buttons: [{ id: 'btn-1', label: 'Approve', type: 'port' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid buttons', () => {
      const result = handler.validate({
        template: '<p>Hello</p>',
        buttons: [{ id: 'btn-1', label: '', type: 'port' }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute with buttons', () => {
    it('should return waiting_for_input when buttons configured', async () => {
      const buttons = [{ id: 'btn-1', label: 'OK', type: 'port' }];
      const result = (await handler.execute(
        {},
        { template: '<p>Hello</p>', buttons },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBe('waiting_for_input');
      expect(result.meta.interactionType).toBe('buttons');
      expect(result.output.rendered).toBe('<p>Hello</p>');
    });

    it('should return normal output without buttons', async () => {
      const result = (await handler.execute(
        {},
        { template: '<p>Hello</p>' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBeUndefined();
    });
  });
});
