import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import {
  ExecutionContext,
  NodeHandler,
} from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { ForEachHandler } from '../../nodes/logic/foreach/foreach.handler';
import { LoopHandler } from '../../nodes/logic/loop/loop.handler';
import { MapHandler } from '../../nodes/logic/map/map.handler';
import { findExecutionStatusUpdate } from './__test-utils__/raw-update-params';

/**
 * ExecutionEngineService 단위 테스트: 컨테이너 런타임(ForEach · Loop · Map) · 컨테이너 사이클 가드.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
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
      handlerRegistry,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = h);
  });

  describe('Container runtime', () => {
    beforeEach(() => {
      // Test modules don't invoke onModuleInit, so register real container
      // handlers used by the pointer loop here.
      // PR-G — metadata 동봉. 엔진의 dispatch 가 `kind === 'container'` 로
      // 식별하므로 NodeComponentRegistry 부팅을 우회하는 테스트는 직접 명시.
      handlerRegistry.register('foreach', new ForEachHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('loop', new LoopHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('map', new MapHandler(), { kind: 'container' });
    });

    it('executes ForEach body once per item and puts collected results on done port', async () => {
      const bodyCalls: unknown[] = [];
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          bodyCalls.push(input);
          const item = input as Record<string, unknown> | null;
          return mockOutput({ doubled: ((item?.n as number) ?? 0) * 2 });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['foreach'];
            return mockOutput({ received: input });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            items: [{ n: 1 }, { n: 2 }, { n: 3 }],
          }),
        ),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      // Body ran once per item
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(bodyCalls).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);

      // Sink received the collected results on done port.
      // Stage 5: containers wrap results in `{ items|iterations|mapped, count }`.
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      expect(sinkCalls[0]).toEqual({
        count: 3,
        items: [{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }],
      });
      // Phase 2 (C — spec/4-nodes/1-logic/9-foreach.md §5.2): runtime metric
      // `meta.iterations` exposes the actually executed body count
      // (= output.items.length, including skip-placeholder slots).
      // Principle 2 — meta carries execution metrics, not config echoes.
      // 핸들러의 시작 시점 `fellBackToEmpty` 가 완료 meta 에 함께 남는다.
      expect(capturedForeachStructured?.meta).toEqual({
        iterations: 3,
        fellBackToEmpty: false,
      });
    });

    // ai-review C3 (2026-07-26) — §2.3 컨테이너 범위 확장. `executeContainerBody`
    // 상단 가드(아이템 경계마다)가 외부 cancel 을 관측하면 남은 아이템은
    // dispatch 되지 않아야 한다. source/sink 없이 `foreach` 를 그래프 진입점으로
    // 둔다(top-level 가드는 여전히 1회 통과해야 하므로 default 3-node 픽스처의
    // node-1/2/3 을 재사용하지 않는다). 실측(2026-07-26): `mockExecutionRepo
    // .findOneBy` 를 사전에 고정 row 로 blanket override 하면 `execute()` →
    // enqueue → **worker 브릿지 자신의 재조회**(주석 L253-258 참고, `runExecution`
    // 진입 전)가 그 축소된 fake row 를 받아 조용히 실패해 그래프가 아예 로드되지
    // 않는다(seedInitialReachability 조차 0회 호출) — 그래서 "선형 경로 외부 cancel
    // 전파" 기존 테스트와 동일하게, **바디 핸들러가 실제로 호출된 뒤** override 를
    // 지연 적용한다(그 시점 이전 호출은 항상 기존 `{...lastSaved}` 기본 동작).
    it('노드 경계 가 아니라 아이템 경계에서 외부 cancel 을 관측하면 남은 ForEach 아이템은 dispatch 되지 않는다 (C3)', async () => {
      let bodyCalls = 0;
      // ai-review W10 (2026-07-26) — 아이템 경계 가드가 이제 시간 기반 스로틀을 쓴다
      // (`{ throttle: true }`, 250ms). 이 테스트는 아이템이 실제 시간차 없이 연속
      // 실행되므로, 스로틀이 "직전 결과 재사용"으로 취소 관측을 가려버리면 아이템 1
      // 도 그대로 dispatch 돼 이 회귀 테스트가 무의미해진다. `Date.now()` 를 제어해
      // 아이템 0→1 경계에서 스로틀 창(250ms)을 실제로 넘기도록 만든다 — `new Date()`
      // 로 찍는 다른 타임스탬프(startedAt 등)는 `Date.now` 스파이의 영향을 받지 않는다.
      let simulatedNow = Date.now();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => simulatedNow);
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          if (bodyCalls === 1) {
            // 아이템 0 실행 완료 직후부터 외부 cancel 이 관측되도록 무장 —
            // 아이템 1 의 executeContainerBody 진입 가드가 이걸 본다.
            mockExecutionRepo.findOneBy.mockImplementation(() =>
              Promise.resolve({
                id: executionId,
                workflowId,
                status: ExecutionStatus.CANCELLED,
                startedAt: new Date(),
              }),
            );
            // 스로틀 창(250ms)을 넘겨 아이템 1 의 가드가 실제 DB 조회를 수행하게 한다.
            simulatedNow += 300;
          }
          return mockOutput({ ok: true });
        }),
      };
      handlerRegistry.register('body_node_c3', bodyHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node_c3',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { items: [1, 2, 3] },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      await flushPromises();

      // 아이템 0(1건)만 body 가 실행되고, 아이템 1/2 는 dispatch 되지 않는다.
      expect(bodyCalls).toBe(1);
      // Execution 은 실패가 아니라 cancelled 로 마감된다 (C4 catch 경로 재사용).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      nowSpy.mockRestore();
    });

    // ai-review W9 (2026-07-26) — §2.3 가 컨테이너 경로(ForEach/Loop/Map)에
    // `ExecutionCancelledError` 를 처음 실전 발생시켰다. `runContainer` 의
    // catch-all 이 이를 일반 실패로 오분류해 컨테이너 자신(`foreach`)의
    // NodeExecution 을 FAILED 로 영속하고 NODE_FAILED 를 emit 하면, Execution 은
    // 결국 cancelled 로 마감되므로 "실행은 취소인데 컨테이너 노드는 실패" 라는
    // 상태·감사로그 불일치가 생긴다. 위 C3 시나리오와 동일한 트리거(아이템 경계
    // 가드)를 재사용하되, 이번엔 컨테이너 노드 자신의 save/emit 인자를 단언한다.
    it('아이템 경계 취소가 컨테이너 노드를 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W9)', async () => {
      let bodyCalls = 0;
      // ai-review W10 — 위 C3 테스트와 동일한 이유로 `Date.now()` 를 제어해 스로틀
      // 창(250ms)을 넘긴다. 상세 근거는 위 C3 테스트 주석 참조.
      let simulatedNow = Date.now();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => simulatedNow);
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          if (bodyCalls === 1) {
            // 아이템 0 실행 완료 직후부터 외부 cancel 이 관측되도록 무장 —
            // 아이템 1 의 executeContainerBody 진입 가드가 이걸 본다.
            mockExecutionRepo.findOneBy.mockImplementation(() =>
              Promise.resolve({
                id: executionId,
                workflowId,
                status: ExecutionStatus.CANCELLED,
                startedAt: new Date(),
              }),
            );
            simulatedNow += 300;
          }
          return mockOutput({ ok: true });
        }),
      };
      handlerRegistry.register('body_node_w9', bodyHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node_w9',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { items: [1, 2, 3] },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      await flushPromises();

      expect(bodyCalls).toBe(1);
      // Execution 자체는 여전히 cancelled 로 마감된다.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );

      // (a) 컨테이너(foreach) NodeExecution 이 FAILED 로 저장되지 않는다.
      const foreachSaves = mockNodeExecutionRepo.save.mock.calls
        .map((c) => c[0] as Partial<NodeExecution>)
        .filter((n) => n.nodeId === 'foreach');
      expect(
        foreachSaves.some((n) => n.status === NodeExecutionStatus.FAILED),
      ).toBe(false);

      // (b) NODE_FAILED 가 컨테이너 노드에 emit 되지 않는다.
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'foreach',
        'execution.node.failed',
        expect.anything(),
      );
      nowSpy.mockRestore();
    });

    // ai-review W10 (2026-07-26) — 아이템 경계 cancel 가드(§2.3 확장)가 아이템 수에
    // 선형 비례하는 순차 DB 라운드트립을 추가하던 결함. `assertExecutionNotCancelled`
    // 가 `executeContainerBody` 호출부에서만 시간 기반 스로틀(`{ throttle: true }`,
    // 200~300ms 권장 범위, 실채택 250ms)을 적용하도록 수정됐다 — 짧은 간격 안에 반복되는 아이템 경계 체크는
    // 실제 DB 조회 없이 직전 결과를 재사용해야 한다. `executionRepository.findOne`
    // 은 이 파일에서 `assertExecutionNotCancelled` 만 호출하는 유일한 지점이므로
    // (production 소스 주석 참조) 호출 횟수를 직접 단언할 수 있다.
    it('짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다 (W10)', async () => {
      // ai-review W17 (2026-07-26) — 이 테스트는 원래 실제 wall-clock 시간(아이템
      // 10개가 250ms 스로틀 창 안에 다 처리되는지)에 의존해 flaky 했다(실측: 415
      // 테스트 40회 반복 중 3회, 그중 1회는 findOne 11회 — 스로틀이 아예 없을 때와
      // 수치적으로 구분 불가능한 실패 시그니처). 자매 테스트(C3 `:10014` 부근)와
      // 동일하게 `Date.now()` 를 고정해 wall-clock 의존을 제거한다 — 여기서는 시간을
      // 전혀 전진시키지 않아(항상 동일 값을 반환) 실행 환경 속도와 무관하게 모든
      // 아이템 경계 체크가 항상 250ms 창 안에 있도록 결정화한다.
      const simulatedNow = Date.now();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => simulatedNow);
      const itemCount = 10;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      };
      handlerRegistry.register('body_node_w10', bodyHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node_w10',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        {
          items: Array.from({ length: itemCount }, (_, i) => i),
        },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(itemCount);
      // 스로틀이 없다면 아이템 경계 가드만으로 10회(+ 상위 노드 경계 1회)의
      // `findOne` 호출이 발생한다. 스로틀이 동작하면 짧은 실행 시간(<250ms) 안의
      // 반복 호출이 직전 결과를 재사용해 실제 조회 횟수가 아이템 수보다 뚜렷이
      // 작아야 한다.
      expect(mockExecutionRepo.findOne.mock.calls.length).toBeLessThan(
        itemCount,
      );
      nowSpy.mockRestore();
    });

    // ai-review W18 (2026-07-26) — 스로틀 Map 정리 로직에 회귀 커버리지가 0이었다
    // (실측: `finalizeRehydrationCleanup`/`runExecution` finally 의 두 `delete` 를
    // 모두 제거해도 415/415 GREEN). 아이템 경계 스로틀(W10, `:6526`)이 정상 완료
    // 경로에서도 `containerCancelCheckedAtMs` 에 executionId 를 set() 하므로,
    // 실행이 정상 종결된 뒤 그 키가 남아있지 않아야 한다(`runExecution` finally
    // `:4544`).
    it('실행이 정상 종결되면 containerCancelCheckedAtMs 에서 executionId 키가 제거된다 (W18)', async () => {
      const priv = () =>
        service as unknown as {
          containerCancelCheckedAtMs: Map<string, number>;
        };
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      };
      handlerRegistry.register('body_node_w18_cleanup', bodyHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node_w18_cleanup',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { items: [1, 2, 3] },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(priv().containerCancelCheckedAtMs.has(executionId)).toBe(false);
    });

    // ai-review W18 (2026-07-26) — LoopExecutor 는 per-iteration try/catch 가
    // 없어(`loop-executor.ts:76-80` 참조) `ExecutionCancelledError` 가 수정 없이
    // 그대로 전파된다는 분석만 있고 이를 고정하는 테스트가 없었다(ForEach/Parallel
    // 은 `describe.each` 로 고정됨). 위 ForEach C3 테스트와 동일한 트리거(아이템/
    // 반복 경계 가드 + `Date.now` 스로틀 창 통과)를 Loop 컨테이너에 대칭 적용한다.
    it('노드 경계가 아니라 반복 경계에서 외부 cancel 을 관측하면 남은 Loop 반복은 dispatch 되지 않는다 (W18 — LoopExecutor 대칭)', async () => {
      let bodyCalls = 0;
      let simulatedNow = Date.now();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => simulatedNow);
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          if (bodyCalls === 1) {
            // 반복 0 실행 완료 직후부터 외부 cancel 이 관측되도록 무장 —
            // 반복 1 의 executeContainerBody 진입 가드가 이걸 본다.
            mockExecutionRepo.findOneBy.mockImplementation(() =>
              Promise.resolve({
                id: executionId,
                workflowId,
                status: ExecutionStatus.CANCELLED,
                startedAt: new Date(),
              }),
            );
            // 스로틀 창(250ms)을 넘겨 반복 1 의 가드가 실제 DB 조회를 수행하게 한다.
            simulatedNow += 300;
          }
          return mockOutput({ ok: true });
        }),
      };
      handlerRegistry.register('body_node_w18_loop', bodyHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: 3 },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node_w18_loop',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();
      await flushPromises();

      // 반복 0(1건)만 body 가 실행되고, 반복 1/2 는 dispatch 되지 않는다.
      expect(bodyCalls).toBe(1);
      // Execution 은 실패가 아니라 cancelled 로 마감된다 (C4 catch 경로 재사용).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      nowSpy.mockRestore();
    });

    it('executes Loop body N times', async () => {
      let counter = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          counter++;
          return mockOutput({ count: counter });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: 4 },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-loop',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-sink',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(4);
      // Stage 5: loop finalises as `{ iterations, count }`.
      expect(sinkCalls).toEqual([
        {
          count: 4,
          iterations: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }],
        },
      ]);
      // Phase 2 (C — spec/4-nodes/1-logic/3-loop.md §5.2): runtime metrics
      // surface on `meta.*` (Principle 2). `iterations` mirrors actual
      // executed reps; `maxIterationsReached=false` since count (4) is
      // well below the default cap (1000). `exitReason='completed'` since
      // no breakCondition fired and the cap wasn't hit.
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 4,
          maxIterationsReached: false,
          exitReason: 'completed',
        }),
      );
    });

    it('flags maxIterationsReached when count equals maxIterations cap', async () => {
      let counter = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          counter++;
          return mockOutput({ count: counter });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
      };
      handlerRegistry.register('source_node', triggerHandler);

      // count === maxIterations: the loop runs every iteration without an
      // early break, so the executor classifies the exit as 'maxIterations'
      // and the engine surfaces `maxIterationsReached: true` alongside
      // `exitReason: 'maxIterations'`.
      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: 3, maxIterations: 3 },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-loop',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-sink',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          maxIterationsReached: true,
          exitReason: 'maxIterations',
        }),
      );
    });

    it('exits early when breakCondition becomes truthy and reports exitReason="break"', async () => {
      // Asserts: the engine reads the raw `{{ ... }}` breakCondition from
      // node.config (not from the pre-resolved engineResolvedConfig — that
      // would lock $loop.index to 0), and re-evaluates it after every
      // iteration with a fresh expression context. When the predicate
      // returns truthy, LoopExecutor breaks and exitReason flips to 'break'.
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (_input: unknown, _cfg: unknown, ctx) =>
          mockOutput({ index: ctx.loopContext?.index }),
        ),
      };
      handlerRegistry.register('body_node', bodyHandler);

      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          // count=10 but breakCondition fires once $loop.index >= 2 (i.e.
          // after the 3rd iteration runs and we're checking post-body).
          config: { count: 10, breakCondition: '{{ $loop.index >= 2 }}' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-loop',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-sink',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // breakCondition `$loop.index >= 2` becomes truthy at the END of
      // iteration index=2 (post-body check). So the body runs for indices
      // 0, 1, 2 → 3 invocations, then breaks before index=3.
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          maxIterationsReached: false,
          exitReason: 'break',
        }),
      );
      // CLE-T-CYCGST — 완료 시점(엔진 덮어쓰기 뒤) config 에도 평가하지 않은
      // breakCondition 원문이 남는다(CLE-NODE-LOOP 출력 구조).
      expect(capturedLoopStructured?.config).toEqual(
        expect.objectContaining({
          breakCondition: '{{ $loop.index >= 2 }}',
        }),
      );
    });

    // engine-config-bug — Phase 3 raw-echo 리팩터링 이후 핸들러가 echo 한
    // raw `{{ ... }}` 을 엔진이 컨테이너 동작 파라미터로 다시 읽으면서 깨졌다.
    // 표현식이 evaluated 값으로 컨테이너 동작에 도달하면서, 동시에 raw echo 가
    // 후속 expression 노드의 `$node["loop"].config.*` 에 보존되는지 검증.
    describe('engine-config-bug — Loop count expression handling', () => {
      const buildLoopNodes = (countConfig: unknown): Partial<Node>[] => [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: countConfig },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const loopEdges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-sink',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      let bodyCount = 0;
      let bodyHandler: NodeHandler;
      let sinkCalls: unknown[];
      let sinkHandler: NodeHandler;
      let triggerHandler: NodeHandler;

      beforeEach(() => {
        bodyCount = 0;
        bodyHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => {
            bodyCount++;
            return mockOutput({ iter: bodyCount });
          }),
        };
        handlerRegistry.register('body_node', bodyHandler);

        sinkCalls = [];
        sinkHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async (input: unknown) => {
            sinkCalls.push(input);
            return mockOutput({ ok: true });
          }),
        };
        handlerRegistry.register('sink_node', sinkHandler);

        triggerHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => mockOutput({ n: 3 })),
        };
        handlerRegistry.register('source_node', triggerHandler);
      });

      it('iterates N times when count is a pure expression literal {{3}}', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('{{3}}'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
        expect(sinkCalls).toEqual([
          {
            count: 3,
            iterations: [{ iter: 1 }, { iter: 2 }, { iter: 3 }],
          },
        ]);
      });

      it('iterates per upstream output when count references a node expression', async () => {
        mockNodeRepo.findBy.mockResolvedValue(
          buildLoopNodes('{{ $node["src"].output.n }}'),
        );
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        // src returns { n: 3 } → loop count expression resolves to 3
        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      });

      it('preserves raw echo on $node["loop"].config (Phase 3 Principle 7 invariant)', async () => {
        let capturedEchoCount: unknown = 'NOT_CAPTURED';
        let capturedEngineCount: unknown = 'NOT_CAPTURED';
        // Inspect from within the sink handler — the engine deletes the
        // execution context in a `finally` block after run completion, so
        // post-await getContext() returns undefined. Sinks run after the
        // loop's final setStructuredOutput, giving us the post-iteration view.
        sinkHandler.execute = jest.fn(
          async (_input: unknown, _config: unknown, ctx: ExecutionContext) => {
            capturedEchoCount =
              ctx.structuredOutputCache?.['loop']?.config?.count;
            capturedEngineCount =
              ctx.engineResolvedConfigCache?.['loop']?.count;
            return mockOutput({ ok: true });
          },
        );
        handlerRegistry.register('sink_node', sinkHandler);

        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('{{3}}'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
        // Echo channel keeps the raw `{{3}}` template (Phase 3 Principle 7).
        expect(capturedEchoCount).toBe('{{3}}');
        // Engine-side cache holds the evaluated value (drives iteration).
        expect(capturedEngineCount).toBe(3);
      });

      it('still works for legacy literal-number config (no regression)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes(2));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(2);
      });

      it('still works for legacy numeric-string config "3" (schema accepts it)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('3'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      });

      // Behavioural change vs. pre-fix engine: previously
      // `Number(undefined ?? 0)` silently produced 0 iterations. coerce
      // helpers now throw INVALID_CONTAINER_PARAM so misconfigured nodes
      // surface loudly instead of finishing as no-ops. zod `default('1')`
      // catches this at storage time ("최소 반복 1회" 정책, spec
      // 4-nodes/1-logic/3-loop.md §8); the throw is the runtime safety net
      // for edges that bypass schema parsing (legacy data, direct repo write).
      it('throws INVALID_CONTAINER_PARAM when count is undefined (intentional loud failure)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes(undefined));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        // Body never iterates and the execution lands in FAILED status.
        // ai-review CRITICAL #1 (2026-07-27, 6차 라운드) — guarded UPDATE(raw
        // query) 경유로 바뀌어 더 이상 full-entity `.save()` 를 호출하지 않는다.
        expect(bodyHandler.execute).not.toHaveBeenCalled();
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE execution/),
          expect.arrayContaining([ExecutionStatus.FAILED]),
        );
      });
    });

    it('produces empty array when ForEach array is empty', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['foreach'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      expect(bodyHandler.execute).not.toHaveBeenCalled();
      // Stage 5: empty foreach still emits the `{ items, count }` envelope.
      expect(sinkCalls[0]).toEqual({ count: 0, items: [] });
      // Phase 2 (C): meta.iterations reflects 0 body executions for empty input.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({ iterations: 0 }),
      );
    });

    // engine-config-bug — Phase 3 raw-echo refactor에서 foreach 핸들러는
    // arrayField 만 echo 했고, 엔진은 structured.config 에서 errorPolicy 를
    // 읽어 항상 'stop' 으로 default fallback 됐다 (사용자 설정 무시). PR-2 의
    // engineResolvedConfigCache 분리 + PR-4 의 coerceErrorPolicy 가드로
    // 이제 사용자 설정이 실제로 동작에 반영된다.
    it('engine-config-bug — respects ForEach errorPolicy="skip" set on node.config', async () => {
      let bodyCalls = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          // Throw on the second item only — verifies skip handler captures
          // and continues to the third instead of aborting (which would be
          // the stop policy's behaviour).
          if (bodyCalls === 2) {
            throw new Error('boom');
          }
          return mockOutput({ ok: bodyCalls });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['fe'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2, 3] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'fe',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'fe',
          config: { arrayField: 'items', errorPolicy: 'skip' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'fe',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Body called for all 3 items — second one threw, but skip continued.
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      // Phase 1 (D — spec/4-nodes/1-logic/9-foreach.md §5.3): foreach now
      // separates skipped iterations into `output.skipped[]` and leaves a
      // `null` placeholder in `output.items[index]` so success/skip slots
      // still line up with the input array index.
      expect(sinkCalls).toHaveLength(1);
      const sinkPayload = sinkCalls[0] as {
        items: unknown[];
        skipped?: Array<{
          index: number;
          error: { code: string; message: string };
        }>;
      };
      expect(sinkPayload.items).toHaveLength(3);
      expect(sinkPayload.items[0]).toEqual({ ok: 1 });
      expect(sinkPayload.items[1]).toBeNull();
      expect(sinkPayload.items[2]).toEqual({ ok: 3 });
      expect(sinkPayload.skipped).toEqual([
        { index: 1, error: { code: 'UNKNOWN_ERROR', message: 'boom' } },
      ]);
      // Phase 2 (C — spec/4-nodes/1-logic/9-foreach.md §5.2): meta.iterations
      // counts every body launch (skip placeholder slots included), so the
      // metric matches `output.items.length`. `meta.skippedCount` (Phase 1 D)
      // continues to mirror `output.skipped.length`.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          skippedCount: 1,
          fellBackToEmpty: false,
        }),
      );
    });

    // Companion case for `errorPolicy: 'continue'` — same observable
    // behaviour as 'skip' in the executor (collect skipped placeholder,
    // proceed to next iteration). Guards against future divergence between
    // the two policies after the engineResolvedConfigCache fix.
    it('engine-config-bug — respects ForEach errorPolicy="continue" set on node.config', async () => {
      let bodyCalls = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          if (bodyCalls === 2) throw new Error('boom');
          return mockOutput({ ok: bodyCalls });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['fe'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2, 3] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'fe',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'fe',
          config: { arrayField: 'items', errorPolicy: 'continue' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'fe',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      // Phase 1 (D): same separation contract as `errorPolicy: 'skip'` —
      // skipped slot becomes `null` in `output.items` and detail moves to
      // `output.skipped[]`.
      const sinkPayload = sinkCalls[0] as {
        items: unknown[];
        skipped?: Array<{
          index: number;
          error: { code: string; message: string };
        }>;
      };
      expect(sinkPayload.items).toHaveLength(3);
      expect(sinkPayload.items[1]).toBeNull();
      expect(sinkPayload.skipped).toEqual([
        { index: 1, error: { code: 'UNKNOWN_ERROR', message: 'boom' } },
      ]);
      // Phase 2 (C): same meta contract as `errorPolicy: 'skip'` — iterations
      // counts every launched body (3) and skippedCount mirrors skipped.length.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          skippedCount: 1,
          fellBackToEmpty: false,
        }),
      );
    });

    it('fails execution when container has no emit edge', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];

      // No edge targeting foreach.emit — should fail
      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      // Execution should be marked failed with the emit-missing message.
      // ai-review CRITICAL #1 (2026-07-27, 6차 라운드) — guarded UPDATE(raw
      // query) 경유로 바뀌어 더 이상 full-entity `.save()` 를 호출하지 않는다.
      const failedUpdate = findExecutionStatusUpdate(
        mockExecutionRepo.query.mock.calls,
        ExecutionStatus.FAILED,
      );
      expect(failedUpdate).toBeDefined();
      expect(failedUpdate!.error).toMatch(/CONTAINER_MISSING_EMIT/);
    });

    it('fails execution when container has multiple emit edges', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);
      handlerRegistry.register('body_node_2', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body-a',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body-a',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'body-b',
          workflowId,
          type: 'body_node_2',
          category: NodeCategory.LOGIC,
          label: 'body-b',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body-a',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body-b',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-emit-a',
          workflowId,
          sourceNodeId: 'body-a',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-emit-b',
          workflowId,
          sourceNodeId: 'body-b',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      // ai-review CRITICAL #1 (2026-07-27, 6차 라운드) — guarded UPDATE(raw
      // query) 경유로 바뀌어 더 이상 full-entity `.save()` 를 호출하지 않는다.
      const failedUpdate = findExecutionStatusUpdate(
        mockExecutionRepo.query.mock.calls,
        ExecutionStatus.FAILED,
      );
      expect(failedUpdate).toBeDefined();
      expect(failedUpdate!.error).toMatch(/CONTAINER_MULTIPLE_EMIT/);
    });

    it('executes Map body once per item and transforms via emit port', async () => {
      const bodyCalls: unknown[] = [];
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          bodyCalls.push(input);
          const item = input as Record<string, unknown> | null;
          const n = (item?.n as number) ?? 0;
          return mockOutput({ squared: n * n });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return mockOutput({ received: input });
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            items: [{ n: 2 }, { n: 3 }, { n: 4 }],
          }),
        ),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'map',
          workflowId,
          type: 'map',
          category: NodeCategory.LOGIC,
          label: 'map',
          config: { inputField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'map',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-map',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'map',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-map-body',
          workflowId,
          sourceNodeId: 'map',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-map',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'map',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-map-sink',
          workflowId,
          sourceNodeId: 'map',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(bodyCalls).toEqual([{ n: 2 }, { n: 3 }, { n: 4 }]);
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      // Stage 5: map finalises as `{ mapped, count }`.
      expect(sinkCalls[0]).toEqual({
        count: 3,
        mapped: [{ squared: 4 }, { squared: 9 }, { squared: 16 }],
      });
    });

    // [Map 노드](CLE-NODE-MAP) · [ForEach 노드](CLE-NODE-FOREACH) — 완료 시점 meta 는
    // 핸들러의 시작 시점 meta(`fellBackToEmpty`)에 엔진 반복 메트릭(`iterations` ·
    // `skippedCount?`)을 합친 값이다([Logic 노드 공통 「엔진 덮어쓰기 계약」](CLE-NODE-LOGIC-COMMON#엔진-덮어쓰기-계약) 규칙 6).
    describe('container completion meta (Map · ForEach)', () => {
      const runContainer = async (
        type: 'map' | 'foreach',
        sourceOutput: Record<string, unknown>,
        containerConfig: Record<string, unknown>,
        bodyExecute: (input: unknown) => Promise<unknown>,
      ) => {
        const bodyHandler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(bodyExecute) as NodeHandler['execute'],
        };
        handlerRegistry.register('body_node', bodyHandler);

        const sinkCalls: unknown[] = [];
        let captured: { meta?: Record<string, unknown> } | undefined;
        const sinkHandler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(
            async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
              sinkCalls.push(input);
              captured = ctx.structuredOutputCache?.['ctr'];
              return mockOutput({ ok: true });
            },
          ),
        };
        handlerRegistry.register('sink_node', sinkHandler);
        handlerRegistry.register('source_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => mockOutput(sourceOutput)),
        });

        const node = (
          id: string,
          nodeType: string,
          config: Record<string, unknown>,
          containerId: string | null,
        ): Partial<Node> => ({
          id,
          workflowId,
          type: nodeType,
          category:
            nodeType === 'source_node'
              ? NodeCategory.TRIGGER
              : NodeCategory.LOGIC,
          label: id,
          config,
          isDisabled: false,
          containerId,
          toolOwnerId: null,
        });
        const edge = (
          id: string,
          sourceNodeId: string,
          sourcePort: string,
          targetNodeId: string,
          targetPort: string,
        ): Partial<Edge> => ({
          id,
          workflowId,
          sourceNodeId,
          sourcePort,
          targetNodeId,
          targetPort,
          type: EdgeType.DATA,
        });

        mockNodeRepo.findBy.mockResolvedValue([
          node('src', 'source_node', {}, null),
          node('ctr', type, containerConfig, null),
          node('body', 'body_node', {}, 'ctr'),
          node('sink', 'sink_node', {}, null),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          edge('e1', 'src', 'out', 'ctr', 'in'),
          edge('e2', 'ctr', 'body', 'body', 'in'),
          edge('e3', 'body', 'out', 'ctr', 'emit'),
          edge('e4', 'ctr', 'done', 'sink', 'in'),
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();
        return { bodyHandler, sinkCalls, meta: captured?.meta };
      };

      // 본문 마지막 노드가 배열 · 원시값을 port 와 함께 돌려주면 엔진 봉투가 아니라 그
      // 값을 모은다(NERV Task CLE-T-T30D5S).
      it.each([
        [
          'array',
          (n: number) => [n, n * 10],
          [
            [1, 10],
            [2, 20],
            [3, 30],
          ],
        ],
        ['number', (n: number) => n * 2, [2, 4, 6]],
      ])(
        'Map: collects a %s emit with a port as the raw value',
        async (_label, toOutput, expectedMapped) => {
          const { sinkCalls } = await runContainer(
            'map',
            { items: [1, 2, 3] },
            { inputField: 'items' },
            async (input) => ({
              config: {},
              output: toOutput(input as number),
              port: 'out',
            }),
          );
          expect(sinkCalls[0]).toEqual({ mapped: expectedMapped, count: 3 });
        },
      );

      // 객체 emit 도 핸들러 output 을 모은다. flat 캐시의 `_selectedPort` 나 `data` 펼침이
      // 섞이지 않는다(CLE-EXEC-HANDLER §포트 선택, NERV Task CLE-T-ZJR3AF).
      it('Map: collects an object emit with a port as the handler output', async () => {
        const { sinkCalls } = await runContainer(
          'map',
          { items: [1, 2] },
          { inputField: 'items' },
          async (input) => ({
            config: {},
            output: { status: 200, data: { v: input } },
            port: 'out',
          }),
        );
        expect(sinkCalls[0]).toEqual({
          mapped: [
            { status: 200, data: { v: 1 } },
            { status: 200, data: { v: 2 } },
          ],
          count: 2,
        });
      });

      it('Map: iterations + fellBackToEmpty=false for an array input', async () => {
        const { sinkCalls, meta } = await runContainer(
          'map',
          { items: [1, 2, 3] },
          { inputField: 'items' },
          async (input) => mockOutput({ v: input }),
        );
        expect(sinkCalls[0]).toEqual({
          mapped: [{ v: 1 }, { v: 2 }, { v: 3 }],
          count: 3,
        });
        expect(meta).toEqual({ fellBackToEmpty: false, iterations: 3 });
      });

      it.each(['skip', 'continue'])(
        'Map: `_skipped` error.code passes a catalog code and maps AbortError under errorPolicy=%s',
        async (errorPolicy) => {
          const { sinkCalls } = await runContainer(
            'map',
            { items: [1, 2, 3] },
            { inputField: 'items', errorPolicy },
            async (input) => {
              if (input === 1) {
                throw Object.assign(new Error('limited'), {
                  code: 'MAKESHOP_RATE_LIMITED',
                });
              }
              if (input === 2) {
                const abort = new Error('aborted');
                abort.name = 'AbortError';
                throw abort;
              }
              return mockOutput({ v: input });
            },
          );
          const payload = sinkCalls[0] as { mapped: unknown[] };
          expect(payload.mapped[0]).toEqual({
            _skipped: true,
            error: { code: 'MAKESHOP_RATE_LIMITED', message: 'limited' },
          });
          expect(payload.mapped[1]).toEqual({
            _skipped: true,
            error: { code: 'AbortError', message: 'aborted' },
          });
        },
      );

      it.each(['skip', 'continue'])(
        'Map: skippedCount mirrors `_skipped` markers under errorPolicy=%s',
        async (errorPolicy) => {
          const { sinkCalls, meta } = await runContainer(
            'map',
            { items: [1, 2, 3] },
            { inputField: 'items', errorPolicy },
            async (input) => {
              if (input === 2) throw new Error('boom');
              return mockOutput({ v: input });
            },
          );
          const payload = sinkCalls[0] as { mapped: unknown[]; count: number };
          expect(payload.mapped[1]).toEqual({
            _skipped: true,
            error: { code: 'UNKNOWN_ERROR', message: 'boom' },
          });
          expect(meta).toEqual({
            fellBackToEmpty: false,
            iterations: 3,
            skippedCount: 1,
          });
        },
      );

      it.each([
        ['map', { inputField: 'items' }, { mapped: [], count: 0 }],
        ['foreach', { arrayField: 'items' }, { items: [], count: 0 }],
      ] as const)(
        '%s: non-array input runs the body zero times and keeps fellBackToEmpty=true',
        async (type, config, expectedOutput) => {
          const { bodyHandler, sinkCalls, meta } = await runContainer(
            type,
            { items: 'not-an-array' },
            config,
            async () => mockOutput({ ran: true }),
          );
          expect(bodyHandler.execute).not.toHaveBeenCalled();
          expect(sinkCalls[0]).toEqual(expectedOutput);
          expect(meta).toEqual({ fellBackToEmpty: true, iterations: 0 });
        },
      );

      // 위 케이스의 부정 짝이다. 실제 빈 배열 입력도 본문은 0회 돌지만 대체한 것이
      // 아니므로 `fellBackToEmpty` 는 `false` 다(Map · ForEach 모두 같다).
      it.each([
        ['map', { inputField: 'items' }, { mapped: [], count: 0 }],
        ['foreach', { arrayField: 'items' }, { items: [], count: 0 }],
      ] as const)(
        '%s: empty array input runs the body zero times and keeps fellBackToEmpty=false',
        async (type, config, expectedOutput) => {
          const { bodyHandler, sinkCalls, meta } = await runContainer(
            type,
            { items: [] },
            config,
            async () => mockOutput({ ran: true }),
          );
          expect(bodyHandler.execute).not.toHaveBeenCalled();
          expect(sinkCalls[0]).toEqual(expectedOutput);
          expect(meta).toEqual({ fellBackToEmpty: false, iterations: 0 });
        },
      );
    });

    // meta 만으로는 배열 output 을 감싸지 않는다. 컨테이너가 아닌 노드(Merge · VarDecl ·
    // Transform 등)도 다음 노드에 배열 그대로 넘긴다(NERV Task CLE-T-T30D5S).
    it.each([
      ['standard', { kind: 'standard' }],
      ['unregistered metadata', undefined],
    ] as const)(
      'passes a non-container array output that carries only meta through as is (%s)',
      async (_label, metadata) => {
        handlerRegistry.register(
          'array_with_meta',
          {
            validate: () => ({ valid: true, errors: [] }),
            execute: jest.fn(async () => ({
              config: {},
              output: [1, 2, 3],
              meta: { inputCount: 3 },
            })),
          },
          metadata,
        );
        const sinkCalls: unknown[] = [];
        handlerRegistry.register('sink_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async (input: unknown) => {
            sinkCalls.push(input);
            return mockOutput({ ok: true });
          }),
        });
        const node = (id: string, type: string): Partial<Node> => ({
          id,
          workflowId,
          type,
          category:
            type === 'array_with_meta'
              ? NodeCategory.TRIGGER
              : NodeCategory.LOGIC,
          label: id,
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        });
        mockNodeRepo.findBy.mockResolvedValue([
          node('src', 'array_with_meta'),
          node('sink', 'sink_node'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          {
            id: 'e1',
            workflowId,
            sourceNodeId: 'src',
            sourcePort: 'out',
            targetNodeId: 'sink',
            targetPort: 'in',
            type: EdgeType.DATA,
          } as Partial<Edge>,
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(sinkCalls).toEqual([[1, 2, 3]]);
      },
    );
  });

  // W3b (SUMMARY) — assertNoContainerCycle(perf #5) 회귀 가드.
  // private 메서드를 직접 호출해 CONTAINER_CYCLE 에러 발생과 에러 메시지를 단언한다.
  // perf #5 리팩터(byId Map + children 재사용) 후 의미론은 동일함을 고정.
  describe('assertNoContainerCycle — named-error 회귀 가드 (W3b)', () => {
    type CycleSubject = {
      assertNoContainerCycle: (
        containerNode: Partial<Node>,
        children: Partial<Node>[],
        byId: Map<string, Partial<Node>>,
      ) => void;
    };

    it('A.containerId=B, B.containerId=A 직접 사이클 → CONTAINER_CYCLE 에러 throws', () => {
      // chain: child-a → container-x → child-a (containerId 순환)
      // child-a.containerId = container-x (직접 부모), container-x.containerId = child-a
      // assertNoContainerCycle 은 child-a 의 containerId 체인을 따라 순환을 검출한다.
      const containerX: Partial<Node> = {
        id: 'container-x',
        label: 'ContainerX',
        type: 'foreach',
        containerId: 'child-a', // 순환 링크: container-x → child-a
      };
      const childA: Partial<Node> = {
        id: 'child-a',
        label: 'ChildA',
        type: 'test_node',
        containerId: 'container-x', // 직접 부모
      };
      const byId = new Map<string, Partial<Node>>([
        ['container-x', containerX],
        ['child-a', childA],
      ]);

      const svc = service as unknown as CycleSubject;
      expect(() =>
        svc.assertNoContainerCycle(containerX, [childA], byId),
      ).toThrow(/CONTAINER_CYCLE/);
    });

    it('사이클 없는 정상 체인 → 예외 없음', () => {
      const containerX: Partial<Node> = {
        id: 'container-x',
        label: 'ContainerX',
        type: 'foreach',
        containerId: null, // 최상위 컨테이너
      };
      const childA: Partial<Node> = {
        id: 'child-a',
        label: 'ChildA',
        type: 'test_node',
        containerId: 'container-x',
      };
      const byId = new Map<string, Partial<Node>>([
        ['container-x', containerX],
        ['child-a', childA],
      ]);

      const svc = service as unknown as CycleSubject;
      expect(() =>
        svc.assertNoContainerCycle(containerX, [childA], byId),
      ).not.toThrow();
    });
  });
});
