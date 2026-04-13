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

    it('should fail when multi_turn maxTurns is negative', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        inputField: '{{ $input.text }}',
        maxTurns: -1,
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Name',
            required: true,
          },
        ],
      });
      expect(result.valid).toBe(false);
    });

    it('should fail when multi_turn turnTimeout is zero', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        inputField: '{{ $input.text }}',
        turnTimeout: 0,
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Name',
            required: true,
          },
        ],
      });
      expect(result.valid).toBe(false);
    });

    it('should pass with valid multi_turn config', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        inputField: '{{ $input.text }}',
        maxTurns: 5,
        turnTimeout: 600,
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Name',
            required: true,
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should allow multi_turn without inputField', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Name',
            required: true,
          },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute (single_turn)', () => {
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
      const extracted = (output.output as Record<string, unknown>)
        .extracted as Record<string, unknown>;
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
      const extracted = (output.output as Record<string, unknown>)
        .extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('Alice');
    });

    it('should route to error port after exhausting all retries on JSON parse failure', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: 'always invalid json {{{',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = (await handler.execute(
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
      )) as Record<string, unknown>;

      expect(result.port).toBe('error');
      expect(result.data).toBeDefined();
      const data = result.data as Record<string, unknown>;
      const output = data.output as Record<string, unknown>;
      expect(output.error).toBeDefined();

      // 1 initial + 2 retries = 3 calls total
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
    });
  });

  describe('execute (multi_turn)', () => {
    const multiTurnSchema = [
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
      {
        name: 'amount',
        type: 'number',
        description: 'Amount',
        required: false,
      },
    ];

    it('should complete in first turn when all required fields are filled', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": "John", "orderNumber": "ORD-123", "amount": null, "_missingFields": [], "_followUpQuestion": ""}',
        usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John 주문 ORD-123',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBeUndefined();
      const outObj = output.output as Record<string, unknown>;
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-123');
      expect(outObj.endReason).toBe('completed');
      expect(outObj.turnCount).toBe(1);
    });

    it('should enter waiting_for_input when required fields are missing', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": "John", "orderNumber": null, "amount": null, "_missingFields": ["orderNumber"], "_followUpQuestion": "주문번호를 알려주세요"}',
        usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John 입니다',
          outputSchema: multiTurnSchema,
          maxTurns: 5,
          turnTimeout: 600,
        },
        context,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect(output.interactionType).toBe('ai_conversation');
      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.message).toBe('주문번호를 알려주세요');
      expect(convConfig.turnCount).toBe(1);
      expect(convConfig.maxTurns).toBe(5);
      const state = output._multiTurnState as Record<string, unknown>;
      expect(state.turnCount).toBe(1);
      const partial = state.partialResult as Record<string, unknown>;
      expect(partial.senderName).toBe('John');
    });

    it('should skip initial LLM call when inputField is empty', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: '',
          outputSchema: multiTurnSchema,
          maxTurns: 5,
          turnTimeout: 600,
        },
        context,
      );

      expect(mockLlmService.chat).not.toHaveBeenCalled();
      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect(output.interactionType).toBe('ai_conversation');
      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.message).toBe('');
      expect(convConfig.turnCount).toBe(0);
      const state = output._multiTurnState as Record<string, unknown>;
      expect(state.turnCount).toBe(0);
      expect(state.partialResult).toEqual({});
      const messages = state.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });

    it('should accept optional fields being empty and complete', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": "John", "orderNumber": "ORD-1", "amount": null, "_missingFields": [], "_followUpQuestion": ""}',
        usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John ORD-1',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBeUndefined();
      const outObj = output.output as Record<string, unknown>;
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.amount).toBeNull();
      expect(outObj.endReason).toBe('completed');
    });
  });

  describe('processMultiTurnMessage', () => {
    const multiTurnSchema = [
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
    ];

    function buildState(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        workspaceId: 'ws-1',
        outputSchema: multiTurnSchema,
        instructions: '',
        examples: [],
        messages: [
          { role: 'system', content: 'extractor prompt' },
          { role: 'user', content: 'John 입니다' },
          {
            role: 'assistant',
            content: '주문번호를 알려주세요',
          },
        ],
        partialResult: { senderName: 'John', orderNumber: null },
        turnCount: 1,
        maxTurns: 5,
        turnTimeout: 600,
        totalInputTokens: 100,
        totalOutputTokens: 30,
        ...overrides,
      };
    }

    it('should complete when remaining required fields are filled', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": null, "orderNumber": "ORD-999", "_missingFields": [], "_followUpQuestion": ""}',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'ORD-999 입니다',
        buildState(),
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBeUndefined();
      const outObj = output.output as Record<string, unknown>;
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John'); // preserved
      expect(extracted.orderNumber).toBe('ORD-999');
      expect(outObj.endReason).toBe('completed');
      expect(outObj.turnCount).toBe(2);
    });

    it('should continue waiting when required fields still missing', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": null, "orderNumber": null, "_missingFields": ["orderNumber"], "_followUpQuestion": "다시 주문번호를 알려주세요"}',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        '음 모르겠어요',
        buildState(),
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.message).toBe('다시 주문번호를 알려주세요');
      expect(convConfig.turnCount).toBe(2);
    });

    it('should return max_turns endReason when turnCount reaches maxTurns', async () => {
      mockLlmService.chat.mockResolvedValue({
        content:
          '{"senderName": null, "orderNumber": null, "_missingFields": ["orderNumber"], "_followUpQuestion": "주문번호?"}',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        '모르겠어요',
        buildState({ turnCount: 4, maxTurns: 5 }),
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBeUndefined();
      const outObj = output.output as Record<string, unknown>;
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(outObj.endReason).toBe('max_turns');
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBeNull();
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    it('should build output with user_ended reason', () => {
      const state = {
        model: 'gpt-4o',
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Name',
            required: true,
          },
        ],
        partialResult: { senderName: 'John' },
        messages: [{ role: 'user', content: 'John' }],
        turnCount: 2,
        totalInputTokens: 100,
        totalOutputTokens: 30,
      };

      const result = handler.buildMultiTurnFinalOutput(
        state as never,
        'user_ended',
      );

      const output = result as Record<string, unknown>;
      const outObj = output.output as Record<string, unknown>;
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(outObj.endReason).toBe('user_ended');
      expect(extracted.senderName).toBe('John');
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');
    });
  });
});
