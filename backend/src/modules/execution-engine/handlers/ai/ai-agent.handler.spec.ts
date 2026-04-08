import { AiAgentHandler } from './ai-agent.handler';
import { ExecutionContext } from '../node-handler.interface';

describe('AiAgentHandler', () => {
  let handler: AiAgentHandler;
  let mockLlmService: Record<string, jest.Mock>;
  let mockRagService: Record<string, jest.Mock>;

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

    mockRagService = {
      search: jest.fn().mockResolvedValue([]),
      buildContext: jest.fn().mockReturnValue({ context: '', sources: [] }),
    };

    handler = new AiAgentHandler(
      mockLlmService as never,
      mockRagService as never,
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
      expect(result.errors).toContain(
        'Either systemPrompt or userPrompt is required',
      );
    });

    it('should pass with systemPrompt', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
      });
      expect(result.valid).toBe(true);
    });

    it('should pass with userPrompt', () => {
      const result = handler.validate({
        userPrompt: 'Hello',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate multi_turn mode with invalid maxTurns', () => {
      const result = handler.validate({
        userPrompt: 'Hello',
        mode: 'multi_turn',
        maxTurns: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'maxTurns must be 0 (unlimited) or a positive integer',
      );
    });

    it('should validate multi_turn mode with invalid turnTimeout', () => {
      const result = handler.validate({
        userPrompt: 'Hello',
        mode: 'multi_turn',
        turnTimeout: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('turnTimeout must be a positive integer');
    });

    it('should pass multi_turn mode with valid settings', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        mode: 'multi_turn',
        maxTurns: 10,
        turnTimeout: 600,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail multi_turn without systemPrompt', () => {
      const result = handler.validate({
        mode: 'multi_turn',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'systemPrompt is required for multi_turn mode',
      );
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
      const output = result as Record<string, unknown>;
      expect(output.response).toBe('Hello! I am an AI assistant.');
      expect(output.metadata).toBeDefined();
    });

    it('should invoke RAG when knowledgeBases are configured', async () => {
      mockRagService.search.mockResolvedValue([
        { chunkId: 'c1', content: 'KB content', score: 0.9 },
      ]);
      mockRagService.buildContext.mockReturnValue({
        context: '\n### Relevant Knowledge\n...',
        sources: [{ chunkId: 'c1', content: 'KB content', score: 0.9 }],
      });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Question',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      expect(mockRagService.search).toHaveBeenCalledWith(
        'Question',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
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

      const output = result as Record<string, unknown>;
      expect(output.response).toEqual({ answer: '42' });
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

      const output = result as Record<string, unknown>;
      expect(output.response).toBe('not valid json {{{');
    });

    it('should handle tool calling loop', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: 'tool_abc12345',
              arguments: '{"input":"data"}',
            },
          ],
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Final answer after tool use',
          usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          userPrompt: 'Use a tool',
          toolNodeIds: ['abc12345-full-node-id'],
        },
        baseContext,
      );

      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      const output = result as Record<string, unknown>;
      expect(output.response).toBe('Final answer after tool use');
      const metadata = output.metadata as Record<string, unknown>;
      expect(metadata.toolCalls).toBe(1);
    });

    it('should default to single_turn when mode is not set', async () => {
      const result = await handler.execute(
        {},
        { userPrompt: 'Hello' },
        baseContext,
      );

      const output = result as Record<string, unknown>;
      expect(output.response).toBeDefined();
      expect(output.status).toBeUndefined(); // single_turn doesn't return status
    });
  });

  describe('execute - multi_turn', () => {
    it('should return waiting_for_input on first turn', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          maxTurns: 10,
          turnTimeout: 600,
        },
        baseContext,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect(output.interactionType).toBe('ai_conversation');
      expect(output.type).toBe('ai_conversation');

      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.message).toBe('Hello! I am an AI assistant.');
      expect(convConfig.turnCount).toBe(1);
      expect(convConfig.maxTurns).toBe(10);
      expect(convConfig.turnTimeout).toBe(600);
      expect(convConfig.messages).toHaveLength(3); // system + user + assistant

      const state = output._multiTurnState as Record<string, unknown>;
      expect(state.turnCount).toBe(1);
      expect(state.totalInputTokens).toBe(100);
      expect(state.totalOutputTokens).toBe(50);
    });

    it('should skip LLM call and wait immediately when no userPrompt', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          maxTurns: 10,
          turnTimeout: 600,
        },
        baseContext,
      );

      // Should NOT call LLM
      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect(output.interactionType).toBe('ai_conversation');

      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.turnCount).toBe(0);
      expect(convConfig.message).toBe('');
      expect(convConfig.messages).toHaveLength(1); // system only

      const state = output._multiTurnState as Record<string, unknown>;
      expect(state.turnCount).toBe(0);
      expect(state.totalInputTokens).toBe(0);
    });

    it('should include debug fields in first turn state when userPrompt is provided', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          maxTurns: 10,
          turnTimeout: 600,
        },
        baseContext,
      );

      const output = result as Record<string, unknown>;
      const state = output._multiTurnState as Record<string, unknown>;
      expect(state.lastTurnRequest).toBeDefined();
      expect((state.lastTurnRequest as Record<string, unknown>).model).toBe(
        'gpt-4o',
      );
      expect(state.lastTurnResponse).toBeDefined();
      expect(typeof state.lastTurnDurationMs).toBe('number');
    });

    it('should include RAG sources in multi_turn first turn', async () => {
      mockRagService.search.mockResolvedValue([
        { chunkId: 'c1', content: 'KB content', score: 0.9 },
      ]);
      mockRagService.buildContext.mockReturnValue({
        context: '\nKnowledge context',
        sources: [{ chunkId: 'c1', score: 0.9 }],
      });

      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'Helper',
          userPrompt: 'Question',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const output = result as Record<string, unknown>;
      const state = output._multiTurnState as Record<string, unknown>;
      const ragSources = state.ragSources as unknown[];
      expect(ragSources).toHaveLength(1);
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
        turnTimeout: 600,
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

      const convConfig = output.conversationConfig as Record<string, unknown>;
      expect(convConfig.message).toBe('Sure, I can help with that.');
      expect(convConfig.turnCount).toBe(2);

      const newState = output._multiTurnState as Record<string, unknown>;
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
        turnTimeout: 600,
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
        ._multiTurnState as Record<string, unknown>;
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
      expect((newState.lastTurnResponse as Record<string, unknown>).content).toBe(
        'Response text',
      );
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
        turnTimeout: 600,
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
        turnTimeout: 600,
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

      const output = result as Record<string, unknown>;
      expect(output.status).toBeUndefined(); // final output has no status
      expect(output.response).toBe('Goodbye!');
      expect(output.endReason).toBe('max_turns');
      expect(output.turnCount).toBe(2);
      expect(output.messages).toBeDefined();
    });

    it('should perform RAG search on follow-up messages', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        turnTimeout: 600,
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

      mockRagService.search.mockResolvedValue([
        { chunkId: 'c2', content: 'New context', score: 0.85 },
      ]);
      mockRagService.buildContext.mockReturnValue({
        context: '\nNew context',
        sources: [{ chunkId: 'c2', score: 0.85 }],
      });

      mockLlmService.chat.mockResolvedValue({
        content: 'Based on the knowledge...',
        usage: { inputTokens: 200, outputTokens: 40, totalTokens: 240 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('Tell me about X', state);

      expect(mockRagService.search).toHaveBeenCalledWith(
        'Tell me about X',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
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

      const output = result as Record<string, unknown>;
      expect(output.response).toBe('Hello!');
      expect(output.turnCount).toBe(3);
      expect(output.endReason).toBe('user_ended');
      expect(output.messages).toHaveLength(3);

      const metadata = output.metadata as Record<string, unknown>;
      expect(metadata.model).toBe('gpt-4o');
      expect(metadata.totalInputTokens).toBe(500);
      expect(metadata.totalOutputTokens).toBe(200);
      expect(metadata.totalTokens).toBe(700);
      expect(metadata.toolCalls).toBe(1);
    });
  });
});
