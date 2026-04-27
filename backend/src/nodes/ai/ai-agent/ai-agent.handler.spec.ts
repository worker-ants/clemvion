import { AiAgentHandler } from './ai-agent.handler';
import { ExecutionContext } from '../../core/node-handler.interface';

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
      const r = result as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Final answer after tool use');
      const meta = r.meta as Record<string, unknown>;
      expect(meta.toolCalls).toBe(1);
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
    it('should return waiting_for_input on first turn', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          maxTurns: 10,
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
      expect(convConfig.messages).toHaveLength(3); // system + user + assistant

      const state = output._resumeState as Record<string, unknown>;
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

      const state = output._resumeState as Record<string, unknown>;
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
        },
        baseContext,
      );

      const output = result as Record<string, unknown>;
      const state = output._resumeState as Record<string, unknown>;
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
      const state = output._resumeState as Record<string, unknown>;
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

    it('should perform RAG search on follow-up messages', async () => {
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
    it('should use tool_ prefix with sanitized nodeId', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          toolNodeIds: ['abc12345-full-node-id'],
        },
        baseContext,
      );
      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      expect(tools[0].name).toBe('tool_abc12345_full_node_id');
    });

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

    it('should execute normal tools first when condition + normal tools are called together', async () => {
      // First call: LLM calls both condition and normal tool
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: 'tool_node_tool_uuid',
              arguments: '{"input":"check"}',
            },
            {
              id: 'tc-2',
              name: 'cond_a1b2c3d4_refund',
              arguments: '{"reason":"maybe refund"}',
            },
          ],
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        // Second call: After re-evaluation, LLM calls only condition tool
        .mockResolvedValueOnce({
          content: 'Processing refund.',
          toolCalls: [
            {
              id: 'tc-3',
              name: 'cond_a1b2c3d4_refund',
              arguments: '{"reason":"confirmed refund"}',
            },
          ],
          usage: { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        });

      const result = (await handler.execute(
        {},
        {
          ...conditionConfig,
          toolNodeIds: ['node-tool-uuid'],
        },
        baseContext,
      )) as Record<string, unknown>;

      // LLM should have been called twice (first with mixed tools, then re-evaluation)
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      expect(result.port).toBe('a1b2c3d4-refund');
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
});
