import { InformationExtractorHandler } from './information-extractor.handler';
import { ExecutionContext } from '../../../../nodes/core/node-handler.interface';

/**
 * Info Extractor returns `{ port, data: { config, output, meta } }` for
 * completed / single-turn success paths. The conversation waiting shape
 * (`{ status: 'waiting_for_input', conversationConfig, _multiTurnState }`)
 * is NOT wrapped. This helper normalises a completed result for tests.
 */
function unwrapFinal(raw: unknown): {
  port: string;
  config: Record<string, unknown>;
  output: Record<string, unknown>;
  meta: Record<string, unknown>;
} {
  const outer = raw as Record<string, unknown>;
  const port = outer.port as string;
  const data = outer.data as Record<string, unknown>;
  return {
    port,
    config: (data.config as Record<string, unknown>) ?? {},
    output: (data.output as Record<string, unknown>) ?? {},
    meta: (data.meta as Record<string, unknown>) ?? {},
  };
}

/**
 * Build a ChatResult-shaped object where the LLM calls `finalize_extraction`
 * with the given arguments. Used in multi-turn tests now that the handler
 * uses function calling instead of JSON content parsing.
 */
function finalizeCall(
  args: Record<string, unknown>,
  opts: {
    callId?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    model?: string;
  } = {},
): unknown {
  return {
    content: '',
    toolCalls: [
      {
        id: opts.callId ?? 'call-1',
        name: 'finalize_extraction',
        arguments: JSON.stringify(args),
      },
    ],
    usage: opts.usage ?? { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
    model: opts.model ?? 'gpt-4o',
    finishReason: 'tool_calls',
  };
}

/** Content-only response (LLM asks a followup, no tool call). */
function contentOnly(
  content: string,
  opts: {
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    model?: string;
  } = {},
): unknown {
  return {
    content,
    usage: opts.usage ?? { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
    model: opts.model ?? 'gpt-4o',
    finishReason: 'stop',
  };
}

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

    it('should pass with valid multi_turn config', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        inputField: '{{ $input.text }}',
        maxTurns: 5,
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

      const { port, output } = unwrapFinal(result);
      expect(port).toBe('out');
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
      const { output } = unwrapFinal(result);
      const extracted = output.extracted as Record<string, unknown>;
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
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: 'John', orderNumber: 'ORD-123' }),
      );

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John 주문 ORD-123',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const { port, output: outObj } = unwrapFinal(result);
      expect(port).toBe('completed');
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-123');
      expect(outObj.endReason).toBe('completed');
      expect(outObj.turnCount).toBe(1);
    });

    it('should enter waiting_for_input when required fields are missing', async () => {
      // LLM asks for the missing order number — content only, no tool call.
      mockLlmService.chat.mockResolvedValue(
        contentOnly('주문번호를 알려주세요'),
      );

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John 입니다',
          outputSchema: multiTurnSchema,
          maxTurns: 5,
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
      // Content-only responses don't touch partialResult — the LLM only
      // populates fields via the finalize_extraction tool.
      expect(state.partialResult).toEqual({});
    });

    it('should skip initial LLM call when inputField is empty', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: '',
          outputSchema: multiTurnSchema,
          maxTurns: 5,
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
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({
          senderName: 'John',
          orderNumber: 'ORD-1',
          amount: null,
        }),
      );

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John ORD-1',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const { output: outObj } = unwrapFinal(result);
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
        totalInputTokens: 100,
        totalOutputTokens: 30,
        ...overrides,
      };
    }

    it('should complete when remaining required fields are filled', async () => {
      // LLM calls finalize_extraction with the remaining required field.
      // senderName from prior turn's partialResult is preserved by mergePartial.
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: 'John', orderNumber: 'ORD-999' }),
      );

      const result = await handler.processMultiTurnMessage(
        'ORD-999 입니다',
        buildState(),
      );

      const { port, output: outObj } = unwrapFinal(result);
      expect(port).toBe('completed');
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-999');
      expect(outObj.endReason).toBe('completed');
      expect(outObj.turnCount).toBe(2);
    });

    it('should continue waiting when required fields still missing', async () => {
      mockLlmService.chat.mockResolvedValue(
        contentOnly('다시 주문번호를 알려주세요'),
      );

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
      mockLlmService.chat.mockResolvedValue(contentOnly('주문번호?'));

      const result = await handler.processMultiTurnMessage(
        '모르겠어요',
        buildState({ turnCount: 4, maxTurns: 5 }),
      );

      const { port, output: outObj } = unwrapFinal(result);
      expect(port).toBe('max_turns');
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(outObj.endReason).toBe('max_turns');
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBeNull();
    });
  });

  describe('collection retry loop', () => {
    const schema = [
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

    function retryState(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        workspaceId: 'ws-1',
        outputSchema: schema,
        instructions: '',
        examples: [],
        messages: [{ role: 'system', content: 'prompt' }],
        partialResult: { senderName: 'John', orderNumber: null },
        turnCount: 1,
        maxTurns: 10,
        collectionRetryCount: 0,
        maxCollectionRetries: 3,
        totalInputTokens: 50,
        totalOutputTokens: 20,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
        ...overrides,
      };
    }

    it('feeds tool_result back and loops when finalize is called with missing required', async () => {
      mockLlmService.chat
        // First: premature finalize missing orderNumber
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: 'John', orderNumber: null },
            { callId: 'c1' },
          ),
        )
        // Retry iteration: LLM corrects and re-calls with all fields
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: 'John', orderNumber: 'O-42' },
            { callId: 'c2' },
          ),
        );

      const result = await handler.processMultiTurnMessage(
        'ORD-42',
        retryState(),
      );

      const { port, output: outObj } = unwrapFinal(result);
      expect(port).toBe('completed');
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(extracted.orderNumber).toBe('O-42');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
    });

    it('routes to error port after exceeding maxCollectionRetries', async () => {
      // Every finalize call leaves orderNumber null.
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: null, orderNumber: null }),
      );

      const result = await handler.processMultiTurnMessage(
        'nope',
        retryState({ maxCollectionRetries: 2 }),
      );

      const { port, output: outObj } = unwrapFinal(result);
      expect(port).toBe('error');
      expect(outObj.endReason).toBe('max_retries');
      // initial + 2 retries = 3 chat calls total before giving up
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
    });

    it('appends a tool-role feedback message that carries missing fields', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: null, orderNumber: null },
            { callId: 'c1' },
          ),
        )
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: 'John', orderNumber: 'O-99' },
            { callId: 'c2' },
          ),
        );

      const result = await handler.processMultiTurnMessage(
        'sure',
        retryState(),
      );

      const { output: outObj } = unwrapFinal(result);
      const messages = outObj.messages as Array<{
        role: string;
        content: string;
        toolCallId?: string;
      }>;
      const feedback = messages.find(
        (m) =>
          m.role === 'tool' &&
          typeof m.content === 'string' &&
          m.content.includes('incomplete_extraction'),
      );
      expect(feedback).toBeDefined();
      expect(feedback?.toolCallId).toBe('c1');
    });

    it('treats content-only responses as waiting and leaves retry count untouched', async () => {
      mockLlmService.chat.mockResolvedValue(
        contentOnly('상품번호를 알려주세요'),
      );

      const result = await handler.processMultiTurnMessage(
        '123-ABC',
        retryState(),
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.collectionRetryCount).toBe(0);
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

      const { port, output: outObj, meta } = unwrapFinal(result);
      expect(port).toBe('user_ended');
      const extracted = outObj.extracted as Record<string, unknown>;
      expect(outObj.endReason).toBe('user_ended');
      expect(extracted.senderName).toBe('John');
      expect(meta.interactionType).toBe('ai_conversation');
    });
  });
});
