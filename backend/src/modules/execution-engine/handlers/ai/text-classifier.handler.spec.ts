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
      expect(result.errors).toContain('At least one category is required');
    });

    it('should fail with empty categories array', () => {
      const result = handler.validate({ inputField: 'test', categories: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one category is required');
    });

    it('should fail when category name is empty', () => {
      const result = handler.validate({
        inputField: 'test',
        categories: [{ name: '', description: 'desc' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Category 1: name is required');
    });

    it('should fail without inputField', () => {
      const result = handler.validate({
        categories: [{ name: 'A', description: 'Cat A' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('inputField is required');
    });

    it('should collect multiple errors', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
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
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('execute', () => {
    const baseConfig = {
      inputField: 'I need a refund',
      categories: [
        { name: 'Billing', description: 'Payment' },
        { name: 'Tech', description: 'Technical' },
      ],
    };

    it('should classify and route to correct port (first category)', async () => {
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      expect(result.port).toBe('class_0');
      const data = result.data as Record<string, unknown>;
      expect(data.category).toBe('Billing');
      expect(data.confidence).toBe(0.95);
    });

    it('should route to second category port', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Tech", "confidence": 0.8}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      expect(result.port).toBe('class_1');
    });

    it('should route to fallback port when category does not match', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Unknown", "confidence": 0.3}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      expect(result.port).toBe('fallback');
    });

    it('should route to fallback port on JSON parse failure with no match', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'invalid json response',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      expect(result.port).toBe('fallback');
      const data = result.data as Record<string, unknown>;
      expect(data.category).toBe('');
    });

    it('should extract category from text on JSON parse failure', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'The answer is Billing because it relates to payment',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      expect(result.port).toBe('class_0');
      const data = result.data as Record<string, unknown>;
      expect(data.category).toBe('Billing');
    });

    it('should preserve confidence of 0 (not treat as falsy)', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Billing", "confidence": 0}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      const data = result.data as Record<string, unknown>;
      expect(data.confidence).toBe(0);
    });

    it('should include metadata in output', async () => {
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      const data = result.data as Record<string, unknown>;
      const metadata = data.metadata as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o-mini');
      expect(metadata.inputTokens).toBe(50);
      expect(metadata.outputTokens).toBe(10);
      expect(metadata.totalTokens).toBe(60);
    });

    it('should include originalInput in output', async () => {
      const result = (await handler.execute({}, baseConfig, context)) as Record<
        string,
        unknown
      >;
      const data = result.data as Record<string, unknown>;
      expect(data.originalInput).toBe('I need a refund');
    });

    it('should pass jsonSchema with category enum to LLM', async () => {
      await handler.execute({}, baseConfig, context);
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      expect(chatCall.responseFormat).toBe('json');
      expect(chatCall.jsonSchema).toEqual({
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['Billing', 'Tech'] },
          confidence: { type: 'number' },
        },
        required: ['category', 'confidence'],
        additionalProperties: false,
      });
    });

    it('should omit confidence from jsonSchema when includeConfidence is false', async () => {
      await handler.execute(
        {},
        { ...baseConfig, includeConfidence: false },
        context,
      );
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      expect(chatCall.jsonSchema).toEqual({
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['Billing', 'Tech'] },
        },
        required: ['category'],
        additionalProperties: false,
      });
    });
  });
});
