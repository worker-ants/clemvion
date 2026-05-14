import { TextClassifierHandler } from './text-classifier.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

// Shared assertion for the error-path meta contract (CONVENTIONS Principle 2,
// spec §5.3). Single-label and multi-label modes share the exact catch-block
// implementation, so both call this to avoid drift if the meta keys evolve.
function assertErrorMeta(
  meta: Record<string, unknown>,
  expectedModel: string,
): void {
  expect(typeof meta.durationMs).toBe('number');
  expect(meta.durationMs).toEqual(expect.any(Number));
  expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  expect(meta.model).toBe(expectedModel);
  expect(meta.inputTokens).toBe(0);
  expect(meta.outputTokens).toBe(0);
  expect(meta.totalTokens).toBe(0);
  expect(Array.isArray(meta.llmCalls)).toBe(true);
  const llmCalls = meta.llmCalls as Array<Record<string, unknown>>;
  expect(llmCalls).toHaveLength(1);
  expect(llmCalls[0].requestPayload).toBeDefined();
  expect(llmCalls[0].responsePayload).toBeNull();
  expect(typeof llmCalls[0].durationMs).toBe('number');
  // meta.durationMs ≥ llmCalls[0].durationMs because the former measures the
  // whole execute() span (resolveConfig + prompt build + call) while the
  // latter measures the LLM call alone — semantic axes are distinct even
  // though both are populated by the same throw boundary.
  expect(meta.durationMs).toBeGreaterThanOrEqual(
    llmCalls[0].durationMs as number,
  );
}

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
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  });

  describe('validate', () => {
    it('should fail without categories', () => {
      const result = handler.validate({ inputField: 'test', model: 'gpt-4' });
      expect(result.valid).toBe(false);
      // Schema warningRule "하나 이상의 카테고리를 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('카테고리'))).toBe(true);
    });

    it('should fail with empty categories array', () => {
      const result = handler.validate({
        inputField: 'test',
        model: 'gpt-4',
        categories: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('카테고리'))).toBe(true);
    });

    it('should fail when category name is empty', () => {
      const result = handler.validate({
        inputField: 'test',
        model: 'gpt-4',
        categories: [{ name: '', description: 'desc' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Category 1: name is required');
    });

    it('should fail without inputField', () => {
      const result = handler.validate({
        model: 'gpt-4',
        categories: [{ name: 'A', description: 'Cat A' }],
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Input Field 를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Input Field'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should pass with valid config', () => {
      const result = handler.validate({
        model: 'gpt-4',
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
        model: 'gpt-4',
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('class_0');
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).category).toBe('Billing');
      expect((data.result as any).confidence).toBe(0.95);
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
      )) as unknown as Record<string, unknown>;
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).category).toBeNull();
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
      )) as unknown as Record<string, unknown>;
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).category).toBeNull();
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('class_0');
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).category).toBe('Billing');
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
      )) as unknown as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).confidence).toBe(0);
    });

    it('should include metadata in output', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as unknown as Record<string, unknown>;
      const metadata = result.meta as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o-mini');
      expect(metadata.inputTokens).toBe(50);
      expect(metadata.outputTokens).toBe(10);
      expect(metadata.totalTokens).toBe(60);
      // CONVENTIONS Principle 2 — meta.durationMs is now handler-returned
      // for the success path too (was previously omitted, contradicting
      // spec §5.1).
      expect(typeof metadata.durationMs).toBe('number');
      expect(metadata.durationMs).toEqual(expect.any(Number));
      expect(metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include originalInput in output', async () => {
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as unknown as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).originalInput).toBe('I need a refund');
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
      )) as unknown as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect(data).not.toHaveProperty('confidence');
    });

    it('should route to error port on LLM failure', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('API timeout'));
      const result = (await handler.execute(
        {},
        baseConfig,
        createContext(),
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      const data = result.output as Record<string, unknown>;
      const err = data.error as Record<string, unknown>;
      expect(err.code).toBe('LLM_CALL_FAILED');
      expect(err.message).toBe('API timeout');
    });

    it('should include execution metrics in meta on LLM failure (Principle 2)', async () => {
      // CONVENTIONS Principle 2 — meta.durationMs MUST be present in every
      // case (success / fallback / error). Error case must also expose
      // meta.model (model that was attempted), token zero-defaults (so
      // downstream arithmetic doesn't fall through to undefined), and
      // meta.llmCalls (call trace with responsePayload: null) so debugging
      // surfaces match the success path.
      mockLlmService.chat.mockRejectedValueOnce(new Error('API timeout'));
      const result = (await handler.execute(
        {},
        { ...baseConfig, model: 'gpt-4o-mini' },
        createContext(),
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      assertErrorMeta(result.meta as Record<string, unknown>, 'gpt-4o-mini');
      // Negative assertion — the legacy `output._llmCalls` mirror was
      // dropped so the error envelope matches spec §5.3 (only `output.error`
      // + `output.originalInput` at the top level). Catches future drift.
      const data = result.output as Record<string, unknown>;
      expect(data).not.toHaveProperty('_llmCalls');
      expect(data.originalInput).toBe('I need a refund');
    });

    it('should fall back model from llmConfig.defaultModel when config.model is unset (error path)', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('boom'));
      const { model: _, ...configWithoutModel } = baseConfig as Record<
        string,
        unknown
      > & { model?: string };
      const result = (await handler.execute(
        {},
        configWithoutModel,
        createContext(),
      )) as unknown as Record<string, unknown>;
      const meta = result.meta as Record<string, unknown>;
      // resolveConfig() mock returns { defaultModel: 'gpt-4o-mini' }.
      expect(meta.model).toBe('gpt-4o-mini');
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).config.multiLabel).toBe(false);
    });

    describe('includeEvidence', () => {
      it('should omit evidence from output and jsonSchema by default', async () => {
        const result = (await handler.execute(
          {},
          baseConfig,
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect(data.result).not.toHaveProperty('evidence');

        const chatCall = mockLlmService.chat.mock.calls[0][1];
        expect(chatCall.jsonSchema.properties).not.toHaveProperty('evidence');
        expect(chatCall.jsonSchema.required).not.toContain('evidence');
      });

      it('should include evidence in jsonSchema when includeEvidence is true', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"category": "Billing", "confidence": 0.9, "evidence": ["refund"]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        );
        const chatCall = mockLlmService.chat.mock.calls[0][1];
        expect(chatCall.jsonSchema.properties.evidence).toEqual({
          type: 'array',
          items: { type: 'string' },
        });
        expect(chatCall.jsonSchema.required).toContain('evidence');
        const systemMessage = chatCall.messages[0].content;
        expect(systemMessage).toContain('evidence');
      });

      it('should expose parsed evidence at output.result.evidence', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"category": "Billing", "confidence": 0.9, "evidence": ["refund", "payment"]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).evidence).toEqual(['refund', 'payment']);
      });

      it('should fall back to empty evidence array when LLM omits it', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: '{"category": "Billing", "confidence": 0.9}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).evidence).toEqual([]);
      });

      it('should set evidence to empty array on fallback (__none__)', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"category": "__none__", "confidence": 0.1, "evidence": []}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('fallback');
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).category).toBeNull();
        expect((data.result as any).evidence).toEqual([]);
      });

      it('should drop non-string evidence items to preserve string[] contract', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"category": "Billing", "confidence": 0.9, "evidence": ["valid", 42, null]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).evidence).toEqual(['valid']);
      });

      it('should cap evidence array length and per-item string length', async () => {
        const oversized = Array.from({ length: 50 }, (_, i) => `e${i}`);
        const longString = 'a'.repeat(500);
        mockLlmService.chat.mockResolvedValueOnce({
          content: JSON.stringify({
            category: 'Billing',
            confidence: 0.9,
            evidence: [longString, ...oversized],
          }),
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        const ev = (data.result as any).evidence as string[];
        expect(ev).toHaveLength(20);
        expect(ev[0]).toHaveLength(200);
      });

      it('should expose evidence even when includeConfidence is false', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: '{"category": "Billing", "evidence": ["refund"]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeConfidence: false, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect(data.result).not.toHaveProperty('confidence');
        expect((data.result as any).evidence).toEqual(['refund']);
      });

      it('should fall back to empty evidence on JSON parse failure', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: 'The answer is Billing because it relates to payment',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...baseConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('class_0');
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).evidence).toEqual([]);
      });
    });

    describe('custom categories[*].id', () => {
      it('should route to category.id when set', async () => {
        const result = (await handler.execute(
          {},
          {
            ...baseConfig,
            categories: [
              { id: 'cat_refund', name: 'Billing', description: 'Payment' },
              { id: 'cat_tech', name: 'Tech', description: 'Technical' },
            ],
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('cat_refund');
      });

      it('should fall back to class_N (index-based) when id is missing (legacy)', async () => {
        const result = (await handler.execute(
          {},
          baseConfig,
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('class_0');
      });

      it('should fall back to class_N (index-based) when id is whitespace-only', async () => {
        const result = (await handler.execute(
          {},
          {
            ...baseConfig,
            categories: [
              { id: '   ', name: 'Billing', description: 'Payment' },
              { id: 'cat_tech', name: 'Tech', description: 'Technical' },
            ],
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('class_0');
      });

      it('should route text-fallback (JSON parse failure) to custom id', async () => {
        // Custom id 가 설정된 카테고리에서 LLM 응답이 JSON 파싱 실패 →
        // 텍스트 substring fallback 으로 매칭되더라도 라우팅이 custom id 로
        // 결정되어야 한다 (review/2026-05-05 W-2).
        mockLlmService.chat.mockResolvedValueOnce({
          content: 'The answer is Billing because it relates to payment',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          {
            ...baseConfig,
            categories: [
              { id: 'cat_refund', name: 'Billing', description: 'Payment' },
              { id: 'cat_tech', name: 'Tech', description: 'Technical' },
            ],
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('cat_refund');
      });
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0', 'class_1']);
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).categories).toEqual([
        { name: 'Billing', confidence: 0.9 },
        { name: 'Tech', confidence: 0.85 },
      ]);
      expect((data.result as any).originalInput).toBe(
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
      )) as unknown as Record<string, unknown>;
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('fallback');
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).categories).toEqual([]);
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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0']);
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).categories).toEqual([
        { name: 'Billing', confidence: 0.9 },
      ]);
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
      )) as unknown as Record<string, unknown>;
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).categories).toEqual([{ name: 'Billing' }]);

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
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toEqual(['class_0', 'class_1']);
      const data = result.output as Record<string, unknown>;
      expect((data.result as any).categories).toEqual([
        { name: 'Billing', confidence: 0 },
        { name: 'Tech', confidence: 0 },
      ]);
    });

    it('should route text-fallback (JSON parse failure) to custom ids', async () => {
      // Multi-label 의 substring fallback 도 custom id 로 라우팅 (review W-2).
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'The text relates to Billing and Tech categories',
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        model: 'gpt-4o-mini',
      });
      const result = (await handler.execute(
        {},
        {
          ...multiLabelConfig,
          categories: [
            { id: 'cat_billing', name: 'Billing', description: 'Payment' },
            { id: 'cat_tech', name: 'Tech', description: 'Technical' },
            { id: 'cat_general', name: 'General', description: 'General' },
          ],
        },
        createContext(),
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toEqual(['cat_billing', 'cat_tech']);
    });

    it('should route to error port on LLM failure in multi-label mode', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('Rate limited'));
      const result = (await handler.execute(
        {},
        multiLabelConfig,
        createContext(),
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      const data = result.output as Record<string, unknown>;
      const err = data.error as Record<string, unknown>;
      expect(err.code).toBe('LLM_CALL_FAILED');
      expect(err.message).toBe('Rate limited');
    });

    it('should include execution metrics in meta on LLM failure (multi-label, Principle 2)', async () => {
      // Multi-label shares the catch-block implementation with single-label.
      // We exercise the multi-label config to confirm the contract holds in
      // both modes (no early-return short-circuit by mode).
      mockLlmService.chat.mockRejectedValueOnce(new Error('Rate limited'));
      const result = (await handler.execute(
        {},
        { ...multiLabelConfig, model: 'gpt-4o-mini' },
        createContext(),
      )) as unknown as Record<string, unknown>;
      expect((result as any).port).toBe('error');
      assertErrorMeta(result.meta as Record<string, unknown>, 'gpt-4o-mini');
      const data = result.output as Record<string, unknown>;
      expect(data).not.toHaveProperty('_llmCalls');
      expect(data.originalInput).toBe(
        'I need a refund and the app is crashing',
      );
    });

    it('should fall back model from llmConfig.defaultModel when config.model is unset (multi-label error path)', async () => {
      mockLlmService.chat.mockRejectedValueOnce(new Error('boom'));
      const { model: _, ...configWithoutModel } = multiLabelConfig as Record<
        string,
        unknown
      > & { model?: string };
      const result = (await handler.execute(
        {},
        configWithoutModel,
        createContext(),
      )) as unknown as Record<string, unknown>;
      const meta = result.meta as Record<string, unknown>;
      expect(meta.model).toBe('gpt-4o-mini');
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
      )) as unknown as Record<string, unknown>;
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
      )) as unknown as Record<string, unknown>;
      const metadata = result.meta as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o-mini');
      expect(metadata.inputTokens).toBe(55);
      expect(metadata.outputTokens).toBe(15);
      expect(metadata.totalTokens).toBe(70);
      expect(typeof metadata.durationMs).toBe('number');
      expect(metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    describe('includeEvidence', () => {
      it('should omit per-item evidence by default', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: '{"categories": [{"name": "Billing", "confidence": 0.9}]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          multiLabelConfig,
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories[0]).not.toHaveProperty(
          'evidence',
        );

        const chatCall = mockLlmService.chat.mock.calls[0][1];
        expect(
          chatCall.jsonSchema.properties.categories.items.properties,
        ).not.toHaveProperty('evidence');
      });

      it('should include per-item evidence in jsonSchema when enabled', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"categories": [{"name": "Billing", "confidence": 0.9, "evidence": ["refund"]}]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        await handler.execute(
          {},
          { ...multiLabelConfig, includeEvidence: true },
          createContext(),
        );
        const chatCall = mockLlmService.chat.mock.calls[0][1];
        const itemProps =
          chatCall.jsonSchema.properties.categories.items.properties;
        expect(itemProps.evidence).toEqual({
          type: 'array',
          items: { type: 'string' },
        });
        expect(
          chatCall.jsonSchema.properties.categories.items.required,
        ).toContain('evidence');
        const systemMessage = chatCall.messages[0].content;
        expect(systemMessage).toContain('evidence');
      });

      it('should expose per-item evidence in output.result.categories', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"categories": [' +
            '{"name": "Billing", "confidence": 0.9, "evidence": ["refund"]},' +
            '{"name": "Tech", "confidence": 0.85, "evidence": ["crashing", "app"]}' +
            ']}',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...multiLabelConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories).toEqual([
          { name: 'Billing', confidence: 0.9, evidence: ['refund'] },
          { name: 'Tech', confidence: 0.85, evidence: ['crashing', 'app'] },
        ]);
      });

      it('should default missing per-item evidence to empty array', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: '{"categories": [{"name": "Billing", "confidence": 0.9}]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...multiLabelConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories[0].evidence).toEqual([]);
      });

      it('should attach empty evidence on substring fallback when enabled', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: 'The text relates to Billing categories',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...multiLabelConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories).toEqual([
          { name: 'Billing', confidence: 0, evidence: [] },
        ]);
      });

      it('should route to fallback with empty categories when LLM returns []', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content: '{"categories": []}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          { ...multiLabelConfig, includeEvidence: true },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toBe('fallback');
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories).toEqual([]);
      });

      it('should expose per-item evidence even when includeConfidence is false', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"categories": [{"name": "Billing", "evidence": ["refund"]}]}',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          {
            ...multiLabelConfig,
            includeConfidence: false,
            includeEvidence: true,
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        const data = result.output as Record<string, unknown>;
        expect((data.result as any).categories).toEqual([
          { name: 'Billing', evidence: ['refund'] },
        ]);
      });
    });

    describe('custom categories[*].id', () => {
      it('should map matched categories to their custom ids', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"categories": [{"name": "Billing", "confidence": 0.9}, {"name": "Tech", "confidence": 0.85}]}',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          {
            ...multiLabelConfig,
            categories: [
              { id: 'cat_billing', name: 'Billing', description: 'Payment' },
              { id: 'cat_tech', name: 'Tech', description: 'Technical' },
              { id: 'cat_general', name: 'General', description: 'General' },
            ],
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toEqual(['cat_billing', 'cat_tech']);
      });

      it('should mix custom and fallback ids when only some have id', async () => {
        mockLlmService.chat.mockResolvedValueOnce({
          content:
            '{"categories": [{"name": "Billing", "confidence": 0.9}, {"name": "Tech", "confidence": 0.85}]}',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o-mini',
        });
        const result = (await handler.execute(
          {},
          {
            ...multiLabelConfig,
            categories: [
              { id: 'cat_billing', name: 'Billing', description: 'Payment' },
              { name: 'Tech', description: 'Technical' },
              { name: 'General', description: 'General' },
            ],
          },
          createContext(),
        )) as unknown as Record<string, unknown>;
        expect((result as any).port).toEqual(['cat_billing', 'class_1']);
      });
    });
  });
});
