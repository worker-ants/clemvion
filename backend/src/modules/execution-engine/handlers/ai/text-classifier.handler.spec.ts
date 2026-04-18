import { TextClassifierHandler } from './text-classifier.handler';
import { ExecutionContext } from '../../../../nodes/core/node-handler.interface';

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

  const createContext = (): ExecutionContext => ({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  });

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

    it('should reject __none__ as category name', () => {
      const result = handler.validate({
        inputField: 'test',
        categories: [{ name: '__none__', description: 'Reserved' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Category 1: "__none__" is a reserved name',
      );
    });
  });

  describe('execute (single-label)', () => {
    const baseConfig = {
      inputField: 'I need a refund',
      includeConfidence: true,
      categories: [
        { name: 'Billing', description: 'Payment' },
        { name: 'Tech', description: 'Technical' },
      ],
    };

    it('should classify and route to correct port (first category)', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('class_0');
      const data = result.output as Record<string, unknown>;
      expect(data.category).toBe('Billing');
      expect(data.confidence).toBe(0.95);
    });

    it('should route to second category port', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Tech", "confidence": 0.8}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('class_1');
    });

    it('should route to fallback when LLM returns __none__', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "__none__", "confidence": 0.1}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect(data.category).toBeNull();
    });

    it('should route to fallback port when category does not match', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Unknown", "confidence": 0.3}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
    });

    it('should route to fallback port on JSON parse failure with no match', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'invalid json response',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect(data.category).toBeNull();
    });

    it('should extract category from text on JSON parse failure', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'The answer is Billing because it relates to payment',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('class_0');
      const data = result.output as Record<string, unknown>;
      expect(data.category).toBe('Billing');
    });

    it('should preserve confidence of 0 (not treat as falsy)', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Billing", "confidence": 0}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect(data.confidence).toBe(0);
    });

    it('should include metadata in output', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      const metadata = result.meta as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o-mini');
      expect(metadata.inputTokens).toBe(50);
      expect(metadata.outputTokens).toBe(10);
      expect(metadata.totalTokens).toBe(60);
    });

    it('should include originalInput in output', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect(data.originalInput).toBe('I need a refund');
    });

    it('should pass jsonSchema with category enum including __none__', async () => {
      await handler.execute({}, baseConfig, createContext());
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      expect(chatCall.responseFormat).toBe('json');
      expect(chatCall.jsonSchema).toEqual({
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['Billing', 'Tech', '__none__'],
          },
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
        createContext(),
      );
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      expect(chatCall.jsonSchema).toEqual({
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['Billing', 'Tech', '__none__'],
          },
        },
        required: ['category'],
        additionalProperties: false,
      });
    });

    it('should omit confidence from output when includeConfidence is false', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"category": "Billing"}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        { ...baseConfig, includeConfidence: false },
        createContext(),
      )) as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect(data).not.toHaveProperty('confidence');
    });

    it('should route to error port on LLM failure', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('API timeout'));
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      const data = result.output as Record<string, unknown>;
      expect(data.error).toBe('API timeout');
    });

    it('should include fallback instruction in system prompt', async () => {
      await handler.execute({}, baseConfig, createContext());
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      const systemMessage = chatCall.messages[0].content;
      expect(systemMessage).toContain('__none__');
      expect(systemMessage).toContain(
        'does not clearly fit any of the above categories',
      );
    });

    it('should include multiLabel: false in config output', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).config.multiLabel).toBe(false);
    });
  });

  describe('execute (multi-label)', () => {
    const multiLabelConfig = {
      inputField: 'I need a refund and the app is crashing',
      includeConfidence: true,
      categories: [
        { name: 'Billing', description: 'Payment' },
        { name: 'Tech', description: 'Technical' },
        { name: 'General', description: 'General inquiry' },
      ],
      multiLabel: true,
    };

    it('should return multiple ports when multiple categories match', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content:
          '{"categories": [{"name": "Billing", "confidence": 0.9}, {"name": "Tech", "confidence": 0.85}]}',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0', 'class_1']);
      const data = result.output as Record<string, unknown>;
      expect(data.categories).toEqual([
        { name: 'Billing', confidence: 0.9 },
        { name: 'Tech', confidence: 0.85 },
      ]);
      expect(data.originalInput).toBe(
        'I need a refund and the app is crashing',
      );
    });

    it('should return single-element port array when one category matches', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": [{"name": "General", "confidence": 0.7}]}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_2']);
    });

    it('should route to fallback when empty categories array returned', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": []}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect(data.categories).toEqual([]);
    });

    it('should filter out invalid category names from LLM response', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content:
          '{"categories": [{"name": "Billing", "confidence": 0.9}, {"name": "InvalidCat", "confidence": 0.5}]}',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0']);
      const data = result.output as Record<string, unknown>;
      expect(data.categories).toEqual([{ name: 'Billing', confidence: 0.9 }]);
    });

    it('should use multi-label prompt and schema', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": []}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      await handler.execute({}, multiLabelConfig, createContext());
      const chatCall = mockLlmService.chat.mock.calls[0][1];
      const systemMessage = chatCall.messages[0].content;
      expect(systemMessage).toContain('ALL applicable categories');
      expect(systemMessage).toContain('empty array');

      expect(chatCall.jsonSchema).toEqual({
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  enum: ['Billing', 'Tech', 'General'],
                },
                confidence: { type: 'number' },
              },
              required: ['name', 'confidence'],
              additionalProperties: false,
            },
          },
        },
        required: ['categories'],
        additionalProperties: false,
      });
    });

    it('should omit confidence in multi-label when includeConfidence is false', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": [{"name": "Billing"}]}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        { ...multiLabelConfig, includeConfidence: false },
        createContext(),
      )) as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect(data.categories).toEqual([{ name: 'Billing' }]);

      const chatCall = mockLlmService.chat.mock.calls[0][1];
      expect(
        chatCall.jsonSchema.properties.categories.items.properties,
      ).not.toHaveProperty('confidence');
    });

    it('should extract categories from text on JSON parse failure', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'The text relates to Billing and Tech categories',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0', 'class_1']);
      const data = result.output as Record<string, unknown>;
      expect(data.categories).toEqual([
        { name: 'Billing', confidence: 0 },
        { name: 'Tech', confidence: 0 },
      ]);
    });

    it('should route to error port on LLM failure in multi-label mode', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('Rate limited'));
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      const data = result.output as Record<string, unknown>;
      expect(data.error).toBe('Rate limited');
    });

    it('should include multiLabel: true in config output', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": [{"name": "Billing", "confidence": 0.9}]}',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      expect((result as any).config.multiLabel).toBe(true);
    });

    it('should include metadata in multi-label output', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '{"categories": [{"name": "Billing", "confidence": 0.9}]}',
        usage: { inputTokens: 55, outputTokens: 15, totalTokens: 70 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as Record<string, unknown>;
      const metadata = result.meta as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o-mini');
      expect(metadata.inputTokens).toBe(55);
      expect(metadata.outputTokens).toBe(15);
      expect(metadata.totalTokens).toBe(70);
    });
  });
});
