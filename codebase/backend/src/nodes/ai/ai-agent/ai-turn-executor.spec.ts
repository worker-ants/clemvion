import { AiTurnExecutor } from './ai-turn-executor';
import { AiConditionEvaluator } from './ai-condition-evaluator';
import { AiMemoryManager } from './ai-memory-manager';
import { ExecutionContext } from '../../core/node-handler.interface';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';

/**
 * AiTurnExecutor unit — refactor 02-architecture §M-1 3단계로 핸들러에서 분리한
 * turn 실행 엔진(single/multi 루프·tool 실행·출력 조립·thread push)을 입출력
 * 단위로 직접 고정한다. 기존엔 `ai-agent.handler.spec` 134KB 가 핸들러 facade 를
 * 통해 간접 테스트했고, 본 spec 은 executor 를 **직접 구성**해 collaborator 주입·
 * graceful degrade·출력 포트 shape·`_retryState` 생명주기를 격리 검증한다
 * (#665 `AiConditionEvaluator` · #668 `AiMemoryManager` 선례 동형, behavior-preserving).
 *
 * executor 는 무상태 collaborator 이고 외부 의존(llm·tool providers·eventEmitter·
 * thread service)과 선행 collaborator(conditionEvaluator·memoryManager)를 생성자로
 * 받으므로, 실제로 건드리는 작은 표면만 부분 fake 로 주입한다.
 */
