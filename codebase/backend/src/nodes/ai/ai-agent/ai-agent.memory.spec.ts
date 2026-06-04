/**
 * Auto-memory strategy integration tests for AI Agent (single-turn focus).
 *
 * Covers spec/4-nodes/3-ai/1-ai-agent.md §6.1 (1.3 recall / 1.5 summary) and
 * the meta.memory echo (§7), plus the **manual backward-compat regression**
 * invariant (memoryStrategy unset/manual → contextScope path 100% unchanged,
 * no meta.memory).
 */
import { AiAgentHandler } from './ai-agent.handler';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import type {
  AgentMemoryService,
  RecalledMemory,
} from '../../../modules/agent-memory/agent-memory.service';

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

describe('AiAgentHandler — auto-memory strategy', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let agentMemoryService: {
    resolveScopeKey: jest.Mock;
    recall: jest.Mock;
    scheduleExtraction: jest.Mock;
  };

  function buildHandler(): AiAgentHandler {
    return new AiAgentHandler(
      mockLlmService as never,
      [],
      undefined,
      conversationThreadService,
      agentMemoryService as unknown as AgentMemoryService,
    );
  }

  function seedThreadFromOtherNode(context: ExecutionContext): void {
    conversationThreadService.appendAiAssistantMessage(context, {
      node: { id: 'agent-prev', label: 'PrevAgent', type: 'ai_agent' },
      content: 'Earlier assistant turn',
    });
  }

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
    agentMemoryService = {
      resolveScopeKey: jest.fn((key: string | undefined, exec: string) =>
        key && key.trim() !== '' ? key : exec,
      ),
      recall: jest.fn().mockResolvedValue([] as RecalledMemory[]),
      scheduleExtraction: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('manual backward-compat regression (CRITICAL invariant)', () => {
    it('memoryStrategy unset → contextScope path unchanged, no meta.memory', async () => {
      const context = makeContext();
      seedThreadFromOtherNode(context);
      const handler = buildHandler();

      const result = await handler.execute(
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
          // memoryStrategy intentionally absent (legacy workflow shape).
        },
        context,
      );

      // contextInjection still echoed; meta.memory must NOT appear.
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.contextInjection).toBeDefined();
      expect(meta.memory).toBeUndefined();
      // No summary mutation on the thread.
      expect(
        conversationThreadService.getThread(context).runningSummary,
      ).toBeUndefined();
      // No recall call for manual strategy.
      expect(agentMemoryService.recall).not.toHaveBeenCalled();

      // Injected thread turns still prepended (manual messages mode unchanged).
      const llmCall = mockLlmService.chat.mock.calls[0][1] as {
        messages: { role: string; content: string }[];
      };
      expect(llmCall.messages[0].role).toBe('system');
      expect(llmCall.messages[1].content).toContain('Earlier assistant turn');
    });

    it("explicit memoryStrategy:'manual' behaves identically (no meta.memory)", async () => {
      const context = makeContext();
      const handler = buildHandler();
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'manual',
        },
        context,
      );
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toBeUndefined();
      expect(agentMemoryService.recall).not.toHaveBeenCalled();
    });
  });

  describe('summary_buffer (single-turn)', () => {
    it('echoes meta.memory with strategy + recalledCount=0 + no summary under budget', async () => {
      const context = makeContext();
      const handler = buildHandler();
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'summary_buffer',
          memoryTokenBudget: 100000,
        },
        context,
      );
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toMatchObject({
        strategy: 'summary_buffer',
        summarized: false,
        recalledCount: 0,
      });
      // summary_buffer never recalls.
      expect(agentMemoryService.recall).not.toHaveBeenCalled();
      // Only the main chat call (no summary LLM call under budget).
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('multi_turn: first turn over budget sets runningSummary, second turn reuses it in the stable prefix', async () => {
      const context = makeContext();
      // 예산 초과를 강제하기 위해 다른 노드의 큰 turn 들을 thread 에 seed.
      const big = 'w'.repeat(500);
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
          content: big,
        });
      }
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
          memoryStrategy: 'summary_buffer',
          memoryTokenBudget: 300,
        },
        context,
      );
      const state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;
      // 첫 waiting tick — LLM/요약 콜 없음 (user query 도착 전).
      expect(mockLlmService.chat).not.toHaveBeenCalled();

      // ── Turn 1: 예산 초과 → 요약 콜(1) + 메인 콜(1). ──
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: 'TURN1 ROLLING SUMMARY',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'first answer',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      await handler.processMultiTurnMessage('첫 질문', state);

      // runningSummary 가 thread (state.conversationThreadRef) 에 영속.
      expect(conversationThreadService.getThread(context).runningSummary).toBe(
        'TURN1 ROLLING SUMMARY',
      );
      const turn1Calls = mockLlmService.chat.mock.calls.length;

      // ── Turn 2: 동일 thread 재사용. 이미 압축된 turn 은 재요약 금지 →
      //    요약 콜 없이 메인 콜만, 그리고 stable prefix 에 기존 요약이 포함. ──
      mockLlmService.chat.mockResolvedValue({
        content: 'second answer',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });
      const turn2 = await handler.processMultiTurnMessage(
        '두 번째 질문',
        state,
      );

      // 두 번째 turn 은 메인 콜 1회만 추가 (재요약 없음 — 캐시 보호 불변식).
      expect(mockLlmService.chat.mock.calls.length).toBe(turn1Calls + 1);

      // 두 번째 turn 의 system 메시지에 기존 요약이 stable prefix 로 회수돼야 한다.
      const mainCall = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: { role: string; content: string }[];
      };
      const systemMsg = mainCall.messages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('TURN1 ROLLING SUMMARY');

      const meta = (turn2 as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toMatchObject({ strategy: 'summary_buffer' });
    });

    it('multi-turn: summary 압축이 진행되면 누적 _resumeState.messages 를 물리 축소 (system+휘발성 꼬리 유지)', async () => {
      const context = makeContext();
      const big = 'w'.repeat(600);
      // 다른 노드의 큰 turn 들을 seed 해 첫 user turn 에서 예산 초과 → 요약.
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
          content: big,
        });
      }
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 50,
          memoryStrategy: 'summary_buffer',
          memoryTokenBudget: 200,
        },
        context,
      );
      let state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;

      // 매 turn: (요약 콜 발생 시) 요약 + 메인 콜. 요약 콜은 압축이 진행될 때만.
      function queueAnswer(answer: string): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: answer,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }
      function queueSummary(): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: 'ROLLING SUMMARY',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }

      // ── Turn 1: seeded turns 예산 초과 → 요약 콜 + 메인 콜. ──
      queueSummary();
      queueAnswer('answer-1');
      const r1 = await handler.processMultiTurnMessage('질문1', state);
      state = (r1 as { _resumeState: Record<string, unknown> })._resumeState;
      expect(conversationThreadService.getThread(context).runningSummary).toBe(
        'ROLLING SUMMARY',
      );
      const len1 = (state.messages as unknown[]).length;

      // ── Turn 2: 다시 큰 seeded turn 추가 → 재요약 트리거(summarizedUpToSeq
      //    전진) → 직전 누적 user 교환을 물리 압축해야 한다. ──
      for (let i = 0; i < 4; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev2', label: 'Prev2', type: 'ai_agent' },
          content: big,
        });
      }
      queueSummary();
      queueAnswer('answer-2');
      const r2 = await handler.processMultiTurnMessage('질문2', state);
      state = (r2 as { _resumeState: Record<string, unknown> })._resumeState;

      const meta2 = (r2 as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta2.memory).toMatchObject({
        strategy: 'summary_buffer',
        summarized: true,
      });

      const msgs2 = state.messages as {
        role: string;
        content: string;
        toolCallId?: string;
        toolCalls?: { id: string }[];
      }[];

      // system 메시지 1개 유지 + 요약 포함.
      const systemMsgs = msgs2.filter((m) => m.role === 'system');
      expect(systemMsgs).toHaveLength(1);
      expect(systemMsgs[0].content).toContain('ROLLING SUMMARY');

      // 물리 압축 흔적 — compactedMessages > 0 (직전 turn 의 오래된 exchange 제거).
      expect(
        (meta2.memory as { compactedMessages?: number }).compactedMessages,
      ).toBeGreaterThan(0);

      // 압축으로 누적 messages 가 단조 증가하지 않음 — turn2 길이 ≤ turn1 길이 + 신규.
      // (압축이 없었다면 user2/assistant2 가 더해져 len1+2 였을 것)
      const len2 = msgs2.length;
      expect(len2).toBeLessThanOrEqual(len1);

      // 페어링 불변식 — 모든 tool 메시지는 직전 assistant.toolCalls 와 매칭, 고아 0.
      // (이 시나리오엔 tool 이 없지만 첫 비-system 메시지가 user 인지로 경계 검증)
      const firstNonSystem = msgs2.find((m) => m.role !== 'system');
      expect(firstNonSystem?.role).toBe('user');
    });

    it('multi-turn: manual 전략은 누적 messages 무변경 (물리 압축 회귀 금지)', async () => {
      const context = makeContext();
      const big = 'w'.repeat(600);
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
          content: big,
        });
      }
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 50,
          memoryStrategy: 'manual',
          memoryTokenBudget: 200,
        },
        context,
      );
      let state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;

      function queueAnswer(answer: string): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: answer,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }

      queueAnswer('answer-1');
      const r1 = await handler.processMultiTurnMessage('질문1', state);
      state = (r1 as { _resumeState: Record<string, unknown> })._resumeState;
      const len1 = (state.messages as unknown[]).length;

      // 더 많은 seeded turn 을 추가해도 manual 은 요약/압축을 절대 안 한다.
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev2', label: 'Prev2', type: 'ai_agent' },
          content: big,
        });
      }
      queueAnswer('answer-2');
      const r2 = await handler.processMultiTurnMessage('질문2', state);
      state = (r2 as { _resumeState: Record<string, unknown> })._resumeState;

      // meta.memory 미출현 (manual 불변식) + messages 는 user2/assistant2 만큼 순증가.
      const meta2 = (r2 as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta2.memory).toBeUndefined();
      const len2 = (state.messages as unknown[]).length;
      expect(len2).toBe(len1 + 2); // 압축 0 — user2 + assistant2 만 추가.
      // 요약 콜 자체가 없었어야 한다 (manual).
      expect(
        conversationThreadService.getThread(context).runningSummary,
      ).toBeUndefined();
    });

    it('compresses oldest turns + sets runningSummary when over budget', async () => {
      const context = makeContext();
      // Seed many large turns from another node so working memory exceeds budget.
      const big = 'w'.repeat(500);
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
          content: big,
        });
      }
      // First chat call = summary LLM call; second = main answer.
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: 'ROLLING SUMMARY',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'AI response',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const handler = buildHandler();
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'summary_buffer',
          memoryTokenBudget: 300,
        },
        context,
      );
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toMatchObject({
        strategy: 'summary_buffer',
        summarized: true,
        recalledCount: 0,
      });
      // runningSummary persisted on the thread for resume reuse.
      expect(conversationThreadService.getThread(context).runningSummary).toBe(
        'ROLLING SUMMARY',
      );
      // The system message carries the summary block (stable prefix).
      const mainCall = mockLlmService.chat.mock.calls[1][1] as {
        messages: { role: string; content: string }[];
      };
      const systemMsg = mainCall.messages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('ROLLING SUMMARY');
    });
  });

  describe('persistent (single-turn)', () => {
    it('recalls with resolved scope key + topK/threshold and injects into the stable prefix', async () => {
      const recalledFacts: RecalledMemory[] = [
        { content: 'User prefers concise answers', score: 0.95 },
        { content: 'Account tier is gold', score: 0.88 },
      ];
      agentMemoryService.recall.mockResolvedValue(recalledFacts);
      const context = makeContext();
      const handler = buildHandler();
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-xyz',
          systemPrompt: 'Sys',
          userPrompt: 'What plan am I on?',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'persistent',
          memoryKey: 'user-42',
          memoryTopK: 3,
          memoryThreshold: 0.5,
          memoryTokenBudget: 100000,
        },
        context,
      );

      // Scope key resolved from memoryKey (truthy → personalised).
      expect(agentMemoryService.resolveScopeKey).toHaveBeenCalledWith(
        'user-42',
        'exec-1',
      );
      // recall called with workspace, scopeKey, query, embed source, topK/threshold.
      expect(agentMemoryService.recall).toHaveBeenCalledTimes(1);
      const recallArgs = agentMemoryService.recall.mock.calls[0];
      expect(recallArgs[0]).toBe('ws-1'); // workspaceId
      expect(recallArgs[1]).toBe('user-42'); // scopeKey
      expect(recallArgs[2]).toBe('What plan am I on?'); // queryText
      expect(recallArgs[3]).toMatchObject({ llmConfigId: 'cfg-xyz' });
      expect(recallArgs[4]).toMatchObject({ topK: 3, threshold: 0.5 });

      // meta.memory echoes recalledCount.
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toMatchObject({
        strategy: 'persistent',
        recalledCount: 2,
      });

      // Recalled facts injected into the system message (stable prefix [5a]).
      const mainCall = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: { role: string; content: string }[];
      };
      const systemMsg = mainCall.messages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('User prefers concise answers');
      expect(systemMsg?.content).toContain('Account tier is gold');
    });

    it('multi-turn re-recalls every turn and echoes meta.memory (system prefix injection)', async () => {
      agentMemoryService.recall.mockResolvedValue([
        { content: 'Loyalty member since 2020', score: 0.9 },
      ] as RecalledMemory[]);
      const context = makeContext();
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
          memoryStrategy: 'persistent',
          memoryKey: 'cust-7',
          memoryTokenBudget: 100000,
        },
        context,
      );
      const state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;
      // First waiting tick performs no LLM call / no recall (no user query yet).
      expect(agentMemoryService.recall).not.toHaveBeenCalled();

      const turnResult = await handler.processMultiTurnMessage(
        '주문 상태 알려줘',
        state,
      );

      // Recall happened this turn with the resolved scope key + user query.
      expect(agentMemoryService.recall).toHaveBeenCalledTimes(1);
      expect(agentMemoryService.recall.mock.calls[0][1]).toBe('cust-7');
      expect(agentMemoryService.recall.mock.calls[0][2]).toBe(
        '주문 상태 알려줘',
      );

      // meta.memory echoed on the (waiting-again) turn result.
      const meta =
        (turnResult as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta.memory).toMatchObject({
        strategy: 'persistent',
        recalledCount: 1,
      });

      // Recalled fact injected into the system message stable prefix.
      const mainCall = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: { role: string; content: string }[];
      };
      const systemMsg = mainCall.messages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('Loyalty member since 2020');
    });

    it('multi-turn: persistent + 낮은 budget 도 물리 압축 발생 (compactedMessages>0, 페어링 유지)', async () => {
      // summary_buffer 와 동일하게 persistent 전략 + 낮은 memoryTokenBudget 에서도
      // 누적 messages 물리 압축이 일어나야 한다 (전략 무관 d.6 경로 일관).
      agentMemoryService.recall.mockResolvedValue([
        { content: 'User prefers concise answers', score: 0.9 },
      ] as RecalledMemory[]);
      const context = makeContext();
      const big = 'w'.repeat(600);
      for (let i = 0; i < 6; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
          content: big,
        });
      }
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 50,
          memoryStrategy: 'persistent',
          memoryKey: 'cust-7',
          memoryTokenBudget: 200,
        },
        context,
      );
      let state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;

      function queueAnswer(answer: string): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: answer,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }
      function queueSummary(): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: 'ROLLING SUMMARY',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }

      // Turn 1: seeded turns 예산 초과 → 요약 콜 + 메인 콜.
      queueSummary();
      queueAnswer('answer-1');
      const r1 = await handler.processMultiTurnMessage('질문1', state);
      state = (r1 as { _resumeState: Record<string, unknown> })._resumeState;
      const len1 = (state.messages as unknown[]).length;

      // Turn 2: 큰 seeded turn 추가 → 재요약 트리거 → 직전 user 교환 물리 압축.
      for (let i = 0; i < 4; i++) {
        conversationThreadService.appendAiAssistantMessage(context, {
          node: { id: 'agent-prev2', label: 'Prev2', type: 'ai_agent' },
          content: big,
        });
      }
      queueSummary();
      queueAnswer('answer-2');
      const r2 = await handler.processMultiTurnMessage('질문2', state);
      state = (r2 as { _resumeState: Record<string, unknown> })._resumeState;

      const meta2 = (r2 as { meta?: Record<string, unknown> }).meta ?? {};
      expect(meta2.memory).toMatchObject({
        strategy: 'persistent',
        summarized: true,
      });
      // 물리 압축 흔적 — persistent 전략에서도 compactedMessages > 0.
      expect(
        (meta2.memory as { compactedMessages?: number }).compactedMessages,
      ).toBeGreaterThan(0);

      const msgs2 = state.messages as { role: string; content: string }[];
      // system 1개 유지 + 요약 포함 + 단조 증가 차단.
      expect(msgs2.filter((m) => m.role === 'system')).toHaveLength(1);
      expect(msgs2.length).toBeLessThanOrEqual(len1);
      // 페어링 경계 — 첫 비-system 메시지는 user.
      expect(msgs2.find((m) => m.role !== 'system')?.role).toBe('user');
    });

    it('multi-turn: thread service 미주입 시 압축 skip (messages 무변경 — fallback 안전)', async () => {
      // conversationThreadService 미주입 → fullTurns=turns(빈 배열 경로) →
      // keepUserExchanges=0 → 물리 압축 skip. summary 콜이 일어나도 누적 messages
      // 는 user/assistant 만큼만 순증한다 (압축 0).
      const handlerNoThread = new AiAgentHandler(
        mockLlmService as never,
        [],
        undefined,
        undefined, // conversationThreadService 미주입.
        agentMemoryService as unknown as AgentMemoryService,
      );
      const context = makeContext();
      const first = await handlerNoThread.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 50,
          memoryStrategy: 'summary_buffer',
          // 매우 작은 budget — systemPrompt 만으로도 초과해 요약 시도 유도.
          memoryTokenBudget: 1,
        },
        context,
      );
      let state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;

      function queueAnswer(answer: string): void {
        mockLlmService.chat.mockResolvedValueOnce({
          content: answer,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      }

      queueAnswer('answer-1');
      const r1 = await handlerNoThread.processMultiTurnMessage('질문1', state);
      state = (r1 as { _resumeState: Record<string, unknown> })._resumeState;
      const len1 = (state.messages as unknown[]).length;

      queueAnswer('answer-2');
      const r2 = await handlerNoThread.processMultiTurnMessage('질문2', state);
      state = (r2 as { _resumeState: Record<string, unknown> })._resumeState;

      // thread service 미주입이라 turns 가 비어 keepUserExchanges=0 → 압축 skip.
      const meta2 = (r2 as { meta?: Record<string, unknown> }).meta ?? {};
      expect(
        (meta2.memory as { compactedMessages?: number }).compactedMessages,
      ).toBeUndefined();
      const len2 = (state.messages as unknown[]).length;
      // user2 + assistant2 만 순증 (물리 압축으로 줄지 않음).
      expect(len2).toBe(len1 + 2);
    });

    it('recall 실패 시에도 핸들러는 graceful 하게 정상 응답을 낸다', async () => {
      // recall 이 reject 해도 (서비스 내부 graceful 가드를 우회한 극단 케이스)
      // 핸들러가 throw 하지 않고 빈 회수로 정상 응답을 내보내야 한다.
      agentMemoryService.recall.mockRejectedValue(new Error('recall blew up'));
      const context = makeContext();
      const handler = buildHandler();
      const result = await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'What plan am I on?',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'persistent',
          memoryKey: 'user-42',
          memoryTokenBudget: 100000,
        },
        context,
      );

      // 메인 답변은 정상적으로 생성됐다.
      expect(mockLlmService.chat).toHaveBeenCalled();
      const meta = (result as { meta?: Record<string, unknown> }).meta ?? {};
      // 회수 0 으로 graceful — recall 실패가 응답 경로를 깨지 않는다.
      expect(meta.memory).toMatchObject({
        strategy: 'persistent',
        recalledCount: 0,
      });
      // 응답 객체가 정상 반환됐다 (throw 없이 graceful 종결).
      expect(result).toBeDefined();
      expect((result as { meta?: unknown }).meta).toBeDefined();
    });

    it('falls back to executionId scope when memoryKey is empty', async () => {
      const context = makeContext();
      const handler = buildHandler();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'persistent',
          memoryTokenBudget: 100000,
        },
        context,
      );
      expect(agentMemoryService.resolveScopeKey).toHaveBeenCalledWith(
        undefined,
        'exec-1',
      );
      // resolveScopeKey returns exec id when key empty → recall uses it.
      expect(agentMemoryService.recall.mock.calls[0][1]).toBe('exec-1');
    });
  });

  describe('턴 경계 비동기 추출 enqueue (spec §3·§6.1 단계 2.7 — producer)', () => {
    it('persistent single-turn 최종 응답 후 scheduleExtraction 호출 (payload·snapshot)', async () => {
      const context = makeContext();
      const handler = buildHandler();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-xyz',
          systemPrompt: 'Sys',
          userPrompt: '내 이름은 지수야',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'persistent',
          memoryKey: 'user-42',
          memoryTokenBudget: 100000,
        },
        context,
      );

      expect(agentMemoryService.scheduleExtraction).toHaveBeenCalledTimes(1);
      const arg = agentMemoryService.scheduleExtraction.mock.calls[0][0];
      expect(arg).toMatchObject({
        workspaceId: 'ws-1',
        scopeKey: 'user-42',
        llmConfigId: 'cfg-xyz',
        model: 'gpt-4o',
      });
      // snapshot 에 직전 user↔assistant 교환이 담긴다.
      const texts = (arg.turns as { source: string; text: string }[]).map(
        (t) => `${t.source}:${t.text}`,
      );
      expect(texts).toContain('ai_user:내 이름은 지수야');
      expect(texts).toContain('ai_assistant:AI response');
    });

    it('snapshot 격리 — enqueue 후 thread 에 turn 을 push 해도 snapshot 불변', async () => {
      const context = makeContext();
      const handler = buildHandler();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: '질문',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'persistent',
          memoryTokenBudget: 100000,
        },
        context,
      );
      const arg = agentMemoryService.scheduleExtraction.mock.calls[0][0];
      const lenAtEnqueue = (arg.turns as unknown[]).length;
      // 이후 메인 루프가 새 turn 을 push 하는 상황을 모사.
      conversationThreadService.appendAiAssistantMessage(context, {
        node: { id: 'other', label: 'Other', type: 'ai_agent' },
        content: 'later turn after extraction enqueue',
      });
      expect((arg.turns as unknown[]).length).toBe(lenAtEnqueue);
    });

    it('summary_buffer 전략은 scheduleExtraction 호출 안 함 (회귀 금지)', async () => {
      const context = makeContext();
      const handler = buildHandler();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'summary_buffer',
          memoryTokenBudget: 100000,
        },
        context,
      );
      expect(agentMemoryService.scheduleExtraction).not.toHaveBeenCalled();
    });

    it('manual 전략은 scheduleExtraction 호출 안 함 (하위호환)', async () => {
      const context = makeContext();
      const handler = buildHandler();
      await handler.execute(
        undefined,
        {
          mode: 'single_turn',
          model: 'gpt-4o',
          systemPrompt: 'Sys',
          userPrompt: 'Hi',
          responseFormat: 'text',
          maxToolCalls: 10,
          memoryStrategy: 'manual',
        },
        context,
      );
      expect(agentMemoryService.scheduleExtraction).not.toHaveBeenCalled();
    });

    it('persistent multi-turn 매 turn 종료 후 enqueue (user query 도착 turn)', async () => {
      const context = makeContext();
      const handler = buildHandler();
      const first = await handler.execute(
        undefined,
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          llmConfigId: 'cfg-1',
          systemPrompt: 'You are helpful',
          maxToolCalls: 10,
          maxTurns: 20,
          memoryStrategy: 'persistent',
          memoryKey: 'cust-7',
          memoryTokenBudget: 100000,
        },
        context,
      );
      // 첫 waiting tick (user query 없음) 은 enqueue 안 함.
      expect(agentMemoryService.scheduleExtraction).not.toHaveBeenCalled();

      const state = (first as { _resumeState: Record<string, unknown> })
        ._resumeState;
      await handler.processMultiTurnMessage('주문 상태 알려줘', state);

      expect(agentMemoryService.scheduleExtraction).toHaveBeenCalledTimes(1);
      expect(
        agentMemoryService.scheduleExtraction.mock.calls[0][0],
      ).toMatchObject({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
      });
    });
  });
});
