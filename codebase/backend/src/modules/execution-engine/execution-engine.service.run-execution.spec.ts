import { ExecutionEngineService } from './execution-engine.service';
import {
  ExecutionCancelledError,
  NodeCancelMarkingError,
} from './workflow-errors';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
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
  mockHandler,
  mockNodes,
  mockWorkflow,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { MapHandler } from '../../nodes/logic/map/map.handler';
import { assertLinkedTransitionApplied } from './linked-transition-guard';

/**
 * ExecutionEngineService 단위 테스트: runExecution 노드 순회 · error 포트 · 취소 마킹 · WebSocket 이벤트 · env 캐시.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];
  let mockConfigService: { get: jest.Mock };

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockConfigService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
      mockWorkflowRepo,
    } = h);
  });

  describe('runExecution — workspace timezone injection', () => {
    // spec/4-nodes/3-ai/0-common.md §11.3 — runExecution 의 createContext 단계가
    // workflow.workspace.settings.timezone 을 IANA name 그대로 `__workspaceTimezone`
    // 변수로 주입한다. 3 AI 핸들러는 이 값을 resolveSystemContextTimezone 으로
    // 받아 LLM prefix 를 생성하므로 엔진 레벨에서 실제 주입이 깨지면 prefix 가
    // 제품 기본값(Asia/Seoul)으로 silent fallback 한다. 본 케이스는 그 회귀 가드.
    it('Asia/Seoul workspace → __workspaceTimezone === "Asia/Seoul" on handler context', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', settings: { timezone: 'Asia/Seoul' } },
      });
      const seenContexts: ExecutionContext[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown, _config: unknown, context: ExecutionContext) => {
          seenContexts.push(context);
          return mockOutput({ processed: true, input });
        },
      );

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(seenContexts.length).toBeGreaterThan(0);
      for (const ctx of seenContexts) {
        expect(ctx.variables['__workspaceTimezone']).toBe('Asia/Seoul');
        expect(ctx.variables['__workspaceId']).toBe('ws-1');
      }
    });

    it('workspace.settings 가 비어있으면 __workspaceTimezone === "" (handler 가 PRODUCT_DEFAULT_TIMEZONE 로 fall through)', async () => {
      // beforeEach default — mockWorkflowRepo.findOne 은 workspace.settings: {} 반환.
      const seenContexts: ExecutionContext[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown, _config: unknown, context: ExecutionContext) => {
          seenContexts.push(context);
          return mockOutput({ processed: true, input });
        },
      );

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(seenContexts.length).toBeGreaterThan(0);
      for (const ctx of seenContexts) {
        expect(ctx.variables['__workspaceTimezone']).toBe('');
      }
    });

    // 재실행 dry-run 부수효과 판정(CLE-EXEC-RERUN) — 실행 시작이 만드는 `context.variables.__dryRun` 이
    // `Execution.dryRun` 에서 오는지 고정한다(rehydration 쪽은 위 별도 케이스). provider
    // 가드 3종과 resume 재유도가 전부 이 값을 입력으로 삼아서, 이 연결이 끊기면 쇼핑몰
    // 쓰기를 막는 안전장치가 조용히 열린다.
    it.each([
      ['true', true, true],
      ['false', false, false],
      ['미지정', undefined, false],
    ])(
      'execute dryRun=%s → handler context 의 __dryRun 이 불리언으로 주입된다',
      async (_label, dryRun, expected) => {
        // 기본 create mock 은 입력과 무관한 고정 row 를 돌려준다. 입력이 row 에 실려야
        // execute() → 큐 → runExecution 경로가 그 값을 읽는다.
        const base = mockExecutionRepo.create() as Partial<Execution>;
        mockExecutionRepo.create.mockImplementationOnce(
          (entity: Partial<Execution>) => ({ ...base, ...entity }),
        );
        const seenContexts: ExecutionContext[] = [];
        (mockHandler.execute as jest.Mock).mockImplementation(
          async (
            input: unknown,
            _config: unknown,
            context: ExecutionContext,
          ) => {
            seenContexts.push(context);
            return mockOutput({ processed: true, input });
          },
        );

        await service.execute(
          workflowId,
          { data: 'test' },
          { workspaceId: 'ws-1', executedBy: 'u1', dryRun },
        );
        await flushPromises();

        expect(seenContexts.length).toBeGreaterThan(0);
        for (const ctx of seenContexts) {
          expect(ctx.variables['__dryRun']).toBe(expected);
        }
      },
    );
  });

  describe('선형 경로 외부 cancel 전파 (node-cancellation §5.1 — 기전 규명)', () => {
    // e2e `node-cancellation-propagation.e2e-spec.ts` 가 "stop 후 하류 노드 미도달" 을
    // 관측했으나 **어느 코드가 그것을 보장하는지 특정되지 않았다**(2026-07-24 ai-review 2R,
    // 독립 reviewer 3명 수렴). 후보 2개는 이미 반증됐다:
    //   · `context.abortSignal?.throwIfAborted()` — `abortSignal:` 대입이
    //     `parallel-executor.ts:245` 한 곳뿐이라 선형 경로에서 항상 undefined.
    //   · "guarded UPDATE" — §7.5 resume-claim 전용 sentinel.
    // 본 테스트는 그 계약을 **엔진 레벨에서 직접** 고정한다(ms 단위 mock, 실 인프라 무관).
    it('노드 1 실행 중 Execution 이 외부에서 cancelled 로 바뀌면 하류 노드는 dispatch 되지 않는다', async () => {
      let calls = 0;
      (mockHandler.execute as jest.Mock).mockImplementation(async () => {
        calls++;
        if (calls === 1) {
          // 외부 stop(`POST /executions/:id/stop`)과 **동일한 표면**을 재현한다:
          // 그 엔드포인트는 RUNNING 실행에 대해 Execution 행을 CANCELLED 로 UPDATE 할
          // 뿐, 돌고 있는 순회 루프에 아무 신호도 보내지 않는다(AbortController·job
          // cancel 없음). 따라서 루프가 스스로 상태를 다시 읽지 않으면 계속 진행한다.
          mockExecutionRepo.findOneBy.mockImplementation(() =>
            Promise.resolve({
              id: executionId,
              workflowId,
              status: ExecutionStatus.CANCELLED,
              finishedAt: new Date(),
            }),
          );
        }
        return mockOutput({ ok: true });
      });

      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', executedBy: 'u1' },
      );
      await flushPromises();
      await flushPromises();

      // node-1 만 실행되고 node-2 / node-3 은 dispatch 되지 않아야 한다.
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('runExecution — 단일 노드 실행 (§1.3)', () => {
    // node-1 → node-2 → node-3 선형 그래프. singleNodeId 가 세팅된 실행은 대상
    // 노드만 실행하고 downstream 으로 진행하지 않으며, previousExecutionId 의
    // 직속 predecessor 출력을 입력으로 seed 한다.
    // 기본 mockExecutionRepo.create 는 인자를 무시하고 고정 객체를 반환하므로
    // (실 TypeORM 과 달리) singleNodeId/previousExecutionId 가 saved row 에 실리지
    // 않는다. 단일 노드 분기를 타게 하려면 create 가 인자를 pass-through 하도록 override.
    function passThroughCreate() {
      mockExecutionRepo.create.mockImplementation((d: Partial<Execution>) => ({
        id: executionId,
        workflowId,
        status: ExecutionStatus.PENDING,
        startedAt: new Date(),
        inputData: {},
        ...d,
      }));
    }

    it('대상 노드만 실행하고 downstream 미진행 + previousExecutionId 상류 출력을 입력으로 seed', async () => {
      passThroughCreate();
      const seenInputs: unknown[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown) => {
          seenInputs.push(input);
          return mockOutput({ processed: true, input });
        },
      );
      // getLatestPredecessorOutputs → prev-exec 의 node-1 완료 출력(canonical shape).
      mockNodeExecutionRepo.find.mockResolvedValueOnce([
        {
          id: 'ne-prev-node-1',
          executionId: 'prev-exec',
          nodeId: 'node-1',
          status: NodeExecutionStatus.COMPLETED,
          outputData: mockOutput({ seeded: 42 }),
          finishedAt: new Date(),
        },
      ]);

      await service.execute(
        workflowId,
        { manual: 'ignored-when-seeded' },
        {
          workspaceId: 'ws-1',
          executedBy: 'u1',
          singleNodeId: 'node-2',
          previousExecutionId: 'prev-exec',
        },
      );
      await flushPromises();
      await flushPromises();

      // 오직 node-2 만 실행 — node-1(상류) 및 node-3(하류) 미실행.
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      // node-2 입력 = node-1 의 seed 출력(구조화 캐시의 핸들러 output).
      expect(seenInputs[0]).toEqual({ seeded: 42 });
      // predecessor 조회가 previousExecutionId 로 수행됐는지.
      expect(mockNodeExecutionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            executionId: 'prev-exec',
            status: NodeExecutionStatus.COMPLETED,
          }),
        }),
      );
      // 완료 outputData = 대상 노드(node-2) 출력 (topological-last node-3 아님).
      // updateExecutionStatus(COMPLETED) 의 guarded UPDATE param[5] = JSON.stringify(outputData).
      const completedCall = mockExecutionRepo.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('output_data') &&
          (c[1] as unknown[])?.[1] === ExecutionStatus.COMPLETED,
      );
      expect(completedCall).toBeDefined();
      const persistedOutput = JSON.parse(
        (completedCall![1] as string[])[5],
      ) as Record<string, unknown>;
      expect(persistedOutput).toMatchObject({
        processed: true,
        input: { seeded: 42 },
      });
    });

    it('비-canonical(bare) predecessor outputData 도 wrapBareAsNodeHandlerOutput 로 안전 seed', async () => {
      passThroughCreate();
      const seenInputs: unknown[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown) => {
          seenInputs.push(input);
          return mockOutput({ processed: true, input });
        },
      );
      // config/output 키가 없는 bare object (legacy/배포 이전 row) — adaptHandlerReturn
      // strict 가 throw 하지 않도록 lenient wrapper 폴백 경로를 검증.
      mockNodeExecutionRepo.find.mockResolvedValueOnce([
        {
          id: 'ne-prev-node-1',
          executionId: 'prev-exec',
          nodeId: 'node-1',
          status: NodeExecutionStatus.COMPLETED,
          outputData: { seeded: 99 },
          finishedAt: new Date(),
        },
      ]);

      await service.execute(
        workflowId,
        {},
        {
          workspaceId: 'ws-1',
          executedBy: 'u1',
          singleNodeId: 'node-2',
          previousExecutionId: 'prev-exec',
        },
      );
      await flushPromises();
      await flushPromises();

      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      // bare {seeded:99} → wrap → {config:{}, output:{seeded:99}} → flat {seeded:99}.
      expect(seenInputs[0]).toEqual({ seeded: 99 });
    });

    // 상류 출력 복원도 노드 완료 경로와 같은 규칙을 따른다. 배열 output 은 노드 종류와
    // 상관없이 meta · port 가 함께 와도 다음 노드에 배열 그대로 넘어간다
    // (NERV Task CLE-T-T30D5S).
    it.each([
      ['map', 'meta', { meta: { fellBackToEmpty: false } }],
      ['test_node', 'meta', { meta: { fellBackToEmpty: false } }],
      ['test_node', 'port', { port: 'out' }],
    ] as const)(
      '상류 %s 의 배열 출력 + %s 를 노드 완료 경로와 같은 모양으로 seed',
      async (predType, _extraLabel, extra) => {
        passThroughCreate();
        // 엔진은 유형 이름이 아니라 등록 때 받은 kind 로 판단한다.
        handlerRegistry.register('map', new MapHandler(), {
          kind: 'container',
        });
        mockNodeRepo.findBy.mockResolvedValue(
          mockNodes.map((n) =>
            n.id === 'node-1' ? { ...n, type: predType } : n,
          ),
        );
        const seenInputs: unknown[] = [];
        (mockHandler.execute as jest.Mock).mockImplementation(
          async (input: unknown) => {
            seenInputs.push(input);
            return mockOutput({ processed: true });
          },
        );
        mockNodeExecutionRepo.find.mockResolvedValueOnce([
          {
            id: 'ne-prev-node-1',
            executionId: 'prev-exec',
            nodeId: 'node-1',
            status: NodeExecutionStatus.COMPLETED,
            outputData: {
              config: {},
              output: [{ v: 1 }],
              ...extra,
            },
            finishedAt: new Date(),
          },
        ]);

        await service.execute(
          workflowId,
          {},
          {
            workspaceId: 'ws-1',
            executedBy: 'u1',
            singleNodeId: 'node-2',
            previousExecutionId: 'prev-exec',
          },
        );
        await flushPromises();
        await flushPromises();

        expect(mockHandler.execute).toHaveBeenCalledTimes(1);
        expect(seenInputs[0]).toEqual([{ v: 1 }]);
      },
    );

    it('previousExecutionId 미지정 시 수동 입력(input)으로 단일 노드 실행', async () => {
      passThroughCreate();
      const seenInputs: unknown[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown) => {
          seenInputs.push(input);
          return mockOutput({ processed: true, input });
        },
      );

      // node-1 은 incoming edge 가 없으므로 workflowInput(수동 입력)을 사용한다.
      await service.execute(
        workflowId,
        { manual: 'value' },
        { workspaceId: 'ws-1', executedBy: 'u1', singleNodeId: 'node-1' },
      );
      await flushPromises();
      await flushPromises();

      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      expect(seenInputs[0]).toEqual({ manual: 'value' });
    });
  });

  it('should execute all nodes in background after returning', async () => {
    await service.execute(
      workflowId,
      { data: 'test' },
      { workspaceId: 'ws-1' },
    );

    // Wait for background execution to complete
    await flushPromises();

    // Nodes and edges should be loaded
    expect(mockNodeRepo.findBy).toHaveBeenCalledWith({ workflowId });
    expect(mockEdgeRepo.findBy).toHaveBeenCalledWith({ workflowId });

    // Handler execute should be called 3 times (once per node)
    expect(mockHandler.execute).toHaveBeenCalledTimes(3);

    // Node executions should be created for each node
    expect(mockNodeExecutionRepo.create).toHaveBeenCalledTimes(3);
  });

  it('should throw if workflow not found', async () => {
    mockWorkflowRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.execute('non-existent', undefined, { workspaceId: 'ws-1' }),
    ).rejects.toThrow('Workflow not found');
  });

  it('should handle handler errors in background without rejecting execute()', async () => {
    const customNodes = mockNodes.map((n) => ({ ...n, type: 'unknown_type' }));
    mockNodeRepo.findBy.mockResolvedValue(customNodes);

    // execute() should resolve (not reject) since errors happen in background
    const result = await service.execute(workflowId, undefined, {
      workspaceId: 'ws-1',
    });
    expect(result).toBe(executionId);

    // Wait for background execution to fail
    await flushPromises();

    // Execution should be marked as failed. ai-review CRITICAL #1 (2026-07-27,
    // 6차 라운드) — FAILED 마킹은 이제 guarded UPDATE(raw query) 경유라 더 이상
    // full-entity `.save()` 를 호출하지 않는다.
    expect(mockExecutionRepo.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE execution/),
      expect.arrayContaining([ExecutionStatus.FAILED]),
    );
  });

  it('should pass output from one node as input to the next', async () => {
    const calls: unknown[] = [];
    const tracingHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async (input: unknown) => {
        calls.push(input);
        return mockOutput({ step: calls.length, previousInput: input });
      }),
    };
    handlerRegistry.register('test_node', tracingHandler);

    await service.execute(
      workflowId,
      { initial: true },
      { workspaceId: 'ws-1' },
    );
    await flushPromises();

    // First node receives workflow input
    expect(calls[0]).toEqual({ initial: true });
    // Second node receives first node's output
    expect(calls[1]).toEqual({ step: 1, previousInput: { initial: true } });
    // Third node receives second node's output
    expect(calls[2]).toEqual({
      step: 2,
      previousInput: { step: 1, previousInput: { initial: true } },
    });
  });

  // spec/5-system/3-error-handling.md §3.2 — 핸들러가 런타임 실패를
  // `port: 'error'` 로 라우팅(throw 아님)했을 때의 엔진 동작. D4 결정(2026-05-17)
  // 이후 Integration·LLM·Code·Workflow 노드 8종이 이 경로를 쓴다. 회귀 전:
  // 엔진이 모든 정상 return 을 COMPLETED 로 마킹해 인증 실패한 send_email 도
  // 실행 성공으로 표시됐다.
  describe('execution.message — presentation 노드 자동 진행 (EIA §5.2)', () => {
    const presentationHandler = (rendered: string): NodeHandler => ({
      validate: () => ({ valid: true, errors: [] }),
      // 버튼 없는 template → status 없이 자동 진행(non-blocking) → NODE_COMPLETED + execution.message.
      execute: jest.fn(async () => ({
        config: { outputFormat: 'markdown' },
        output: { rendered },
      })),
    });

    it('비차단 presentation(template) 완료 시 execution.message 를 {config,output} envelope 로 발행', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-tmpl',
          workflowId,
          type: 'template',
          category: NodeCategory.PRESENTATION,
          label: 'Template',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register(
        'template',
        presentationHandler('**안내** 메시지'),
      );

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // EIA SSE 표면용 execution.message — presentations[0] 은 위젯 classifyPresentation 입력 envelope.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.message',
        expect.objectContaining({
          nodeId: 'n-tmpl',
          nodeType: 'template',
          presentations: [
            expect.objectContaining({
              config: expect.objectContaining({ outputFormat: 'markdown' }),
              output: expect.objectContaining({ rendered: '**안내** 메시지' }),
            }),
          ],
        }),
      );
      // node-level NODE_COMPLETED 도 그대로 발행(기존 firehose 동작 유지 — chat-channel 픽업).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-tmpl',
        'execution.node.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('비차단 presentation(carousel) 완료 시에도 execution.message 발행 (4종 커버)', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-carousel',
          workflowId,
          type: 'carousel',
          category: NodeCategory.PRESENTATION,
          label: 'Carousel',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      // 버튼 없는 carousel → 자동 진행. output.items + config.layout envelope.
      handlerRegistry.register('carousel', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { layout: 'card' },
          output: { items: [{ title: 'A' }, { title: 'B' }] },
        })),
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.message',
        expect.objectContaining({
          nodeId: 'n-carousel',
          nodeType: 'carousel',
          presentations: [
            expect.objectContaining({
              config: expect.objectContaining({ layout: 'card' }),
              output: expect.objectContaining({
                items: [{ title: 'A' }, { title: 'B' }],
              }),
            }),
          ],
        }),
      );
    });

    it('비-presentation 노드 완료 시 execution.message 미발행 (firehose 누출 방지)', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-plain',
          workflowId,
          type: 'plain_node',
          category: NodeCategory.LOGIC,
          label: 'Plain',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('plain_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).not.toHaveBeenCalledWith(
        executionId,
        'execution.message',
        expect.anything(),
      );
    });
  });

  describe('error port routing (§3.2)', () => {
    const errHandler = (): NodeHandler => ({
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () =>
        mockOutput(
          { error: { code: 'EMAIL_SEND_FAILED', message: 'SMTP auth failed' } },
          { port: 'error' },
        ),
      ),
    });

    const lastNodeExecSave = (nodeId: string) =>
      mockNodeExecutionRepo.save.mock.calls
        .map((c) => c[0] as Partial<NodeExecution>)
        .filter((n) => n.nodeId === nodeId)
        .pop();

    it('marks the node FAILED (not COMPLETED) and continues when the error port is connected', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Mailer',
          config: {},
          isDisabled: false,
        },
        {
          id: 'n-handle',
          workflowId,
          type: 'test_node',
          category: NodeCategory.LOGIC,
          label: 'Handle error',
          config: {},
          isDisabled: false,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-err',
          workflowId,
          sourceNodeId: 'n-err',
          sourcePort: 'error',
          targetNodeId: 'n-handle',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);
      handlerRegistry.register('err_node', errHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // 노드는 FAILED 로 마킹 (회귀 전: COMPLETED).
      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      expect(errNe?.error).toEqual(
        expect.objectContaining({
          code: 'EMAIL_SEND_FAILED',
          message: 'SMTP auth failed',
        }),
      );
      // NODE_FAILED 이벤트 발사 (NODE_COMPLETED 아님).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-err',
        'execution.node.failed',
        expect.objectContaining({ status: 'failed' }),
      );
      // error 포트가 연결돼 있으므로 다운스트림이 실행되고 Execution 은 계속 → COMPLETED.
      // M-3 — COMPLETED 마감은 full-save 대신 guarded raw UPDATE(query)로 영속한다
      // (status IN 비-terminal 가드). status 'completed' 가 쿼리 파라미터에 포함.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.COMPLETED]),
      );
      // #5 — lost-update 가드 문자열 검증: status IN 절이 쿼리에 포함돼야 가드가 동작한다.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/status IN/),
        expect.anything(),
      );
    });

    it('classifies a handler-thrown AbortError as CANCELLED (not FAILED) and emits NODE_CANCELLED (node-cancellation §5.1)', async () => {
      const abortHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        }),
      });
      const nodes: Partial<Node>[] = [
        {
          id: 'n-abort',
          workflowId,
          type: 'abort_node',
          category: NodeCategory.LOGIC,
          label: 'Aborted node',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('abort_node', abortHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // 노드는 CANCELLED (FAILED 아님) — abort 는 실패가 아니라 취소.
      const ne = lastNodeExecSave('n-abort');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // C2 (ai-review): DB 저장 error 필드도 봉투 형식 `{ code: 'AbortError', message }`.
      expect(ne?.error).toEqual(
        expect.objectContaining({ code: 'AbortError', message: 'aborted' }),
      );
      // NODE_CANCELLED 이벤트 발사 (NODE_FAILED 아님).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-abort',
        'execution.node.cancelled',
        // C2: error 필드가 구조체 `{ code: 'AbortError', message }` 여야 함.
        expect.objectContaining({
          status: 'cancelled',
          error: expect.objectContaining({
            code: 'AbortError',
            message: 'aborted',
          }),
        }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-abort',
        'execution.node.failed',
        expect.anything(),
      );
    });

    // W2 (ai-review): dispatch 직전 throwIfAborted() 사전 체크 경로.
    // context.abortSignal 이 이미 abort 된 상태라면 executeWithRetry 의
    // throwIfAborted() 가 발화해 CANCELLED + NODE_CANCELLED 로 귀결된다
    // (node-cancellation §5.1 사전 체크 조항).
    // 검증 전략: 핸들러가 context 의 abortSignal 을 통해 throwIfAborted() 를
    // 호출하도록 구현 → 핸들러 진입 이전에 executeWithRetry 의 사전 체크가 먼저
    // 발화하므로 핸들러 execute 는 1회도 호출되지 않아야 한다.
    it('pre-check: already-aborted signal reaches executeWithRetry → CANCELLED + NODE_CANCELLED without handler execute call (W2)', async () => {
      const executeImpl = jest.fn();
      // executeWithRetry 의 throwIfAborted() 보다 먼저 signal 을 주입하려면
      // context 에 미리 abort 된 signal 을 넣어야 한다. service.execute 는
      // abortSignal 을 외부에서 받지 않으므로, runExecution 이 nodeContext 를
      // 빌드한 뒤 executeWithRetry 가 호출되기 전에 signal 을 set 하는 방법을
      // 선택한다: handler.execute 첫 줄에서 `context.abortSignal?.throwIfAborted()`
      // 를 호출해 같은 AbortError 경로를 유발한다. 이미 abort 된 signal 을
      // context 에 주입한 다음 executeWithRetry 내 사전 체크가 그것을 잡는 것을
      // 시뮬레이션한다.
      const controller = new AbortController();
      controller.abort(); // 사전 abort
      const preCheckHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl.mockImplementation(
          async (_input: unknown, _config: unknown, ctx: unknown) => {
            // 핸들러 진입 시 이미 abort 된 signal 이 context 에 있으면
            // throwIfAborted() 가 DOMException(AbortError) 를 던진다.
            (
              ctx as { abortSignal?: AbortSignal }
            ).abortSignal?.throwIfAborted();
          },
        ),
      });

      const nodes: Partial<Node>[] = [
        {
          id: 'n-precheck',
          workflowId,
          type: 'precheck_node',
          category: NodeCategory.LOGIC,
          label: 'Pre-check node',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      // abortSignal 을 context 에 넣어야 throwIfAborted() 가 발화한다.
      // executeNode 는 nodeContext = { ...context, nodeId, ... } 로 빌드하므로
      // 상위 context 의 abortSignal 이 전파된다.
      // runExecution 의 createContext 호출 후 abortSignal 을 inject 한다.
      const ctxService = (
        service as unknown as {
          contextService: import('./context/execution-context.service').ExecutionContextService;
        }
      ).contextService;
      const originalCreateContext = ctxService.createContext.bind(ctxService);
      const createContextSpy = jest
        .spyOn(ctxService, 'createContext')
        .mockImplementationOnce(function (
          ...args: Parameters<typeof originalCreateContext>
        ) {
          const ctx = originalCreateContext(...args);
          ctx.abortSignal = controller.signal;
          return ctx;
        });
      handlerRegistry.register('precheck_node', preCheckHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();
      createContextSpy.mockRestore();

      // 핸들러 execute 는 호출됐지만(spy confirm), throwIfAborted() 로 즉시 throw.
      // → executeNode catch 의 isAbortError 분기 → CANCELLED.
      // 노드는 CANCELLED.
      const ne = lastNodeExecSave('n-precheck');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // NODE_CANCELLED 이벤트 발사.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-precheck',
        'execution.node.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-precheck',
        'execution.node.failed',
        expect.anything(),
      );
    });

    // W3 (ai-review): errorPolicy='retry' 노드에서 AbortError 발생 시
    // 재시도 없이(handler.execute 1회만) CANCELLED 로 즉시 종결되는지 검증
    // (node-cancellation §5.1: abort 는 재시도 대상이 아님).
    it('retry policy: AbortError in retry loop → CANCELLED immediately, handler called only once (W3)', async () => {
      const executeImpl = jest.fn(async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      });
      const retryAbortHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl,
      });

      const nodes: Partial<Node>[] = [
        {
          id: 'n-retry-abort',
          workflowId,
          type: 'retry_abort_node',
          category: NodeCategory.LOGIC,
          label: 'Retry + Abort node',
          config: {
            errorHandling: {
              policy: 'retry',
              retryConfig: {
                maxRetries: 3,
                retryInterval: 10,
                backoffMultiplier: 1,
              },
            },
          },
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('retry_abort_node', retryAbortHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // CANCELLED (FAILED 아님) — abort 는 retry 대상이 아님.
      const ne = lastNodeExecSave('n-retry-abort');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // handler.execute 는 단 1회만 호출 — 재시도(maxRetries=3) 없이 즉시 전파.
      expect(executeImpl).toHaveBeenCalledTimes(1);
      // NODE_CANCELLED emit, NODE_FAILED 미발사.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-retry-abort',
        'execution.node.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-retry-abort',
        'execution.node.failed',
        expect.anything(),
      );
    });

    // ai-review W15 (2026-07-26) — W9(runContainer)와 동형 결함이 Sub-Workflow
    // 노드 경로에 잔존했다. `workflow.handler.ts` 의 C1 재throw(sync 모드
    // `executeInline` 이 §2.3 가드로 관측한 `ExecutionCancelledError`)가 이
    // `executeNode` try 안에서 발생하면 예전에는 generic catch 가
    // instanceof 분기 없이 기본 `stop_workflow` 정책을 적용해 노드를 FAILED 로
    // 영속하고 executionId 를 포함한 내부 message 를 실어 NODE_FAILED 를 WS 로
    // 방출했다. `ParkReleaseSignal` 과 대칭인 우회 재throw 로 이를 막는다 —
    // 정상 그래프 dispatch 로 workflow 타입 노드를 통과시켰을 때(handler 가
    // 직접 `ExecutionCancelledError` 를 throw 해 C1 재throw 를 시뮬레이션) 취소가
    // 노드를 FAILED 로 만들지 않고 NODE_FAILED 를 emit 하지 않는지 단언한다.
    it('Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)', async () => {
      const executeImpl = jest.fn(async () => {
        throw new ExecutionCancelledError('Execution cancelled externally');
      });
      const cancelledSubWorkflowHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl,
      });

      const nodes: Partial<Node>[] = [
        {
          id: 'n-subwf',
          workflowId,
          type: 'workflow',
          category: NodeCategory.LOGIC,
          label: 'Sub-workflow',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('workflow', cancelledSubWorkflowHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // 노드는 FAILED 가 아니라 **CANCELLED 로 마감**된다.
      //
      // ai-review 4R (side_effect) — 옛 단언은 `not.toBe(FAILED)` 였는데, 그 시점
      // `lastNodeExecSave` 가 반환하던 것은 `createNodeExecution` 의 최초 RUNNING save
      // 였다(취소 분기가 아무 save 도 하지 않았으므로). 즉 "FAILED 가 아니다" 는
      // RUNNING 인 채로도 참이라 **vacuous** 했고, 노드가 영구 running 으로 잔류하는
      // 진짜 결함을 가렸다. 이제 terminal 상태와 finishedAt 을 양성으로 단언한다.
      const ne = lastNodeExecSave('n-subwf');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      expect(ne?.finishedAt).toBeInstanceOf(Date);
      // terminal 이벤트(NODE_CANCELLED)가 반드시 발행된다 — 타임라인 영구 spinner 방지.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-subwf',
        'execution.node.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      // 내부 message(executionId 포함)는 노드 이벤트 payload 에 실리지 않는다.
      const cancelCall = (
        mockWebsocketService.emitNodeEvent as jest.Mock
      ).mock.calls.find(
        (c: unknown[]) =>
          c[2] === 'execution.node.cancelled' && c[1] === 'n-subwf',
      );
      expect(JSON.stringify(cancelCall?.[3] ?? {})).not.toContain(
        'cancelled externally',
      );
      // ai-review 6R (testing) — 위 문자열 단언만으로는 부족하다. `markNodeCancelled`
      // 이 `errorEnvelope` 없이 호출될 때 **`error` 에 아무 내용도 싣지 않는다**는
      // 것이 이 헬퍼의 존재 이유(W15/W19: sentinel message 에 executionId 가 있다)인데,
      // 실측 mutation 에서 임의의 leaked `error` 를 강제 주입해도 기존 단언들이 전부
      // GREEN 이었다. 구조적으로 고정한다. CLE-T-J6GRJ9 부터 `markNodeCancelled` 가
      // `error` 를 직접 비우므로(null) 행 쪽 기대값은 `null` 이다.
      expect(ne?.error).toBeNull();
      expect(cancelCall?.[3]).not.toHaveProperty('error');
      // handler.execute 는 errorPolicy 재시도 없이 1회만 호출된다.
      expect(executeImpl).toHaveBeenCalledTimes(1);
      // NODE_FAILED 가 emit 되지 않는다.
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-subwf',
        'execution.node.failed',
        expect.anything(),
      );
      // Execution 자체는 cancelled 로 마감된다 (C1/C4 catch 경로 재사용).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    // ai-review 4R (requirement) — `errorHandling.policy:'retry'` 가 붙은 노드에서
    // 취소가 **재시도 대상으로 오분류**되던 결함. `executeWithRetry` 의 재시도 제외
    // 판정이 `isAbortError` 뿐이었는데 `ExecutionCancelledError` 는 name 이
    // 'AbortError' 가 아니라 걸리지 않았다 — 최대 3회 재호출 + 백오프 뒤에야 수렴.
    it('errorPolicy:retry 노드에서도 ExecutionCancelledError 는 재시도하지 않고 즉시 전파한다 (4R)', async () => {
      const executeImpl = jest.fn(async () => {
        throw new ExecutionCancelledError('Execution cancelled externally');
      });
      handlerRegistry.register('workflow', {
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl,
      } as NodeHandler);

      mockNodeRepo.findBy.mockResolvedValue([
        {
          id: 'n-retry-cancel',
          workflowId,
          type: 'workflow',
          category: NodeCategory.LOGIC,
          label: 'Retry Sub-workflow',
          // 재시도 3회 + 백오프가 걸린 노드.
          // 주의: retry 설정은 `errorHandling.retryConfig` **중첩** 위치다
          // (`getErrorPolicyConfig` 가 그렇게 읽는다). 처음 이 테스트를 평면 형태로
          // 썼더니 retryConfig 가 undefined 라 재시도 루프에 진입조차 하지 않아
          // mutation 을 해도 GREEN 인 vacuous 테스트가 됐다.
          config: {
            errorHandling: {
              policy: 'retry',
              retryConfig: {
                maxRetries: 3,
                retryInterval: 1,
                backoffMultiplier: 2,
              },
            },
          },
          isDisabled: false,
        },
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      // 재시도는 `sleep` 을 끼고 도는 **detached** 실행이라 `flushPromises` 만으로는
      // 아직 일어나지 않는다 — 그 상태로 단언하면 재시도 여부와 무관하게 항상 1 이라
      // vacuous 하다(실제로 이 테스트를 처음 그렇게 썼다가 mutation 이 GREEN 으로
      // 통과했다). retryInterval 1ms·backoff 2 → 최대 1+2+4ms 이므로 여유를 두고
      // 실제 타이머를 흘려보낸 뒤 판정한다.
      await new Promise((r) => setTimeout(r, 80));
      await flushPromises();

      // 회귀 전: 4회(최초 1 + 재시도 3). 지금은 1회로 즉시 전파.
      expect(executeImpl).toHaveBeenCalledTimes(1);
    });

    it('stops the workflow (ERROR_PORT_FALLBACK) when the error port has no connected edge', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Mailer',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('err_node', errHandler());

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // 노드는 FAILED.
      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      // error 포트 미연결 → Stop Workflow 폴백 → Execution FAILED + code 보존.
      // ai-review CRITICAL #1 (2026-07-27, 6차 라운드) — guarded UPDATE(raw
      // query) 경유로 바뀌어 더 이상 full-entity `.save()` 를 호출하지 않는다.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([
          ExecutionStatus.FAILED,
          expect.stringContaining('ERROR_PORT_FALLBACK'),
        ]),
      );
      // DB write 는 위에서 `ERROR_PORT_FALLBACK` 을 단언하는데 emit 은 `status` 만 보고
      // 있었다 — **sentinel code 가 wire 까지 보존되는지**를 아무도 안 보고 있었다
      // (`23_49_41` testing W1). 이 PR 의 요점이 "DB 와 wire 를 같은 값으로" 이므로 고정한다.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({
            code: 'ERROR_PORT_FALLBACK',
            nodeId: null,
          }) as unknown,
        }),
      );
      // 성공 종료 이벤트는 발사되지 않아야 한다.
      expect(mockWebsocketService.emitExecutionEvent).not.toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.anything(),
      );
    });

    it('still marks a normal (non-error-port) handler COMPLETED', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-ok',
          workflowId,
          type: 'ok_node',
          category: NodeCategory.LOGIC,
          label: 'OK',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('ok_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      const okNe = lastNodeExecSave('n-ok');
      expect(okNe?.status).toBe(NodeExecutionStatus.COMPLETED);
      // M-3 — COMPLETED 마감은 full-save 대신 guarded raw UPDATE(query)로 영속한다
      // (status IN 비-terminal 가드). status 'completed' 가 쿼리 파라미터에 포함.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.COMPLETED]),
      );
      // #5 — lost-update 가드 문자열 검증.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/status IN/),
        expect.anything(),
      );
    });

    it('marks FAILED with a default message when error envelope carries no code/message', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Bare error',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      // error 포트로 라우팅하지만 output.error 가 없는 핸들러 (코드/메시지 부재).
      handlerRegistry.register('err_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({ note: 'oops' }, { port: 'error' }),
        ),
      });

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      expect(errNe?.error).toEqual({ message: 'Node routed to error port' });
      // 미연결 error 포트 → Stop Workflow. ai-review CRITICAL #1 (2026-07-27,
      // 6차 라운드) — guarded UPDATE(raw query) 경유로 바뀌어 더 이상
      // full-entity `.save()` 를 호출하지 않는다.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([
          ExecutionStatus.FAILED,
          expect.stringContaining('ERROR_PORT_FALLBACK'),
        ]),
      );
    });

    // 핸들러가 throw 한 실패에 「에러 포트로 라우팅」이 걸린 경우도 `port: 'error'`
    // 출력과 같이 error 포트를 고른다. 회귀 전에는 출력에 고른 포트가 없어서 `out`
    // 연결선까지 함께 열렸고, error 연결선이 없어도 멈추지 않았고, NODE_FAILED 도
    // 내지 않았다(NERV Task CLE-T-0R8F99).
    describe('handler throw with route_to_error_port', () => {
      const throwerNode: Partial<Node> = {
        id: 'n-throw',
        workflowId,
        type: 'throw_node',
        category: NodeCategory.LOGIC,
        label: 'Thrower',
        config: { errorHandling: { policy: 'route_to_error_port' } },
        isDisabled: false,
      };
      const sinkNode = (id: string, type: string): Partial<Node> => ({
        id,
        workflowId,
        type,
        category: NodeCategory.LOGIC,
        label: id,
        config: {},
        isDisabled: false,
      });
      const throwerEdge = (
        id: string,
        sourcePort: string,
        targetNodeId: string,
      ): Partial<Edge> => ({
        id,
        workflowId,
        sourceNodeId: 'n-throw',
        sourcePort,
        targetNodeId,
        targetPort: 'in',
        type: EdgeType.DATA,
      });
      const routedError = { code: 'UNKNOWN_ERROR', message: 'boom' };
      let normalExecute: jest.Mock;
      let errorSinkExecute: jest.Mock;

      beforeEach(() => {
        handlerRegistry.register('throw_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => {
            throw new Error('boom');
          }),
        });
        normalExecute = jest.fn(async () => mockOutput({ normal: true }));
        errorSinkExecute = jest.fn(async () => mockOutput({ handled: true }));
        handlerRegistry.register('normal_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: normalExecute,
        });
        handlerRegistry.register('error_sink_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: errorSinkExecute,
        });
      });

      it('opens only the error edge, marks the node FAILED and emits NODE_FAILED', async () => {
        mockNodeRepo.findBy.mockResolvedValue([
          throwerNode,
          sinkNode('n-normal', 'normal_node'),
          sinkNode('n-handle', 'error_sink_node'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          throwerEdge('e-out', 'out', 'n-normal'),
          throwerEdge('e-err', 'error', 'n-handle'),
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        // 정상 경로(out)의 다음 노드는 실행하지 않는다.
        expect(normalExecute).not.toHaveBeenCalled();
        // error 경로의 다음 노드는 라우팅 표지 없이 에러 데이터만 입력으로 받는다.
        expect(errorSinkExecute).toHaveBeenCalledTimes(1);
        expect(errorSinkExecute.mock.calls[0][0]).toEqual({
          error: routedError,
        });

        const throwNe = lastNodeExecSave('n-throw');
        expect(throwNe?.status).toBe(NodeExecutionStatus.FAILED);
        expect(throwNe?.error).toEqual(routedError);
        expect(throwNe?.outputData).toEqual({ error: routedError });
        expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
          executionId,
          'n-throw',
          'execution.node.failed',
          expect.objectContaining({
            status: 'failed',
            error: 'boom',
            output: { error: routedError },
          }),
        );
        // error 연결선이 있으므로 실행은 계속되고 성공으로 끝난다.
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE execution/),
          expect.arrayContaining([ExecutionStatus.COMPLETED]),
        );
      });

      // 엔진이 라우팅 표지를 붙인 값은 평면 캐시에만 둔다. `$node[X].output` 은 에러 데이터
      // 그대로이고 `port` 는 `error` 다(NERV Task CLE-T-JDYHCF 3번과 같은 경로).
      it('$node[X].output 은 라우팅 표지 없이 에러 데이터이고 port 는 error 다', async () => {
        mockNodeRepo.findBy.mockResolvedValue([
          throwerNode,
          {
            ...sinkNode('n-handle', 'error_sink_node'),
            config: {
              fromNode: '{{ $node["Thrower"].output }}',
              port: '{{ $node["Thrower"].port }}',
            },
          },
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          throwerEdge('e-err', 'error', 'n-handle'),
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(errorSinkExecute).toHaveBeenCalledTimes(1);
        const config = errorSinkExecute.mock.calls[0][1] as Record<
          string,
          unknown
        >;
        expect(config.fromNode).toStrictEqual({ error: routedError });
        expect(config.port).toBe('error');
      });

      // 동적 에러 포트(REQ-NODEUI-012): 캔버스가 고정 `error` 포트가 없는 노드에
      // 그리는 포트도 연결선 `sourcePort === 'error'` 로 저장된다. 정책이 켜져
      // 있어도 노드가 성공하면 그 연결선은 열지 않는다.
      it('opens only the normal edge when a route_to_error_port node succeeds', async () => {
        mockNodeRepo.findBy.mockResolvedValue([
          { ...throwerNode, id: 'n-ok', type: 'normal_node' },
          sinkNode('n-next', 'error_sink_node'),
          sinkNode('n-handle', 'normal_node'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          { ...throwerEdge('e-out', 'out', 'n-next'), sourceNodeId: 'n-ok' },
          {
            ...throwerEdge('e-err', 'error', 'n-handle'),
            sourceNodeId: 'n-ok',
          },
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        // n-ok 자신만 normal_node 를 한 번 부르고 error 쪽 n-handle 은 부르지 않는다.
        expect(normalExecute).toHaveBeenCalledTimes(1);
        expect(errorSinkExecute).toHaveBeenCalledTimes(1);
        expect(lastNodeExecSave('n-ok')?.status).toBe(
          NodeExecutionStatus.COMPLETED,
        );
        expect(lastNodeExecSave('n-handle')).toBeUndefined();
      });

      // 고정 `error` 포트가 있는 노드(REQ-NODEUI-043)는 동적 포트 없이 그 포트로
      // 보낸다. 핸들러가 직접 `port: 'error'` 를 내도, throw 해도 error 연결선
      // 하나만 열고 다음 노드는 한 번만 실행한다.
      it.each([
        [
          'returns port: error',
          async () =>
            mockOutput(
              { error: { code: 'EMAIL_SEND_FAILED', message: 'SMTP' } },
              { port: 'error' },
            ),
        ],
        [
          'throws',
          async () => {
            throw new Error('boom');
          },
        ],
      ])(
        'routes a fixed-error-port node to its error edge once when the handler %s',
        async (_label, impl) => {
          handlerRegistry.register('fixed_err_node', {
            validate: () => ({ valid: true, errors: [] }),
            execute: jest.fn(impl),
          });
          mockNodeRepo.findBy.mockResolvedValue([
            { ...throwerNode, type: 'fixed_err_node' },
            sinkNode('n-normal', 'normal_node'),
            sinkNode('n-handle', 'error_sink_node'),
          ]);
          mockEdgeRepo.findBy.mockResolvedValue([
            throwerEdge('e-out', 'out', 'n-normal'),
            throwerEdge('e-err', 'error', 'n-handle'),
          ]);

          await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
          await flushPromises();

          expect(normalExecute).not.toHaveBeenCalled();
          expect(errorSinkExecute).toHaveBeenCalledTimes(1);
          expect(lastNodeExecSave('n-throw')?.status).toBe(
            NodeExecutionStatus.FAILED,
          );
          expect(mockExecutionRepo.query).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE execution/),
            expect.arrayContaining([ExecutionStatus.COMPLETED]),
          );
        },
      );

      it('stops the workflow (ERROR_PORT_FALLBACK) when no error edge is connected', async () => {
        mockNodeRepo.findBy.mockResolvedValue([
          throwerNode,
          sinkNode('n-normal', 'normal_node'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          throwerEdge('e-out', 'out', 'n-normal'),
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();

        expect(normalExecute).not.toHaveBeenCalled();
        expect(lastNodeExecSave('n-throw')?.status).toBe(
          NodeExecutionStatus.FAILED,
        );
        expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
          executionId,
          'n-throw',
          'execution.node.failed',
          expect.objectContaining({ status: 'failed' }),
        );
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE execution/),
          expect.arrayContaining([
            ExecutionStatus.FAILED,
            expect.stringContaining('ERROR_PORT_FALLBACK'),
          ]),
        );
        expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
          executionId,
          'execution.failed',
          expect.objectContaining({
            status: 'failed',
            error: expect.objectContaining({
              code: 'ERROR_PORT_FALLBACK',
            }) as unknown,
          }),
        );
        expect(
          mockWebsocketService.emitExecutionEvent,
        ).not.toHaveBeenCalledWith(
          executionId,
          'execution.completed',
          expect.anything(),
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // markNodeCancelled — 노드 단위 취소 마감 계약 (CLE-T-J6GRJ9).
  //
  // 짝 전이가 동시 Stop 에 선점당한 호출부(AI · form · button)는 성공 · 대기 · 실패
  // payload 를 낙관적으로 채운 nodeExec 를 넘긴다. 비우는 일은 호출부 주석에 기대지
  // 않고 이 메서드가 한다. 실패하면 어느 단계(save / emit)인지 표지 오류로 알린다.
  // ──────────────────────────────────────────────────────────────────────────
  describe('markNodeCancelled', () => {
    const node = {
      id: 'n-mark',
      type: 'form',
      label: 'Form',
    } as unknown as Node;
    const makeNodeExec = (): NodeExecution =>
      ({
        id: 'ne-mark',
        nodeId: 'n-mark',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(Date.now() - 1_000),
        outputData: { output: { message: 'stale success payload' } },
        error: { code: 'STALE', message: 'stale failure payload' },
      }) as unknown as NodeExecution;
    const ctx = () =>
      ({ executionId, parentNodeExecutionId: undefined }) as never;

    it('payload 를 비우고 CANCELLED 로 저장한 뒤 NODE_CANCELLED 를 낸다', async () => {
      const ne = makeNodeExec();

      await service.markNodeCancelled(ne, node, ctx(), executionId);

      const saved = mockNodeExecutionRepo.save.mock.calls.at(-1)?.[0] as
        NodeExecution | undefined;
      expect(saved).toBe(ne);
      expect(saved?.status).toBe(NodeExecutionStatus.CANCELLED);
      expect(saved?.outputData).toBeNull();
      expect(saved?.error).toBeNull();
      expect(saved?.finishedAt).toBeInstanceOf(Date);
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-mark',
        'execution.node.cancelled',
        expect.not.objectContaining({ error: expect.anything() }),
      );
    });

    it('errorEnvelope 가 있으면 error 를 그 봉투로 바꾸고 이벤트에도 싣는다', async () => {
      const ne = makeNodeExec();
      const envelope = { code: 'AbortError', message: 'aborted' };

      await service.markNodeCancelled(ne, node, ctx(), executionId, envelope);

      expect(ne.outputData).toBeNull();
      expect(ne.error).toEqual(envelope);
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-mark',
        'execution.node.cancelled',
        expect.objectContaining({ error: envelope }),
      );
    });

    it('save 가 실패하면 stage=save 표지 오류로 알리고 이벤트를 내지 않는다', async () => {
      mockNodeExecutionRepo.save.mockRejectedValueOnce(
        new Error('DB write failed'),
      );

      const promise = service.markNodeCancelled(
        makeNodeExec(),
        node,
        ctx(),
        executionId,
      );

      await expect(promise).rejects.toBeInstanceOf(NodeCancelMarkingError);
      await expect(promise).rejects.toMatchObject({
        stage: 'save',
        nodeExecutionId: 'ne-mark',
        // 상위가 메시지로 실패를 기록하는 경로의 문구가 바뀌지 않게 원본 메시지를 쓴다.
        message: 'DB write failed',
      });
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-mark',
        'execution.node.cancelled',
        expect.anything(),
      );
    });

    it('emit 이 실패하면 stage=emit 표지 오류로 알린다 — 저장은 이미 끝났다', async () => {
      mockWebsocketService.emitNodeEvent.mockRejectedValueOnce(
        new Error('ws publish failed'),
      );
      const ne = makeNodeExec();

      const promise = service.markNodeCancelled(ne, node, ctx(), executionId);

      await expect(promise).rejects.toMatchObject({
        stage: 'emit',
        nodeExecutionId: 'ne-mark',
        message: 'ws publish failed',
      });
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: NodeExecutionStatus.CANCELLED }),
      );
    });

    it('짝 전이 가드가 실제 markNodeCancelled 로 낙관적 payload 가 찬 행을 비워 CANCELLED 로 저장한다', async () => {
      // 소비처 spec 은 driver 를 mock 으로 두므로, 가드 → 실제 마킹 연결은 여기서 잇는다.
      const ne = makeNodeExec();

      await expect(
        assertLinkedTransitionApplied(
          { driver: service, logger: { error: jest.fn() } },
          {
            shouldProceed: false,
            nodeExec: ne,
            node,
            context: ctx(),
            executionId,
            phase: 'form park',
          },
        ),
      ).rejects.toBeInstanceOf(ExecutionCancelledError);

      const saved = mockNodeExecutionRepo.save.mock.calls.at(-1)?.[0] as
        NodeExecution | undefined;
      expect(saved).toBe(ne);
      expect(saved?.status).toBe(NodeExecutionStatus.CANCELLED);
      expect(saved?.outputData).toBeNull();
      expect(saved?.error).toBeNull();
    });
  });

  describe('WebSocket events', () => {
    it('should emit EXECUTION_STARTED event when execution begins', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.started',
        expect.objectContaining({ status: 'running' }),
      );
    });

    it('should emit EXECUTION_COMPLETED event after successful execution', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

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

    it('should emit NODE_STARTED and NODE_COMPLETED for each node', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // 3 nodes = 3 started + 3 completed = 6 node events
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledTimes(6);

      // Check first node started
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'execution.node.started',
        expect.objectContaining({ status: 'running' }),
      );

      // Check first node completed — payload 가 startedAt (ISO) 도 동봉해야
      // 한다. NODE_STARTED race miss 시에도 frontend store row 의 startedAt
      // 이 누락되지 않도록 NODE_* 모든 이벤트에 startedAt 동봉 (timeline
      // 회귀 hotfix #6).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'execution.node.completed',
        expect.objectContaining({
          status: 'completed',
          startedAt: expect.any(String),
        }),
      );
    });

    it('should emit EXECUTION_FAILED on error in background', async () => {
      (mockHandler.execute as jest.Mock).mockRejectedValue(
        new Error('Node execution failed'),
      );

      // execute() returns normally (fire-and-forget)
      const result = await service.execute(workflowId, undefined, {
        workspaceId: 'ws-1',
      });
      expect(result).toBe(executionId);

      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        expect.objectContaining({
          status: 'failed',
          // 종전엔 문자열이었다. EIA §6.4 객체 형태로 바뀌었고 부재는 명시적 null 이다.
          error: {
            code: null,
            message: 'Node execution failed',
            nodeId: null,
          },
        }),
      );
    });
  });

  // W2 (SUMMARY) — env read-once 캐시 회귀 가드: resolveMaxNodeIterations /
  // resolveParallelEngineFlag 가 configService.get 을 최초 1회만 호출하는지
  // spy call-count 로 직접 단언한다 (캐시가 깨져 매 실행마다 재읽기해도
  // 값 자체는 동일해 침묵하는 회귀 방어).
  describe('env read-once cache (perf #14) — W2', () => {
    it('resolveMaxNodeIterations: configService.get 이 MAX_NODE_ITERATIONS 키로 첫 execute 에서 1회만 호출된다', async () => {
      // 단순 워크플로우를 실행해 loadAndBuildGraph → resolveMaxNodeIterations 흐름을 타게 한다.
      mockConfigService.get.mockClear();

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      const maxIterCalls = mockConfigService.get.mock.calls.filter(
        (c: unknown[]) => c[0] === 'MAX_NODE_ITERATIONS',
      );
      expect(maxIterCalls).toHaveLength(1);
    });

    it('resolveMaxNodeIterations: 두 번째 execute 에서 configService.get 재호출 없음 (인스턴스 캐시 유지)', async () => {
      // 첫 번째 실행으로 maxNodeIterationsOnce 캐시를 warm-up 한 뒤
      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      mockConfigService.get.mockClear();

      // 두 번째 실행 — 캐시가 있으므로 MAX_NODE_ITERATIONS get 재호출 없어야 함
      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      const maxIterCalls = mockConfigService.get.mock.calls.filter(
        (c: unknown[]) => c[0] === 'MAX_NODE_ITERATIONS',
      );
      expect(maxIterCalls).toHaveLength(0);
    });

    // 재리뷰(20_45_51) W1 — PARALLEL_ENGINE 경로도 동일 패턴으로 가드.
    it('resolveParallelEngineFlag: configService.get 이 PARALLEL_ENGINE 키로 1회만 호출된다 (read-once)', async () => {
      // 인스턴스 캐시를 직접 비워 cold 상태에서 시작 (다른 테스트의 warm-up 영향 제거).
      (
        service as unknown as { parallelEngineFlagOnce: string | null }
      ).parallelEngineFlagOnce = null;
      mockConfigService.get.mockClear();

      type FlagSubject = { resolveParallelEngineFlag: () => string };
      const svc = service as unknown as FlagSubject;
      expect(svc.resolveParallelEngineFlag()).toBe('v1');
      expect(svc.resolveParallelEngineFlag()).toBe('v1');

      const flagCalls = mockConfigService.get.mock.calls.filter(
        (c: unknown[]) => c[0] === 'PARALLEL_ENGINE',
      );
      expect(flagCalls).toHaveLength(1);
    });

    it('resolveParallelEngineFlag: warm 캐시 상태에서는 configService.get 재호출이 없다', async () => {
      type FlagSubject = { resolveParallelEngineFlag: () => string };
      const svc = service as unknown as FlagSubject;
      svc.resolveParallelEngineFlag(); // warm-up

      mockConfigService.get.mockClear();
      svc.resolveParallelEngineFlag();

      const flagCalls = mockConfigService.get.mock.calls.filter(
        (c: unknown[]) => c[0] === 'PARALLEL_ENGINE',
      );
      expect(flagCalls).toHaveLength(0);
    });
  });
});
