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

  describe('inject (Phase 4b)', () => {
    function seedThreadFromOtherNode(context: ExecutionContext): void {
      conversationThreadService.appendPresentationInteraction(context, {
        node: { id: 'form-1', label: 'Form', type: 'form' },
        interaction: {
          type: 'form_submitted',
          data: { name: 'Alice', email: 'alice@example.com' },
          receivedAt: '2026-05-14T10:00:00.000Z',
        },
      });
      conversationThreadService.appendAiAssistantMessage(context, {
        node: { id: 'agent-prev', label: 'PrevAgent', type: 'ai_agent' },
        content: 'Welcome Alice',
      });
    }

    it("single-turn contextScope='thread' messages mode prepends turns from other nodes", async () => {
      const context = makeContext();
      seedThreadFromOtherNode(context);

      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          userPrompt: 'How are you?',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'thread',
          contextInjectionMode: 'messages',
        },
        context,
      );

      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string; content: string }[];
      };
      // Order: system → injected (form_submitted as user, prev assistant) → userPrompt
      expect(llmCall.messages[0].role).toBe('system');
      expect(llmCall.messages[1].role).toBe('user');
      expect(llmCall.messages[1].content).toContain('[from Form]');
      expect(llmCall.messages[1].content).toContain('name=Alice');
      expect(llmCall.messages[2].role).toBe('assistant');
      expect(llmCall.messages[2].content).toBe('Welcome Alice');
      expect(llmCall.messages[3].role).toBe('user');
      expect(llmCall.messages[3].content).toBe('How are you?');
    });

    it("single-turn contextScope='thread' system_text mode appends to system prompt", async () => {
      const context = makeContext();
      seedThreadFromOtherNode(context);

      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'thread',
          contextInjectionMode: 'system_text',
        },
        context,
      );

      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string; content: string }[];
      };
      expect(llmCall.messages[0].role).toBe('system');
      expect(llmCall.messages[0].content).toContain('You are helpful');
      expect(llmCall.messages[0].content).toContain(
        '[Conversation Context — chronological]',
      );
      expect(llmCall.messages[0].content).toContain('name=Alice');
      // No injected turns in messages array
      expect(llmCall.messages[1].role).toBe('user');
      expect(llmCall.messages[1].content).toBe('Hi');
    });

    it("contextScope='lastN' clamps injection to N most recent turns", async () => {
      const context = makeContext();
      // Seed 5 turns from other nodes
      for (let i = 0; i < 5; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: `prev-${i}`, label: `Prev${i}`, type: 'ai_agent' },
          content: `msg ${i}`,
        });
      }
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'q',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'lastN',
          contextScopeN: 2,
          contextInjectionMode: 'messages',
        },
        context,
      );
      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string; content: string }[];
      };
      // userPrompt + 2 injected = expecting 3 messages (no system prompt set)
      expect(
        llmCall.messages.filter((m) => m.role === 'assistant'),
      ).toHaveLength(2);
      expect(llmCall.messages[0].content).toBe('msg 3');
      expect(llmCall.messages[1].content).toBe('msg 4');
    });

    it('getThreadExcludingNode prevents self-history duplication', async () => {
      const context = makeContext();
      // Self push (executeSingleTurn appends ai_user then ai_assistant; the
      // injection helper must exclude the agent's own turns so the next call
      // doesn't see itself doubled).
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'first',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'thread',
          contextInjectionMode: 'messages',
        },
        context,
      );
      // Run again — second call should not see its first-call turns injected
      // (self-exclusion). Only the first call's pushes are in the thread,
      // which both have nodeId='agent-1' (self) → excluded.
      mockLlmService.chat.mockClear();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'second',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'thread',
          contextInjectionMode: 'messages',
        },
        context,
      );
      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string }[];
      };
      // Only the userPrompt (no injected self-turns) → length 1
      expect(llmCall.messages).toHaveLength(1);
      expect(llmCall.messages[0].role).toBe('user');
    });

    it("noop when contextScope='none' (no injection, no meta echo)", async () => {
      const context = makeContext();
      seedThreadFromOtherNode(context);
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          // contextScope omitted = default 'none'
        },
        context,
      );
      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string }[];
      };
      expect(llmCall.messages).toHaveLength(1); // userPrompt only
      expect(
        (result as { meta?: Record<string, unknown> }).meta,
      ).not.toHaveProperty('contextInjection');
    });

    it('includeToolTurns=true pushes tool-loop assistant + tool result turns', async () => {
      const context = makeContext();
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: 'I will use a tool',
          toolCalls: [{ id: 'tc-1', name: 'tool_foo', arguments: '{"q":"x"}' }],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'do it',
          responseFormat: 'text',
          maxToolCalls: 5,
          includeToolTurns: true,
        },
        context,
      );

      const turns = conversationThreadService.getThread(context).turns;
      // ai_user (userPrompt) + ai_assistant (tool-loop, w/ toolCalls) +
      // ai_tool (result) + ai_assistant (final) = 4 turns.
      expect(turns).toHaveLength(4);
      expect(turns[0].source).toBe('ai_user');
      expect(turns[1].source).toBe('ai_assistant');
      expect(turns[1].toolCalls).toEqual([
        { id: 'tc-1', name: 'tool_foo', arguments: '{"q":"x"}' },
      ]);
      expect(turns[2].source).toBe('ai_tool');
      expect(turns[2].toolCallId).toBe('tc-1');
      expect(turns[3].source).toBe('ai_assistant');
      expect(turns[3].text).toBe('Done');
    });

    it('default (includeToolTurns omitted) skips tool-loop turns', async () => {
      const context = makeContext();
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'tool_foo', arguments: '{}' }],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          model: 'gpt-4o',
          finishReason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'do it',
          responseFormat: 'text',
          maxToolCalls: 5,
        },
        context,
      );

      const turns = conversationThreadService.getThread(context).turns;
      expect(turns).toHaveLength(2);
      expect(turns.map((t) => t.source)).toEqual(['ai_user', 'ai_assistant']);
    });

    it('emits meta.contextInjection echo when scope is active', async () => {
      const context = makeContext();
      seedThreadFromOtherNode(context);
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          userPrompt: 'hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          contextScope: 'thread',
          contextInjectionMode: 'messages',
        },
        context,
      );
      const meta = (result as { meta: Record<string, unknown> }).meta;
      expect(meta.contextInjection).toMatchObject({
        appliedScope: 'thread',
        appliedMode: 'messages',
        injectedTurns: 2,
        droppedTurns: 0,
      });
    });
  });
});
