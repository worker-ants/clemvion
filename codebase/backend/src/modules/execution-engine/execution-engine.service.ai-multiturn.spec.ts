import { ExecutionEngineService } from './execution-engine.service';
import { userMessageSignalApplies } from './ai-conversation-helpers';
import {
  resumeCheckpointSchema,
  CREDENTIAL_CONTEXT_FIELDS,
} from './utils/resume-state.schema';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { NodeHandler } from '../../nodes/core/node-handler.interface';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../../nodes/ai/llm-provider-rule';
import {
  armSlowPathResume,
  flushResumeDrive,
} from './__test-utils__/engine-service-resume-drive';

/**
 * ExecutionEngineService 단위 테스트: AI Agent 멀티턴 emit · 재개 턴 dispatch · LLM provider 규칙.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  // C-1 step2 — AI 멀티턴 lifecycle 은 AiTurnOrchestrator 로 추출됨. 엔진의
  // dispatch/registry/retry 가 위임하므로, 추출된 메서드를 spy 하는 테스트는 본
  // 인스턴스를 대상으로 한다 (엔진 인스턴스가 아님).
  let aiTurnOrchestrator: AiTurnOrchestrator;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      aiTurnOrchestrator,
      handlerRegistry,
      mockWebsocketService,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = h);
  });

  describe('AI Agent multi-turn — execution.ai_message emit shape', () => {
    // spec/5-system/6-websocket-protocol.md §4.4 — waiting_for_input emit
    // must carry `llmCalls` (array) + `durationMs` and must NOT carry the
    // legacy flat fields requestPayload / responsePayload that no shipping
    // frontend reads. This is the contract a regression here would silently
    // break; helper unit tests cover the transformation, this integration
    // test covers the emit call site.
    const aiNodes: Partial<Node>[] = [
      {
        id: 'node-agent',
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: { mode: 'multi_turn' },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const aiEdges: Partial<Edge>[] = [];

    function makeAiAgentHandler(processReturn: () => unknown): NodeHandler & {
      processMultiTurnMessage: jest.Mock;
      endMultiTurnConversation: jest.Mock;
    } {
      return {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          // D6 (2026-05-17) — waiting `output.result.*` 단일 경로.
          output: { result: { messages: [], message: '', turnCount: 0 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            turnDebugHistory: [],
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
          },
        })),
        processMultiTurnMessage: jest.fn(async () => processReturn()),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & {
        processMultiTurnMessage: jest.Mock;
        endMultiTurnConversation: jest.Mock;
      };
    }

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(aiNodes);
      mockEdgeRepo.findBy.mockResolvedValue(aiEdges);
    });

    it('emits messages snapshot, llmCalls, and durationMs (and omits removed flat fields) on resumed waiting turn', async () => {
      // Distinct values for per-call vs turn-total durationMs so the test
      // pinpoints which source the payload's top-level durationMs comes
      // from (must be the turn total, not the last LLM call's latency).
      const llmCall = {
        requestPayload: { messages: [{ role: 'user', content: 'hi' }] },
        responsePayload: {
          content: 'hello',
          model: 'test-model',
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        durationMs: 90,
      };
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
            message: 'hello',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [
            {
              turnIndex: 1,
              llmCalls: [llmCall],
              totalDurationMs: 120,
            },
          ],
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      // Phase B (exec-park D4) — top-level AI multi-turn 은 첫 응답 emit 후
      // park-release 한다. 후속 turn 은 §7.5 slow-path(rehydration →
      // processAiResumeTurn → handleAiMessageTurn) 로 처리되므로 slow-path
      // DB lookup 을 무장한 뒤 detached drive 완료까지 실제 타이머를 흘린다.
      armSlowPathResume(h, 'node-agent', aiNodes[0]);
      void service.continueAiConversation(executionId, 'hi');
      await flushResumeDrive();

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(1);
      const payload = aiMessageCalls[0][2] as Record<string, unknown>;

      // Frontend drops payloads missing this field — assert the engine
      // honors the contract (system role filtered, length > 0).
      expect(payload).toHaveProperty('messages');
      expect(Array.isArray(payload.messages)).toBe(true);
      expect((payload.messages as unknown[]).length).toBeGreaterThan(0);

      expect(payload).toMatchObject({
        nodeId: 'node-agent',
        message: 'hello',
        turnCount: 1,
        // turn-total (totalDurationMs), not the per-call llmCall.durationMs (90)
        durationMs: 120,
      });
      // Sub-Workflow nesting 에서 같은 nodeId 의 AI Agent 가 여러 row 일 수
      // 있으므로 nodeExecutionId 동봉 필수 (timeline 회귀 점검 #2).
      expect(payload).toHaveProperty('nodeExecutionId');
      expect(payload.llmCalls).toEqual([llmCall]);

      // Dead fields removed in this branch alignment — guard against
      // accidental reintroduction.
      expect(payload).not.toHaveProperty('requestPayload');
      expect(payload).not.toHaveProperty('responsePayload');
    });

    // §4.x 회귀 가드 (AI multi-turn) — worker job 반환이 가장 중요한 케이스.
    // 옛 구현에서 AI 멀티턴 `waitForAiConversation` 은 대화 종료까지 도는 장수
    // 루프라 worker 슬롯을 대화 수명 내내 점유했다 (가장 심각한 starvation).
    // Phase B (exec-park D4) — top-level AI 멀티턴은 첫 응답 emit 후 park-release:
    // `runExecutionFromQueue` 가 첫 turn park 시점에 resolve(슬롯 반환)하고 in-memory
    // resolver 를 **남기지 않는다** (bounded memory). 후속 turn 입력은 §7.5
    // slow-path(rehydration → processAiResumeTurn)로 재개되며 worker 를 점유하지 않는다.
    //
    // 커버리지 노트 (ai-review testing Info): `information_extractor` multi-turn 의
    // park 도 동일 공용 경로(`waitForAiConversation('release')` → PARK_RELEASED)를
    // 타므로 본 ai_agent 테스트가 그 분기까지 함께 가드한다 (별도 노드-타입 테스트 불요).
    it('§4.x — runExecutionFromQueue 는 AI 멀티턴 첫 park 시점에 resolve, resolver 미잔류 + 후속 turn 은 slow-path 재개', async () => {
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
            message: 'hello',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [],
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const fromQueue = service.runExecutionFromQueue(executionId, {});
      // park-release — worker 진입점은 첫 park 에서 반환한다.
      await expect(fromQueue).resolves.toBeUndefined();

      // exec-park D6 full B3 — park 는 durable persist + WAITING 전이로 완결되며
      // in-memory resolver/coroutine 잔류가 없다 (bounded memory).

      // 후속 turn 입력은 §7.5 slow-path(rehydration)로 재개 → 동일 노드의
      // processMultiTurnMessage 가 호출된다.
      armSlowPathResume(h, 'node-agent', aiNodes[0]);
      void service.continueAiConversation(executionId, 'hi');
      await flushResumeDrive();
      expect(handler.processMultiTurnMessage).toHaveBeenCalled();
    });

    // spec/5-system/6-websocket-protocol.md §4.4 execution.user_message +
    // spec/4-nodes/3-ai/1-ai-agent.md §7.5 — 사용자 발화(q)를 다음 턴 LLM 호출
    // 전에 라이브로 노출하기 위한 진행 신호. AI 응답(a) emit(ai_message) 보다
    // 먼저 발화해야 q 가 a 전에 보인다.
    it('emits execution.user_message (q) before execution.ai_message (a), with the expected payload', async () => {
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: '주문 확인해줘' },
              { role: 'assistant', content: '네, 확인하겠습니다' },
            ],
            message: '네, 확인하겠습니다',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: '주문 확인해줘' },
            { role: 'assistant', content: '네, 확인하겠습니다' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [],
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      // Phase B (exec-park D4) — 후속 turn 은 §7.5 slow-path(processAiResumeTurn).
      armSlowPathResume(h, 'node-agent', aiNodes[0]);
      void service.continueAiConversation(executionId, '주문 확인해줘');
      await flushResumeDrive();

      const calls = mockWebsocketService.emitExecutionEvent.mock.calls;
      const userMsgCalls = calls.filter(
        (call: unknown[]) => call[1] === 'execution.user_message',
      );
      // 정확히 1회 emit + payload contract.
      expect(userMsgCalls).toHaveLength(1);
      const userPayload = userMsgCalls[0][2] as Record<string, unknown>;
      expect(userPayload).toMatchObject({
        nodeId: 'node-agent',
        message: '주문 확인해줘',
      });
      // nodeExecutionId 는 waiting NodeExecution row PK — 존재 + 문자열 보장
      // (toHaveProperty 만으로는 undefined 도 통과하므로 강화, ai-review W8).
      expect(typeof userPayload.nodeExecutionId).toBe('string');
      expect(userPayload.nodeExecutionId).toBeTruthy();
      expect(typeof userPayload.receivedAt).toBe('string');

      // ordering: user_message(q) 가 ai_message(a) 보다 먼저.
      const userIdx = calls.findIndex(
        (call: unknown[]) => call[1] === 'execution.user_message',
      );
      const aiIdx = calls.findIndex(
        (call: unknown[]) => call[1] === 'execution.ai_message',
      );
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(aiIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeLessThan(aiIdx);
    });

    // ai-review W6 — form 제출 경로는 USER_MESSAGE 미발화 (spec §6.2 / §7.5).
    // 발화 게이팅 predicate 를 직접 단언해 회귀를 차단한다 (full form-render
    // blocking flow 의 무거운 fixture 없이 결정적 검증).
    it('userMessageSignalApplies: ai_message 발화 / form_submitted 미발화', () => {
      expect(userMessageSignalApplies('ai_message')).toBe(true);
      expect(userMessageSignalApplies('form_submitted')).toBe(false);
    });

    it('preserves the full llmCalls sequence for tool-loop turns', async () => {
      const calls = [
        {
          requestPayload: { tool: 1 },
          responsePayload: { content: '' },
          durationMs: 30,
        },
        {
          requestPayload: { tool: 2 },
          responsePayload: { content: '' },
          durationMs: 40,
        },
        {
          requestPayload: { tool: 3 },
          responsePayload: { content: 'final' },
          durationMs: 50,
        },
      ];
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'final' },
            ],
            message: 'final',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'final' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          turnDebugHistory: [
            { turnIndex: 1, llmCalls: calls, totalDurationMs: 120 },
          ],
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      // Phase B (exec-park D4) — 후속 turn 은 §7.5 slow-path(processAiResumeTurn).
      armSlowPathResume(h, 'node-agent', aiNodes[0]);
      void service.continueAiConversation(executionId, 'hi');
      await flushResumeDrive();

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(1);
      const payload = aiMessageCalls[0][2] as Record<string, unknown>;
      expect(payload).toHaveProperty('messages');
      expect(Array.isArray(payload.messages)).toBe(true);
      expect((payload.messages as unknown[]).length).toBeGreaterThan(0);
      expect(payload.llmCalls).toEqual(calls);
      expect(payload.llmCalls as unknown[]).toHaveLength(3);
      expect(payload.durationMs).toBe(120);
    });

    // multi-turn 후속 turn 의 NodeExecution.outputData DB 영속 회귀 가드.
    //
    // 버그: 워크플로 실행 중인 AI Agent multi-turn 의 첫 turn 후속(2번째 turn
    // 부터)에서 `handleAiMessageTurn` 의 waiting_for_input 분기가 in-memory
    // context cache 만 갱신하고 `nodeExecutionRepository.save` 를 호출하지 않아,
    // 같은 실행을 다른 탭(실행 상세 페이지)에서 열면 첫 user 메시지 외 후속
    // user/assistant/tool 메시지가 표시되지 않았다.
    //
    // spec/5-system/4-execution-engine.md §646 — "NodeExecution.outputData
    // 가 영구 SoT". spec/4-nodes/3-ai/1-ai-agent.md §7.4 — "종료 조건 미충족
    // 시 다시 waiting_for_input — output.result.messages 가 누적 상태로 갱신".
    it('persists outputData (messages + interactionType + _resumeState strip + _resumeCheckpoint credential-strip) on multi-turn follow-up waiting turn', async () => {
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
            message: 'hello',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [
            { turnIndex: 1, llmCalls: [], totalDurationMs: 120 },
          ],
          // 민감 internal state — DB 에 새어 나가면 WARN #6 회귀.
          systemPrompt: 'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST',
          llmConfigId: 'cred-leak-canary',
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Phase B (exec-park D4) — 후속 turn 은 §7.5 slow-path(processAiResumeTurn).
      // armSlowPathResume 가 첫 turn 의 WAITING save outputData(_resumeCheckpoint
      // 포함)를 읽어 findOneBy mock 을 무장하므로, save mock clear 보다 먼저 호출한다.
      armSlowPathResume(h, 'node-agent', aiNodes[0]);

      // 첫 turn waiting 진입 시점의 save 호출은 무시 — 후속 turn 만 검증.
      mockNodeExecutionRepo.save.mockClear();

      // 후속 turn 입력 — slow-path 재개. detached drive(processAiResumeTurn →
      // handleAiMessageTurn 의 waiting 분기 re-park persist)가 완료되도록 실제
      // 타이머를 흘린다.
      void service.continueAiConversation(executionId, 'hi');
      await flushResumeDrive();

      // 후속 turn waiting 분기에서 NodeExecution save 가 호출되어야 한다.
      // (Button/Form 대기 및 첫 turn 대기와 동일 패턴.)
      expect(mockNodeExecutionRepo.save).toHaveBeenCalled();

      // save 된 entity 중 ai_agent 노드의 것 한 건 이상.
      // ai-review W5 — nodeId 하드코딩이 fixture 와 결합되어 있어 fixture
      // 변경 시 한 곳만 갱신하도록 상수화 + 진단성 메시지 분리. Jest 의
      // expect() 는 두 번째 인자 메시지를 지원하지 않아 throw 로 분기.
      const AGENT_NODE_ID = 'node-agent';
      const savedAgentRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((e) => e?.nodeId === AGENT_NODE_ID);
      if (savedAgentRows.length === 0) {
        const allNodeIds = mockNodeExecutionRepo.save.mock.calls.map(
          (call: unknown[]) => (call[0] as Partial<NodeExecution>)?.nodeId,
        );
        throw new Error(
          `no NodeExecution.save was made for nodeId=${AGENT_NODE_ID} — ` +
            `multi-turn follow-up persist may be skipped or fixture nodeId ` +
            `changed (observed save calls: [${allNodeIds.join(', ')}])`,
        );
      }
      expect(savedAgentRows.length).toBeGreaterThanOrEqual(1);

      const persisted = savedAgentRows[savedAgentRows.length - 1];
      const outputData = persisted.outputData as Record<string, unknown>;
      expect(outputData).toBeDefined();

      // (a) 누적 messages 가 outputData.output.result.messages 에 반영.
      const output = outputData.output as Record<string, unknown> | undefined;
      const result = output?.result as Record<string, unknown> | undefined;
      const messages = result?.messages as Array<Record<string, unknown>>;
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'hi' }),
          expect.objectContaining({ role: 'assistant', content: 'hello' }),
        ]),
      );

      // (b) meta.interactionType 이 'ai_conversation' 으로 마킹 — REST snapshot
      // hydration 분기 정합성 (snapshot reconcile 가 ai_conversation 분기로 진입).
      const meta = outputData.meta as Record<string, unknown> | undefined;
      expect(meta?.interactionType).toBe('ai_conversation');

      // (c) WARN #6 회귀 가드 — full `_resumeState` 는 DB 영속 페이로드에서 strip.
      expect(outputData).not.toHaveProperty('_resumeState');

      // (d) §7.5 — credential-strip 부분집합 `_resumeCheckpoint` 는 영속된다
      // (ai_agent 한정). 재시작 후 재개의 단일 진실.
      const checkpoint = outputData._resumeCheckpoint as
        Record<string, unknown> | undefined;
      expect(checkpoint).toBeDefined();
      // 안전 필드는 보존 (재구성에 필요).
      expect(checkpoint?.turnCount).toBe(1);
      expect(checkpoint?.model).toBe('test-model');
      expect(checkpoint?.totalInputTokens).toBe(5);
      expect(checkpoint?.totalOutputTokens).toBe(2);
      const cpMessages = checkpoint?.messages as Array<Record<string, unknown>>;
      expect(Array.isArray(cpMessages)).toBe(true);
      expect(cpMessages.length).toBeGreaterThanOrEqual(2);
      // credential / context-binding 필드는 checkpoint 에 미동봉 (allow-list).
      expect(checkpoint).not.toHaveProperty('llmConfigId');
      expect(checkpoint).not.toHaveProperty('systemPrompt');
      expect(checkpoint).not.toHaveProperty('turnDebugHistory');

      // (e) 페이로드 전체를 직렬화해 internal credential 식별자가 한 줄도
      // 흘러나가지 않았는지 확인 — `_resumeCheckpoint` 영속 후에도 유지돼야 한다
      // (allow-list 가 credential 을 배제하므로 canary 가 새면 회귀).
      const serialized = JSON.stringify(outputData);
      expect(serialized).not.toContain(
        'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST',
      );
      expect(serialized).not.toContain('cred-leak-canary');
    });

    // W5 (ai-review) — emitAiWaitingForInput 가드: information_extractor 노드도
    // waiting_for_input 진입 시 outputData._resumeCheckpoint 가 저장되고
    // partialResult/collectionRetryCount 가 포함됨을 검증.
    // (ai_agent 는 위 `persists outputData ... _resumeCheckpoint` 가 커버)
    it('W5: information_extractor 노드 — emitAiWaitingForInput 가드: _resumeCheckpoint 에 IE runtime state(partialResult/collectionRetryCount) 저장', async () => {
      const ieNodes: Partial<Node>[] = [
        {
          id: 'node-ie-w5',
          workflowId,
          type: 'information_extractor',
          category: NodeCategory.AI,
          label: 'IE',
          config: {
            mode: 'multi_turn',
            outputSchema: [{ name: 'name', type: 'string' }],
            maxCollectionRetries: 3,
          },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(ieNodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      // IE handler — waiting_for_input 상태로 진입 + IE 전용 state 포함.
      const ieHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 0 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
            partialResult: { name: 'Bob' },
            collectionRetryCount: 1,
          },
        })),
        processMultiTurnMessage: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 1 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 1,
            partialResult: { name: 'Bob' },
            collectionRetryCount: 1,
          },
        })),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('information_extractor', ieHandler);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // emitAiWaitingForInput 경로에서 NodeExecution save 가 호출됨.
      expect(mockNodeExecutionRepo.save).toHaveBeenCalled();
      const savedIeRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((e) => e?.nodeId === 'node-ie-w5');
      expect(savedIeRows.length).toBeGreaterThanOrEqual(1);

      const lastSaved = savedIeRows[savedIeRows.length - 1];
      const outputData = lastSaved.outputData as Record<string, unknown>;

      // _resumeCheckpoint 가 저장됐는지 — IE 노드에도 guard 가 동작함.
      expect(outputData).toHaveProperty('_resumeCheckpoint');
      const checkpoint = outputData._resumeCheckpoint as Record<
        string,
        unknown
      >;
      // IE 고유 runtime state 가 checkpoint 에 포함됨.
      expect(checkpoint).toMatchObject({
        partialResult: { name: 'Bob' },
        collectionRetryCount: 1,
      });
      // M-7 builder↔schema drift 가드 — 실 산출물이 allow-list 스키마(§1.3, I-5)를
      // 정확히 만족하는지 `.strict()` 로 검증(credential/알 수 없는 키가 섞이면
      // strict 파싱이 실패 → drift 검출). non-strict 는 unknown 키를 조용히 strip 해
      // 항상-참이 되므로 사용하지 않는다.
      expect(
        resumeCheckpointSchema.strict().safeParse(checkpoint).success,
      ).toBe(true);
      for (const cred of CREDENTIAL_CONTEXT_FIELDS) {
        expect(checkpoint).not.toHaveProperty(cred);
      }
      // _resumeState 는 strip 돼야 한다 (credential-safe 정책).
      expect(outputData).not.toHaveProperty('_resumeState');
    });

    // W5 (ai-review) — handleAiMessageTurn 가드: 멀티턴 후속 turn 에서도
    // information_extractor 노드의 _resumeCheckpoint 가 저장되는지 검증.
    it('W5: information_extractor 노드 — handleAiMessageTurn 가드: 후속 turn 에서 _resumeCheckpoint 에 IE runtime state 저장', async () => {
      const ieNodes2: Partial<Node>[] = [
        {
          id: 'node-ie-w5b',
          workflowId,
          type: 'information_extractor',
          category: NodeCategory.AI,
          label: 'IE2',
          config: {
            mode: 'multi_turn',
            outputSchema: [{ name: 'email', type: 'string' }],
            maxCollectionRetries: 2,
          },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(ieNodes2);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const ieHandler2: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 0 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
            partialResult: {},
            collectionRetryCount: 0,
          },
        })),
        processMultiTurnMessage: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: {
            result: {
              messages: [
                { role: 'user', content: 'hello' },
                { role: 'assistant', content: 'hi' },
              ],
              message: 'hi',
              turnCount: 1,
            },
          },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [
              { role: 'user', content: 'hello' },
              { role: 'assistant', content: 'hi' },
            ],
            turnCount: 1,
            partialResult: { email: 'x@y.z' },
            collectionRetryCount: 1,
          },
        })),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('information_extractor', ieHandler2);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Phase B (exec-park D4) — 후속 turn 은 §7.5 slow-path(processAiResumeTurn
      // → handleAiMessageTurn). armSlowPathResume 가 첫 turn WAITING save 의
      // outputData(_resumeCheckpoint 포함)를 읽어 findOneBy mock 을 무장하므로,
      // save mock clear 보다 먼저 호출한다.
      armSlowPathResume(h, 'node-ie-w5b', ieNodes2[0]);

      // 첫 turn waiting 진입 후 후속 turn 처리.
      mockNodeExecutionRepo.save.mockClear();

      void service.continueAiConversation(executionId, 'hello');
      await flushResumeDrive();

      // handleAiMessageTurn 경로에서 NodeExecution save 가 호출됨.
      expect(mockNodeExecutionRepo.save).toHaveBeenCalled();
      const savedRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((e) => e?.nodeId === 'node-ie-w5b');
      expect(savedRows.length).toBeGreaterThanOrEqual(1);

      const lastSaved = savedRows[savedRows.length - 1];
      const outputData = lastSaved.outputData as Record<string, unknown>;
      expect(outputData).toHaveProperty('_resumeCheckpoint');
      const checkpoint = outputData._resumeCheckpoint as Record<
        string,
        unknown
      >;
      // handleAiMessageTurn 후속 turn 에서도 IE runtime state 가 checkpoint 에 포함.
      expect(checkpoint).toMatchObject({
        partialResult: { email: 'x@y.z' },
        collectionRetryCount: 1,
      });
      // M-7 builder↔schema drift 가드 (§1.3, I-5) — 후속 turn 경로도 `.strict()` 로 검증.
      expect(
        resumeCheckpointSchema.strict().safeParse(checkpoint).success,
      ).toBe(true);
      for (const cred of CREDENTIAL_CONTEXT_FIELDS) {
        expect(checkpoint).not.toHaveProperty(cred);
      }
      expect(outputData).not.toHaveProperty('_resumeState');
    });

    // WARN #21 — endAiConversation 종료 흐름 전체 테스트.
    //
    // 시나리오:
    //  1. AI handler 가 첫 turn 에서 `waiting_for_input` 으로 진입
    //  2. 사용자가 endAiConversation 호출 → bus 가 `ai_end_conversation` publish
    //  3. continuation handler 가 pending Promise 를 'end' 로 resolve
    //  4. 엔진이 handler.endMultiTurnConversation() 호출 → `ended` status + port
    //  5. NodeExecution 가 COMPLETED 로 finalize, EXECUTION_COMPLETED emit
    //
    // 회귀 위험: PR-H 의 waitForAiConversation 분해 시 본 흐름이 깨지면
    // 사용자가 대화를 종료할 수 없게 된다 — 이 테스트가 안전망 역할.
    it('end-to-end: endAiConversation drives handler.endMultiTurnConversation and finalizes node + execution', async () => {
      const handler = makeAiAgentHandler(() => ({
        // unused — endAiConversation path skips processMultiTurnMessage
        config: { mode: 'multi_turn' },
        output: {},
        meta: {},
        port: 'ended',
        status: 'ended',
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Phase B (exec-park D4) — 종료 turn(ai_end_conversation)도 §7.5
      // slow-path(processAiResumeTurn → handleAiEndConversation + finalizeAiNode
      // COMPLETED → 그래프 진행)로 처리된다. slow-path DB lookup 무장.
      armSlowPathResume(h, 'node-agent', aiNodes[0]);

      // waiting state 진입 확인
      const waitingCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) =>
            call[1] === 'execution.waiting_for_input' &&
            (call[2] as { waitingNodeId?: string })?.waitingNodeId ===
              'node-agent',
        );
      expect(waitingCalls.length).toBeGreaterThanOrEqual(1);

      // Carousel buttons-disabled bug fix (2026-05-09) — 3 waiting emit
      // (Buttons / Form / AI) 모두 top-level interactionType 일관화.
      // AI 의 nested interactionType 은 backward compat 으로 유지.
      const aiWaitingPayload = waitingCalls[0]?.[2] as Record<string, unknown>;
      expect(aiWaitingPayload).toMatchObject({
        interactionType: 'ai_conversation',
      });
      expect(
        (aiWaitingPayload?.nodeOutput as Record<string, unknown> | undefined)
          ?.interactionType,
      ).toBe('ai_conversation');

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();

      // 사용자 종료
      void service.endAiConversation(executionId);
      await flushResumeDrive();

      // (a) handler.endMultiTurnConversation 호출됨
      expect(handler.endMultiTurnConversation).toHaveBeenCalledTimes(1);
      // (b) processMultiTurnMessage 는 호출되지 않음 — end path 는 별도 경로
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();

      // (c) NODE_COMPLETED 가 ai_agent 노드에 대해 emit
      const nodeCompletedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) => call[2] === 'execution.node.completed',
        );
      expect(nodeCompletedCalls.length).toBeGreaterThanOrEqual(1);
      const completedNodeIds = nodeCompletedCalls.map(
        (call) => (call as unknown[])[1] as string,
      );
      expect(completedNodeIds).toContain('node-agent');

      // (d) EXECUTION_COMPLETED 가 emit (단일 노드 워크플로우라 종료까지 흐름)
      const executionCompletedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.completed',
        );
      expect(executionCompletedCalls.length).toBeGreaterThanOrEqual(1);
    });

    // spec/4-nodes/3-ai/1-ai-agent.md §7.9 — multi-turn LLM 오류 (429/timeout/
    // connection) 시 노드는 `port='error'`, `status='ended'` 로 finalize 되고
    // `output.error.{code, message, details}` 를 운반해야 한다. 본 테스트가 없을
    // 때의 회귀 (운영 보고 2026-05-19): processMultiTurnMessage 가 throw 하면
    // handleAiMessageTurn 의 try/catch 부재로 finalizeAiNode 가 호출되지 않아
    // NodeExecution 이 WAITING_FOR_INPUT 상태로 영구 잔류하고, Execution 만
    // top-level catch 로 FAILED 가 된다. frontend 는 헤더 "실패" + 노드 "Waiting"
    // 의 모순 상태를 본다.
    //
    // 시나리오:
    //  1. AI handler 가 첫 turn 에서 `waiting_for_input` 으로 진입
    //  2. 사용자가 ai_message 전송 → continuation handler 가 resolve
    //  3. handler.processMultiTurnMessage 가 LLM 429 등으로 throw
    //  4. 엔진이 handler.endMultiTurnConversation(state, 'error', errorPayload) 호출
    //  5. NodeExecution 가 FAILED 로 finalize, EXECUTION_FAILED + NODE_FAILED emit
    it('end-to-end: handleAiMessageTurn throw drives endMultiTurnConversation(error, payload) and finalizes node FAILED', async () => {
      const rateLimitError = Object.assign(
        new Error('Anthropic API returned 429 (Too Many Requests)'),
        { code: 'LLM_RATE_LIMIT' },
      );
      const handler = makeAiAgentHandler(() => {
        throw rateLimitError;
      });
      // endMultiTurnConversation mock 을 error endReason / errorPayload 친화적 으로 재정의.
      handler.endMultiTurnConversation.mockImplementation(
        (_state: unknown, endReason: string, errorPayload?: unknown) => ({
          config: { mode: 'multi_turn' },
          output: {
            result: {
              response: '',
              messages: [],
              turnCount: 0,
              endReason,
            },
            ...(errorPayload ? { error: errorPayload } : {}),
          },
          meta: { interactionType: 'ai_conversation' },
          port: 'error',
          status: 'ended',
        }),
      );
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Phase B (exec-park D4) — error turn 도 §7.5 slow-path(processAiResumeTurn
      // → handleAiMessageTurn throw → finalizeAiNode FAILED). armSlowPathResume 가
      // 첫 turn WAITING save 의 outputData 를 읽으므로 save mock clear 보다 먼저 호출.
      armSlowPathResume(h, 'node-agent', aiNodes[0]);

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();
      mockNodeExecutionRepo.save.mockClear();

      // FAILED 경로는 slow-path detached drive(processAiResumeTurn →
      // handleAiMessageTurn try/catch → finalizeAiNode FAILED)를 거치므로
      // detached drive 완료까지 실제 타이머를 흘린다.
      void service.continueAiConversation(executionId, 'trigger error');
      await flushResumeDrive();

      // (a) handler.endMultiTurnConversation 이 'error' endReason + errorPayload
      //     로 1회 호출됨.
      expect(handler.endMultiTurnConversation).toHaveBeenCalledTimes(1);
      const endCall = handler.endMultiTurnConversation.mock.calls[0];
      expect(endCall[1]).toBe('error');
      const passedPayload = endCall[2] as Record<string, unknown> | undefined;
      expect(passedPayload).toBeDefined();
      expect(passedPayload?.code).toBe('LLM_RATE_LIMIT');
      expect(typeof passedPayload?.message).toBe('string');
      expect(passedPayload?.message).toContain('429');

      // (b) NODE_FAILED (execution.node.failed) 1회 발사. AI_MESSAGE 양발사 금지.
      const nodeFailedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) => call[2] === 'execution.node.failed',
        );
      expect(nodeFailedCalls.length).toBeGreaterThanOrEqual(1);
      const failedNodeIds = nodeFailedCalls.map(
        (call) => (call as unknown[])[1] as string,
      );
      expect(failedNodeIds).toContain('node-agent');

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(0);

      // (c) NODE_COMPLETED 는 발사되지 않아야 한다 (정상 종결 분기와 분리).
      const nodeCompletedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) =>
            call[2] === 'execution.node.completed' && call[1] === 'node-agent',
        );
      expect(nodeCompletedCalls).toHaveLength(0);

      // (d) NodeExecution.status === FAILED 로 save.
      const savedAgentRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((row): row is Partial<NodeExecution> => !!row)
        .filter((row) => row.nodeId === 'node-agent');
      expect(savedAgentRows.length).toBeGreaterThanOrEqual(1);
      const finalStatus = savedAgentRows[savedAgentRows.length - 1].status;
      expect(finalStatus).toBe(NodeExecutionStatus.FAILED);

      // (e) EXECUTION_FAILED 가 발사.
      const executionFailedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.failed',
        );
      expect(executionFailedCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // W11 (SUMMARY) — form_submitted 분기 단위 테스트.
  // W12 (SUMMARY) — unknown action.type warn+re-park 단위 테스트.
  //
  // Phase B (exec-park D4) — 옛 장수 루프(waitForAiConversation)의 dispatch body 는
  // top-level resume 에서 단발 turn 처리기 `processAiResumeTurn` 으로 이관됐다.
  // 따라서 본 블록은 turn 을 §7.5 slow-path(applyContinuation → rehydration →
  // processAiResumeTurn)로 전달해 그 dispatch body 를 가드한다. INTENT 동일:
  // form_submitted → handleAiMessageTurn(JSON.stringify(formData), source:'form_submitted');
  // ai_message → processMultiTurnMessage(source:'ai_message');
  // unknown → warn + re-park (silent drop / crash 금지);
  // button_click → warn + re-park (대화 alive, MAX_UNKNOWN_SKIPS 누적 없음);
  // buttonId → slice(0,64) + typeof 가드.
  // ---------------------------------------------------------------------------
  describe('processAiResumeTurn dispatch — form_submitted + unknown type (W11/W12)', () => {
    // `form_submitted` payload 가 handler.processMultiTurnMessage 에 도달하는지,
    // unknown type 이 warn log 를 남기고 re-park 하는지 검증.
    // W15 (ai-review) — flushResumeDrive(200ms) × 다수(button×22·인터리빙 등) 누적이
    // jest 기본 5s 타임아웃에 근접해 CI 고부하 시 flaky → 본 파일 타임아웃 상향.
    jest.setTimeout(15_000);

    const makeAiDispatchHandler = (
      processReturn: () => unknown,
    ): NodeHandler & {
      processMultiTurnMessage: jest.Mock;
      endMultiTurnConversation: jest.Mock;
    } =>
      ({
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 0 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            turnDebugHistory: [],
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
          },
        })),
        processMultiTurnMessage: jest.fn(async () => processReturn()),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      }) as unknown as NodeHandler & {
        processMultiTurnMessage: jest.Mock;
        endMultiTurnConversation: jest.Mock;
      };

    const aiDispatchNodes: Partial<Node>[] = [
      {
        id: 'node-agent-dispatch',
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: { mode: 'multi_turn' },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(aiDispatchNodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
    });

    // W8 (SUMMARY) — 본 블록의 일부 테스트가 `aiTurnOrchestrator.logger` 에
    // jest.spyOn(warn) 을 건다(C-1 step2 에서 spy 대상이 service.logger →
    // orchestrator.logger 로 변경). 각 테스트가 warnSpy.mockRestore() 를 호출하나,
    // 조기 실패 시 복원 누락으로 후속 테스트 logger 가 오염되지 않도록 방어적으로
    // 전체 복원한다.
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('W11 — form_submitted dispatch: handleAiMessageTurn 이 JSON.stringify(formData) 인자로 호출됨', async () => {
      // spec §10.9 + §10.9 dispatch 표 — form_submitted case 는
      // handleAiMessageTurn(executionId, contextKey, node, JSON.stringify(formData), ...) 호출.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Phase B (exec-park D4) — form_submitted turn 을 §7.5 slow-path 로 전달
      // (continueExecution → bus continue → applyContinuation → rehydration →
      // processAiResumeTurn 의 form_submitted 분기).
      armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
      const formPayload = { field1: 'value1', type: '주문 문의' };
      void service.continueExecution(executionId, formPayload);
      await flushResumeDrive();

      // processMultiTurnMessage 가 첫 번째 인자로 JSON.stringify(formPayload) 를 받았는지.
      // 호출 시그니처: processMultiTurnMessage(userMessage: string, state, options)
      // spec §6.2 step 2 — 'form_submitted' source 신호 전달 검증.
      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        JSON.stringify(formPayload),
        expect.anything(),
        expect.objectContaining({ source: 'form_submitted' }),
      );
    });

    it('W10 — ai_message dispatch: processMultiTurnMessage 가 { source: "ai_message" } 로 호출됨', async () => {
      // spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass — engine 이
      // `continueAiConversation` 경로에서 `'ai_message'` source 를 결정적으로
      // 전달해야 handler 의 form bypass 분기가 올바르게 작동한다.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Phase B (exec-park D4) — ai_message turn 을 §7.5 slow-path 로 전달
      // (continueAiConversation → bus ai_message → applyContinuation →
      // rehydration → processAiResumeTurn 의 ai_message 분기).
      armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
      void service.continueAiConversation(executionId, '안녕하세요');
      await flushResumeDrive();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        '안녕하세요',
        expect.anything(),
        expect.objectContaining({ source: 'ai_message' }),
      );
    });

    it('W12 — unknown action.type: logger.warn 호출 + re-park (silent drop 금지)', async () => {
      // spec §10.9 — unknown type 은 warn log 남기고 re-park (다음 입력 대기).
      // Phase B (exec-park D4) — 옛 loop 의 MAX_UNKNOWN_SKIPS in-memory cap 은
      // turn-park 에서 제거됐다 (각 turn = 별 continuation job). 따라서 본 테스트는
      // unknown turn 이 crash 없이 warn + re-park(WAITING 복귀) 함을 가드한다.
      const handler = makeAiDispatchHandler(() => ({
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      // C-1 step2 — re-park warn 은 orchestrator 의 processAiResumeTurn 에서
      // 발생하므로 orchestrator 의 logger 를 spy 한다.
      const logger = (
        aiTurnOrchestrator as unknown as { logger: { warn: jest.Mock } }
      ).logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // unknown type turn 을 §7.5 slow-path 로 직접 주입 (공개 continue* 메서드는
      // 알 수 없는 type 을 만들 수 없으므로 applyContinuation 직접 호출 — bus
      // worker 가 dispatch 하는 것과 동일 진입점, payload 만 unknown).
      armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
      mockWebsocketService.emitExecutionEvent.mockClear();
      await service.applyContinuation(executionId, 'ne-node-agent-dispatch', {
        type: 'totally_unknown_type_xyz',
      });
      await flushResumeDrive();

      // warn log 가 호출됐는지 — unknown type 명(직렬화 포함) 또는 unknown 문구.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasUnknownWarn = warnCalls.some(
        (msg) =>
          msg.includes('unknown continuation action.type') ||
          msg.includes('totally_unknown_type_xyz'),
      );
      expect(hasUnknownWarn).toBe(true);

      // crash 없이 re-park: 핸들러 turn 처리(processMultiTurnMessage)는 호출되지
      // 않고, 대화가 종료(terminal)되지 않고 alive 유지된다 (turn-park 의 re-park 는
      // durable WAITING_FOR_INPUT 으로 복귀하되 AI_MESSAGE/WAITING 재emit 없이 조용히
      // 다음 입력을 기다린다 — 옛 loop 의 button/unknown skip 동작과 동일: 종료 emit 부재).
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
      const terminalEmits =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) =>
            c[1] === 'execution.completed' ||
            c[1] === 'execution.failed' ||
            c[1] === 'execution.cancelled',
        );
      expect(terminalEmits.length).toBe(0);

      warnSpy.mockRestore();
    });

    it('button_click action.type: re-park (스킵 cap 없음) — stale telegram 클릭 누적이 대화를 죽이지 않는다', async () => {
      // spec/4-nodes/6-presentation/0-common.md §10.9 line 400/407 —
      // `button_click` 은 enum-complete 케이스로 spec 이 명시한 "warn log +
      // graceful re-park" 그대로 동작해야 한다. 텔레그램 stale inline_keyboard
      // 클릭이 누적돼도 대화가 FAILED 종결되지 않아야 한다.
      //
      // Phase B (exec-park D4) — 옛 loop 의 MAX_UNKNOWN_SKIPS cap 자체가 제거됐다
      // (각 button_click = 별 continuation job → 별 turn-park). 따라서 회귀 가드는
      // "cap warn 부재" 가 아니라 "매 button_click turn 이 crash 없이 re-park 하고
      // 핸들러 turn 처리를 트리거하지 않는다" 로 강화한다.
      const handler = makeAiDispatchHandler(() => ({
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      }));
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      // C-1 step2 — re-park warn 은 orchestrator 의 processAiResumeTurn 에서
      // 발생하므로 orchestrator 의 logger 를 spy 한다.
      const logger = (
        aiTurnOrchestrator as unknown as { logger: { warn: jest.Mock } }
      ).logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // stale button_click 반복 — 각각 별 continuation job(turn-park)으로 도착.
      // 매 turn 마다 slow-path 를 재무장한다 (armSlowPathResume 의 mockResolvedValueOnce
      // 들이 turn 당 한 번씩 소비되므로). 모두 crash 없이 re-park 해야 한다. (옛
      // MAX_UNKNOWN_SKIPS=20 cap 이 살아있다면 21회째 FAILED 종결됐을 것 — cap
      // 부재를 가드하기 위해 cap(20) 초과 횟수를 구동한다.)
      for (let i = 0; i < 22; i += 1) {
        armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
        await service.applyContinuation(executionId, 'ne-node-agent-dispatch', {
          type: 'button_click',
          buttonId: `btn-${i}`,
        });
        await flushResumeDrive(40);
      }

      // 22회 stale 클릭(옛 cap 20 초과)에도 핸들러 turn 처리(processMultiTurnMessage)는
      // 절대 호출되지 않는다 — button_click 은 상태 변경 없이 re-park 만 한다 (대화 alive).
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();

      // FAILED 종결을 야기하는 cap 도달 warn 이 없어야 함 (cap 자체가 제거됨).
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasCapWarn = warnCalls.some((msg) =>
        msg.includes('unknown skip limit'),
      );
      expect(hasCapWarn).toBe(false);

      // button_click re-park warn 은 매 turn 마다 발생 (silent drop 금지).
      const hasButtonWarn = warnCalls.some((msg) =>
        msg.includes('button_click received during ai_conversation'),
      );
      expect(hasButtonWarn).toBe(true);

      warnSpy.mockRestore();
    });

    // -------------------------------------------------------------------------
    // W4 (SUMMARY) — button_click × N → ai_message → ended 인터리빙 통합 케이스.
    // stale 클릭이 복수로 누적된 뒤 실제 ai_message 가 도달하면 정상 처리됨.
    // -------------------------------------------------------------------------
    it('W4 — button_click × N 인터리빙 후 ai_message 도달 시 정상 처리 (인터리빙 통합)', async () => {
      // 시나리오: stale button_click 3회 → ai_message 1회 → ai_end_conversation.
      // button_click 은 skip count 에서 제외되고 ai_message 는 정상 처리되어야 한다.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [{ role: 'assistant', content: 'ok' }],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
        port: 'waiting_for_input',
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Phase B (exec-park D4) — 각 turn 은 별 continuation job(slow-path).
      // stale button_click 3회 — 각각 crash 없이 re-park, 핸들러 turn 미트리거.
      for (let i = 0; i < 3; i += 1) {
        armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
        await service.applyContinuation(executionId, 'ne-node-agent-dispatch', {
          type: 'button_click',
          buttonId: `stale-${i}`,
        });
        await flushResumeDrive();
      }
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();

      // ai_message 도달 — processMultiTurnMessage 가 호출되어야 한다.
      armSlowPathResume(h, 'node-agent-dispatch', aiDispatchNodes[0]);
      await service.applyContinuation(executionId, 'ne-node-agent-dispatch', {
        type: 'ai_message',
        message: 'hello AI',
      });
      await flushResumeDrive();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        'hello AI',
        expect.any(Object),
        expect.objectContaining({ source: 'ai_message' }),
      );
    });
  });

  describe('AI no-llm-provider rule post-filter', () => {
    // 캔버스 hasDefaultLlmConfig 억제와 의미를 일치시키기 위한 후처리 검증.
    // execute 전체를 돌리는 대신 private 메서드를 직접 호출하여 분기를 검증한다.

    // keep in sync with filterAiNoLlmProviderError signature (subject + errors + context).
    type Filterable = {
      filterAiNoLlmProviderError: (
        nodeType: string,
        errors: string[],
        context: { variables?: Record<string, unknown> },
      ) => Promise<string[]>;
    };

    let llm: { hasDefaultLlmConfig: jest.Mock };
    const subject = () => service as unknown as Filterable;

    const buildContext = (
      workspaceId: string | undefined,
      extraVariables: Record<string, unknown> = {},
    ): { variables: Record<string, unknown> } => {
      if (workspaceId === undefined) {
        return { variables: { ...extraVariables } };
      }
      return {
        variables: { __workspaceId: workspaceId, ...extraVariables },
      };
    };

    beforeEach(() => {
      llm = (
        service as unknown as {
          llmService: { hasDefaultLlmConfig: jest.Mock };
        }
      ).llmService;
      llm.hasDefaultLlmConfig.mockReset();
      llm.hasDefaultLlmConfig.mockResolvedValue(false);
    });

    it('passes through errors for non-AI nodes', async () => {
      const result = await subject().filterAiNoLlmProviderError(
        'http_request',
        [AI_NO_LLM_PROVIDER_MESSAGE, 'other error'],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE, 'other error']);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('keeps the no-llm-provider error when workspace has no default LLM', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(false);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
    });

    it('drops the no-llm-provider error when workspace has a default LLM', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      for (const type of [
        'ai_agent',
        'text_classifier',
        'information_extractor',
      ]) {
        const result = await subject().filterAiNoLlmProviderError(
          type,
          [AI_NO_LLM_PROVIDER_MESSAGE],
          buildContext('ws-1'),
        );
        expect(result).toEqual([]);
      }
    });

    it('preserves other AI validation errors when filtering no-llm-provider', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [
          AI_NO_LLM_PROVIDER_MESSAGE,
          'maxTurns must be 0 (unlimited) or a positive integer',
        ],
        buildContext('ws-1'),
      );
      expect(result).toEqual([
        'maxTurns must be 0 (unlimited) or a positive integer',
      ]);
    });

    it('keeps the error when workspaceId is empty string', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext(''),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('keeps the error when __workspaceId is absent from variables', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext(undefined),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('falls back to original errors when hasDefaultLlmConfig throws (DB error)', async () => {
      llm.hasDefaultLlmConfig.mockRejectedValue(new Error('DB unavailable'));

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
    });

    it('caches hasDefaultLlmConfig result on the same context (no N+1)', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const ctx = buildContext('ws-1');
      for (let i = 0; i < 5; i++) {
        await subject().filterAiNoLlmProviderError(
          'ai_agent',
          [AI_NO_LLM_PROVIDER_MESSAGE],
          ctx,
        );
      }
      expect(llm.hasDefaultLlmConfig).toHaveBeenCalledTimes(1);
    });
  });
});
