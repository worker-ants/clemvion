import { InformationExtractorHandler } from './information-extractor.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { adaptHandlerReturn } from '../../../modules/execution-engine/handler-output.adapter';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Handler returns the unified NodeHandlerOutput shape
 * `{ config, output, meta, port?, status?, _resumeState? }` for both
 * terminal and waiting states. Waiting carries
 * `output: { messages, message, turnCount, maxTurns, partial? }` per
 * CONVENTIONS §4.3 and `meta.interactionType: 'ai_conversation'` so the
 * persisted outputData is recognisable as a conversation snapshot.
 */
function asNodeHandlerOutput(raw: unknown): {
  config: Record<string, unknown>;
  output: Record<string, unknown>;
  meta: Record<string, unknown>;
  port: string | undefined;
  status: string | undefined;
} {
  const obj = raw as Record<string, unknown>;
  return {
    config: (obj.config as Record<string, unknown>) ?? {},
    output: (obj.output as Record<string, unknown>) ?? {},
    meta: (obj.meta as Record<string, unknown>) ?? {},
    port: obj.port as string | undefined,
    status: obj.status as string | undefined,
  };
}

function getResult(output: Record<string, unknown>): Record<string, unknown> {
  return (output.result as Record<string, unknown>) ?? {};
}

function getError(output: Record<string, unknown>): Record<string, unknown> {
  return (output.error as Record<string, unknown>) ?? {};
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
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
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
        model: 'gpt-4',
        inputField: '{{ $input.text }}',
        outputSchema: [
          { name: 'senderName', type: 'string', description: 'Name' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when multi_turn maxTurns is negative', () => {
      const result = handler.validate({
        model: 'gpt-4',
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
        model: 'gpt-4',
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
        model: 'gpt-4',
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

  describe('System Context Prefix (spec §11)', () => {
    it('prepends "## System Context" with current time + timezone to single-turn systemPrompt by default', async () => {
      const tzCtx: ExecutionContext = {
        ...context,
        variables: {
          __workspaceId: 'ws-1',
          __workspaceTimezone: 'Asia/Seoul',
        },
      };
      await handler.execute(
        { text: 'X' },
        {
          mode: 'single_turn',
          inputField: 'X',
          outputSchema: [{ name: 'name', type: 'string', description: '이름' }],
        },
        tzCtx,
      );
      const systemMsg = mockLlmService.chat.mock.calls[0][1].messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).toMatch(/^## System Context\n/);
      expect(systemMsg.content).toContain('Timezone: Asia/Seoul (UTC+9)');
    });

    it('skips the prefix when includeSystemContext: false', async () => {
      await handler.execute(
        { text: 'X' },
        {
          mode: 'single_turn',
          inputField: 'X',
          outputSchema: [{ name: 'name', type: 'string', description: '이름' }],
          includeSystemContext: false,
        },
        context,
      );
      const systemMsg = mockLlmService.chat.mock.calls[0][1].messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).not.toContain('## System Context');
    });
  });

  describe('execute (single_turn)', () => {
    it('extracts structured data and returns output.result.extracted', async () => {
      const rawResult = await handler.execute(
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

      const { config, output, meta, port, status } =
        asNodeHandlerOutput(rawResult);
      expect(port).toBe('out');
      expect(status).toBe('ended');
      expect(config.mode).toBe('single_turn');

      const result = getResult(output);
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-123');
      expect(result.endReason).toBe('out');
      expect(result.turnCount).toBe(1);
      expect(result.originalInput).toBe('Email from John about order ORD-123');

      // Tokens / debug trace live on meta, not output.
      expect(meta.model).toBe('gpt-4o');
      expect(meta.totalTokens).toBe(120);
      expect(Array.isArray(meta.turnDebug)).toBe(true);
      expect(meta.interactionType).toBeUndefined();
      expect(typeof meta.durationMs).toBe('number');

      // Ensure the legacy nested paths are gone.
      expect(output.extracted).toBeUndefined();
      expect(output._llmCalls).toBeUndefined();
    });

    it('retries JSON parse failure and succeeds on subsequent attempt', async () => {
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

      const rawResult = await handler.execute(
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

      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      const { output } = asNodeHandlerOutput(rawResult);
      const extracted = getResult(output).extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('Alice');
    });

    it('routes to error port with output.error after retries exhausted', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: 'always invalid json {{{',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const rawResult = await handler.execute(
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
      );

      const { output, port, status } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('error');
      expect(status).toBe('ended');

      const err = getError(output);
      expect(err.code).toBe('LLM_RESPONSE_INVALID');
      expect(typeof err.message).toBe('string');
      const details = err.details as Record<string, unknown>;
      expect(details.attempts).toBe(3);
      expect(details.originalInput).toBe('test input');
      expect(output.result).toBeUndefined();

      // 1 initial + 2 retries = 3 calls total
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
    });

    it('routes to error port with LLM_CALL_FAILED when provider throws', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('network down'));

      const rawResult = await handler.execute(
        {},
        {
          inputField: 'x',
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
      );

      const { output, port } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('error');
      const err = getError(output);
      expect(err.code).toBe('LLM_CALL_FAILED');
      expect(err.message).toBe('network down');
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

    it('completes in first turn with output.result shape', async () => {
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: 'John', orderNumber: 'ORD-123' }),
      );

      const rawResult = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John 주문 ORD-123',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const { output, port, status, meta } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('completed');
      expect(status).toBe('ended');

      const result = getResult(output);
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-123');
      expect(result.endReason).toBe('completed');
      expect(result.turnCount).toBe(1);
      expect(Array.isArray(result.messages)).toBe(true);

      expect(meta.collectionRetryCount).toBe(0);
      expect(Array.isArray(meta.turnDebug)).toBe(true);
      expect(meta.interactionType).toBeUndefined();
    });

    it('enters waiting_for_input when required fields are missing', async () => {
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

      const output = result as unknown as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // Canonical NodeHandlerOutput shape (CONVENTIONS §4.3 + Principle 0).
      expect('type' in output).toBe(false);
      expect('interactionType' in output).toBe(false);
      expect('conversationConfig' in output).toBe(false);
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');

      // D6 (2026-05-17) — waiting `output.result.*` 단일 경로.
      // `partial` 은 result/partial 의미 분리로 별도 슬롯 유지.
      const outBody = output.output as Record<string, unknown>;
      const conv = outBody.result as Record<string, unknown>;
      expect(conv.message).toBe('주문번호를 알려주세요');
      expect(conv.turnCount).toBe(1);
      expect(conv.maxTurns).toBe(5);
      const partial = outBody.partial as Record<string, unknown>;
      expect(partial.extracted).toBeDefined();
      const state = output._resumeState as Record<string, unknown>;
      expect(state.turnCount).toBe(1);
      expect(state.partialResult).toEqual({});
    });

    it('canonical waiting shape passes adaptHandlerReturn under NODE_ENV=production', async () => {
      // Regression: pre-migration the handler returned a bare object that
      // failed the production-strict validation in adaptHandlerReturn.
      mockLlmService.chat.mockResolvedValue(
        contentOnly('주문번호를 알려주세요'),
      );
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
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
        expect(() => adaptHandlerReturn(result)).not.toThrow();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('skips initial LLM call when inputField is empty', async () => {
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
      const output = result as unknown as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // D6 — waiting `output.result.*` 단일 경로.
      const conv = (output.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(conv.turnCount).toBe(0);
      const state = output._resumeState as Record<string, unknown>;
      expect(state.turnCount).toBe(0);
      const messages = state.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });

    it('accepts optional fields being null and completes', async () => {
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({
          senderName: 'John',
          orderNumber: 'ORD-1',
          amount: null,
        }),
      );

      const rawResult = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          inputField: 'John ORD-1',
          outputSchema: multiTurnSchema,
        },
        context,
      );

      const { output } = asNodeHandlerOutput(rawResult);
      const result = getResult(output);
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.amount).toBeNull();
      expect(result.endReason).toBe('completed');
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

    it('hydrateState round-trip preserves rawConfig (resumed turn surfaces raw echo)', async () => {
      // Multi-turn resumes go: DB JSONB → engine.handleResume → handler.
      // processMultiTurnMessage(state) → hydrateState(state) → ... → echo
      // through `multiTurnConfigEcho`. The engine merges node.config into
      // resumeState if absent (execution-engine.service.ts:~1838), but the
      // handler must also propagate an explicitly-stored rawConfig field.
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: 'John', orderNumber: 'ORD-999' }),
      );

      const stateWithRawConfig = buildState({
        rawConfig: {
          mode: 'multi_turn',
          model: '{{ vars.model }}',
          outputSchema: multiTurnSchema,
          instructions: '{{ vars.instructions }}',
          examples: [],
          inputField: '{{ $node["X"].output.message }}',
          maxTurns: 7,
          maxCollectionRetries: 2,
        },
      });

      const rawResult = await handler.processMultiTurnMessage(
        'ORD-999 입니다',
        stateWithRawConfig,
      );

      const { config } = asNodeHandlerOutput(rawResult);
      expect(config.model).toBe('{{ vars.model }}');
      expect(config.instructions).toBe('{{ vars.instructions }}');
      expect(config.inputField).toBe('{{ $node["X"].output.message }}');
      expect(config.maxTurns).toBe(7);
      expect(config.maxCollectionRetries).toBe(2);
    });

    it('completes when remaining required fields are filled', async () => {
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: 'John', orderNumber: 'ORD-999' }),
      );

      const rawResult = await handler.processMultiTurnMessage(
        'ORD-999 입니다',
        buildState(),
      );

      const { output, port } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('completed');
      const result = getResult(output);
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(extracted.orderNumber).toBe('ORD-999');
      expect(result.endReason).toBe('completed');
      expect(result.turnCount).toBe(2);
    });

    it('continues waiting when required fields still missing', async () => {
      mockLlmService.chat.mockResolvedValue(
        contentOnly('다시 주문번호를 알려주세요'),
      );

      const result = await handler.processMultiTurnMessage(
        '음 모르겠어요',
        buildState(),
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // D6 — resumed waiting `output.result.*` 단일 경로.
      const conv = (output.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(conv.message).toBe('다시 주문번호를 알려주세요');
      expect(conv.turnCount).toBe(2);
    });

    it('returns max_turns endReason when turnCount reaches maxTurns', async () => {
      mockLlmService.chat.mockResolvedValue(contentOnly('주문번호?'));

      const rawResult = await handler.processMultiTurnMessage(
        '모르겠어요',
        buildState({ turnCount: 4, maxTurns: 5 }),
      );

      const { output, port } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('max_turns');
      const result = getResult(output);
      expect(result.endReason).toBe('max_turns');
      const extracted = result.extracted as Record<string, unknown>;
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
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: 'John', orderNumber: null },
            { callId: 'c1' },
          ),
        )
        .mockResolvedValueOnce(
          finalizeCall(
            { senderName: 'John', orderNumber: 'O-42' },
            { callId: 'c2' },
          ),
        );

      const rawResult = await handler.processMultiTurnMessage(
        'ORD-42',
        retryState(),
      );

      const { output, port } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('completed');
      const extracted = getResult(output).extracted as Record<string, unknown>;
      expect(extracted.orderNumber).toBe('O-42');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
    });

    it('routes to error port after exceeding maxCollectionRetries', async () => {
      mockLlmService.chat.mockResolvedValue(
        finalizeCall({ senderName: null, orderNumber: null }),
      );

      const rawResult = await handler.processMultiTurnMessage(
        'nope',
        retryState({ maxCollectionRetries: 2 }),
      );

      const { output, port } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('error');

      // Both error and result coexist on max_retries (partial result preserved).
      const err = getError(output);
      expect(err.code).toBe('MAX_COLLECTION_RETRIES_EXCEEDED');
      const errDetails = err.details as Record<string, unknown>;
      expect(errDetails.turnCount).toBe(2);
      expect(errDetails.collectionRetryCount).toBe(3);
      expect(Array.isArray(errDetails.missingFields)).toBe(true);

      const result = getResult(output);
      expect(result.endReason).toBe('max_retries');
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.orderNumber).toBeNull();

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

      const rawResult = await handler.processMultiTurnMessage(
        'sure',
        retryState(),
      );

      const { output } = asNodeHandlerOutput(rawResult);
      const messages = getResult(output).messages as Array<{
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
      const conv = output.output as Record<string, unknown>;
      const partial = conv.partial as Record<string, unknown>;
      expect(partial.collectionRetryCount).toBe(0);
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    it('builds output with user_ended reason', () => {
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
        maxTurns: 10,
        maxCollectionRetries: 3,
        collectionRetryCount: 0,
        totalInputTokens: 100,
        totalOutputTokens: 30,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
      };

      const rawResult = handler.buildMultiTurnFinalOutput(
        state as never,
        'user_ended',
      );

      const { output, port, status, meta } = asNodeHandlerOutput(rawResult);
      expect(port).toBe('user_ended');
      expect(status).toBe('ended');
      const result = getResult(output);
      expect(result.endReason).toBe('user_ended');
      const extracted = result.extracted as Record<string, unknown>;
      expect(extracted.senderName).toBe('John');
      expect(meta.interactionType).toBeUndefined();
      expect(typeof meta.durationMs).toBe('number');
    });

    it('echoes rawConfig (model / instructions / inputField templates) when state carries it', () => {
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
        maxTurns: 10,
        maxCollectionRetries: 3,
        collectionRetryCount: 0,
        totalInputTokens: 100,
        totalOutputTokens: 30,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
        instructions: 'extract',
        examples: [],
        rawConfig: {
          mode: 'multi_turn' as const,
          model: '{{ vars.model }}',
          outputSchema: [
            {
              name: 'senderName',
              type: 'string',
              description: 'Name',
              required: true,
            },
          ],
          instructions: '{{ vars.instructions }}',
          examples: [{ input: 'a', output: { senderName: 'a' } }],
          inputField: '{{ $node["X"].output.message }}',
          maxTurns: 7,
          maxCollectionRetries: 2,
        },
      };

      const rawResult = handler.buildMultiTurnFinalOutput(
        state as never,
        'completed',
      );

      const { config } = asNodeHandlerOutput(rawResult);
      expect(config.model).toBe('{{ vars.model }}');
      expect(config.instructions).toBe('{{ vars.instructions }}');
      expect(config.inputField).toBe('{{ $node["X"].output.message }}');
      expect(config.maxTurns).toBe(7);
      expect(config.maxCollectionRetries).toBe(2);
      expect(config.examples).toEqual([
        { input: 'a', output: { senderName: 'a' } },
      ]);
    });

    it('falls back to evaluated state values when rawConfig is omitted', () => {
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
        partialResult: {},
        messages: [],
        turnCount: 0,
        maxTurns: 9,
        maxCollectionRetries: 4,
        collectionRetryCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
        instructions: 'fallback-instructions',
        examples: [],
      };

      const rawResult = handler.buildMultiTurnFinalOutput(
        state as never,
        'user_ended',
      );

      const { config } = asNodeHandlerOutput(rawResult);
      expect(config.mode).toBe('multi_turn');
      expect(config.model).toBe('gpt-4o');
      expect(config.instructions).toBe('fallback-instructions');
      expect(config.maxTurns).toBe(9);
      expect(config.maxCollectionRetries).toBe(4);
      expect(config.inputField).toBeUndefined();
    });
  });
});
