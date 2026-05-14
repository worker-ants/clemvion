/**
 * Conversation Thread push behaviour for AI Agent (single + multi turn).
 *
 * Phase 4a verifies that the handler routes user / assistant turns through
 * ConversationThreadService.append* — the actual mutation logic is unit-
 * tested in ConversationThreadService.spec, and this file asserts the
 * handler's call sites + payloads (spec/conventions/conversation-thread.md
 * §2.2).
 */
import { AiAgentHandler } from './ai-agent.handler';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';

function makeContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeId: 'agent-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
    ...overrides,
  };
}

describe('AiAgentHandler — ConversationThread push (Phase 4a)', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let handler: AiAgentHandler;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn().mockResolvedValue({
        content: 'AI response',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      embed: jest.fn(),
    };
    conversationThreadService = new ConversationThreadService();
    handler = new AiAgentHandler(
      mockLlmService as never,
      [],
      undefined,
      conversationThreadService,
    );
  });

  describe('single turn', () => {
    it('pushes ai_user (userPrompt) + ai_assistant (final) turns', async () => {
      const context = makeContext();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          responseFormat: 'text',
          maxToolCalls: 10,
        },
        context,
      );

      const turns = conversationThreadService.getThread(context).turns;
      expect(turns).toHaveLength(2);
      expect(turns[0]).toMatchObject({
        seq: 0,
        nodeId: 'agent-1',
        nodeType: 'ai_agent',
        source: 'ai_user',
        text: 'Hello',
      });
      expect(turns[1]).toMatchObject({
        seq: 1,
        nodeId: 'agent-1',
        nodeType: 'ai_agent',
        source: 'ai_assistant',
        text: 'AI response',
      });
    });

    it('skips both turns when excludeFromConversationThread is true', async () => {
      const context = makeContext();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          responseFormat: 'text',
          maxToolCalls: 10,
          excludeFromConversationThread: true,
        },
        context,
      );
      // opt-out applies to push, not to LLM call
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      expect(conversationThreadService.getThread(context).turns).toHaveLength(
        0,
      );
    });

    it('stringifies JSON responses for thread text', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: JSON.stringify({ score: 0.95 }),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });
      const context = makeContext();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'q',
          responseFormat: 'json',
          maxToolCalls: 10,
        },
        context,
      );
      const turns = conversationThreadService.getThread(context).turns;
      expect(turns[1].source).toBe('ai_assistant');
      expect(turns[1].text).toBe('{"score":0.95}');
    });
  });

  describe('multi turn', () => {
    it('first turn (executeMultiTurn) does not push; thread reference is captured in state', async () => {
      const context = makeContext();
      const result = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
        },
        context,
      );

      expect(conversationThreadService.getThread(context).turns).toHaveLength(
        0,
      );
      // _resumeState carries the live thread reference so subsequent turns
      // can mutate the same object even though they receive only `state`.
      const resumeState = (
        result as { _resumeState?: { conversationThreadRef?: unknown } }
      )._resumeState;
      expect(resumeState?.conversationThreadRef).toBe(
        context.conversationThread,
      );
    });

    it('subsequent turn pushes ai_user + ai_assistant via processMultiTurnMessage', async () => {
      const context = makeContext();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
        },
        context,
      );
      const state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;

      await handler.processMultiTurnMessage('주문 상태?', state);

      const turns = conversationThreadService.getThread(context).turns;
      expect(turns).toHaveLength(2);
      expect(turns[0]).toMatchObject({
        source: 'ai_user',
        text: '주문 상태?',
        nodeType: 'ai_agent',
      });
      expect(turns[1]).toMatchObject({
        source: 'ai_assistant',
        text: 'AI response',
        nodeType: 'ai_agent',
      });
    });

    it('opt-out via state.rawConfig.excludeFromConversationThread blocks subsequent pushes', async () => {
      const context = makeContext({
        rawConfig: {
          mode: 'multi_turn',
          excludeFromConversationThread: true,
        },
      });
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
          excludeFromConversationThread: true,
        },
        context,
      );
      const state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;
      // Engine wires state.rawConfig as the frozen first-turn snapshot —
      // mirror that here so the helper sees the opt-out flag.
      state.rawConfig = {
        mode: 'multi_turn',
        excludeFromConversationThread: true,
      };

      await handler.processMultiTurnMessage('hi', state);

      expect(conversationThreadService.getThread(context).turns).toHaveLength(
        0,
      );
    });
  });
});
