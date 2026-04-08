import { TextClassifierHandler } from './text-classifier.handler';
import { ExecutionContext } from '../node-handler.interface';

describe('TextClassifierHandler', () => {
  let handler: TextClassifierHandler;
  let mockLlmService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        defaultModel: 'gpt-4o-mini',
      }),
      chat: jest.fn().mockResolvedValue({
        content: '{"category": "Billing", "confidence": 0.95}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      }),
    };

    handler = new TextClassifierHandler(mockLlmService as never);
  });

  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };

  describe('validate', () => {
    it('should fail without categories', () => {
      const result = handler.validate({ inputField: 'test' });
      expect(result.valid).toBe(false);
    });

    it('should fail without inputField', () => {
      const result = handler.validate({
        categories: [{ name: 'A', description: 'Cat A' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should pass with valid config', () => {
      const result = handler.validate({
        inputField: '{{ $input.text }}',
        categories: [
          { name: 'Billing', description: 'Payment questions' },
          { name: 'Tech', description: 'Technical support' },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should classify and route to correct port', async () => {
      const result = await handler.execute(
        {},
        {
          inputField: 'I need a refund',
          categories: [
            { name: 'Billing', description: 'Payment' },
            { name: 'Tech', description: 'Technical' },
          ],
        },
        context,
      );

      const output = result as Record<string, unknown>;
      expect(output.port).toBe('class_0'); // Billing is index 0
      const data = output.data as Record<string, unknown>;
      expect(data.category).toBe('Billing');
      expect(data.confidence).toBe(0.95);
    });
  });
});
