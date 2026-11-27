import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import { ButtonInteractionService } from './button-interaction.service';
import { RetryTurnService } from './retry-turn.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { EdgeType } from '../edges/entities/edge.entity';
import { NodeHandler } from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  workflowId,
} from './__test-utils__/engine-service-harness';

/**
 * ExecutionEngineService 단위 테스트: applyRetryLastTurn · 재시도 뒤 그래프 순회.
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
  let buttonInteraction: ButtonInteractionService;
  // C-1 후속 ④ — retry_last_turn 진입점은 엔진 delegator 가 제거되고 RetryTurnService
  // 가 직접 표면이 됐다. 본 spec 의 applyRetryLastTurn 통합 테스트는 이 실 인스턴스를
  // 대상으로 호출한다 (driver=엔진 이므로 엔진 내부 협력은 그대로 exercise).
  let retryTurnService: RetryTurnService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let retryClaimQb: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  // `updateExecutionStatus` 의 linkedNodeExec(park 짝 전이) 분기가 트랜잭션 안에서
  // 실행하는 terminal 가드(`SELECT ... FOR UPDATE`) 제어. 기본은 "행 잠금 성공(비-terminal)"
  // 이라 기존 테스트가 그대로 통과하고, 선점 테스트만 `[]` 로 재무장한다.
  let mockTxManagerQuery: jest.Mock;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      aiTurnOrchestrator,
      buttonInteraction,
      retryTurnService,
      handlerRegistry,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      retryClaimQb,
      mockEdgeRepo,
      mockTxManagerQuery,
    } = h);
  });

  // spec/5-system/6-websocket-protocol.md §4.2 "Continuation Bus 경유 (worker
  // handoff)" / §4.2.1 + spec/4-nodes/3-ai/1-ai-agent.md §7.9 — retry 재진입.
  describe('applyRetryLastTurn (multi-turn loop re-entry)', () => {
    const EXEC = executionId;
    const NODE_ID = 'node-agent-retry';
    const SPAWNED = 'ne-spawned-retry';

    // WARNING #11 — W9 테스트의 turnGate 잔여 promise 정리를 afterEach 에서
    // 보장해 microtask 누수가 이후 테스트 spy 를 오염하지 않게 한다.
    let _releasePendingTurnGate: (() => void) | undefined;
    afterEach(() => {
      _releasePendingTurnGate?.();
      _releasePendingTurnGate = undefined;
    });

    function retryStateSeed(): Record<string, unknown> {
      return {
        // pre-failed-turn history (does NOT include the failed user message).
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ack' },
        ],
        turnCount: 1,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        toolCalls: 0,
        model: 'test-model',
        // failed user message to replay (spec §7.9).
        lastUserMessage: 'please retry me',
        lastUserMessageSource: 'ai_message',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }

    function installReentry(opts: {
      processReturn: () => unknown;
      spawnedStatus?: NodeExecutionStatus;
      retryState?: Record<string, unknown> | undefined;
      config?: Record<string, unknown>;
    }): {
      handler: NodeHandler & { processMultiTurnMessage: jest.Mock };
      savedSpawn: { status?: NodeExecutionStatus };
    } {
      const node: Partial<Node> = {
        id: NODE_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: opts.config ?? {
          mode: 'multi_turn',
          llmConfigId: 'cfg-1',
          maxTurns: 20,
        },
        isDisabled: false,
      };
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: NODE_ID,
        status: opts.spawnedStatus ?? NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData:
          'retryState' in opts
            ? opts.retryState
              ? { _retryState: opts.retryState }
              : {}
            : { _retryState: retryStateSeed() },
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      // re-entry loads node via nodeRepository.findOneBy.
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(node);
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([node]);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });
      // 잠금 mock 이 대조할 DB status — retry 재진입은 Execution 이 FAILED 인 상태에서
      // 시작하므로, opt-in(allowRetryReentry) 없이는 짝 전이가 0행이 된다.
      h.dbExecutionStatus = ExecutionStatus.FAILED;

      const handler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => opts.processReturn()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { processMultiTurnMessage: jest.Mock };
      handlerRegistry.register('ai_agent', handler);
      return { handler, savedSpawn: spawnedRow };
    }

    function terminalSuccess(): unknown {
      // re-run of the failed turn now succeeds → terminal `ended` output with
      // a fresh assistant response on the spawned row.
      return {
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'please retry me' },
              { role: 'assistant', content: 'retried OK' },
            ],
            message: 'retried OK',
            turnCount: 2,
            endReason: 'user_ended',
          },
        },
        meta: { interactionType: 'ai_conversation', model: 'test-model' },
        port: 'user_ended',
        status: 'ended',
      };
    }

    it('replays the failed last turn and produces a new assistant response on the spawned row', async () => {
      const { handler } = installReentry({ processReturn: terminalSuccess });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // The failed last user message was replayed verbatim (spec §7.9).
      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const [replayedMsg] = handler.processMultiTurnMessage.mock.calls[0];
      expect(replayedMsg).toBe('please retry me');

      // A NODE_STARTED was emitted for the spawned row.
      const nodeStarted = mockWebsocketService.emitNodeEvent.mock.calls.filter(
        (c: unknown[]) => c[2] === 'execution.node.started',
      );
      expect(
        nodeStarted.some(
          (c: unknown[]) =>
            (c[3] as { nodeExecutionId?: string }).nodeExecutionId === SPAWNED,
        ),
      ).toBe(true);

      // A fresh assistant message event was emitted.
      const aiMsg = mockWebsocketService.emitExecutionEvent.mock.calls.filter(
        (c: unknown[]) => c[1] === 'execution.ai_message',
      );
      expect(aiMsg.length).toBeGreaterThan(0);
    });

    // 재시도한 턴은 성공했지만 대화가 끝나지 않았다 → 다음 입력을 기다린다(re-park).
    //
    // 9R 이 이 시나리오를 철회한 원인(CLE-T-5QG099 #25, 형태를 바꿔 실측했다):
    // - 최상위 `_resumeState` 가 없으면 계속 분기가 AI_MESSAGE 를 보내며
    //   `_resumeState.model` 을 읽다 TypeError 로 멈춘다. re-park · `FOR UPDATE` 전이다.
    // - `{ config, output }` 이 없는 평면 반환은 `adaptHandlerReturn` 이 늘 엄격하게
    //   거절한다(NODE_ENV 무관). 여기서도 잠금 전에 멈춘다.
    // - `status: 'waiting_for_input'` 이 없으면 종료 턴으로 처리돼 re-park 가 아니다.
    function continueTurn(): unknown {
      const messages = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ack' },
        { role: 'user', content: 'please retry me' },
        { role: 'assistant', content: 'retried — anything else?' },
      ];
      return {
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages,
            message: 'retried — anything else?',
            turnCount: 2,
          },
        },
        meta: { interactionType: 'ai_conversation', model: 'test-model' },
        status: 'waiting_for_input',
        _resumeState: {
          messages,
          turnCount: 2,
          totalInputTokens: 20,
          totalOutputTokens: 10,
          toolCalls: 0,
          model: 'test-model',
        },
      };
    }

    // CLE-T-5QG099 #25 — 턴 계속(re-park). 재진입 opt-in 이 re-park 의 짝 전이
    // (FAILED → WAITING_FOR_INPUT)와 그 DB 가드까지 닿는지 통합으로 잠근다. 지금까지는
    // 짝 전이 focused 테스트와 orchestrator seam 테스트 두 단만 있었다.
    it('재시도한 턴이 계속되면 실행을 waiting_for_input 으로 re-park 한다 (#25)', async () => {
      const { savedSpawn } = installReentry({ processReturn: continueTurn });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // opt-in 이 DB 가드까지 닿아야 FAILED 행을 잠근다.
      const lockSqls = mockTxManagerQuery.mock.calls
        .map((c: unknown[]) => String(c[0]))
        .filter((sql) => sql.includes('FOR UPDATE'));
      expect(lockSqls.some((sql) => sql.includes("'failed'"))).toBe(true);
      // 짝 전이가 persist 됐다 — 실행과 spawn row 모두 WAITING_FOR_INPUT.
      expect(h.dbExecutionStatus).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(savedSpawn.status).toBe(NodeExecutionStatus.WAITING_FOR_INPUT);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: SPAWNED,
          status: NodeExecutionStatus.WAITING_FOR_INPUT,
        }),
      );
      const executionEvents =
        mockWebsocketService.emitExecutionEvent.mock.calls.map(
          (c: unknown[]) => c[1],
        );
      expect(executionEvents).toContain('execution.waiting_for_input');
      expect(executionEvents).not.toContain('execution.failed');
      expect(executionEvents).not.toContain('execution.cancelled');
      expect(executionEvents).not.toContain('execution.completed');
    });

    it('marks the Execution COMPLETED when the replayed conversation ends normally', async () => {
      installReentry({ processReturn: terminalSuccess });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    it('re-failure (retryable again) → Execution FAILED + NODE_FAILED on spawned row', async () => {
      // The replayed turn throws again (LLM still rate-limited).
      const { handler } = installReentry({
        processReturn: () => {
          throw Object.assign(new Error('429'), { status: 429 });
        },
      });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const failedEvents =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.failed',
        );
      expect(failedEvents.length).toBe(1);
      const nodeFailed = mockWebsocketService.emitNodeEvent.mock.calls.filter(
        (c: unknown[]) => c[2] === 'execution.node.failed',
      );
      expect(
        nodeFailed.some(
          (c: unknown[]) =>
            (c[3] as { nodeExecutionId?: string }).nodeExecutionId === SPAWNED,
        ),
      ).toBe(true);
    });

    it('ack-and-discard when spawned row is no longer RUNNING (idempotency)', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        spawnedStatus: NodeExecutionStatus.COMPLETED,
      });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();
      // Already handled by another worker — no re-entry.
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
    });

    // ai-review CRITICAL #1 (2026-07-28, `review/code/2026/07/28/20_32_57`) —
    // 과거엔 이 케이스("spawned row 에 _retryState 없음")를 claim 보다 앞선
    // 판정이 "손상"으로 오판해 FAILED 로 무가드 덮어썼다. 실제로는 다른/이전
    // delivery 가 이미 claim 했을 수 있으므로(살아있는 row 일 수 있음), 이제는
    // FAILED 로 마킹하지 않고 discard 한다.
    it('missing _retryState on spawned row → discard, no replay, no FAILED marking', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        retryState: undefined,
      });
      // 실 Postgres 라면 jsonb_exists(input_data, '_retryState') 가 false 라
      // claim UPDATE 가 0행에 매칭된다 — 그 결과를 흉내낸다(기존 mock 은 SQL
      // 조건을 평가하지 않고 affected:1 을 고정 반환해 실제 DB 동작과 어긋났다).
      retryClaimQb.execute = jest.fn().mockResolvedValue({ affected: 0 });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
      // spawned row 를 FAILED 로 저장하지 않는다(활성 row 를 죽이지 않는다).
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    // ai-review WARNING #8 (2026-07-28) — 통합 레벨(execution-engine.service.spec.ts)
    // 이 claim 실패(affected=0) 분기를 한 번도 실행하지 않았다(`retryClaimQb.execute`
    // 가 스펙 전체에서 `{affected:1}` 로 한 번만 설정되고 override 되지 않음). 정상
    // `_retryState` 가 존재하는 케이스에서 claim 자체가 다른 delivery 에 선점된
    // 시나리오(진짜 동시성 케이스)를 통합 레벨에서 고정한다.
    it('claim 실패(affected=0, 다른 delivery 선점) 시 discard 하고 재진입하지 않는다 — 통합 레벨', async () => {
      const { handler } = installReentry({ processReturn: terminalSuccess });
      retryClaimQb.execute = jest.fn().mockResolvedValueOnce({ affected: 0 });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    // #11 (followup) — re-entry 시 node.config 의 `{{ expression }}` 이
    // best-effort 로 평가돼 operational 필드(여기선 llmConfigId)가 evaluated
    // 값으로 resumeState 에 들어간다. `$execution.workflowId` 는 rehydrated
    // context 에서 해소 가능한 대표 토큰.
    it('resolves config expressions on re-entry (operational fields use evaluated values)', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        config: {
          mode: 'multi_turn',
          llmConfigId: '{{ $execution.workflowId }}',
          maxTurns: 20,
        },
      });
      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const state = handler.processMultiTurnMessage.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      // operational llmConfigId = evaluated value.
      expect(state.llmConfigId).toBe(workflowId);
      // rawConfig echo 는 spec config-echo 정책상 raw template 을 보존.
      expect((state.rawConfig as Record<string, unknown>).llmConfigId).toBe(
        '{{ $execution.workflowId }}',
      );
    });

    // W9 — exec-park D6 full B3: replay turn(processAiResumeTurn 경유) 중 도달한
    // 외부 cancel 은 옛 in-memory pending 코루틴에 ExecutionCancelledError 를
    // 주입하던 race 가 사라졌다. cancel(applyCancellation → cancelParkedExecution)은
    // `status = WAITING_FOR_INPUT` 가드의 UPDATE 라, RUNNING 인 replay 중에는 affected:0
    // → graceful no-op (premature CANCELLED 미발사). replay 는 그대로 완결된다. cancel
    // 은 다음 park(WAITING 전이) 시점에만 효력을 갖는다.
    // WARNING #11 — turnGate 정리는 afterEach 에서 보장 (microtask 누수 방지).
    it('replay turn(RUNNING) 중 도달한 cancel 은 graceful no-op — replay 는 완결, premature CANCELLED 미발사 (W9)', async () => {
      const turnGate = new Promise<void>((r) => {
        _releasePendingTurnGate = r;
      });
      const { handler } = installReentry({
        // replay turn 이 gate 가 풀릴 때까지 hang — 그 사이 cancel 이 도달.
        processReturn: () => turnGate.then(() => terminalSuccess()),
      });
      // cancelParkedExecution 의 (트랜잭션 안) Execution UPDATE 가 affected:0
      // (RUNNING 이라 WAITING 가드 미스) 을 반환하도록 무장 — 멱등 no-op 경로.
      // ai-review WARNING #1 (2026-07-27) — 단일 트랜잭션 원자화 이후 개별 repo 의
      // createQueryBuilder 가 아니라 `dataSource.transaction` 의
      // `manager.createQueryBuilder()` 를 통하므로 그 경로를 직접 무장한다(전역
      // 기본 mock 은 affected:1 이라 이 시나리오엔 맞지 않음).
      const noopQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      // 이 replay turn 이 완결되면 finalizeAiNode(COMPLETED) 가 **같은**
      // `dataSource.transaction`(tryLockActiveExecutionAndSaveNodeExec /
      // updateExecutionStatus 의 linkedNodeExec 분기)을 별도로 호출하므로,
      // `query`/`save` 는 전역 기본 mock 과 동일하게 정상 동작하도록 유지하고
      // `createQueryBuilder` 만 이 시나리오 전용(affected:0)으로 교체한다.
      (
        service as unknown as { dataSource: { transaction: jest.Mock } }
      ).dataSource.transaction = jest.fn(
        async (cb: (m: unknown) => Promise<unknown>) =>
          cb({
            createQueryBuilder: jest.fn(() => noopQb),
            query: mockTxManagerQuery,
            save: jest.fn(async (target: unknown, entity?: unknown) => {
              if (target === Execution) return mockExecutionRepo.save(entity);
              if (target === NodeExecution) {
                return mockNodeExecutionRepo.save(entity);
              }
              return entity;
            }),
          }),
      );

      const p = retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      // replay turn 시작까지 진행하도록 flush.
      await flushPromises();
      // 외부 cancel 도달 (worker applyCancellation 경유와 동형). fire-and-forget 의도.
      void service.applyCancellation(EXEC);
      await flushPromises();
      // gate 해제 → replay turn 이 terminalSuccess 로 완결.
      _releasePendingTurnGate?.();
      await p;
      await flushPromises();

      // replay turn 이 실제로 구동됐다 (retry 재진입 경로 커버리지).
      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      // RUNNING 중 cancel 은 no-op → premature CANCELLED 미발사.
      const cancelled =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.cancelled',
        );
      expect(cancelled.length).toBe(0);
      // replay 는 정상 완결 → execution.completed 발사.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
      // turnGate 정리는 afterEach 에서 수행 (_releasePendingTurnGate).
    });
  });

  // spec/4-nodes/3-ai/1-ai-agent.md §7.9 + §12.8 — retry 성공 후 downstream
  // graph 는 일반 노드 COMPLETED 와 동일하게 진행된다 (WARNING #10 해소).
  // 본 describe 는 `resumeGraphAfterRetry` 의 동작을 검증한다 —
  // `applyRetryLastTurn` 을 통해 간접 호출하되 mock 의 차이는 downstream
  // 노드 + edge 가 등장한다는 점.
  describe('resumeGraphAfterRetry — downstream graph traversal (WARNING #10)', () => {
    const EXEC = executionId;
    const AGENT_ID = 'node-agent-retry-w10';
    const DOWNSTREAM_ID = 'node-downstream-w10';
    const SPAWNED = 'ne-spawned-w10';

    function retryStateSeed(): Record<string, unknown> {
      return {
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ack' },
        ],
        turnCount: 1,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        toolCalls: 0,
        model: 'test-model',
        lastUserMessage: 'please retry me',
        lastUserMessageSource: 'ai_message',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }

    function terminalSuccess(): unknown {
      return {
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'please retry me' },
              { role: 'assistant', content: 'retried OK' },
            ],
            message: 'retried OK',
            turnCount: 2,
            endReason: 'user_ended',
          },
        },
        meta: { interactionType: 'ai_conversation', model: 'test-model' },
        port: 'user_ended',
        status: 'ended',
      };
    }

    function installReentryWithDownstream(opts: {
      nodes: Partial<Node>[];
      edges: Array<{
        sourceNodeId: string;
        targetNodeId: string;
        sourcePort?: string;
      }>;
      downstreamHandler?: NodeHandler;
      /** Downstream handler type (default 'test_downstream_w10'). */
      downstreamType?: string;
      /**
       * Downstream handler metadata — register 의 3번째 인자로 그대로 전달.
       * 생략 시 sentinel `{ kind: 'standard' }`. blocking 노드는
       * `{ kind: 'blocking', interaction: 'form' | 'buttons' | 'ai_conversation' }`.
       */
      downstreamMetadata?: { kind: string; interaction?: string };
    }): {
      agentHandler: NodeHandler & { processMultiTurnMessage: jest.Mock };
      downstreamHandler: NodeHandler & { execute: jest.Mock };
    } {
      const fullEdges = opts.edges.map((e, i) => ({
        id: `edge-w10-${i}`,
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort ?? 'user_ended',
        targetNodeId: e.targetNodeId,
        targetPort: 'in',
        type: EdgeType.DATA,
      }));
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: AGENT_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: { _retryState: retryStateSeed() },
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockImplementation((q: { id: string }) =>
          Promise.resolve(opts.nodes.find((n) => n.id === q.id) ?? null),
        );
      mockNodeRepo.findBy = jest.fn().mockResolvedValue(opts.nodes);
      mockEdgeRepo.findBy = jest.fn().mockResolvedValue(fullEdges);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });
      // 잠금 mock 이 대조할 DB status — retry 재진입은 Execution 이 FAILED 인 상태에서
      // 시작하므로, opt-in(allowRetryReentry) 없이는 짝 전이가 0행이 된다.
      h.dbExecutionStatus = ExecutionStatus.FAILED;

      const agentHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => terminalSuccess()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { processMultiTurnMessage: jest.Mock };
      handlerRegistry.register('ai_agent', agentHandler);

      const downstreamHandler = (opts.downstreamHandler ?? {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { result: { ok: true } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      }) as NodeHandler & { execute: jest.Mock };
      const downstreamType = opts.downstreamType ?? 'test_downstream_w10';
      handlerRegistry.register(
        downstreamType,
        downstreamHandler,
        opts.downstreamMetadata,
      );

      return { agentHandler, downstreamHandler };
    }

    // (a) downstream 존재 — retry 성공 후 downstream 노드가 dispatch 된다.
    it('dispatches downstream node when retry succeeds and downstream exists', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Downstream',
        config: {},
        isDisabled: false,
      };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, downstreamNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // downstream handler.execute 가 1회 호출됨 (graph traversal 합류).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);

      // downstream node 의 node.completed 이벤트가 emit 됨.
      const nodeCompleted =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (c: unknown[]) => c[2] === 'execution.node.completed',
        );
      expect(nodeCompleted.some((c: unknown[]) => c[1] === DOWNSTREAM_ID)).toBe(
        true,
      );

      // Execution 도 정상 COMPLETED 마감 (graph loop 자연 종결).
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // (b/e) downstream 없음 (leaf) — retry 성공 후 Execution.COMPLETED 자연 마감.
    // 기존 동작과 회귀 없음.
    it('completes Execution naturally when retry succeeds on a leaf node (no downstream)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode],
        edges: [],
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // downstream handler 는 호출되지 않음.
      expect(downstreamHandler.execute).not.toHaveBeenCalled();

      // Execution 은 정상 COMPLETED 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // (e) defensive fallback — workflow nodes 가 비어 있으면 Execution 을
    // 직접 COMPLETED 마감 (graph rebuild 불가).
    it('falls back to direct Execution.COMPLETED when workflow has no nodes (defensive)', async () => {
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: AGENT_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: { _retryState: retryStateSeed() },
      };
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      // findOneBy (node lookup) must still return agentNode so that
      // applyRetryLastTurn can resolve the node.
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(agentNode);
      // resumeGraphAfterRetry 의 nodeRepository.findBy 가 [] 를 반환하게
      // 하여 nodes.length === 0 defensive fallback 을 실제로 hit 한다.
      // rehydrateContext 는 nodeRepository.findBy 를 호출하지 않으므로
      // 단일 mockResolvedValue([]) 만으로 충분하다.
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([]);
      mockEdgeRepo.findBy = jest.fn().mockResolvedValue([]);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });
      // 잠금 mock 이 대조할 DB status — retry 재진입은 Execution 이 FAILED 인 상태에서
      // 시작하므로, opt-in(allowRetryReentry) 없이는 짝 전이가 0행이 된다.
      h.dbExecutionStatus = ExecutionStatus.FAILED;

      const agentHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => terminalSuccess()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('ai_agent', agentHandler);

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // 정상 COMPLETED — fallback 경로도 동일 종결.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // W2 — completedPointer undefined (second fallback): completedNode 가 graph
    // 에 없으면 defensive fallback 으로 Execution.COMPLETED 마감한다.
    it('falls back to direct Execution.COMPLETED when completedNode is absent from sorted graph (W2)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      // A different node set that does NOT include AGENT_ID — so sortedIndexMap
      // will not contain completedNode.id, triggering the second fallback.
      const otherNode: Partial<Node> = {
        id: 'other-node-w10',
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Other',
        config: {},
        isDisabled: false,
      };
      installReentryWithDownstream({
        // installReentryWithDownstream sets up agent + downstream mocks,
        // but we override findBy to return only otherNode (not AGENT_ID).
        nodes: [agentNode, otherNode],
        edges: [],
      });
      // Override: nodeRepository.findBy returns only otherNode for the graph —
      // completedNode (AGENT_ID) won't be in sortedIndexMap.
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([otherNode]);

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Execution is COMPLETED via defensive fallback (completeRetryExecution).
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // W3 — downstream 실패 경로: downstream 노드 실행 중 오류 발생 시
    // failRetryExecution 이 호출되고 Execution 이 FAILED 로 마감된다.
    it('marks Execution FAILED when downstream node throws during traversal (W3)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Downstream',
        config: {},
        isDisabled: false,
      };
      const failingDownstreamHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          throw new Error('downstream node failed unexpectedly');
        }),
      } as unknown as NodeHandler & { execute: jest.Mock };
      installReentryWithDownstream({
        nodes: [agentNode, downstreamNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: failingDownstreamHandler,
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Execution is FAILED — applyRetryLastTurn catch → failRetryExecution.
      const failed = mockWebsocketService.emitExecutionEvent.mock.calls.filter(
        (c: unknown[]) => c[1] === 'execution.failed',
      );
      expect(failed.length).toBe(1);
      // execution.completed must NOT have been emitted.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(0);
    });

    // WARNING #16 회귀 가드 (resumeGraphAfterRetry 경로) — nodeExecutionCount 초기값 0.
    //
    // 발견사항(testing.md W1): `resumeFromCheckpoint` 와 `resumeGraphAfterRetry` 는
    // helper 호출 전 `nodeExecutionCount.set(startNode, 0)` 으로 초기화한다.
    // 이전 코드(init=1) 에서는 back-edge 가 completedNode 를 재방문할 때
    // count=1+1=2 > MAX_NODE_ITERATIONS=1 → false positive throw 가 발생했다.
    //
    // 테스트 그래프 (topological order: Agent → BackEdgeTrigger):
    //   Agent(completedNode, no fwd edges) ← back-edge ← BackEdgeTrigger
    //   BackEdgeTrigger 는 back-edge 포트만 출력하며 forward 엣지 없음.
    //
    // 흐름 (MAX_NODE_ITERATIONS=1):
    //   1. loop starts at BackEdgeTrigger (completedPointer+1)
    //   2. BackEdgeTrigger: count=1 (≤1, passes). fires back-edge → Agent.
    //   3. Agent: count=init(0)+1=1 (≤1, passes). fwd 없음. pointer++.
    //   4. BackEdgeTrigger not in reachable (cleared by back-edge). loop ends.
    //   5. COMPLETED.
    //
    //   init=1 이었다면 step 3 에서 count=2>1 → throw (false positive).
    it('MAX_NODE_ITERATIONS=1: resumeGraphAfterRetry back-edge revisit of completedNode succeeds (WARNING #16 regression guard)', async () => {
      const TRIGGER_ID = 'node-w16-trigger';

      const triggerHandler16 = {
        validate: () => ({ valid: true, errors: [] }),
        // BackEdgeTrigger always fires back-edge port (no forward output).
        execute: jest.fn(async () =>
          mockOutput({ fired: true }, { port: 'back' }),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };

      handlerRegistry.register('w16_trigger', triggerHandler16);

      const agentNode16: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent16',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const triggerNode16: Partial<Node> = {
        id: TRIGGER_ID,
        workflowId,
        type: 'w16_trigger',
        category: NodeCategory.LOGIC,
        label: 'BackEdgeTrigger',
        config: {},
        isDisabled: false,
      };

      // Edge: Agent(user_ended) → Trigger (forward), Trigger(back) → Agent (back-edge).
      const { agentHandler } = installReentryWithDownstream({
        nodes: [agentNode16, triggerNode16],
        edges: [
          // forward edge: agent → trigger (the "downstream" after retry completes)
          {
            sourceNodeId: AGENT_ID,
            targetNodeId: TRIGGER_ID,
            sourcePort: 'user_ended',
          },
          // back-edge: trigger(back) → agent
          {
            sourceNodeId: TRIGGER_ID,
            targetNodeId: AGENT_ID,
            sourcePort: 'back',
          },
        ],
      });

      // Agent re-execution (back-edge revisit) calls handler.execute() directly.
      // Return output with port 'done' — this port has NO forward edge in the
      // graph (forward edge uses sourcePort='user_ended'), so propagateReachability
      // adds nothing and Trigger is NOT re-queued after Agent's revisit.
      (agentHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ revisited: true }, { port: 'done' }),
      );

      // MAX_NODE_ITERATIONS=1.
      const cs16 = service['configService'] as unknown as { get: jest.Mock };
      cs16.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MAX_NODE_ITERATIONS') return 1;
        return defaultValue;
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Trigger must have been called once (not zero, not two).
      expect(triggerHandler16.execute).toHaveBeenCalledTimes(1);

      // Execution must complete — no MAX_NODE_ITERATIONS exceeded false positive.
      const completed16 =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed16.length).toBe(1);

      // Must NOT have emitted execution.failed.
      const failed16 =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.failed',
        );
      expect(failed16.length).toBe(0);
    });

    // W4 (삭제) — 옛 in-memory cancel-during-replay race (replay turn 의 pending
    // 코루틴에 ExecutionCancelledError 주입 → CANCELLED, downstream skip) 는
    // exec-park D6 full B3 에서 제거됐다. cancel 은 이제 다음 park(WAITING) 시점에만
    // 효력을 가지므로, RUNNING 인 replay 중 cancel 은 graceful no-op 이고 replay 는
    // 완결된다. 새 semantics 는 applyRetryLastTurn 블록의 W9 테스트가 커버한다.

    // PR #371 ai-review W2 — parallel/background dispatchKind 회귀 가드.
    // retry 성공 후 downstream 에 parallel/background 노드가 존재할 때 정상
    // dispatch 되는지 검증 (runNodeDispatchLoop 의 dispatchKind 분기 도달).
    it('dispatches downstream parallel node when retry succeeds (W2 parallel resume)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const parallelNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_parallel_w2',
        category: NodeCategory.LOGIC,
        label: 'DownstreamParallel',
        config: { branches: [] },
        isDisabled: false,
      };
      const parallelHandler = {
        validate: () => ({ valid: true, errors: [] }),
        // Parallel handler 의 execute 는 runParallel 의 분기 진입 전 호출됨.
        // branches 가 비어있으면 runParallel 이 즉시 종결 (정상 흐름).
        execute: jest.fn(async () => ({
          config: { branches: [] },
          output: { result: { branches: [] } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, parallelNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: parallelHandler,
        downstreamType: 'test_parallel_w2',
        downstreamMetadata: { kind: 'parallel' },
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Parallel downstream handler 가 dispatch 됨 (runNodeDispatchLoop 의
      // parallel 분기 도달).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // Execution 은 정상 COMPLETED 마감 — runParallel 가 빈 branches 로
      // 즉시 종결 후 graph loop 자연 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    it('dispatches downstream background node when retry succeeds (W2 background resume)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const backgroundNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_background_w2',
        category: NodeCategory.LOGIC,
        label: 'DownstreamBackground',
        config: {},
        isDisabled: false,
      };
      const backgroundHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { result: { scheduled: true } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, backgroundNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: backgroundHandler,
        downstreamType: 'test_background_w2',
        downstreamMetadata: { kind: 'background' },
      });

      await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Background downstream handler 가 dispatch 됨 (runNodeDispatchLoop 의
      // background 분기 도달 → scheduleBackgroundBody).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // Execution 은 정상 COMPLETED 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // PR #371 ai-review W4 — downstream blocking 노드 (form/buttons/ai_conversation)
    // resume 경로 회귀 가드. retry 성공 후 downstream 의 blocking 노드가 정상적으로
    // waitForX 진입하는지 검증한다 (runNodeDispatchLoop 의 blocking wait 분기 도달).
    //
    // Phase B (PR-B1) — downstream form 은 이제 fresh top-level park 으로 **release**
    // 된다: runNodeDispatchLoop 가 PARK_RELEASED 를 받아 `{ parked: true }` 를 반환하고
    // resumeGraphAfterRetry 는 COMPLETED 마감을 **skip** 한 채 early-return 한다
    // (Execution 은 WAITING_FOR_INPUT 로 잔류, 재개는 §7.5 rehydration). 따라서 옛
    // "continueExecution → COMPLETED" 단언은 더 이상 성립하지 않는다. 본 테스트의 새
    // 불변식: downstream form 에 도달하면 다시 **park**(waiting emit)되고 execution.
    // completed 는 emit 되지 않는다 (re-park). retryPromise 는 park-release 로 코루틴이
    // 풀려 continuation 없이도 resolve 된다.
    it('enters waitForFormSubmission when downstream is a form node, resumes on continueExecution (W4 form)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const formNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_form_w4',
        category: NodeCategory.PRESENTATION,
        label: 'DownstreamForm',
        config: { fields: [{ name: 'approved', type: 'checkbox' }] },
        isDisabled: false,
      };
      const formHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'form',
              formConfig: {
                fields: [{ name: 'approved', type: 'checkbox' }],
              },
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'form' },
            },
          ),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, formNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: formHandler,
        downstreamType: 'test_form_w4',
        downstreamMetadata: { kind: 'blocking', interaction: 'form' },
      });

      // Retry 시작 — form node 가 waiting_for_input 으로 진입 후 hang.
      // applyRetryLastTurn 의 Promise 는 continueExecution 후에야 resolve.
      const retryPromise = retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Form handler.execute 가 dispatch 됨 (runNodeDispatchLoop 의 blocking
      // 분기 진입 직전).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // waiting_for_input 이벤트 emit (interactionType='form').
      const waitingForInput =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.waiting_for_input',
        );
      expect(waitingForInput.length).toBe(1);
      expect(waitingForInput[0][2]).toMatchObject({
        waitingNodeId: DOWNSTREAM_ID,
        interactionType: 'form',
      });
      // Phase B (PR-B1) — downstream form 의 park-release 로 코루틴이 풀려
      // resumeGraphAfterRetry 가 COMPLETED 마감 없이 early-return 한다. 따라서
      // retryPromise 는 continuation 없이도 resolve 된다.
      await retryPromise;
      await flushPromises();

      // 새 불변식: downstream form 에서 re-park 됐을 뿐 COMPLETED 마감되지 않는다.
      // (재개는 §7.5 rehydration 으로 일원화 — 별도 continuation job 경로.)
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(0);
      // waiting_for_input(downstream form) 은 정확히 1회 emit — re-park 확인.
      const waitingAfter =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.waiting_for_input',
        );
      expect(waitingAfter.length).toBe(1);
      expect(waitingAfter[0][2]).toMatchObject({
        waitingNodeId: DOWNSTREAM_ID,
        interactionType: 'form',
      });
    });

    // W4 buttons / ai_conversation — `waitForX` private method spy 패턴.
    // form 시나리오는 metadata 의 `interaction === 'form'` 분기로 통과하지만,
    // buttons / ai_conversation 분기는 `getInteractionType` (캐시 양쪽 lookup)
    // 결과 의존이라 fixture 정확성 디버깅 비용이 크다. 본 PR 의 회귀 가드
    // 목적은 `runNodeDispatchLoop` 의 buttons / ai_conversation 분기 도달 자체
    // 검증이므로 `waitForX` 를 spy 로 대체해 hang 회피 + 호출 1회 검증으로
    // 단순화한다.

    it('reaches waitForButtonInteraction when downstream is a buttons node (W4 buttons)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const buttonsNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_buttons_w4',
        category: NodeCategory.PRESENTATION,
        label: 'DownstreamButtons',
        config: { buttons: [{ id: 'btn-ok', label: 'OK' }] },
        isDisabled: false,
      };
      // mockOutput 의 양쪽 위치에 interactionType 명시 — flat 와 structured
      // 양쪽 캐시 모두에 'buttons' 가 들어가도록.
      const buttonsHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'buttons',
              interactionType: 'buttons',
              buttons: [{ id: 'btn-ok', label: 'OK' }],
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'buttons' },
            },
          ),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, buttonsNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: buttonsHandler,
        downstreamType: 'test_buttons_w4',
        downstreamMetadata: { kind: 'blocking', interaction: 'buttons' },
      });

      // C-1 step3 — waitForButtonInteraction 은 ButtonInteractionService 로 이동.
      // 엔진 dispatch loop 가 this.buttonInteraction.waitForButtonInteraction 으로
      // 위임하므로, 분기 도달 검증(+hang 회피)을 위해 그 인스턴스 메서드를 spy 한다.
      const btnAny = buttonInteraction as unknown as {
        waitForButtonInteraction: jest.Mock;
      };
      const originalWait = btnAny.waitForButtonInteraction;
      btnAny.waitForButtonInteraction = jest.fn().mockResolvedValue(undefined);

      try {
        await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
        await flushPromises();

        // Buttons handler.execute 가 dispatch 됨.
        expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
        // runNodeDispatchLoop 의 `downstreamInteraction === 'buttons'` 분기 도달.
        expect(btnAny.waitForButtonInteraction).toHaveBeenCalledTimes(1);
      } finally {
        btnAny.waitForButtonInteraction = originalWait;
      }
    });

    it('reaches waitForAiConversation when downstream is an ai_conversation node (W4 ai_conversation)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamAiNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_ai_conv_w4',
        category: NodeCategory.AI,
        label: 'DownstreamAi',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-2', maxTurns: 10 },
        isDisabled: false,
      };
      const aiHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'ai_conversation',
              interactionType: 'ai_conversation',
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'ai_conversation' },
            },
          ),
        ),
        processMultiTurnMessage: jest.fn(),
        endMultiTurnConversation: jest.fn(),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, downstreamAiNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: aiHandler,
        downstreamType: 'test_ai_conv_w4',
        downstreamMetadata: {
          kind: 'blocking',
          interaction: 'ai_conversation',
        },
      });

      // C-1 step2 — waitForAiConversation 은 orchestrator 로 이동. dispatch loop 의
      // ai_conversation 분기가 orchestrator 로 위임하므로 orchestrator 에 둔다.
      const orchAny = aiTurnOrchestrator as unknown as {
        waitForAiConversation: jest.Mock;
      };
      const originalWait = orchAny.waitForAiConversation;
      orchAny.waitForAiConversation = jest.fn().mockResolvedValue(undefined);

      try {
        await retryTurnService.applyRetryLastTurn(EXEC, SPAWNED);
        await flushPromises();

        expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
        // runNodeDispatchLoop 의 `downstreamInteraction === 'ai_conversation'`
        // 분기 도달.
        expect(orchAny.waitForAiConversation).toHaveBeenCalledTimes(1);
      } finally {
        orchAny.waitForAiConversation = originalWait;
      }
    });
  });
});
