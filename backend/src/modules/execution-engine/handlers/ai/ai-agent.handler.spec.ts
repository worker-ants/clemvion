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
  });

  describe('execute', () => {
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
      // First call returns tool_calls, second call returns final response
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
  });
});
