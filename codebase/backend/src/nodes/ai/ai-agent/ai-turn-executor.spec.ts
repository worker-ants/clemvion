import {
  AiTurnExecutor,
  capFormDataBytes,
  FORM_SUBMITTED_MAX_BYTES,
} from './ai-turn-executor';
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

    // C-2 1차 — buildSingleTurnSystemPrompt 의 §11.4 ordering 분기(KB/condition/
    // presentation guidance)를 executor 레벨에서 직접 고정. setup 추출(메서드 분리)
    // 후 system 프롬프트 조립 회귀를 핸들러 spec 간접 커버에 의존하지 않고 잡는다.
    it('composes the §11.4-ordered system prompt (systemPrompt → KB → condition → presentation)', async () => {
      const executor = buildExecutor();
      await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'You are helpful.',
          userPrompt: 'Hi',
          knowledgeBases: ['kb-1'],
          conditions: [{ id: 'c1', prompt: '환불 요청' }],
          presentationTools: [{ type: 'render_table' }],
        },
        baseContext,
      );

      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      const chatPayload = mockLlmService.chat.mock.calls[0][1] as {
        messages: Array<{ role: string; content: string }>;
      };
      const sys = chatPayload.messages.find(
        (m) => m.role === 'system',
      )?.content;
      expect(sys).toBeDefined();
      // [2] 사용자 systemPrompt · [3] KB · [4] condition · presentation guidance 모두 포함
      expect(sys).toContain('You are helpful.');
      expect(sys).toContain('[Knowledge Base]');
      expect(sys).toContain('[조건 안내]');
      expect(sys).toContain('환불 요청');
      expect(sys).toContain('[Presentation Tools]');
      // §11.4 ordering: systemPrompt → KB_TOOL_GUIDANCE → condition suffix (인덱스 단조 증가)
      expect(sys!.indexOf('You are helpful.')).toBeLessThan(
        sys!.indexOf('[Knowledge Base]'),
      );
      expect(sys!.indexOf('[Knowledge Base]')).toBeLessThan(
        sys!.indexOf('[조건 안내]'),
      );
    });

    // C-2 2차 (review W10) — condition-only 라우팅(handleSingleTurnConditionRoute)
    // 을 executor 레벨에서 고정: LLM 이 조건 도구만 호출하면 즉시 condition 분기로
    // 종결한다 (루프 미진입).
    it('routes to the condition branch when the LLM calls only a condition tool', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 't1', name: 'cond_c1', arguments: {} }],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: '환불해주세요',
          conditions: [{ id: 'c1', label: '환불', prompt: '환불 요청' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.endReason).toBe('condition');
      expect((output.result.condition as { id: string }).id).toBe('c1');
      // condition-only → 즉시 분기, 루프 미진입(첫 호출 후 종결).
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    // C-2 2차 (review W1/W6) — single-turn 도구 루프에서 condition deferral 은
    // toolCallCount 에 합산되지 않고(§3.f-g), normal 도구만 합산되는 비대칭을
    // executor 레벨에서 고정 (multi-turn 의 동명 helper 는 의도적으로 합산 — 다름).
    it('counts only normal tools, not condition tools, toward toolCalls (single-turn)', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 't1', name: 'cond_c1', arguments: {} },
            { id: 't2', name: 'do_thing', arguments: {} },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '완료했습니다.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          conditions: [{ id: 'c1', label: 'c', prompt: 'p' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.status).toBe('ended');
      // cond_c1 은 미합산, do_thing(normal) 만 +1 → toolCalls === 1.
      expect((result.meta as { toolCalls: number }).toolCalls).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
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

    // C-2 후속 (review W7 / impl-prep BLOCK 해소) — multi-turn 도구 루프에서
    // condition deferral 은 toolCallCount 에 합산하지 않고(spec §7.1 조건 도구
    // 제외) normal 도구만 합산. single-turn 과 동일 정책으로 통일됨을 고정.
    it('does not count condition tools toward toolCalls in multi-turn, only normal tools', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 't1', name: 'cond_c1', arguments: {} },
            { id: 't2', name: 'do_thing', arguments: {} },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '처리했습니다.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor();
      const state = {
        ...resumeState(),
        conditions: [{ id: 'c1', label: 'c', prompt: 'p' }],
      };
      const result = (await executor.processMultiTurnMessage(
        'go',
        state,
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      // cond_c1 미합산, do_thing(normal)만 +1 → toolCalls === 1 (single-turn 과 동일).
      const next = result._resumeState as { toolCalls: number };
      expect(next.toolCalls).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
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

    it('carries resume-state allow-list fields into _retryState (M-7 cast 제거 회귀 가드)', () => {
      // buildRetryState 가 mcpServers/knowledgeBases/pendingFormToolCall/
      // totalThinkingTokens 의 `as` 단언을 ResumeState 타입화로 제거한 뒤에도
      // non-default 값을 그대로 운반하는지 검증 (behavior-preserving).
      const executor = buildExecutor();
      const mcpServers = [{ id: 'srv-1', tools: ['t'] }];
      const knowledgeBases = [{ id: 'kb-1' }];
      const pendingFormToolCall = { toolCallId: 'call-1', formSchema: {} };
      const state = {
        ...endState(),
        totalThinkingTokens: 7,
        mcpServers,
        knowledgeBases,
        pendingFormToolCall,
      };
      const result = executor.endMultiTurnConversation(state, 'error', {
        code: 'LLM_TIMEOUT',
        message: 'timeout',
        details: { retryable: true },
      }) as Record<string, unknown>;
      const retryState = result._retryState as Record<string, unknown>;
      expect(retryState.mcpServers).toEqual(mcpServers);
      expect(retryState.knowledgeBases).toEqual(knowledgeBases);
      expect(retryState.pendingFormToolCall).toEqual(pendingFormToolCall);
      expect(retryState.totalThinkingTokens).toBe(7);
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

    // spec §3.2 — 종결 사유별 전용 포트. `condition` 은 buildConditionOutput
    // 경로이므로 이 함수로 새면 방어적으로 `error` 로 매핑한다.
    it.each([
      ['max_turns', 'max_turns'],
      ['user_ended', 'user_ended'],
      ['error', 'error'],
      ['condition', 'error'],
    ] as const)('maps endReason=%s to port %s', (endReason, port) => {
      const executor = buildExecutor();
      const result = executor.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        endReason,
        meta,
      ) as Record<string, unknown>;
      expect(result.port).toBe(port);
      expect(result.status).toBe('ended');
    });
  });

  // spec §12.7 — form 제출 tool_result content 의 byte cap. 복잡한 순수 함수라
  // executor 모듈에서 export 해 직접 단위 고정한다 (ai-review WARNING #7).
  describe('capFormDataBytes', () => {
    it('returns formData unchanged below the cap (no truncation meta)', () => {
      const formData = { name: '홍길동', note: 'short' };
      const { capped, formDataTruncation } = capFormDataBytes(
        formData,
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(capped).toEqual(formData);
      expect(formDataTruncation).toBeUndefined();
    });

    it('truncates oversized string fields and reports truncation meta', () => {
      const big = 'a'.repeat(FORM_SUBMITTED_MAX_BYTES + 5000);
      const { capped, formDataTruncation } = capFormDataBytes(
        { essay: big, keep: 1 },
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(formDataTruncation).toBeDefined();
      expect(formDataTruncation?.truncatedFields).toContain('essay');
      // 비-string 필드는 보존, 구조도 보존.
      expect((capped as { keep: number }).keep).toBe(1);
      expect(
        Buffer.byteLength(JSON.stringify(capped), 'utf8'),
      ).toBeLessThanOrEqual(
        Buffer.byteLength(JSON.stringify({ essay: big, keep: 1 }), 'utf8'),
      );
    });

    it('truncates on UTF-8 byte boundaries (multibyte safe)', () => {
      // 한글은 3 bytes/char — byte 단위 절단이 valid UTF-8 을 깨지 않아야 한다.
      const big = '가'.repeat(FORM_SUBMITTED_MAX_BYTES);
      const { capped } = capFormDataBytes(
        { ko: big },
        FORM_SUBMITTED_MAX_BYTES,
      );
      // round-trip 가능한 valid UTF-8 인지 확인 (깨진 surrogate 없음).
      expect(() => JSON.stringify(capped)).not.toThrow();
      expect(typeof (capped as { ko: string }).ko).toBe('string');
    });

    it('attaches truncation meta even when no string field is truncatable', () => {
      // 모든 필드가 비-string 인데 cap 초과 — truncate 대상 없음이지만 메타는 부착.
      const arr = Array.from({ length: 4000 }, (_, i) => i);
      const { capped, formDataTruncation } = capFormDataBytes(
        { ids: arr },
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(capped).toEqual({ ids: arr });
      expect(formDataTruncation?.truncatedFields).toEqual([]);
    });
  });

  // spec §6.2 step 2.c — render_form 제출 resume 분기를 executor 레벨에서 직접
  // 고정 (ai-review WARNING #8). pendingFormToolCall 클리어 부작용 포함.
  describe('processMultiTurnMessage — form_submitted resume', () => {
    const formResumeState = (): Record<string, unknown> => ({
      llmConfigId: 'cfg-1',
      model: 'gpt-4o',
      maxToolCalls: 10,
      maxTurns: 20,
      knowledgeBases: [],
      conditions: [],
      mcpServers: [],
      presentationTools: [],
      // 직전 turn 의 render_form tool_use 가 messages 에 남아 있어야 tool_result
      // splice 가 toolCallId 로 매칭된다 (tool_use ↔ tool_result 페어링).
      messages: [
        { role: 'system', content: 'sys' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'form-tc-1', name: 'render_form', arguments: {} }],
        },
      ],
      turnCount: 1,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      workspaceId: 'ws-1',
      executionId: 'exec-1',
      memoryStrategy: 'manual',
      pendingFormToolCall: { toolCallId: 'form-tc-1', formConfig: {} },
    });

    it('splices the form tool_result, clears pendingFormToolCall, and continues', async () => {
      const executor = buildExecutor();
      const state = formResumeState();
      const result = (await executor.processMultiTurnMessage(
        JSON.stringify({ email: 'a@b.com' }),
        state,
        { source: 'form_submitted' },
      )) as Record<string, unknown>;

      // form 제출 후 LLM 재호출 → waiting 재진입.
      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      // pendingFormToolCall 클리어 부작용 (호출자 state 변이).
      expect(state.pendingFormToolCall).toBeUndefined();
      // 다음 turn resume state 에도 pendingFormToolCall 이 남지 않는다.
      const next = result._resumeState as Record<string, unknown>;
      expect(next.pendingFormToolCall).toBeUndefined();
    });

    // C-2 2차 (review W3) — form bypass(handleMultiTurnUserMessageEntry §6.2
    // 2.c.bypass): 사용자가 form 활성 중 일반 ai_message 를 보내면 render_form
    // tool_use 를 cancelled tool_result 로 채우고 pendingFormToolCall 클리어 +
    // 정상 ai_user turn 진행 (tool_use↔tool_result 매칭 보존).
    it('bypasses the active form on a plain ai_message: cancels the tool_result and clears pendingFormToolCall', async () => {
      const executor = buildExecutor();
      const state = formResumeState();
      const result = (await executor.processMultiTurnMessage(
        '그냥 다른 질문할게요',
        state,
        { source: 'ai_message' },
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      // bypass: pendingFormToolCall 클리어 (caller state + resume state).
      expect(state.pendingFormToolCall).toBeUndefined();
      const next = result._resumeState as Record<string, unknown>;
      expect(next.pendingFormToolCall).toBeUndefined();
      // cancelled tool_result 가 render_form tool_use(form-tc-1)와 매칭되어 삽입됨.
      const msgs = next.messages as Array<{
        role: string;
        toolCallId?: string;
        content?: string;
      }>;
      const cancelled = msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'form-tc-1',
      );
      expect(cancelled).toBeDefined();
      expect(cancelled!.content).toContain('user_sent_message_instead');
    });
  });
});
