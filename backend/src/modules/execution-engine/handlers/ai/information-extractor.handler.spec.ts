import { InformationExtractorHandler } from './information-extractor.handler';
import { ExecutionContext } from '../node-handler.interface';

describe('InformationExtractorHandler', () => {
  let handler: InformationExtractorHandler;
  let mockLlmService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn().mockResolvedValue({
        content: '{"senderName": "John", "orderNumber": "ORD-123"}',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
    };

    handler = new InformationExtractorHandler(mockLlmService as never);
  });

  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };

  describe('validate', () => {
    it('should fail without outputSchema', () => {
      const result = handler.validate({ inputField: 'text' });
      expect(result.valid).toBe(false);
    });

    it('should fail without inputField', () => {
      const result = handler.validate({
        outputSchema: [{ name: 'field1', type: 'string', description: 'desc' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should pass with valid config', () => {
      const result = handler.validate({
        inputField: '{{ $input.text }}',
        outputSchema: [
          { name: 'senderName', type: 'string', description: 'Name' },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should extract and return structured data', async () => {
      const result = await handler.execute(
        {},
        {
          inputField: 'Email from John about order ORD-123',
          outputSchema: [
            {
              name: 'senderName',
              type: 'string',
              description: 'Sender name',
              required: true,
            },
            {
              name: 'orderNumber',
              type: 'string',
              description: 'Order number',
              required: true,
            },
          ],
        },
        context,
      );

      const output = result as Record<string, unknown>;
      const extracted = output.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-123');
    });

    it('should retry on JSON parse failure and succeed on subsequent attempt', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: 'not valid json',
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
          model: 'gpt-4o',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: '{"senderName": "Alice"}',
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          inputField: 'Email from Alice',
          outputSchema: [
            {
              name: 'senderName',
              type: 'string',
              description: 'Sender name',
              required: true,
            },
          ],
        },
        context,
      );

      // Should have been called twice (first failed JSON parse, second succeeded)
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      const output = result as Record<string, unknown>;
      const extracted = output.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('Alice');
    });

    it('should throw after exhausting all retries on JSON parse failure', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: 'always invalid json {{{',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await expect(
        handler.execute(
          {},
          {
            inputField: 'test input',
            outputSchema: [
              {
                name: 'field1',
                type: 'string',
                description: 'desc',
                required: true,
              },
            ],
          },
          context,
        ),
      ).rejects.toThrow();

      // 1 initial + 2 retries = 3 calls total
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
    });
  });
});