describe('AiTurnExecutor', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let mockEventEmitter: { emitExecution: jest.Mock };

  const buildExecutor = (
    opts: {
      toolProviders?: unknown[];
      withEventEmitter?: boolean;
    } = {},
  ): AiTurnExecutor =>
    new AiTurnExecutor(
      mockLlmService as never,
      new AiConditionEvaluator(),
      // thread / agent-memory service 미주입 — manual 외 전략은 graceful degrade.
      new AiMemoryManager(mockLlmService as never, undefined, undefined),
      (opts.toolProviders ?? []) as never,
      opts.withEventEmitter === false ? undefined : (mockEventEmitter as never),
      // conversationThreadService 미주입 — thread push 는 no-op 으로 degrade.
      undefined,
    );

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
    };
    mockEventEmitter = { emitExecution: jest.fn() };
  });

  const baseContext: ExecutionContext = makeExecutionContext({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
  });

  describe('executeSingleTurn', () => {
    it('produces an `out` port ended result for a plain text response', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'You are helpful.',
          userPrompt: 'Hi',
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.port).toBe('out');
      expect(result.status).toBe('ended');
      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.response).toBe('Hello! I am an AI assistant.');
      expect(output.result.turnCount).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('degrades gracefully without an eventEmitter (telemetry omitted)', async () => {
      const executor = buildExecutor({ withEventEmitter: false });
      const result = (await executor.executeSingleTurn(
        undefined,
        { mode: 'single_turn', systemPrompt: 'sys', userPrompt: 'Hi' },
        baseContext,
      )) as Record<string, unknown>;
      expect(result.status).toBe('ended');
      expect(mockEventEmitter.emitExecution).not.toHaveBeenCalled();
    });
  });

  describe('executeMultiTurn (first-turn park)', () => {
    it('returns waiting_for_input + _resumeState without calling the LLM', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeMultiTurn(
        undefined,
        { mode: 'multi_turn', systemPrompt: 'You are a support agent.' },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      // 첫 진입은 LLM 호출을 사용자 메시지 수신 후로 미룬다 (spec §6.2 step 1.b).
      expect(mockLlmService.chat).not.toHaveBeenCalled();
      const resumeState = result._resumeState as Record<string, unknown>;
      expect(resumeState).toBeDefined();
      expect(resumeState.turnCount).toBe(0);
      // credential 은 _resumeState 에는 담기되 마스킹은 엔진 boundary 책임.
      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.turnCount).toBe(0);
      expect(output.result.message).toBe('');
    });
  });

  describe('processMultiTurnMessage (resume loop)', () => {
    const resumeState = (): Record<string, unknown> => ({
      llmConfigId: 'cfg-1',
      model: 'gpt-4o',
      maxToolCalls: 10,
      maxTurns: 20,
      knowledgeBases: [],
      conditions: [],
      mcpServers: [],
      presentationTools: [],
      messages: [{ role: 'system', content: 'You are a support agent.' }],
      turnCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      workspaceId: 'ws-1',
      executionId: 'exec-1',
      memoryStrategy: 'manual',
    });

    it('appends the user turn, calls the LLM, and re-enters waiting_for_input', async () => {
      const executor = buildExecutor();
      const result = (await executor.processMultiTurnMessage(
        '환불 문의입니다',
        resumeState(),
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      const next = result._resumeState as Record<string, unknown>;
      expect(next.turnCount).toBe(1);
      const output = result.output as { result: { messages: unknown[] } };
      // system + user + assistant 누적.
      expect(output.result.messages.length).toBeGreaterThanOrEqual(3);
    });

    it('routes to max_turns when the turn budget is exhausted', async () => {
      const executor = buildExecutor();
      const state = { ...resumeState(), turnCount: 19, maxTurns: 20 };
      const result = (await executor.processMultiTurnMessage(
        'one more',
        state,
      )) as Record<string, unknown>;
      expect(result.status).toBe('ended');
      expect(result.port).toBe('max_turns');
    });
  });

  describe('endMultiTurnConversation', () => {
    const endState = (): Record<string, unknown> => ({
      messages: [
        { role: 'user', content: 'bye' },
        { role: 'assistant', content: 'Goodbye!' },
      ],
      turnCount: 3,
      model: 'gpt-4o',
      totalInputTokens: 100,
      totalOutputTokens: 30,
      toolCalls: 0,
      ragSources: [],
    });

    it('maps user_ended to the user_ended port', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(
        endState(),
        'user_ended',
      ) as Record<string, unknown>;
      expect(result.port).toBe('user_ended');
      expect(result.status).toBe('ended');
    });

    it('carries output.error + _retryState only for retryable errors', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(
        endState(),
        'error',
        {
          code: 'LLM_TIMEOUT',
          message: 'timeout',
          details: { retryable: true },
        },
        'failed message',
      ) as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as { error?: { code: string } };
      expect(output.error?.code).toBe('LLM_TIMEOUT');
      const retryState = result._retryState as Record<string, unknown>;
      expect(retryState).toBeDefined();
      expect(retryState.expiresAt).toEqual(expect.any(String));
      // spec §7.9 — credential (llmConfigId) 미동봉.
      expect(retryState.llmConfigId).toBeUndefined();
      expect(retryState.lastUserMessage).toBe('failed message');
    });

    it('omits _retryState for non-retryable errors', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(endState(), 'error', {
        code: 'BAD_REQUEST',
        message: 'nope',
        details: { retryable: false },
      }) as Record<string, unknown>;
      expect(result._retryState).toBeUndefined();
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    const meta = {
      model: 'gpt-4o',
      totalInputTokens: 10,
      totalOutputTokens: 5,
      toolCalls: 0,
      ragSources: [],
    };

    it('maps max_turns / user_ended / error to their ports', () => {
      const executor = buildExecutor();
      expect(
        (
          executor.buildMultiTurnFinalOutput(
            [],
            '',
            1,
            'max_turns',
            meta,
          ) as Record<string, unknown>
        ).port,
      ).toBe('max_turns');
      expect(
        (
          executor.buildMultiTurnFinalOutput(
            [],
            '',
            1,
            'user_ended',
            meta,
          ) as Record<string, unknown>
        ).port,
      ).toBe('user_ended');
      // condition 은 buildConditionOutput 경로 — 여기로 새면 방어적으로 error.
      expect(
        (
          executor.buildMultiTurnFinalOutput(
            [],
            '',
            1,
            'condition',
            meta,
          ) as Record<string, unknown>
        ).port,
      ).toBe('error');
    });
  });
});
