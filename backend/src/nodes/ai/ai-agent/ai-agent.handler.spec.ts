import { AiAgentHandler } from './ai-agent.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { KbToolProvider, kbToolName } from './tool-providers/kb-tool-provider';
import { adaptHandlerReturn } from '../../../modules/execution-engine/handler-output.adapter';

describe('AiAgentHandler', () => {
  let handler: AiAgentHandler;
  let mockLlmService: Record<string, jest.Mock>;
  let mockRagService: { search: jest.Mock };
  let mockKbService: { findById: jest.Mock };
  let mockWebsocketService: { emitExecutionEvent: jest.Mock };
  let kbProvider: KbToolProvider;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn().mockResolvedValue({
        content: 'Hello! I am an AI assistant.',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    mockRagService = { search: jest.fn().mockResolvedValue([]) };
    mockKbService = {
      findById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve({ id, name: `KB ${id}`, description: '' }),
        ),
    };
    kbProvider = new KbToolProvider(
      mockRagService as never,
      mockKbService as never,
    );

    mockWebsocketService = { emitExecutionEvent: jest.fn() };

    handler = new AiAgentHandler(
      mockLlmService as never,
      [kbProvider],
      mockWebsocketService as never,
    );
  });

  const baseContext: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };

  describe('validate', () => {
    it('should fail when no prompts are provided', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "ai_agent:single-turn-needs-prompt" fires.
      expect(result.errors.some((e) => e.includes('System Prompt'))).toBe(true);
    });

    it('should pass with systemPrompt + provider', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(true);
    });

    it('should pass with userPrompt + provider', () => {
      const result = handler.validate({
        userPrompt: 'Hello',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate multi_turn mode with invalid maxTurns', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        mode: 'multi_turn',
        maxTurns: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'maxTurns must be 0 (unlimited) or a positive integer',
      );
    });

    it('should pass multi_turn mode with valid settings', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        mode: 'multi_turn',
        maxTurns: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail multi_turn without systemPrompt', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Multi Turn 모드에서는 System Prompt 가 필요합니다." fires.
      expect(result.errors.some((e) => e.includes('Multi Turn'))).toBe(true);
    });
  });

  describe('execute - single_turn', () => {
    it('should call LLM and return response', async () => {
      const result = await handler.execute(
        { question: 'What is AI?' },
        {
          systemPrompt: 'You are helpful',
          userPrompt: 'What is AI?',
        },
        baseContext,
      );

      expect(mockLlmService.chat).toHaveBeenCalled();
      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello! I am an AI assistant.');
      expect(r.meta).toBeDefined();
      expect(r.status).toBe('ended');
    });

    it('should NOT pre-search KB on first call (LLM decides via tool)', async () => {
      // KB 가 등록돼도 핸들러는 더 이상 LLM 호출 전에 검색을 강제하지 않는다.
      // LLM 이 small-talk 라고 판단해 toolCalls=[] 만 반환하면 검색은 0회.
      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Hi',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      expect(mockRagService.search).not.toHaveBeenCalled();
      const meta = readSingleTurnMeta(handler)(
        await handler.execute(
          {},
          {
            systemPrompt: 'Helper',
            userPrompt: 'Hi',
            knowledgeBases: ['kb-1'],
          },
          baseContext,
        ),
      );
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(false);
    });

    it('exposes a kb_ tool to the LLM when knowledgeBases are configured', async () => {
      mockKbService.findById.mockResolvedValueOnce({
        id: 'kb-1',
        name: 'Refund Policy',
        description: 'How refunds work',
      });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Anything refundable?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const kbTool = tools.find((t: { name: string }) =>
        t.name.startsWith('kb_'),
      );
      expect(kbTool).toBeDefined();
      expect(kbTool.name).toBe(kbToolName('kb-1'));
      expect(kbTool.description).toContain('Refund Policy');
    });

    it('executes a kb_ tool call and feeds result back to the LLM', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'refund.md',
          content: '14-day refund window.',
          score: 0.9,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-kb-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refund window"}',
            },
          ],
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You have 14 days to request a refund.',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'When can I request a refund?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledWith(
        'refund window',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );

      // 두 번째 LLM 호출에는 tool_result 메시지가 포함돼야 한다.
      const secondCall = mockLlmService.chat.mock.calls[1];
      const messages = secondCall[1].messages;
      const toolMsg = messages.find((m: { role: string }) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      const toolPayload = JSON.parse(toolMsg.content);
      expect(toolPayload.results[0].source).toBe('refund.md');

      const meta = (result.meta ?? {}) as Record<string, unknown>;
      expect(meta.toolCalls).toBe(1);
      expect((meta.ragSources as unknown[]).length).toBe(1);
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(true);
      expect(diag.searchedKbCount).toBe(1);
      expect(diag.resultCount).toBe(1);
    });

    it('runs parallel kb_ tool calls when LLM emits multiple in one response', async () => {
      mockRagService.search.mockImplementation((q: string) =>
        Promise.resolve([
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ]),
      );

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-a'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-b'),
              arguments: '{"query":"beta"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Combined answer.',
          usage: { inputTokens: 30, outputTokens: 15, totalTokens: 45 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Tell me about alpha and beta',
          knowledgeBases: ['kb-a', 'kb-b'],
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledTimes(2);
      const meta = (result.meta ?? {}) as Record<string, unknown>;
      expect(meta.toolCalls).toBe(2);
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.searchedKbCount).toBe(2);
      expect((diag.queriesUsed as string[]).sort()).toEqual(['alpha', 'beta']);
    });

    it('supports re-search across iterations until maxToolCalls is reached', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'first',
          score: 0.7,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"first"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-2',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refined"}',
            },
          ],
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Final.',
          usage: { inputTokens: 25, outputTokens: 5, totalTokens: 30 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Tell me',
          knowledgeBases: ['kb-1'],
          maxToolCalls: 5,
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledTimes(2);
      const meta = (result.meta ?? {}) as Record<string, unknown>;
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.queriesUsed as string[]).toEqual(['first', 'refined']);
    });

    it('stops the tool loop once maxToolCalls is reached', async () => {
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat.mockResolvedValue({
        content: null,
        toolCalls: [
          {
            id: 'tc-x',
            name: kbToolName('kb-1'),
            arguments: '{"query":"x"}',
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Q',
          knowledgeBases: ['kb-1'],
          maxToolCalls: 2,
        },
        baseContext,
      )) as Record<string, unknown>;

      // chat invoked: initial + 2 loop iterations (until count == max), then exits.
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
      const meta = (result.meta ?? {}) as Record<string, unknown>;
      expect(meta.toolCalls).toBe(2);
    });

    it('should parse JSON response when responseFormat is json', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: '{"answer": "42"}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          userPrompt: 'answer',
          responseFormat: 'json',
        },
        baseContext,
      );

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toEqual({ answer: '42' });
    });

    it('should fallback to raw string when JSON parse fails', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: 'not valid json {{{',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          userPrompt: 'answer',
          responseFormat: 'json',
        },
        baseContext,
      );

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('not valid json {{{');
    });

    it('should default to single_turn when mode is not set', async () => {
      const result = await handler.execute(
        {},
        { userPrompt: 'Hello' },
        baseContext,
      );

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBeDefined();
      // Stage 5: single_turn now emits `status:'ended'` for observability.
      expect(r.status).toBe('ended');
    });
  });

  describe('execute - multi_turn', () => {
    // multi_turn 의 첫 메시지는 항상 사용자가 채팅 UI 에서 입력한다.
    // config.userPrompt 는 single_turn 전용이며, 여기서 LLM 호출을 trigger
    // 하지 않는다 (mode 전환 시 leak 된 값일 수도 있어 server-side 에서도
    // 무시 — frontend clearFields 와 함께 두 계층에서 차단).
    it('returns waiting_for_input immediately without calling LLM', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          maxTurns: 10,
        },
        baseContext,
      );

      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // Canonical NodeHandlerOutput shape — top-level type/conversationConfig
      // are no longer present (CONVENTIONS §4.3 + Principle 0).
      expect('type' in output).toBe(false);
      expect('interactionType' in output).toBe(false);
      expect('conversationConfig' in output).toBe(false);
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');

      const config = output.config as Record<string, unknown>;
      expect(config.mode).toBe('multi_turn');
      expect(config.maxTurns).toBe(10);

      const conv = output.output as Record<string, unknown>;
      expect(conv.turnCount).toBe(0);
      expect(conv.message).toBe('');
      expect(conv.messages).toHaveLength(1); // system only
      expect(conv.maxTurns).toBe(10);

      const state = output._resumeState as Record<string, unknown>;
      expect(state.turnCount).toBe(0);
      expect(state.totalInputTokens).toBe(0);
      expect(state.totalOutputTokens).toBe(0);
    });

    it('ignores leaked userPrompt from a previous single_turn config', async () => {
      // Regression: mode 를 single_turn → multi_turn 으로 전환 시 frontend
      // clearFields 가 동작하지 않은 옛 워크플로 (또는 backend 직접 invoke)
      // 의 leak 된 userPrompt 가 들어와도 LLM 호출이 trigger 되지 않아야 한다.
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'leaked prompt that must NOT trigger an LLM call',
          maxTurns: 10,
        },
        baseContext,
      );

      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      const conv = output.output as Record<string, unknown>;
      expect(conv.turnCount).toBe(0);
      // 시스템 메시지만 있고 user 메시지는 push 되지 않는다.
      expect(conv.messages).toHaveLength(1);
      const onlyMsg = (conv.messages as Array<Record<string, unknown>>)[0];
      expect(onlyMsg.role).toBe('system');
    });

    it('canonical waiting shape passes adaptHandlerReturn under NODE_ENV=production', async () => {
      // Regression: pre-migration the handler returned a bare object that
      // failed the production-strict validation in adaptHandlerReturn.
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const result = await handler.execute(
          {},
          { mode: 'multi_turn', systemPrompt: 'sp', maxTurns: 5 },
          baseContext,
        );
        expect(() => adaptHandlerReturn(result)).not.toThrow();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('does not pre-search KB on first turn even when KB is configured', async () => {
      // multi_turn 첫 turn 에서는 LLM 호출 자체가 없으므로 KB tool 호출도 0회.
      // KB 검색은 사용자가 첫 메시지를 보낸 후 processMultiTurnMessage 에서
      // LLM 이 능동 호출할 때 일어난다.
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'Helper',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      expect(mockRagService.search).not.toHaveBeenCalled();
      const output = result as Record<string, unknown>;
      const state = output._resumeState as Record<string, unknown>;
      expect((state.ragSources as unknown[]).length).toBe(0);
    });
  });

  describe('processMultiTurnMessage', () => {
    it('should process user message and return waiting_for_input', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure, I can help with that.',
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Can you help me?',
        state,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect('conversationConfig' in output).toBe(false);
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');

      const conv = output.output as Record<string, unknown>;
      expect(conv.message).toBe('Sure, I can help with that.');
      expect(conv.turnCount).toBe(2);

      const newState = output._resumeState as Record<string, unknown>;
      expect(newState.turnCount).toBe(2);
      expect(newState.totalInputTokens).toBe(250);
      expect(newState.totalOutputTokens).toBe(80);
    });

    it('should include debug fields (lastTurnRequest, lastTurnResponse, lastTurnDurationMs)', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 1024,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      const llmResponse = {
        content: 'Response text',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      };
      mockLlmService.chat.mockResolvedValue(llmResponse);

      const result = await handler.processMultiTurnMessage('Hi again', state);

      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      expect(newState.lastTurnRequest).toBeDefined();
      expect(newState.lastTurnRequest).toEqual(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.5,
          maxTokens: 1024,
          tools: undefined,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hi again' }),
          ]),
        }),
      );
      expect(newState.lastTurnResponse).toBeDefined();
      expect(
        (newState.lastTurnResponse as Record<string, unknown>).content,
      ).toBe('Response text');
      expect(typeof newState.lastTurnDurationMs).toBe('number');
      expect(newState.lastTurnDurationMs as number).toBeGreaterThanOrEqual(0);
    });

    it('should not mutate the original messages array', async () => {
      const originalMessages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: originalMessages,
        turnCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Reply',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('New message', state);

      // Original array should not be mutated
      expect(originalMessages).toHaveLength(3);
    });

    it('should return final output when maxTurns is reached', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 2,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Goodbye!',
        usage: { inputTokens: 150, outputTokens: 20, totalTokens: 170 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Last message',
        state,
      );

      const r = result as Record<string, unknown>;
      // Stage 5: terminal multi-turn emits unified shape with status:'ended'.
      expect(r.status).toBe('ended');
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Goodbye!');
      expect(res.endReason).toBe('max_turns');
      expect(res.turnCount).toBe(2);
      expect(res.messages).toBeDefined();
    });

    it('does NOT auto-search KB when user follows up — LLM decides via kb_ tool', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure, I am here.',
        usage: { inputTokens: 200, outputTokens: 40, totalTokens: 240 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('Just chatting', state);

      // No tool call from the LLM means no KB search happens.
      expect(mockRagService.search).not.toHaveBeenCalled();
    });

    it('processes a follow-up kb_ tool call and accumulates ragSources across turns', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c2',
          documentId: 'd1',
          documentName: 'doc',
          content: 'New context',
          score: 0.85,
          metadata: {},
        },
      ]);

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-x',
              name: kbToolName('kb-1'),
              arguments: '{"query":"X"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Based on KB...',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage(
        'Tell me about X',
        state,
      );

      expect(mockRagService.search).toHaveBeenCalledWith(
        'X',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // Carries the previous ragSources entry plus the new one.
      expect((newState.ragSources as unknown[]).length).toBe(2);

      // turnDebugHistory 의 최신 항목에는 이번 턴에 호출된 KB delta 만 담긴다
      // (직전 턴의 c-prev 는 포함되지 않아 노드 누적과 분리 노출됨).
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      expect(lastTurn.turnIndex).toBe(2);
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(1);
      expect(turnSources[0].chunkId).toBe('c2');
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.attempted).toBe(true);
      expect(turnDiag.searchedKbCount).toBe(1);
      expect(turnDiag.queriesUsed).toEqual(['X']);
    });

    it('dedupes ragSources by chunkId across turns (no React key collision)', async () => {
      // Multi-turn conversations where the LLM re-queries the same KB chunk
      // used to push the duplicate into ragSources, which surfaced as a
      // duplicate-key warning on `<li key={s.chunkId}>` in the References tab.
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c-prev',
          documentId: 'd1',
          documentName: 'doc',
          content: 'Same chunk re-fetched',
          score: 0.9,
          metadata: {},
        },
      ]);

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-dup',
              name: kbToolName('kb-1'),
              arguments: '{"query":"again"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'OK',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage('Again', state);
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // Node-level accumulator deduped: still just c-prev once.
      expect((newState.ragSources as unknown[]).length).toBe(1);
      // But the turn delta still records this turn's match for grouping.
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(1);
      expect(turnSources[0].chunkId).toBe('c-prev');
    });

    it('accumulates multiple KB tool calls within the same turn into turnDebug delta', async () => {
      mockRagService.search.mockImplementation((q: string) =>
        Promise.resolve([
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ]),
      );

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-a', 'kb-b'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-a'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-b'),
              arguments: '{"query":"beta"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Combined.',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage(
        'Tell me alpha and beta',
        state,
      );
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(2);
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.searchedKbCount).toBe(2);
      expect((turnDiag.queriesUsed as string[]).sort()).toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('emits turnDebug with empty ragSources when LLM does not call KB', async () => {
      // small-talk 턴은 KB tool 을 호출하지 않으므로 turnDebug.ragSources = []
      // 가 되어야 한다 (전체 누적과 무관하게 turn delta 만 분리 노출).
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure thing.',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Just chatting',
        state,
      );

      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // 노드 누적은 직전 턴의 c-prev 가 그대로 보존된다.
      expect((newState.ragSources as unknown[]).length).toBe(1);
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      expect(lastTurn.ragSources).toEqual([]);
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.attempted).toBe(false);
    });
  });

  describe('single-turn turnDebug ragSources', () => {
    it('emits turnDebug[0] with empty ragSources when LLM responds directly (no KB)', async () => {
      // small-talk 대화: knowledgeBases 가 비어있고 LLM 도 KB tool 을 호출하지
      // 않는 경우 turnDebug[0].ragSources === [], ragDiagnostics.attempted === false
      // 가 되어야 한다 (skipReason='empty_kb_list').
      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Hi!',
        },
        baseContext,
      )) as Record<string, unknown>;
      const meta = (result.meta ?? {}) as Record<string, unknown>;
      const turnDebug = meta.turnDebug as Array<Record<string, unknown>>;
      expect(turnDebug).toHaveLength(1);
      expect(turnDebug[0].ragSources).toEqual([]);
      const diag = turnDebug[0].ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(false);
      expect(diag.skipReason).toBe('empty_kb_list');
    });

    it('exposes turn-level ragSources in turnDebug[0] for single_turn KB call', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'refund.md',
          content: '14-day refund window.',
          score: 0.9,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-kb-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refund window"}',
            },
          ],
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You have 14 days.',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'When can I request a refund?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as Record<string, unknown>;

      const meta = (result.meta ?? {}) as Record<string, unknown>;
      const turnDebug = meta.turnDebug as Array<Record<string, unknown>>;
      expect(turnDebug).toHaveLength(1);
      expect(turnDebug[0].turnIndex).toBe(1);
      const sources = turnDebug[0].ragSources as Array<Record<string, unknown>>;
      expect(sources).toHaveLength(1);
      expect(sources[0].chunkId).toBe('c1');
      const diag = turnDebug[0].ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(true);
      expect(diag.searchedKbCount).toBe(1);
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    it('should build correct final output structure', () => {
      const messages = [
        { role: 'system' as const, content: 'System' },
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' },
      ];

      const result = handler.buildMultiTurnFinalOutput(
        messages,
        'Hello!',
        3,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 500,
          totalOutputTokens: 200,
          toolCalls: 1,
          ragSources: [],
        },
      );

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello!');
      expect(res.turnCount).toBe(3);
      expect(res.endReason).toBe('user_ended');
      expect(res.messages as unknown[]).toHaveLength(3);

      const meta = r.meta as Record<string, unknown>;
      expect(meta.model).toBe('gpt-4o');
      expect(meta.inputTokens).toBe(500);
      expect(meta.outputTokens).toBe(200);
      expect(meta.totalTokens).toBe(700);
      expect(meta.toolCalls).toBe(1);
    });
  });

  // ===== Conditions feature =====

  describe('validate - conditions', () => {
    it('should pass with valid conditions', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          {
            id: 'cond-uuid-1',
            label: 'Refund',
            prompt: 'Customer wants a refund',
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when condition is missing label', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          { id: 'cond-uuid-1', label: '', prompt: 'Customer wants a refund' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('label');
    });

    it('should fail when condition is missing prompt', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'cond-uuid-1', label: 'Refund', prompt: '' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('prompt');
    });

    it('should fail when condition is missing id', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          { id: '', label: 'Refund', prompt: 'Customer wants a refund' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('id');
    });

    it('should fail when condition id conflicts with reserved port name', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'out', label: 'Conflict', prompt: 'test' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('reserved');
    });

    it('should fail when prompt exceeds 2000 characters', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'cond-1', label: 'Long', prompt: 'a'.repeat(2001) }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('2000');
    });

    it('should fail when more than 20 conditions', () => {
      const conditions = Array.from({ length: 21 }, (_, i) => ({
        id: `cond-${i}`,
        label: `C${i}`,
        prompt: `Condition ${i}`,
      }));
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions,
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Conditions 는 최대 20개까지 추가할 수 있습니다." fires.
      expect(result.errors.some((e) => e.includes('20'))).toBe(true);
    });
  });

  describe('buildTools - tool naming', () => {
    it('should use cond_ prefix for condition tools', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          systemPrompt: 'Be helpful',
          conditions: [
            { id: 'abc-123', label: 'Test', prompt: 'Test condition' },
          ],
        },
        baseContext,
      );
      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const condTool = tools.find(
        (t: { name: string }) => t.name === 'cond_abc_123',
      );
      expect(condTool).toBeDefined();
      expect(condTool.description).toBe('Test condition');
    });
  });

  // 스키마 .passthrough() 호환성 가드 — 도구 연결 두 필드는 스키마에서 제거됐지만
  // DB 의 legacy workflow 데이터에는 여전히 toolNodeIds/toolOverrides 가 남아 있을
  // 수 있다. 핸들러는 이를 읽지 않고 일반 도구(`tool_*`)를 LLM 에 등록하지 않는다.
  // 도구 연결 입력 경로 재작성 시 새 필드 기준으로 본 블록 갱신 또는 제거.
  describe('legacy passthrough: tool connection inputs', () => {
    it('ignores legacy toolNodeIds in config (no normal tools registered to LLM)', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          toolNodeIds: ['abc12345-full-node-id'],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name.startsWith('tool_'))).toBeUndefined();
    });

    it('ignores legacy toolOverrides in config', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          toolNodeIds: ['abc12345-full-node-id'],
          toolOverrides: [
            {
              nodeId: 'abc12345-full-node-id',
              toolName: 'custom_name',
              toolDescription: 'custom desc',
            },
          ],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name === 'custom_name')).toBeUndefined();
    });

    it('preserves condition tools alongside legacy passthrough (regression check)', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          systemPrompt: 'Be helpful',
          toolNodeIds: ['abc12345-full-node-id'],
          conditions: [
            { id: 'cond-x', label: 'Test', prompt: 'Test condition' },
          ],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name === 'cond_cond_x')).toBeDefined();
      expect(tools.find((t) => t.name.startsWith('tool_'))).toBeUndefined();
    });
  });

  describe('conditions - single_turn', () => {
    const conditionConfig = {
      userPrompt: 'I want a refund',
      systemPrompt: 'You are a support agent',
      conditions: [
        {
          id: 'a1b2c3d4-refund',
          label: 'Refund',
          prompt: 'Customer requests a refund',
        },
        {
          id: 'e5f6g7h8-escalate',
          label: 'Escalation',
          prompt: 'Issue needs expert help',
        },
      ],
    };

    it('should register condition tools with condition id as name', async () => {
      await handler.execute({}, conditionConfig, baseContext);

      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const condTools = tools.filter(
        (t: { name: string }) =>
          t.name === 'cond_a1b2c3d4_refund' ||
          t.name === 'cond_e5f6g7h8_escalate',
      );
      expect(condTools).toHaveLength(2);
      expect(condTools[0].description).toBe('Customer requests a refund');
      expect(condTools[1].description).toBe('Issue needs expert help');
    });

    it('should inject condition instructions into system prompt', async () => {
      await handler.execute({}, conditionConfig, baseContext);

      const chatCall = mockLlmService.chat.mock.calls[0];
      const messages = chatCall[1].messages;
      const systemMsg = messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).toContain('조건');
    });

    it('should route to condition port when LLM calls only condition tool', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'I will process your refund.',
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cond_a1b2c3d4_refund',
            arguments: '{"reason":"Customer explicitly asked for refund"}',
          },
        ],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as Record<string, unknown>;

      expect(result.port).toBe('a1b2c3d4-refund');
      expect(result.status).toBe('ended');
      // Stage 5: condition-triggered output follows unified shape:
      // { output: { result: { ..., condition:{id,label,reason} } }, meta, port, status }
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.condition).toBeDefined();
      const condition = res.condition as Record<string, unknown>;
      expect(condition.id).toBe('a1b2c3d4-refund');
      expect(condition.label).toBe('Refund');
    });

    it('should select first-defined condition when multiple conditions are called', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'Multiple conditions detected.',
        toolCalls: [
          { id: 'tc-1', name: 'cond_e5f6g7h8_escalate', arguments: '{}' },
          { id: 'tc-2', name: 'cond_a1b2c3d4_refund', arguments: '{}' },
        ],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as Record<string, unknown>;

      // a1b2c3d4-refund is first in conditions array (index 0)
      expect(result.port).toBe('a1b2c3d4-refund');
    });

    it('should return normal output via out port when no condition is triggered', async () => {
      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as Record<string, unknown>;

      // Default mock returns no toolCalls, so should go to the normal
      // `out` port (single-turn unified shape).
      expect(result.port).toBe('out');
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello! I am an AI assistant.');
    });
  });

  describe('conditions - multi_turn', () => {
    it('should route to condition port when condition triggered during processMultiTurnMessage', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
        conditions: [
          {
            id: 'a1b2c3d4-refund',
            label: 'Refund',
            prompt: 'Customer wants refund',
          },
        ],
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'I will process your refund.',
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cond_a1b2c3d4_refund',
            arguments: '{"reason":"refund request"}',
          },
        ],
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.processMultiTurnMessage(
        'I want a refund please',
        state,
      )) as Record<string, unknown>;

      expect(result.port).toBe('a1b2c3d4-refund');
      expect(result.status).toBe('ended');
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.endReason).toBe('condition');
      expect(res.condition).toBeDefined();
    });

    it('should pass conditions to multiTurnState from execute', async () => {
      const result = (await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          conditions: [
            { id: 'cond-1', label: 'Cond1', prompt: 'Test condition' },
          ],
        },
        baseContext,
      )) as Record<string, unknown>;

      const state = result._resumeState as Record<string, unknown>;
      expect(state.conditions).toBeDefined();
      expect(state.conditions).toHaveLength(1);
    });
  });

  describe('buildMultiTurnFinalOutput with port', () => {
    it('should support condition endReason', () => {
      const messages = [
        { role: 'system' as const, content: 'System' },
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' },
      ];

      const result = handler.buildMultiTurnFinalOutput(
        messages,
        'Hello!',
        3,
        'condition',
        {
          model: 'gpt-4o',
          totalInputTokens: 500,
          totalOutputTokens: 200,
          toolCalls: 1,
          ragSources: [],
        },
      );

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.endReason).toBe('condition');
    });

    it('should support error endReason', () => {
      const result = handler.buildMultiTurnFinalOutput([], '', 1, 'error', {
        model: 'gpt-4o',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
      });

      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.endReason).toBe('error');
    });
  });

  describe('tool call telemetry — WS emit + turnDebug.toolCalls', () => {
    function lastTurnDebug(result: unknown) {
      const meta = ((result as Record<string, unknown>).meta ?? {}) as Record<
        string,
        unknown
      >;
      const arr = (meta.turnDebug ?? []) as Array<Record<string, unknown>>;
      return arr[arr.length - 1] ?? {};
    }

    function emittedEvents() {
      return mockWebsocketService.emitExecutionEvent.mock.calls.map((c) => ({
        executionId: c[0],
        type: c[1],
        payload: c[2],
      }));
    }

    it('emits TOOL_CALL_STARTED + TOOL_CALL_COMPLETED around provider.execute', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'hello',
          score: 0.9,
          metadata: {},
        },
      ]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"hi"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'final',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'hi',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const events = emittedEvents();
      const started = events.find(
        (e) => e.type === 'execution.tool_call_started',
      );
      const completed = events.find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(started).toBeDefined();
      expect(started?.payload).toMatchObject({
        toolCallId: 'tc-1',
        name: kbToolName('kb-1'),
        arguments: '{"query":"hi"}',
        turnIndex: 1,
      });
      expect(completed).toBeDefined();
      expect(completed?.payload).toMatchObject({
        toolCallId: 'tc-1',
        status: 'success',
      });
      expect(typeof completed?.payload.durationMs).toBe('number');
    });

    it('records turnDebug.toolCalls with status=success for the executed provider tool', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'x',
          score: 0.9,
          metadata: {},
        },
      ]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"x"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'done',
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'x',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const td = lastTurnDebug(result);
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc).toHaveLength(1);
      expect(tc[0]).toMatchObject({
        toolCallId: 'tc-1',
        name: kbToolName('kb-1'),
        status: 'success',
      });
      expect(typeof tc[0].durationMs).toBe('number');
    });

    it('catches provider.execute errors → status=error, LLM gets error content, turn continues', async () => {
      // First LLM response asks for KB; provider then throws; second LLM call
      // should still happen with the error content as a tool message.
      mockRagService.search.mockRejectedValue(new Error('KB DOWN'));
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-err',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '죄송합니다. 검색에 실패했습니다.',
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'q',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      // Second LLM call must happen with a tool message in the messages array
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      const secondCall = mockLlmService.chat.mock.calls[1];
      const messages = secondCall[1].messages as Array<{
        role: string;
        content: string;
        toolCallId?: string;
      }>;
      const toolMsg = messages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.toolCallId).toBe('tc-err');
      expect(toolMsg?.content).toContain('KB DOWN');

      // turnDebug carries the error
      const td = lastTurnDebug(result);
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc[0]).toMatchObject({
        toolCallId: 'tc-err',
        status: 'error',
        error: 'KB DOWN',
      });

      // WS event reports error too
      const completed = emittedEvents().find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(completed?.payload).toMatchObject({
        toolCallId: 'tc-err',
        status: 'error',
        error: 'KB DOWN',
      });

      // Final assistant response is preserved (turn recovered)
      const out = (result as Record<string, unknown>).output as Record<
        string,
        unknown
      >;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('죄송합니다. 검색에 실패했습니다.');
    });

    it('does nothing for the WS service when websocketService is not provided (BC)', async () => {
      const noWsHandler = new AiAgentHandler(mockLlmService as never, [
        kbProvider,
      ]);
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-x',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'ok',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      // Should not throw despite missing WS service.
      const result = await noWsHandler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'q',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );
      const td = lastTurnDebug(result);
      // turnDebug.toolCalls is still recorded.
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc).toHaveLength(1);
      expect(tc[0].status).toBe('success');
    });

    it('emits TOOL_CALL_* with the correct turnIndex on multi-turn resume', async () => {
      // Resume into the second user turn — telemetry must report turnIndex=2,
      // not 1, so the timeline UI can group the tool call under the right
      // turn. Without this, multi-turn debugging mis-attributes tool events.
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-mt',
              name: kbToolName('kb-1'),
              arguments: '{"query":"x"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'turn-2 done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const resumeState = {
        turnCount: 1,
        maxTurns: 5,
        maxToolCalls: 5,
        knowledgeBases: ['kb-1'],
        workspaceId: 'ws-1',
        conditions: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'turn1' },
          { role: 'assistant', content: 'ack' },
        ],
        executionId: 'exec-1',
        nodeId: 'agent-1',
        nodeExecutionId: 'ne-1',
        workflowId: 'wf-1',
        model: 'gpt-4o',
        llmConfigId: 'config-1',
        turnDebugHistory: [],
      };

      // Reach into the handler's resume path the way the engine does.
      await (
        handler as unknown as {
          processMultiTurnMessage: (
            msg: string,
            state: Record<string, unknown>,
          ) => Promise<unknown>;
        }
      ).processMultiTurnMessage('turn2 question', resumeState);

      const events = emittedEvents();
      const started = events.find(
        (e) => e.type === 'execution.tool_call_started',
      );
      const completed = events.find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(started?.payload.turnIndex).toBe(2);
      expect(completed?.payload.turnIndex).toBe(2);
      expect(started?.payload.nodeId).toBe('agent-1');
    });
  });
});

/**
 * Compact helper to fish meta out of single-turn execute() output.
 * Used in a couple of assertions that only need the diagnostic block.
 */
function readSingleTurnMeta(_handler: AiAgentHandler) {
  return (result: unknown) =>
    ((result as Record<string, unknown>).meta ?? {}) as Record<string, unknown>;
}
