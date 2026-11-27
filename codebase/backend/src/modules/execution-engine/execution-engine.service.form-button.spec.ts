import { In } from 'typeorm';
import {
  BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS,
  BackgroundExecutionJob,
} from './queues/background-execution.queue';
import { ExecutionEngineService } from './execution-engine.service';
import { MessageTooLongError } from './workflow-errors';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { FormInteractionService } from './form-interaction.service';
import { ExecutionContextService } from './context/execution-context.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { NodeHandler } from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  mockHandler,
  mockWorkflow,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { BackgroundHandler } from '../../nodes/logic/background/background.handler';
import {
  armSlowPathResume,
  flushResumeDrive,
} from './__test-utils__/engine-service-resume-drive';

/**
 * ExecutionEngineService 단위 테스트: Form · Button 노드 대기와 재개.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  // C-1 step3 — Form/Button blocking-interaction 은 FormInteractionService /
  // ButtonInteractionService 로 추출됨. 엔진의 dispatch/registry 가 위임하므로,
  // 위임된 메서드를 spy 하는 테스트는 이 인스턴스를 대상으로 한다 (엔진 인스턴스
  // 가 아님 — AiTurnOrchestrator 선례와 동일).
  let formInteraction: FormInteractionService;
  // 엔진·interaction 서비스가 공유하는 ConversationThreadService 싱글톤 — form/button
  // resume 의 thread append 부작용을 위임 너머로 검증하기 위해 모듈에서 직접 얻는다
  // (옛 `service.conversationThreadService` 접근은 엔진에서 주입이 제거돼 무효).
  let conversationThreadService: ConversationThreadService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      formInteraction,
      conversationThreadService,
      handlerRegistry,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
      mockWorkflowRepo,
      mockExecutionNodeLogRepo,
    } = h);
  });

  describe('Form node blocking', () => {
    const formNodes: Partial<Node>[] = [
      {
        id: 'node-start',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'Start',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-form',
        workflowId,
        type: 'form',
        category: NodeCategory.PRESENTATION,
        label: 'Approval Form',
        config: {
          fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
          title: 'Approval',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-end',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'End',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const formEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-start',
        sourcePort: 'out',
        targetNodeId: 'node-form',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
      {
        id: 'edge-2',
        workflowId,
        sourceNodeId: 'node-form',
        sourcePort: 'out',
        targetNodeId: 'node-end',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    const formHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () =>
        mockOutput({
          type: 'form',
          status: 'waiting_for_input',
          formConfig: {
            fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
            title: 'Approval',
          },
        }),
      ),
    };

    beforeEach(() => {
      // Reset the test_node handler implementation (may have been overridden by previous tests)
      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ processed: true }),
      );
      mockNodeRepo.findBy.mockResolvedValue(formNodes);
      mockEdgeRepo.findBy.mockResolvedValue(formEdges);
      // PR-G — metadata 동봉 등록. 엔진의 dispatch 가 `kind === 'blocking' &&
      // interaction === 'form'` 으로 form 노드를 식별한다.
      handlerRegistry.register('form', formHandler, {
        kind: 'blocking',
        interaction: 'form',
      });
    });

    it('should pause at Form node and emit waiting_for_input event', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Should emit waiting_for_input event — payload 가 startedAt (ISO) 을
      // 동봉해야 한다. 프론트엔드 store 가 NODE_STARTED race miss 시에도
      // sortByStartedAt 정렬 정합성을 유지하기 위해서 (timeline-ordering
      // bug fix).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.waiting_for_input',
        expect.objectContaining({
          status: 'waiting_for_input',
          waitingNodeId: 'node-form',
          waitingNodeType: 'form',
          startedAt: expect.any(String),
          // Carousel buttons-disabled bug fix (2026-05-09) — 3 waiting emit
          // (Buttons / Form / AI) 모두 top-level interactionType 일관화.
          // frontend handleWaitingForInput 의 첫 fallback 만으로 정확히 분기.
          interactionType: 'form',
        }),
      );

      // End node should NOT have been executed yet (form is blocking)
      expect(mockHandler.execute).toHaveBeenCalledTimes(1); // only start node
    });

    // `output: null` 출력의 포트 봉투(NERV Task CLE-T-X3AH4F)는 포트 하나만 고른 출력에만
    // 쓴다. 입력 대기 선언은 포트가 함께 있어도 예전처럼 대기로 멈춘다.
    it.each([
      ['포트 없음', {}],
      ['포트 있음', { port: 'out' }],
    ])(
      'output 이 null 인 입력 대기 선언(%s)도 대기 이벤트를 내고 멈춘다',
      async (_label, portField) => {
        (formHandler.execute as jest.Mock).mockImplementationOnce(async () => ({
          config: { fields: [{ name: 'approved', type: 'checkbox' }] },
          output: null,
          meta: { interactionType: 'form' },
          status: 'waiting_for_input',
          ...portField,
        }));

        await service.execute(
          workflowId,
          { data: 'test' },
          { workspaceId: 'ws-1' },
        );
        await flushPromises();

        expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
          executionId,
          'execution.waiting_for_input',
          expect.objectContaining({
            status: 'waiting_for_input',
            waitingNodeId: 'node-form',
            interactionType: 'form',
          }),
        );
        expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      },
    );

    it('persists outputData.meta.interactionType="form" so snapshot reconcile hydrates store correctly', async () => {
      // 페이지 재마운트 시 execution.snapshot reconcile (frontend) 이 이
      // 필드로 store 의 waitingInteractionType 을 set. 누락 시 Preview 탭
      // 버튼이 callback 없이 disabled 로 그려지는 회귀 발생 (PR-B Part C).
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      const saveCalls = mockNodeExecutionRepo.save.mock.calls;
      const waitingSave = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as { status?: string })?.status ===
          NodeExecutionStatus.WAITING_FOR_INPUT,
      );
      expect(waitingSave).toBeDefined();
      const persisted = (waitingSave as unknown[])[0] as {
        outputData?: { meta?: { interactionType?: string } };
      };
      expect(persisted.outputData?.meta?.interactionType).toBe('form');
    });

    // PR-A3 WARNING #1 — form park 통합 경로에서 userVariables 가 DB save 인자에
    // 포함되는지 검증. stageDurableResumeSnapshot → updateExecutionStatus 트랜잭션
    // 경로(linkedNodeExec 있음 → dataSource.transaction → manager.save(Execution, ...))
    // 를 통해 Execution.userVariables 가 영속됨을 통합 레벨에서 assert.
    it('PR-A3 — form park: Execution save 에 userVariables 객체가 포함된다 (DB 영속 통합 가드)', async () => {
      mockExecutionRepo.save.mockClear();

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // updateExecutionStatus 의 linkedNodeExec 경로는 dataSource.transaction 을
      // 통해 manager.save(Execution, execution) 를 호출하고, 테스트의 transaction
      // mock 이 이를 mockExecutionRepo.save 로 라우팅한다 (L288~310 mock 설정).
      const execSaveCalls = mockExecutionRepo.save.mock.calls;
      // WAITING_FOR_INPUT 상태로 저장된 Execution 행이 userVariables 를 포함해야 함.
      const parkSave = execSaveCalls.find(
        (c: unknown[]) =>
          (c[0] as Partial<Execution>).status ===
          ExecutionStatus.WAITING_FOR_INPUT,
      );
      expect(parkSave).toBeDefined();
      const savedExecution = (parkSave as [Partial<Execution>])[0];
      // userVariables 필드가 존재해야 함 (빈 객체여도 됨 — 변수 없는 워크플로우).
      expect(
        Object.prototype.hasOwnProperty.call(savedExecution, 'userVariables'),
      ).toBe(true);
      expect(savedExecution.userVariables).toBeDefined();
    });

    it('should resume after continueExecution and complete all nodes', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Resume with form data — Phase B (PR-B1): slow-path rehydration 으로 재개
      // 되므로 detached 드라이브 완료까지 실제 타이머를 흘린다. slow-path 가
      // 통과하는 DB lookup mock 을 무장한다.
      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      // End node should now have been executed
      expect(mockHandler.execute).toHaveBeenCalledTimes(2); // start + end

      // Execution should be completed
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({
          status: 'completed',
          // EIA §6 필드 집합 표가 `durationMs` 를 종결 3종에 약속한다.
          durationMs: expect.any(Number) as unknown,
        }),
      );
    });

    // CLE-T-TDAV1G — 재개 경로(`runNodeDispatchLoop`)의 범위 입력은 `{}` 다. 재개 뒤
    // 실행한 Background 도 Background 노드가 받은 입력으로 본문을 큐에 넣는다.
    it('재개 뒤 실행한 Background 는 범위 입력이 아니라 Background 노드가 받은 입력(앞 노드 출력)으로 본문을 큐에 넣는다 (CLE-T-TDAV1G)', async () => {
      handlerRegistry.register('background', new BackgroundHandler(), {
        kind: 'background',
      });
      handlerRegistry.register('pre_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ marker: 'pre-output' })),
      });
      const [startNode, formNode, endNode] = formNodes;
      mockNodeRepo.findBy.mockResolvedValue([
        startNode,
        formNode,
        { ...endNode, id: 'node-pre', type: 'pre_node', label: 'Pre' },
        { ...endNode, id: 'node-bg', type: 'background', label: 'Bg' },
        endNode,
        { ...endNode, id: 'node-bg-body', label: 'BgBody' },
      ]);
      const [startToForm, formToEnd] = formEdges;
      mockEdgeRepo.findBy.mockResolvedValue([
        startToForm,
        { ...formToEnd, id: 'edge-form-pre', targetNodeId: 'node-pre' },
        {
          ...formToEnd,
          id: 'edge-pre-bg',
          sourceNodeId: 'node-pre',
          targetNodeId: 'node-bg',
        },
        {
          ...formToEnd,
          id: 'edge-bg-end',
          sourceNodeId: 'node-bg',
          sourcePort: 'main',
          targetNodeId: 'node-end',
        },
        {
          ...formToEnd,
          id: 'edge-bg-body',
          sourceNodeId: 'node-bg',
          sourcePort: 'background',
          targetNodeId: 'node-bg-body',
        },
      ]);
      const queueAdd = (
        service as unknown as { backgroundQueue: { add: jest.Mock } }
      ).backgroundQueue.add;
      queueAdd.mockClear();

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      // 폼에서 멈췄으므로 Background 는 아직 실행하지 않았다.
      expect(queueAdd).not.toHaveBeenCalled();

      armSlowPathResume(h, 'node-form', formNode);
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      const jobs = queueAdd.mock.calls.map(
        (call: unknown[]) => call[1] as BackgroundExecutionJob,
      );
      expect(jobs.map((job) => job.bodyEntryNodeIds)).toEqual([
        ['node-bg-body'],
      ]);
      expect(jobs.map((job) => job.input)).toEqual([{ marker: 'pre-output' }]);
      // 끝난 작업 보존은 큐 정의의 나이 기준 옵션을 쓴다(CLE-T-9XMCS6).
      expect(queueAdd.mock.calls.map((call: unknown[]) => call[2])).toEqual([
        BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS,
      ]);
    });

    // ai-review C2 (2026-07-26) — mutation 실측: `runNodeDispatchLoop` 상단의
    // §2.3 가드(`assertExecutionNotCancelled`)를 제거해도 이전엔 407/407 GREEN
    // 이었다(커버리지 0). §7.5 재개 경로(driveResumeAwaited → runNodeDispatchLoop)
    // 에서 외부 cancel 관측 시 하류 노드(node-end)가 실제로 dispatch 되지 않음을
    // 직접 고정한다 — resume 경로는 runExecution 의 선형 루프와 별도 while 문이라
    // 독립적으로 회귀할 수 있다.
    it('재개 중 외부 cancel 관측 시 runNodeDispatchLoop 가 하류 노드를 dispatch 하지 않는다 (§2.3 C2)', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      // armSlowPathResume 의 mockResolvedValueOnce 는 rehydrateAndResume 의
      // invariant 조회(WAITING_FOR_INPUT) 1건을 채운다. 그 다음 executionRepository
      // .findOneBy 호출 — runNodeDispatchLoop 상단 assertExecutionNotCancelled(§2.3)
      // — 이 CANCELLED 를 관측하도록 무장한다.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: executionId,
        workflowId,
        status: ExecutionStatus.CANCELLED,
        startedAt: new Date(),
      });

      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      // node-end(하류)는 dispatch 되지 않는다 — node-start(park 이전, 1회)만.
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      // finalizeResumedExecutionOutcome(C4/W3) 이 cancelled 로 마감 + emit.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(mockWebsocketService.emitExecutionEvent).not.toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.anything(),
      );
    });

    // ai-review W11 (2026-07-26) — C4 배선(옛 raw `save()` → guarded
    // `updateExecutionStatus`)에 대한 회귀 테스트. `stop()` 이 이미 이 Execution 을
    // CANCELLED 로 커밋해 guarded UPDATE 가 0행(이미 terminal)을 매칭하는 상황을
    // 재현한다 — 이 경우 `finalizeCancelledExecution`(C4/W12)이 계산한 방어적
    // `finishedAt`/`durationMs` 값이 옛 raw `save()` 경로로 다시 쓰여서는 안 된다
    // (그 값은 이 catch 가 최초 관측자가 아닐 때 stop() 이 이미 쓴 정확한 시각보다
    // 늦다). 옛 배선으로 되돌리면(guarded UPDATE 대신 `executionRepository.save`)
    // 아래 두 번째 단언이 RED 가 된다 — mutation 으로 실측 검증.
    it('guarded UPDATE 가 0행 매칭(이미 terminal)이어도 stale finishedAt/durationMs 를 raw save() 로 재저장하지 않는다 (W11)', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: executionId,
        workflowId,
        status: ExecutionStatus.CANCELLED,
        startedAt: new Date(),
      });

      // guarded UPDATE(CANCELLED 전이)만 0행 매칭으로 override — 그 외 `.query()`
      // 호출은 기존 default(1행 매칭)를 그대로 쓴다.
      const defaultQuery = mockExecutionRepo.query;
      mockExecutionRepo.query = jest.fn((sql: string, params?: unknown[]) => {
        if (
          typeof sql === 'string' &&
          sql.includes('UPDATE execution') &&
          Array.isArray(params) &&
          params.includes(ExecutionStatus.CANCELLED)
        ) {
          // 0행 = 이미 terminal (stop() 이 선점). **실 드라이버 shape 인 `[rows, count]`
          // 튜플로 준다** — 종전엔 bare `[]` 였고, `updateReturningRows` 를 거치면 둘 다
          // length 0 이라 결론은 같았지만 **틀린 현실을 mock 에 인코딩**하는 것이 이
          // 결함 클래스의 발원지다 (`01_44_04` plan_coherence INFO 6).
          return Promise.resolve([[], 0]);
        }
        return defaultQuery(sql, params);
      });

      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      // (a) guarded UPDATE 경로가 실제로 시도됐다 (0행 매칭이라도 시도는 함).
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE execution'),
        expect.arrayContaining([ExecutionStatus.CANCELLED]),
      );
      // (b) 0행 매칭이므로 raw save() 로 stale finishedAt/durationMs 를 다시 쓰지
      // 않는다 — CANCELLED 상태의 Execution save() 호출 자체가 없어야 한다.
      expect(
        mockExecutionRepo.save.mock.calls.some(
          (c: unknown[]) =>
            (c[0] as Partial<Execution>).status === ExecutionStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    // §4.x "active 세그먼트 + durable park" 회귀 가드 — worker job 반환.
    // 옛 버그: `runExecutionFromQueue`(worker process() 가 await 하는 진입점)가
    // `runExecution` 전체를 await 해 form park 동안 BullMQ job(concurrency=1
    // 슬롯)을 점유 → 새 execution 미실행.
    //
    // Phase B (PR-B1) — 이제 fresh top-level form park 은 세그먼트 종료다:
    // durable snapshot 영속 + WAITING 전이 후 PARK_RELEASED 로 코루틴을 **해제**한다
    // (pendingContinuations 에 resolver 미등록 = bounded memory). worker job 은
    // park 시점에 반환되고, 재개는 §7.5 slow-path(rehydration)로 일원화된다. 본
    // 테스트의 새 불변식: park 후 **resolver 잔류 없음** (released), execution 행은
    // DB 에서 WAITING_FOR_INPUT, 그리고 resume 은 slow-path 로 완료된다.
    it('§4.x — runExecutionFromQueue 는 form park 시점에 resolve (worker job 반환), execution 은 계속 parked', async () => {
      // execute() 의 자동 worker 브릿지를 우회하고 직접 worker 진입점을 호출한다.
      const fromQueue = service.runExecutionFromQueue(executionId, {
        data: 'test',
      });

      // worker 진입점은 park 시점에 반환해야 한다 — 절대 form 제출까지 hang 하지
      // 않는다. (옛 버그라면 이 await 는 영원히 resolve 되지 않아 timeout.)
      await expect(fromQueue).resolves.toBeUndefined();

      // exec-park D6 full B3 — park 는 durable persist + WAITING 전이로 완결되며
      // in-memory resolver/coroutine 잔류가 없다 (bounded memory). 아직 form
      // 다음(End) 노드는 실행되지 않았다 (start 만).
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);

      // 이후 사용자 제출은 §7.5 slow-path(rehydration)로 lossless 재개 → 완료.
      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();
      expect(mockHandler.execute).toHaveBeenCalledTimes(2); // start + end
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({
          status: 'completed',
          // EIA §6 필드 집합 표가 `durationMs` 를 종결 3종에 약속한다.
          durationMs: expect.any(Number) as unknown,
        }),
      );
    });

    // §4.x — A 가 parked 인 동안 B 가 즉시 실행됨 (worker 슬롯 starvation 해소).
    // 같은 service 인스턴스에서 두 execution 의 worker 진입점을 순차 호출하되,
    // A 가 park 로 슬롯을 반환했으므로 B 의 runExecutionFromQueue 가 막힘 없이
    // 끝까지 진행한다.
    it('§4.x — execution A 가 parked 인 동안 execution B 가 즉시 실행 완료된다', async () => {
      const execA = 'exec-A-parked';
      const execB = 'exec-B-runs';

      // findOneBy 가 두 execution 모두 PENDING 으로 반환하도록 라우팅. A 는
      // 폼 워크플로(park), B 는 단순 노드 워크플로(즉시 완료)로 분기한다.
      const statusById: Record<string, ExecutionStatus> = {
        [execA]: ExecutionStatus.PENDING,
        [execB]: ExecutionStatus.PENDING,
      };
      mockExecutionRepo.findOneBy.mockImplementation(({ id }: { id: string }) =>
        Promise.resolve({
          id,
          workflowId,
          status: statusById[id] ?? ExecutionStatus.PENDING,
          inputData: {},
          startedAt: new Date(),
        }),
      );
      // updateExecutionStatus → save 가 상태를 갱신하면 후속 findOneBy 가 반영하도록.
      mockExecutionRepo.save.mockImplementation(
        (entity: Partial<Execution>) => {
          if (entity.id && entity.status) {
            statusById[entity.id] = entity.status;
          }
          return Promise.resolve(entity);
        },
      );

      // A: 폼 워크플로로 park.
      const aQueue = service.runExecutionFromQueue(execA, { data: 'a' });
      await expect(aQueue).resolves.toBeUndefined();
      // exec-park D6 full B3 — fresh top-level park 은 durable persist + WAITING
      // 전이로 완결한다 (in-memory coroutine 잔류 없음). A 의 DB 행이
      // WAITING_FOR_INPUT 으로 영속됐다.
      expect(statusById[execA]).toBe(ExecutionStatus.WAITING_FOR_INPUT);

      // B: 폼 없는 단순 워크플로(start→end, 모두 test_node)로 즉시 완료.
      mockNodeRepo.findBy.mockResolvedValueOnce([
        {
          id: 'b-start',
          workflowId,
          type: 'test_node',
          category: NodeCategory.LOGIC,
          config: {},
          isDisabled: false,
        },
      ]);
      mockEdgeRepo.findBy.mockResolvedValueOnce([]);

      const bQueue = service.runExecutionFromQueue(execB, { data: 'b' });
      // B 의 worker 진입점은 A 의 park 와 무관하게 즉시 완료까지 진행 → resolve.
      await expect(bQueue).resolves.toBeUndefined();
      await flushPromises();
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        execB,
        'execution.completed',
        expect.objectContaining({
          status: 'completed',
          // EIA §6 필드 집합 표가 `durationMs` 를 종결 3종에 약속한다.
          durationMs: expect.any(Number) as unknown,
        }),
      );
      // A 는 여전히 parked (durable DB WAITING, in-memory coroutine 없음).
      expect(statusById[execA]).toBe(ExecutionStatus.WAITING_FOR_INPUT);
    });

    // Engine hook (spec/conventions/conversation-thread.md §2.1) — form resume
    // must push a presentation_user turn to the
    // ConversationThread so downstream AI Agent nodes can auto-inject it.
    // SoT: spec/conventions/conversation-thread.md §2.1.
    //
    // We assert via spy because the engine deletes the ExecutionContext when
    // the workflow completes (this test runs the form to terminal state).
    // Spying captures the hook's call args at the exact resume tick.
    it('appends presentation_user turn to ConversationThread on form resume', async () => {
      // C-1 step3 — form resume 는 이제 FormInteractionService 로 위임된다. 그 서비스가
      // 주입받는 ConversationThreadService 는 엔진과 같은 싱글톤이므로 모듈에서 얻은
      // 인스턴스를 그대로 spy 한다 (위임 너머 thread append 부작용 검증).
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          node: expect.objectContaining({
            id: 'node-form',
            type: 'form',
          }),
          interaction: expect.objectContaining({
            type: 'form_submitted',
            data: { approved: true },
            receivedAt: expect.any(String),
          }),
        }),
      );
    });

    it('should emit EXECUTION_RESUMED (not EXECUTION_STARTED) when resuming from form', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Clear mock to isolate resume events
      mockWebsocketService.emitExecutionEvent.mockClear();

      // Resume with form data (slow-path rehydration)
      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      // Should emit execution.resumed, NOT execution.started
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.resumed',
        expect.objectContaining({ status: 'running' }),
      );
      // Ensure execution.started was NOT emitted during resume
      const startedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.started',
        );
      expect(startedCalls).toHaveLength(0);
    });

    it('should emit NODE_COMPLETED for the form node when resuming', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      mockWebsocketService.emitNodeEvent.mockClear();

      armSlowPathResume(
        h,
        'node-form',
        formNodes.find((n) => n.id === 'node-form')!,
      );
      void service.continueExecution(executionId, { approved: true });
      await flushResumeDrive();

      // Form node should have a NODE_COMPLETED event
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-form',
        'execution.node.completed',
        expect.objectContaining({
          status: 'completed',
          nodeType: 'form',
        }),
      );
    });

    it('should silently skip continueExecution without local pending continuation (multi-instance safe)', async () => {
      // PR-B — 다중 인스턴스에서 다른 인스턴스가 호스팅 중일 수 있으므로
      // "No pending continuation" 즉시 throw 는 폐기됐다. publish 만 수행하고
      // 키가 있는 인스턴스만 실제 resolve 한다.
      await expect(
        service.continueExecution('non-existent', {}),
      ).resolves.not.toThrow();
    });

    it('should throw when continueAiConversation receives oversized message', async () => {
      // Set up a pending continuation first
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      const oversizedMessage = 'x'.repeat(10_001);
      await expect(
        service.continueAiConversation(executionId, oversizedMessage),
      ).rejects.toBeInstanceOf(MessageTooLongError);
    });

    it('should silently skip continueAiConversation without local pending continuation (multi-instance safe)', async () => {
      // PR-B — 위와 동일 사유. publish 만 수행하고 silent skip.
      await expect(
        service.continueAiConversation('non-existent', 'hello'),
      ).resolves.not.toThrow();
    });

    it('should handle cancellation of waiting execution', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Cancel the waiting execution — Phase B (PR-B1): park-release 로 코루틴이
      // 없으므로 cancelParkedExecution 이 durable WAITING 행을 직접 CANCELLED 마감.
      // 그 마감은 (ai-review WARNING #1, 2026-07-27 — 단일 트랜잭션으로 원자화)
      // `dataSource.transaction` 안의 `manager.createQueryBuilder()` 이중 UPDATE
      // (Execution → NodeExecution) 의 affected>0 일 때만 EXECUTION_CANCELLED 를
      // emit 한다 — 전역 기본 mock(getDataSourceToken)이 이미 affected:1 로
      // 무장돼 있어 별도 오버라이드가 필요 없다.
      await service.cancelWaitingExecution(executionId);
      await flushResumeDrive();

      // Should emit cancelled event
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    // Phase 2.7 — rehydration 통합 시나리오. 단일 instance 의 in-memory
    // pendingContinuations 를 강제로 비운 뒤 applyContinuation 을 직접 호출
    // (BullMQ Worker 가 다른 instance 또는 재시작 후 본 instance 의 worker 가
    // pick up 한 상황 시뮬레이션). rehydrateAndResume 가 DB 에서 context 재구성
    // 후 waitForFormSubmission 을 재 invoke 해 workflow 가 정상 완료되는지 검증.
    it('Phase 2.7 — rehydration: pendingContinuations 가 비어있어도 applyContinuation → rehydrate → workflow 정상 완료', async () => {
      // 1. 정상 시작 → 폼 노드에서 WAITING_FOR_INPUT 진입.
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // 2. 첫 단계 시점의 NodeExecution(form 노드) outputData 캡처. waitFor
      //    Form 가 NodeExecution.outputData 에 form 노드의 envelope (status=
      //    waiting_for_input + meta.interactionType=form) 을 저장한 마지막 save 결과.
      const saveCalls = mockNodeExecutionRepo.save.mock.calls;
      const waitingSave = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as { status?: string; nodeId?: string })?.status ===
            NodeExecutionStatus.WAITING_FOR_INPUT &&
          (c[0] as { nodeId?: string })?.nodeId === 'node-form',
      );
      expect(waitingSave).toBeDefined();
      const persistedFormOutput = (
        (waitingSave as unknown[])[0] as {
          outputData?: Record<string, unknown>;
        }
      ).outputData;
      expect(persistedFormOutput).toBeDefined();

      // 3. 인스턴스 재시작 시뮬레이션 — 같은 id 의 in-memory context 를 제거하여
      //    rehydrateContext 가 DB 에서 재구성하도록 한다. (exec-park D6 full B3 —
      //    in-memory resolver/pendingContinuations 자체가 없으므로 applyContinuation
      //    은 항상 rehydrateAndResume slow-path 로 진입한다.)
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      contextService.deleteContext(executionId);

      // 4. 정확히 rehydrateAndResume 분기에 들어가도록 DB 응답 mock 갱신.
      //    - Execution 은 WAITING_FOR_INPUT.
      //    - NodeExecution(form) 은 WAITING_FOR_INPUT + persistedFormOutput 보유.
      //    - Node(form) 정의는 formNodes 에서 찾는다.
      //    - execution_node_log 는 start 노드 1건 (form 노드는 아직 미완료).
      //    - findOne (status=COMPLETED) 으로 start 노드의 outputData 반환.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
        recursionDepth: 0,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValueOnce({
        id: 'ne-node-form',
        executionId,
        nodeId: 'node-form',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: persistedFormOutput,
        startedAt: new Date(),
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValueOnce(formNodes.find((n) => n.id === 'node-form'));
      mockExecutionNodeLogRepo.find.mockResolvedValueOnce([
        { id: 1, executionId, nodeId: 'node-start' },
      ]);
      mockWorkflowRepo.findOne.mockResolvedValueOnce({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      // execution_node_log 의 start 노드를 위한 COMPLETED NodeExecution lookup.
      // 그리고 rehydration 후 waitForFormSubmission 이 호출하는 findOne (form node
      // 의 가장 최근 row) 도 같은 mock 이 처리해야 한다 — nodeId 별 분기.
      const originalFindOne = mockNodeExecutionRepo.findOne;
      mockNodeExecutionRepo.findOne = jest
        .fn()
        .mockImplementation(
          (
            opts: { where?: { nodeId?: string; status?: string } } = {},
          ): Promise<unknown> => {
            const nid = opts.where?.nodeId;
            if (
              nid === 'node-start' &&
              opts.where?.status === NodeExecutionStatus.COMPLETED
            ) {
              return Promise.resolve({
                id: 'ne-node-start',
                executionId,
                nodeId: 'node-start',
                status: NodeExecutionStatus.COMPLETED,
                outputData: { processed: true },
                startedAt: new Date(),
              });
            }
            if (nid === 'node-form') {
              return Promise.resolve({
                id: 'ne-node-form',
                executionId,
                nodeId: 'node-form',
                status: NodeExecutionStatus.WAITING_FOR_INPUT,
                outputData: persistedFormOutput,
                startedAt: new Date(),
              });
            }
            // 그 외 lookup 은 기본 mock 으로 처리 (legacy 호환).
            return originalFindOne(opts);
          },
        );

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();

      // 5. BullMQ Worker pickup 시뮬레이션 — applyContinuation 직접 호출.
      //    exec-park D6 full B3 — applyContinuation 은 항상 rehydrateAndResume 로 진입.
      await service.applyContinuation('execution-1', 'ne-node-form', {
        type: 'form_submitted',
        formData: { approved: true },
      });
      // applyContinuation → rehydrateAndResume → resumeFromCheckpoint →
      // driveResumeAwaited 가 도착 payload 를 processFormResumeTurn 으로 직접
      // 전달하고 남은 그래프를 순회해 COMPLETED 로 진행한다. drive 는 await 되지만
      // 비동기 emit 정착을 위해 안전하게 polling 한다.
      for (let i = 0; i < 50; i++) {
        const completed = (
          mockWebsocketService.emitExecutionEvent.mock.calls as unknown[][]
        ).some((c) => c[1] === 'execution.completed');
        if (completed) break;
        await new Promise((r) => setTimeout(r, 20));
        await flushPromises();
      }

      // 6. 검증 — workflow 가 COMPLETED 까지 도달.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({
          status: 'completed',
          // EIA §6 필드 집합 표가 `durationMs` 를 종결 3종에 약속한다.
          durationMs: expect.any(Number) as unknown,
        }),
      );
      // form 노드의 NODE_COMPLETED 이벤트도 emit 됐어야 함.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-form',
        'execution.node.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    // PR-A3 WARNING #2 — rehydration 통합 경로에서 userVariables 가 resume 후
    // downstream 노드에 올바르게 전달되는지 검증.
    // mock Execution 에 userVariables: { counter: 5 } 를 설정하고, rehydrateContext
    // 가 context.variables.counter === 5 로 복원하는지 직접 확인한다.
    // (통합 경로: rehydrateContext → createContext({ initialVariables: { ...userVars } }))
    it('PR-A3 WARNING #2 — rehydration: mock Execution.userVariables 가 resume 후 context.variables 에 복원된다', async () => {
      const rehydrateExecId = 'exec-w2-rehydrate-vars';
      const waitingNodeExecForW2 = {
        id: 'ne-w2-form',
        nodeId: 'node-form',
        outputData: {
          interactionType: 'form',
          meta: { interactionType: 'form' },
          status: 'waiting_for_input',
        },
      };

      // rehydrateContext 를 직접 호출해 user variables 가 복원됨을 검증.
      // 이 경로는 applyContinuation slow-path 가 실제로 타는 경로.
      type RehydrateSubject = {
        rehydrateContext: (
          execution: unknown,
          waitingNodeExec: unknown,
        ) => Promise<{ variables: Record<string, unknown> }>;
        contextService: { deleteContext: (id: string) => void };
      };
      const subject = service as unknown as RehydrateSubject;
      subject.contextService.deleteContext(rehydrateExecId);

      mockWorkflowRepo.findOne.mockResolvedValueOnce({
        ...mockWorkflow,
        workspaceId: 'ws-rehydrate-w2',
        workspace: { id: 'ws-rehydrate-w2', name: 'W2', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValueOnce([]);

      const ctx = await subject.rehydrateContext(
        {
          id: rehydrateExecId,
          workflowId,
          status: ExecutionStatus.WAITING_FOR_INPUT,
          recursionDepth: 0,
          dryRun: false,
          conversationThread: null,
          // park 이전에 counter: 5 가 영속된 시나리오.
          userVariables: { counter: 5 },
        },
        waitingNodeExecForW2,
      );

      // downstream 노드가 context.variables.counter === 5 를 수신해야 함.
      expect(ctx.variables['counter']).toBe(5);
      // 시스템 변수도 공존해야 함 (충돌 없음).
      expect(ctx.variables['__workspaceId']).toBe('ws-rehydrate-w2');
    });

    // 재실행 dry-run 부수효과 판정(CLE-EXEC-RERUN) — resume 경로가 만드는 `context.variables.__dryRun` 이
    // `Execution.dryRun` 에서 오는지 고정한다. provider 가드 3종과 resume 재유도가 전부
    // 이 값을 입력으로 삼으므로, 이 연결이 끊기면 가드가 조용히 열린다. 컬럼 NULL(배포 이전
    // row)은 false 로 닫는다.
    it.each([
      ['true', true, true],
      ['false', false, false],
      ['undefined', undefined, false],
    ])(
      'rehydration — Execution.dryRun=%s → context.variables.__dryRun 이 불리언으로 복원된다',
      async (label, dryRun, expected) => {
        const rehydrateExecId = `exec-dryrun-rehydrate-${label}`;
        type RehydrateSubject = {
          rehydrateContext: (
            execution: unknown,
            waitingNodeExec: unknown,
          ) => Promise<{ variables: Record<string, unknown> }>;
          contextService: { deleteContext: (id: string) => void };
        };
        const subject = service as unknown as RehydrateSubject;
        subject.contextService.deleteContext(rehydrateExecId);

        mockWorkflowRepo.findOne.mockResolvedValueOnce({
          ...mockWorkflow,
          workspaceId: 'ws-rehydrate-dry',
          workspace: { id: 'ws-rehydrate-dry', name: 'D', settings: {} },
        });
        mockExecutionNodeLogRepo.find.mockResolvedValueOnce([]);

        const ctx = await subject.rehydrateContext(
          {
            id: rehydrateExecId,
            workflowId,
            status: ExecutionStatus.WAITING_FOR_INPUT,
            recursionDepth: 0,
            dryRun,
            conversationThread: null,
            userVariables: {},
          },
          { id: 'ne-dry-form', nodeId: 'node-form', outputData: null },
        );

        // 불리언 그대로여야 한다. `undefined` 로 새면 `=== true` 가드는 닫혀 있어도
        // 이 값을 그대로 쓰는 소비자가 생기면 달라진다.
        expect(ctx.variables['__dryRun']).toBe(expected);
      },
    );

    // perf #1 — rehydration 의 per-node findOne N+1 을 단일 In() 배치 조회로
    // 교체한 회귀 가드. 의미론 고정: (a) findOne 미사용 + find 1회, (b) 같은
    // nodeId 다중 row(loop iteration)에서 startedAt 최신 COMPLETED 1건 채택
    // (DESC 첫 등장 — _resumeCheckpoint 등 보존 필드를 가진 최신 row 와 선택
    // row 가 일치해야 한다는 conventions 불변식 포함), (c) COMPLETED 부재
    // 노드는 executedNodes 에 미포함.
    it('perf #1 — rehydration 은 nodeExecution 을 단일 배치 조회하고 nodeId 당 최신 COMPLETED 를 채택한다', async () => {
      const rehydrateExecId = 'exec-perf1-batch';
      type RehydrateSubject = {
        rehydrateContext: (
          execution: unknown,
          waitingNodeExec: unknown,
        ) => Promise<{ _executedNodes: Set<string> }>;
        contextService: {
          deleteContext: (id: string) => void;
          setNodeOutputs: (
            key: unknown,
            nodeId: string,
            structured: unknown,
            flat: unknown,
          ) => void;
        };
      };
      const subject = service as unknown as RehydrateSubject;
      subject.contextService.deleteContext(rehydrateExecId);
      const setNodeOutputsSpy = jest.spyOn(
        subject.contextService,
        'setNodeOutputs',
      );

      mockWorkflowRepo.findOne.mockResolvedValueOnce({
        ...mockWorkflow,
        workspaceId: 'ws-perf1',
        workspace: { id: 'ws-perf1', name: 'P1', settings: {} },
      });
      // 로그 타임라인: n1 이 loop iteration 으로 2회 등장 + n2 + COMPLETED
      // row 가 없는 n3.
      mockExecutionNodeLogRepo.find.mockResolvedValueOnce([
        { id: 1, nodeId: 'n1' },
        { id: 2, nodeId: 'n2' },
        { id: 3, nodeId: 'n1' },
        { id: 4, nodeId: 'n3' },
      ]);
      // 배치 조회 응답 (startedAt DESC): n1 의 최신은 iter-2 출력.
      mockNodeExecutionRepo.find = jest.fn().mockResolvedValueOnce([
        {
          nodeId: 'n1',
          startedAt: new Date('2026-06-10T00:00:03Z'),
          outputData: { output: { iter: 2 } },
        },
        {
          nodeId: 'n2',
          startedAt: new Date('2026-06-10T00:00:02Z'),
          outputData: { output: { n2: true } },
        },
        {
          nodeId: 'n1',
          startedAt: new Date('2026-06-10T00:00:01Z'),
          outputData: { output: { iter: 1 } },
        },
      ]);
      const findOneCallsBefore =
        mockNodeExecutionRepo.findOne.mock.calls.length;

      const ctx = await subject.rehydrateContext(
        {
          id: rehydrateExecId,
          workflowId,
          status: ExecutionStatus.WAITING_FOR_INPUT,
          recursionDepth: 0,
          dryRun: false,
          conversationThread: null,
          userVariables: {},
        },
        { id: 'ne-wait', nodeId: 'n-wait', outputData: null },
      );

      // (a) 배치 1회 — findOne 미사용.
      expect(mockNodeExecutionRepo.find).toHaveBeenCalledTimes(1);
      expect(mockNodeExecutionRepo.find.mock.calls[0][0].where.nodeId).toEqual(
        In(['n1', 'n2', 'n3']),
      );
      expect(mockNodeExecutionRepo.findOne.mock.calls.length).toBe(
        findOneCallsBefore,
      );
      // (b) nodeId 당 최신 1건 — n1 은 iter-2 가 복원돼야 한다 (옛 값 회귀 차단).
      // 정본이 아닌 옛 행이라 구조화 출력은 저장 값을 `output` 으로 감싼다.
      const n1Call = setNodeOutputsSpy.mock.calls.find((c) => c[1] === 'n1');
      expect(n1Call?.[2]).toEqual({
        config: {},
        output: { output: { iter: 2 } },
      });
      const n2Call = setNodeOutputsSpy.mock.calls.find((c) => c[1] === 'n2');
      expect(n2Call?.[2]).toEqual({
        config: {},
        output: { output: { n2: true } },
      });
      // (c) COMPLETED 부재 노드(n3)는 복원/완료 처리되지 않는다.
      expect(ctx._executedNodes.has('n1')).toBe(true);
      expect(ctx._executedNodes.has('n2')).toBe(true);
      expect(ctx._executedNodes.has('n3')).toBe(false);

      setNodeOutputsSpy.mockRestore();
    });
  });

  describe('Button (Carousel) node blocking', () => {
    // Mirror of "Form node blocking" (above) for the button-resume path.
    // Verifies the engine hook (spec/conventions/conversation-thread.md §2.1)
    // pushes a presentation_user turn to ConversationThread when the user
    // clicks a port-typed button on a Carousel/Table/Chart/Template node.
    const carouselNodes: Partial<Node>[] = [
      {
        id: 'node-start',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        config: {},
        positionX: 0,
        positionY: 0,
        label: 'start',
        isDisabled: false,
      },
      {
        id: 'node-carousel',
        workflowId,
        type: 'carousel',
        category: NodeCategory.PRESENTATION,
        config: {},
        positionX: 100,
        positionY: 0,
        label: 'carousel',
        isDisabled: false,
      },
      {
        id: 'node-end',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        config: {},
        positionX: 200,
        positionY: 0,
        label: 'end',
        isDisabled: false,
      },
    ];

    const carouselEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-start',
        sourcePort: 'out',
        targetNodeId: 'node-carousel',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
      // Button-typed dynamic port — sourcePort matches button.id so engine
      // routes to `node-end` on click.
      {
        id: 'edge-2',
        workflowId,
        sourceNodeId: 'node-carousel',
        sourcePort: 'btn-1',
        targetNodeId: 'node-end',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    const carouselHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () =>
        mockOutput(
          {
            // Engine reads buttonConfig from nodeOutputCache as fallback —
            // mockOutput puts the value here so waitForButtonInteraction
            // can pick it up via the flat path.
            buttonConfig: {
              buttons: [
                {
                  id: 'btn-1',
                  label: 'Approve',
                  type: 'port' as const,
                  style: 'primary' as const,
                },
              ],
            },
            items: [],
          },
          {
            status: 'waiting_for_input',
            // getInteractionType() reads `meta.interactionType` first.
            // Without this the engine falls through neither the form nor
            // button branch and runs to completion immediately.
            meta: { interactionType: 'buttons' },
          },
        ),
      ),
    };

    beforeEach(() => {
      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ processed: true }),
      );
      mockNodeRepo.findBy.mockResolvedValue(carouselNodes);
      mockEdgeRepo.findBy.mockResolvedValue(carouselEdges);
      handlerRegistry.register('carousel', carouselHandler, {
        kind: 'blocking',
        interaction: 'buttons',
      });
    });

    it('appends presentation_user turn (button_click) to ConversationThread on resume', async () => {
      // C-1 step3 — button resume 는 이제 ButtonInteractionService 로 위임된다. 그
      // 서비스가 주입받는 ConversationThreadService 는 엔진과 같은 싱글톤이므로 모듈에서
      // 얻은 인스턴스를 그대로 spy 한다 (위임 너머 thread append 부작용 검증).
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      // Phase B (PR-B1) — button park-release → resume 은 §7.5 slow-path. slow-path
      // DB lookup 무장 후 detached 드라이브 완료까지 실제 타이머를 흘린다.
      armSlowPathResume(
        h,
        'node-carousel',
        carouselNodes.find((n) => n.id === 'node-carousel')!,
      );
      void service.continueButtonClick(executionId, 'btn-1');
      await flushResumeDrive();

      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          node: expect.objectContaining({
            id: 'node-carousel',
            type: 'carousel',
          }),
          interaction: expect.objectContaining({
            type: 'button_click',
            data: expect.objectContaining({
              buttonId: 'btn-1',
              buttonLabel: 'Approve',
            }),
            receivedAt: expect.any(String),
          }),
        }),
      );
    });

    it('emits waiting_for_input with interactionType="buttons" + thread snapshot', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.waiting_for_input',
        expect.objectContaining({
          waitingNodeId: 'node-carousel',
          waitingNodeType: 'carousel',
          interactionType: 'buttons',
          // Thread snapshot is included for live UI updates (spec §4.4.5).
          conversationThread: expect.objectContaining({
            id: 'default',
            turns: expect.any(Array),
          }),
        }),
      );
    });

    // §4.x 회귀 가드 (button) — worker job 반환 후 click 으로 lossless 재개.
    // Phase B (PR-B1) — button park 도 코루틴 release(resolver 미잔류) → resume 은
    // §7.5 slow-path(rehydration). worker job 은 park 시점에 반환된다.
    it('§4.x — runExecutionFromQueue 는 button park 시점에 resolve, click 후 재개 완료', async () => {
      const fromQueue = service.runExecutionFromQueue(executionId, {
        data: 'test',
      });
      await expect(fromQueue).resolves.toBeUndefined();

      // exec-park D6 full B3 — park 는 durable persist + WAITING 전이로 완결되며
      // in-memory resolver/coroutine 잔류가 없다 (bounded memory).
      expect(mockHandler.execute).toHaveBeenCalledTimes(1); // start only

      // 클릭은 §7.5 slow-path(rehydration)로 재개 → btn-1 포트로 end 라우팅 → 완료.
      armSlowPathResume(
        h,
        'node-carousel',
        carouselNodes.find((n) => n.id === 'node-carousel')!,
      );
      void service.continueButtonClick(executionId, 'btn-1');
      // detached slow-path 드라이브 완료(execution.completed)까지 real-timer polling.
      for (let i = 0; i < 50; i++) {
        const done = (
          mockWebsocketService.emitExecutionEvent.mock.calls as unknown[][]
        ).some((c) => c[1] === 'execution.completed');
        if (done) break;
        await flushResumeDrive(20);
      }
      expect(mockHandler.execute).toHaveBeenCalledTimes(2); // start + end
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({
          status: 'completed',
          // EIA §6 필드 집합 표가 `durationMs` 를 종결 3종에 약속한다.
          durationMs: expect.any(Number) as unknown,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // W13 (SUMMARY) — Form node sentinel unwrap back-compat fallback 검증.
  // waitForFormSubmission 이 sentinel 없는 raw 값을 받으면 warn log + 값 그대로 사용.
  // ---------------------------------------------------------------------------
  describe('waitForFormSubmission — back-compat fallback (W13)', () => {
    const formNodesW13: Partial<Node>[] = [
      {
        id: 'node-start-w13',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'Start',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-form-w13',
        workflowId,
        type: 'form',
        category: NodeCategory.PRESENTATION,
        label: 'Form W13',
        config: {
          fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
          title: 'Test',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];
    const formEdgesW13: Partial<Edge>[] = [
      {
        id: 'edge-w13-1',
        workflowId,
        sourceNodeId: 'node-start-w13',
        sourcePort: 'out',
        targetNodeId: 'node-form-w13',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(formNodesW13);
      mockEdgeRepo.findBy.mockResolvedValue(formEdgesW13);
      const formHandlerW13: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            type: 'form',
            status: 'waiting_for_input',
            formConfig: {
              fields: [
                { name: 'approved', type: 'checkbox', label: 'Approved' },
              ],
            },
          }),
        ),
      };
      handlerRegistry.register('form', formHandlerW13, {
        kind: 'blocking',
        interaction: 'form',
      });
    });

    it('sentinel 없는 raw 값이 resolvePending 에 도달하면 warn log + raw 값 그대로 formData 로 사용', async () => {
      // spec §10.9 back-compat: continueExecution 경로 외 직접 resolvePending 시
      // sentinel 없이 raw 값이 들어올 수 있다. warn log 남기고 raw 값을 그대로 사용.
      //
      // Phase B (PR-B1) — fresh top-level form park 은 코루틴을 release 하므로
      // (pending 미잔류) 비-sentinel fallback 분기는 이제 waitForFormSubmission 의
      // `parkMode==='await'` 경로(= §7.5 slow-path resume 재진입)에만 남는다.
      // 따라서 slow-path 를 통해 raw(non-sentinel) payload 를 전달해 그 분기를
      // 구동한다: form slow-path mock 무장 후 applyContinuation 을 raw 값으로 직접
      // 호출(continueExecution 의 sentinel-wrap 우회) → firePayload 가 그 raw 를
      // 그대로 resolvePending 으로 전달 → await-mode waitForFormSubmission 의 fallback.
      // C-1 step3 — non-sentinel 폴백 warn 은 이제 FormInteractionService.logger 에서
      // 발생한다 (processFormResumeTurn 이 그 서비스로 위임됐으므로). 엔진 로거가
      // 아니라 위임 대상 서비스의 로거를 spy 한다.
      const logger = (
        formInteraction as unknown as { logger: { warn: jest.Mock } }
      ).logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      void service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      armSlowPathResume(
        h,
        'node-form-w13',
        formNodesW13.find((n) => n.id === 'node-form-w13')!,
      );
      // sentinel 없는 raw 값을 payload 로 직접 전달 — continueExecution 의 wrap 우회.
      const raw = { approved: true };
      void service.applyContinuation(executionId, 'ne-node-form-w13', raw);
      await flushResumeDrive();

      // warn log 가 sentinel 없는 폴백 분기임을 알리는지.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasFallbackWarn = warnCalls.some(
        (msg) =>
          msg.includes('sentinel') ||
          msg.includes('waitForFormSubmission') ||
          msg.includes('폴백'),
      );
      expect(hasFallbackWarn).toBe(true);

      warnSpy.mockRestore();
    });
  });
});
