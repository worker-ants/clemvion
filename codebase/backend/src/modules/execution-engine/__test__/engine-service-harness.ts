/**
 * `ExecutionEngineService` 통합 스펙 공용 하네스.
 *
 * `execution-engine.service.spec.ts` 와 그 파일에서 나눠 낸 스펙
 * (`containers/parallel-execution.integration.spec.ts`) 이 같은 서비스 구성을 쓴다.
 * 테스트마다 `beforeEach` 에서 `createEngineServiceHarness()` 를 불러 새 Nest 테스트
 * 모듈과 mock 레포지토리를 받는다.
 *
 * 테스트가 다시 대입하는 값(`dbExecutionStatus` · `waitingRawRows` ·
 * `waitingQueryError`)은 하네스 객체의 필드다. mock 클로저가 이 필드를 매번 읽으므로
 * 테스트는 `h.dbExecutionStatus = …` 처럼 하네스 객체에 대입한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from '../queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from '../queues/execution-run.queue';
import { ExecutionEngineService } from '../execution-engine.service';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import { AiTurnOrchestrator } from '../ai-turn-orchestrator.service';
import { FormInteractionService } from '../form-interaction.service';
import { ButtonInteractionService } from '../button-interaction.service';
import { RetryTurnService } from '../retry-turn.service';
import { ENGINE_DRIVER } from '../engine-driver.interface';
import { ExecutionContextService } from '../context/execution-context.service';
import { ErrorPolicyHandler } from '../error/error-policy.handler';
import { ExpressionResolverService } from '../expression/expression-resolver.service';
import { ForEachExecutor } from '../containers/foreach-executor';
import { LoopExecutor } from '../containers/loop-executor';
import { ParallelExecutor } from '../containers/parallel-executor';
import { WebsocketService } from '../../websocket/websocket.service';
import { ExecutionEventEmitter } from '../events/execution-event-emitter.service';
import { GraphTraversalService } from '../graph/graph-traversal.service';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../llm/llm.service';
import { RagSearchService } from '../../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { Cafe24ApiClient } from '../../../nodes/integration/cafe24/cafe24-api.client';
import { MakeshopApiClient } from '../../../nodes/integration/makeshop/makeshop-api.client';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { Edge, EdgeType } from '../../edges/entities/edge.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from '../entities/execution-node-log.entity';
import { ContinuationBusService } from '../continuation/continuation-bus.service';
import { StuckExecutionRecoveryService } from '../recovery/stuck-execution-recovery.service';
import { ConversationThreadService } from '../conversation-thread/conversation-thread.service';
import { ShutdownStateService } from '../shutdown/shutdown-state.service';
import { BusinessMetricsService } from '../../metrics/business-metrics.service';
import {
  ExecutionContext,
  NodeHandler,
} from '../../../nodes/core/node-handler.interface';
import { mockOutput } from './mock-output';

// Helper to flush pending promises (allow background execution to complete)
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// Mock data
export const workflowId = 'workflow-1';
export const executionId = 'execution-1';

export const mockWorkflow: Partial<Workflow> = {
  id: workflowId,
  name: 'Test Workflow',
  isActive: true,
  // W-6 workspace 격리는 fail-closed — sub-workflow target lookup(findOneBy)이
  // 반환하는 workflow 는 workspaceId 를 가져야 호출자 __workspaceId='ws-1' 와
  // 일치 통과한다. (runExecution 의 __workspaceId 주입은 findOne(relations) 경로라
  // 본 기본값과 무관 — 그쪽은 개별 테스트의 findOne mock 이 결정.)
  workspaceId: 'ws-1',
};

// W-6 fail-closed: sub-workflow 실행은 context.variables.__workspaceId 가
// target workflow.workspaceId 와 일치해야 통과한다. 격리-무관 테스트들이
// 기본 'ws-1'(=mockWorkflow.workspaceId) 호출자 컨텍스트를 공유 주입하는 헬퍼.
export const withWorkspace = (
  ctx: ExecutionContext,
  workspaceId = 'ws-1',
): ExecutionContext => {
  ctx.variables = { ...(ctx.variables ?? {}), __workspaceId: workspaceId };
  return ctx;
};

export const mockNodes: Partial<Node>[] = [
  {
    id: 'node-1',
    workflowId,
    type: 'test_node',
    category: NodeCategory.LOGIC,
    label: 'Node 1',
    config: {},
    isDisabled: false,
    containerId: undefined,
    toolOwnerId: undefined,
  },
  {
    id: 'node-2',
    workflowId,
    type: 'test_node',
    category: NodeCategory.LOGIC,
    label: 'Node 2',
    config: {},
    isDisabled: false,
    containerId: undefined,
    toolOwnerId: undefined,
  },
  {
    id: 'node-3',
    workflowId,
    type: 'test_node',
    category: NodeCategory.LOGIC,
    label: 'Node 3',
    config: {},
    isDisabled: false,
    containerId: undefined,
    toolOwnerId: undefined,
  },
];

export const mockEdges: Partial<Edge>[] = [
  {
    id: 'edge-1',
    workflowId,
    sourceNodeId: 'node-1',
    sourcePort: 'out',
    targetNodeId: 'node-2',
    targetPort: 'in',
    type: EdgeType.DATA,
  },
  {
    id: 'edge-2',
    workflowId,
    sourceNodeId: 'node-2',
    sourcePort: 'out',
    targetNodeId: 'node-3',
    targetPort: 'in',
    type: EdgeType.DATA,
  },
];

// Mock handler
export const mockHandler: NodeHandler = {
  validate: () => ({ valid: true, errors: [] }),
  // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
  execute: jest.fn(async (input: unknown) =>
    mockOutput({
      processed: true,
      input,
    }),
  ),
};

/** 테스트가 다시 대입하는 값. mock 클로저가 매번 이 필드를 읽는다. */
export interface EngineServiceHarnessState {
  // `updateExecutionStatus` 의 linkedNodeExec(park 짝 전이) 분기 잠금 mock 이 대조할
  // "현재 DB Execution.status".
  dbExecutionStatus: ExecutionStatus;
  // resolveWaitingNodeExecutionId 의 단일 JOIN 쿼리(§7.5.1) 제어 — raw 행 / infra 실패.
  waitingRawRows: Array<Record<string, unknown>>;
  waitingQueryError: Error | null;
}

export interface EngineServiceHarness extends EngineServiceHarnessState {
  service: ExecutionEngineService;
  aiTurnOrchestrator: AiTurnOrchestrator;
  formInteraction: FormInteractionService;
  buttonInteraction: ButtonInteractionService;
  retryTurnService: RetryTurnService;
  conversationThreadService: ConversationThreadService;
  mockExecutionRunQueue: { add: jest.Mock };
  handlerRegistry: NodeHandlerRegistry;
  mockWebsocketService: {
    emitExecutionEvent: jest.Mock;
    emitNodeEvent: jest.Mock;
    registerExecutionRouting: jest.Mock;
    releaseExecutionRouting: jest.Mock;
  };
  mockConfigService: { get: jest.Mock };
  mockExecutionRepo: Record<string, jest.Mock>;
  mockNodeExecutionRepo: Record<string, jest.Mock>;
  mockNodeRepo: Record<string, jest.Mock>;
  mockWaitingQb: Record<string, jest.Mock>;
  retryClaimQb: Record<string, jest.Mock>;
  mockEdgeRepo: Record<string, jest.Mock>;
  mockWorkflowRepo: Record<string, jest.Mock>;
  mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // `updateExecutionStatus` 의 linkedNodeExec(park 짝 전이) 분기가 트랜잭션 안에서
  // 실행하는 terminal 가드(`SELECT ... FOR UPDATE`) 제어. 기본은 "행 잠금 성공(비-terminal)"
  // 이라 기존 테스트가 그대로 통과하고, 선점 테스트만 `[]` 로 재무장한다.
  mockTxManagerQuery: jest.Mock;
}

/**
 * mock 클로저가 읽는 "지금 테스트의" 값. 모듈 범위라 스펙 파일 하나 안에서만 공유된다.
 *
 * 원래 스펙은 이 값들을 최상위 describe 의 `let` 으로 두고 `beforeEach` 마다 새로
 * 대입했다. 그래서 앞 테스트에서 끝나지 않고 남은 백그라운드 실행도 다음 테스트의
 * 최신 mock · 서비스를 읽었다. 하네스도 같은 동작을 지키려고 클로저가 이 객체를 읽는다.
 * 하네스 지역 변수를 바로 읽게 하면 남은 실행이 옛 mock 을 계속 써서 다음 테스트가
 * 끝나지 않는 경우가 있다(원래 스펙의 runExecutionFromQueue describe 에서 확인).
 */
const live = {} as Pick<
  EngineServiceHarness,
  | 'service'
  | 'mockExecutionRepo'
  | 'mockNodeExecutionRepo'
  | 'mockWaitingQb'
  | 'retryClaimQb'
  | 'mockTxManagerQuery'
> & {
  state: EngineServiceHarnessState;
  // Phase 2 — ContinuationBusService mock 의 publish closure 가 lazy reference 로
  // 사용. service 는 Test.createTestingModule 이 끝난 뒤에야 set 되므로 외부 변수.
  resolvedService?: ExecutionEngineService;
};

export async function createEngineServiceHarness(): Promise<EngineServiceHarness> {
  const state: EngineServiceHarnessState = {
    dbExecutionStatus: ExecutionStatus.PENDING,
    waitingRawRows: [],
    waitingQueryError: null,
  };
  live.state = state;

  const savedExecution: Partial<Execution> = {
    id: executionId,
    workflowId,
    status: ExecutionStatus.PENDING,
    inputData: {},
    startedAt: new Date(),
  };

  // PR1 — execution-run 인라인 worker 브릿지(아래 큐 mock)가 runExecutionFromQueue
  // 에서 findOneBy({id}) 로 row 를 재조회하므로, save 가 만든 최신 row(triggerId
  // 등 포함)를 findOneBy 가 충실히 반환하도록 lastSaved 로 추적한다. 이로써
  // execute() → enqueue → worker → runExecution 경로가 옛 fire-and-forget 계약과
  // 동일하게 동작해 기존 execute() 테스트가 그대로 통과한다.
  let lastSaved: Partial<Execution> = { ...savedExecution };
  // ai-review CRITICAL #1 (2026-07-30) — 이 mock 은 종전에 SQL·status 와 **무관하게**
  // 항상 `[{id}]`(잠금 성공)을 반환해, `updateExecutionStatus` 의 DB 가드가 FAILED 를
  // 배제하는 사실을 8라운드 동안 은폐했다(retry 재진입 짝 전이가 실제로는 항상 0행이라
  // persist 되지 않았는데 테스트는 전부 GREEN). 이제 **SQL 의 `status IN (...)` 목록과
  // 현재 DB status 를 실제로 대조**한다 — opt-in(`allowRetryReentry`) 시에만 SQL 에
  // `'failed'` 가 들어가므로, opts 전파가 빠지면 이 mock 이 `[]` 를 돌려 RED 가 된다.
  state.dbExecutionStatus = ExecutionStatus.PENDING;
  const mockTxManagerQuery = jest.fn((sql: unknown, ...rest: unknown[]) => {
    if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
      return Promise.resolve(
        sql.includes(`'${live.state.dbExecutionStatus}'`)
          ? [{ id: executionId }]
          : [],
      );
    }
    // `updateExecutionStatus` else 분기의 guarded UPDATE 가 이제 이 트랜잭션
    // manager 를 탄다(`18_19_33` concurrency INFO 9 — throw 가 UPDATE 를 롤백하도록).
    //
    // **기존 repo mock 에 위임한다.** 그 UPDATE 는 종전에 `executionRepository.query`
    // 를 탔고, 이 스펙의 수십 개 테스트가 거기에 단언·`mockResolvedValueOnce` 를
    // 걸어 두고 있다. 위임하면 그 의도가 전부 살아 있으면서 호출이 **실제로
    // 트랜잭션을 경유한다는 사실**도 `mockTxManagerQuery` 에 기록된다 — 두 신호를
    // 다 남기려고 공유 대신 위임을 골랐다(공유하면 "트랜잭션을 탔는가" 를 못 가른다).
    if (typeof sql === 'string' && /UPDATE execution/.test(sql)) {
      return live.mockExecutionRepo.query(sql, ...rest) as Promise<unknown>;
    }
    return Promise.resolve([{ id: executionId }]);
  });
  const mockExecutionRepo: Record<string, jest.Mock> = {
    // PR2b — admission gate(admitExecutionOrDefer)의 원자 조건부 UPDATE 기본 mock:
    // affected=1 → admitted 로, runExecutionFromQueue 경유 테스트가 기존 흐름 유지.
    // (admission/5분 cancel 전용 테스트는 자체 mkQb 로 재할당.)
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
    })),
    // PR2b — admission advisory-lock 트랜잭션 기본 mock: query rows 1건 → admitted
    // (runExecutionFromQueue 경유 테스트가 기존 흐름 유지). admission/deferred 전용
    // 테스트는 manager.transaction 을 자체 재할당.
    manager: {
      // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
      transaction: jest.fn(async (cb: (m: { query: jest.Mock }) => unknown) =>
        cb({ query: jest.fn().mockResolvedValue([{ id: 'x' }]) }),
      ),
    },
    create: jest.fn().mockReturnValue({ ...savedExecution }),
    save: jest.fn().mockImplementation((entity: Partial<Execution>) => {
      lastSaved = { ...savedExecution, ...entity };
      if (entity.status) {
        live.state.dbExecutionStatus = entity.status;
      }
      return Promise.resolve(lastSaved);
    }),
    findOneBy: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ ...lastSaved })),
    // W1 (ai-review 2026-07-26) — `assertExecutionNotCancelled` 가 전체 row
    // SELECT(`findOneBy`) 대신 컬럼 투영(`findOne({select:{status:true}})`)으로
    // 바뀌었다. 이 mock 은 실제 TypeORM select 투영을 흉내내지 않고 `findOneBy`
    // 로 위임한다 — 기존/신규 테스트가 `mockExecutionRepo.findOneBy` 에 무장한
    // `mockResolvedValueOnce`/status 값을 그대로 재사용할 수 있게 하기 위함
    // (production 이 이 파일에서 `.findOne` 을 호출하는 유일한 지점).
    findOne: jest
      .fn()
      .mockImplementation(
        (opts: { where?: { id?: string } }) =>
          live.mockExecutionRepo.findOneBy(opts?.where ?? {}) as unknown,
      ),
    find: jest.fn().mockResolvedValue([]),
    // M-3 — updateExecutionStatus else 분기(RUNNING/COMPLETED)가 full-save 대신
    // guarded raw UPDATE(... RETURNING id)를 쓴다. 기본은 1행 매칭(=적용됨, applied
    // true). affected=0(동시 cancel/park 선점) 케이스는 [] 로 override.
    query: jest.fn().mockResolvedValue([{ id: executionId }]),
  };

  const mockNodeExecutionRepo: Record<string, jest.Mock> = {
    create: jest.fn().mockImplementation((data: Partial<NodeExecution>) => ({
      id: `ne-${data.nodeId}`,
      ...data,
      startedAt: new Date(),
    })),
    save: jest
      .fn()
      .mockImplementation((entity: Partial<NodeExecution>) =>
        Promise.resolve(entity),
      ),
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { nodeId: string } }) => {
        return Promise.resolve({
          id: `ne-${where.nodeId}`,
          executionId,
          nodeId: where.nodeId,
          status: NodeExecutionStatus.RUNNING,
          startedAt: new Date(),
        });
      }),
    find: jest.fn().mockResolvedValue([]),
    // Phase 2.3 (변경 2.3) — resolveWaitingNodeExecutionId 의 publisher 측 lookup.
    // 단일 JOIN 쿼리(대기 행 + node.type + interactionType JSONB path 투영).
    // 반환 행은 `waitingRawRows`, infra 실패는 `waitingQueryError` 로 제어한다.
    createQueryBuilder: jest.fn(() => live.mockWaitingQb),
  };

  // 기본값: WAITING_FOR_INPUT row 1건 (정상 케이스). 표면은 `ai_conversation` —
  // 4종 명령을 모두 허용하므로 publish 경로 자체를 검증하는 대다수 테스트가 표면
  // 가드에 걸리지 않는다. form/buttons 거부 경로는 전용 describe 가 override 한다.
  state.waitingRawRows = [
    {
      id: 'ne-waiting',
      nodeId: 'n-wait',
      nodeType: 'ai_agent',
      metaInteractionType: 'ai_conversation',
      flatInteractionType: null,
    },
  ];
  state.waitingQueryError = null;
  const mockWaitingQb: Record<string, jest.Mock> = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(() =>
      live.state.waitingQueryError
        ? Promise.reject(live.state.waitingQueryError)
        : Promise.resolve(live.state.waitingRawRows),
    ),
    // `applyRetryLastTurn` 의 재진입 원자 claim(2026-07-28) — 같은
    // `createQueryBuilder()` 진입점을 쓰지만 UPDATE 체인이라 SELECT 형 위 메서드들과
    // 섞이면 안 된다. `update()` 가 **별도 체인 객체**를 반환하게 해 두 경로를 분리한다.
    // 기본값은 "claim 성공"(affected=1) — 실패 시나리오는 전용 테스트가 재무장한다.
    update: jest.fn(() => live.retryClaimQb),
  };

  const retryClaimQb: Record<string, jest.Mock> = {
    set: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockNodeRepo: Record<string, jest.Mock> = {
    findBy: jest.fn().mockResolvedValue(mockNodes),
    // assertFormSubmissionValid (continueExecution publisher 검증) 의 Node 정의 lookup.
    // 기본값 null → form field 검증 skip (form 검증 무관 테스트의 기존 동작 유지).
    // 폼 검증 테스트는 form 노드 config 를 mockResolvedValueOnce 로 override.
    findOneBy: jest.fn().mockResolvedValue(null),
  };

  const mockEdgeRepo: Record<string, jest.Mock> = {
    findBy: jest.fn().mockResolvedValue(mockEdges),
  };

  const mockWorkflowRepo: Record<string, jest.Mock> = {
    findOneBy: jest.fn().mockResolvedValue(mockWorkflow),
    // runExecution 의 createContext 단계에서 workflow + workspace 를 join 으로
    // 가져오는 호출 (workspace timezone 을 __workspaceTimezone 으로 주입하기 위함).
    // spec/4-nodes/3-ai/0-common.md §11.3.
    findOne: jest.fn().mockResolvedValue({
      ...mockWorkflow,
      workspace: { id: 'ws-1', settings: {} },
    }),
  };

  const mockExecutionNodeLogRepo: Record<string, jest.Mock> = {
    insert: jest.fn().mockResolvedValue({ identifiers: [{ id: '1' }] }),
    find: jest.fn().mockResolvedValue([]),
  };

  Object.assign(live, {
    mockExecutionRepo,
    mockNodeExecutionRepo,
    mockWaitingQb,
    retryClaimQb,
    mockTxManagerQuery,
  });

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ExecutionEngineService,
      StuckExecutionRecoveryService,
      AiTurnOrchestrator,
      // C-1 step3 — 엔진이 forwardRef 로 위임하는 추출 서비스 (DI 필수).
      FormInteractionService,
      ButtonInteractionService,
      // C-1 step4 — 엔진이 retry 진입점을 위임하는 추출 서비스 (DI 필수; engine
      // 생성자가 forwardRef(() => RetryTurnService) 로 의존).
      RetryTurnService,
      { provide: ENGINE_DRIVER, useExisting: ExecutionEngineService },
      BusinessMetricsService,
      ExecutionEventEmitter,
      GraphTraversalService,
      NodeHandlerRegistry,
      NodeComponentRegistry,
      ExecutionContextService,
      ErrorPolicyHandler,
      ExpressionResolverService,
      ForEachExecutor,
      LoopExecutor,
      ParallelExecutor,
      { provide: getRepositoryToken(Execution), useValue: mockExecutionRepo },
      {
        provide: getRepositoryToken(NodeExecution),
        useValue: mockNodeExecutionRepo,
      },
      { provide: getRepositoryToken(Node), useValue: mockNodeRepo },
      { provide: getRepositoryToken(Edge), useValue: mockEdgeRepo },
      { provide: getRepositoryToken(Workflow), useValue: mockWorkflowRepo },
      {
        provide: getRepositoryToken(ExecutionNodeLog),
        useValue: mockExecutionNodeLogRepo,
      },
      {
        // WARN #4 — `updateExecutionStatus(execution, status, linkedNodeExec)`
        // 가 `dataSource.transaction()` 으로 Execution + NodeExecution 두
        // save 를 묶는다. 테스트에서는 in-memory 로 callback 즉시 실행 +
        // manager.save(EntityClass, entity) 를 기존 mock 레포로 라우팅 해
        // 호출 추적을 그대로 유지한다.
        provide: getDataSourceToken(),
        useValue: {
          transaction: jest.fn(
            async (cb: (manager: unknown) => Promise<unknown>) => {
              const manager = {
                // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
                save: jest.fn(async (target: unknown, entity?: unknown) => {
                  // `manager.save(EntityClass, entity)` 형태만 사용.
                  if (target === Execution) {
                    return live.mockExecutionRepo.save(entity) as unknown;
                  }
                  if (target === NodeExecution) {
                    return live.mockNodeExecutionRepo.save(entity) as unknown;
                  }
                  return entity;
                }),
                // 짝 전이 terminal 가드(`SELECT ... FOR UPDATE`)용.
                query: live.mockTxManagerQuery,
                // ai-review WARNING #1 (2026-07-27) — `cancelParkedExecution`
                // 이 이제 이 트랜잭션 안에서 `manager.createQueryBuilder()` 를
                // 호출한다(원자화, markWebChatIdleTimeout 과 동형). 기본은
                // "적용됨"(affected:1)으로 기존 흐름을 그대로 유지한다 —
                // affected:0(가드 미스) 시나리오가 필요한 테스트는 개별로
                // `dataSource.transaction` 을 재정의한다.
                createQueryBuilder: jest.fn(() => ({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockReturnThis(),
                  setParameter: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  andWhere: jest.fn().mockReturnThis(),
                  returning: jest.fn().mockReturnThis(),
                  execute: jest.fn().mockResolvedValue({ affected: 1 }),
                })),
              };
              return cb(manager);
            },
          ),
        },
      },
      {
        // Phase 2 (workflow-resumable-execution) — BullMQ continuation-queue
        // 의 in-memory 시뮬레이션. 옛 Redis pub/sub `on(type, handler)` 등록
        // 경로는 폐기되어 `on` 은 no-op. publish 는 즉시 service 의 dispatch
        // 메서드 (applyContinuation / applyCancellation) 를 호출해 Phase 1
        // 까지의 round-trip 동등성을 유지한다. SoT: spec/5-system/4-execution-engine.md §7.4.
        provide: ContinuationBusService,
        useValue: {
          on: jest.fn(),
          publish: jest.fn(
            async (msg: {
              type: string;
              executionId: string;
              nodeExecutionId?: string;
              payload?: unknown;
            }) => {
              const nodeExecutionId = msg.nodeExecutionId ?? '__no_node_exec__';
              // service 인스턴스가 closure 외부에서 set 되므로 lazy reference.
              const resolvedService = live.resolvedService;
              if (!resolvedService) return null;
              if (msg.type === 'cancel') {
                await resolvedService.applyCancellation(msg.executionId);
              } else if (msg.type === 'continue') {
                await resolvedService.applyContinuation(
                  msg.executionId,
                  nodeExecutionId,
                  msg.payload,
                );
              } else if (msg.type === 'button_click') {
                const buttonId = (
                  msg.payload as { buttonId?: string } | undefined
                )?.buttonId;
                await resolvedService.applyContinuation(
                  msg.executionId,
                  nodeExecutionId,
                  { type: 'button_click', buttonId },
                );
              } else if (msg.type === 'ai_message') {
                const message = (
                  msg.payload as { message?: string } | undefined
                )?.message;
                await resolvedService.applyContinuation(
                  msg.executionId,
                  nodeExecutionId,
                  { type: 'ai_message', message },
                );
              } else if (msg.type === 'ai_end_conversation') {
                await resolvedService.applyContinuation(
                  msg.executionId,
                  nodeExecutionId,
                  { type: 'ai_end_conversation' },
                );
              }
              return 'jobId-stub';
            },
          ),
          acquireLock: jest.fn().mockResolvedValue(true),
          releaseLock: jest.fn().mockResolvedValue(true),
        },
      },
      {
        provide: WebsocketService,
        useValue: {
          emitExecutionEvent: jest.fn(),
          emitNodeEvent: jest.fn(),
          registerExecutionRouting: jest.fn(),
          releaseExecutionRouting: jest.fn(),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, defaultValue?: unknown) => {
            if (key === 'MAX_NODE_ITERATIONS') return 100;
            return defaultValue;
          }),
        },
      },
      {
        provide: LlmService,
        useValue: {
          resolveConfig: jest.fn(),
          chat: jest.fn(),
          embed: jest.fn(),
          hasDefaultLlmConfig: jest.fn().mockResolvedValue(false),
        },
      },
      {
        provide: RagSearchService,
        useValue: {
          search: jest.fn().mockResolvedValue([]),
          buildContext: jest.fn().mockReturnValue({ context: '', sources: [] }),
        },
      },
      {
        provide: KnowledgeBaseService,
        useValue: {
          findById: jest.fn(),
        },
      },
      {
        provide: IntegrationsService,
        useValue: {
          getForExecution: jest.fn(),
          logUsage: jest.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: McpClientService,
        useValue: {
          connect: jest.fn(),
        },
      },
      {
        provide: Cafe24ApiClient,
        useValue: {
          request: jest.fn(),
        },
      },
      {
        provide: MakeshopApiClient,
        useValue: {
          call: jest.fn(),
        },
      },
      {
        provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
        useValue: {
          add: jest.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: getQueueToken(EXECUTION_RUN_QUEUE),
        useValue: {
          // 인라인 worker 브릿지 — production 의 ExecutionRunProcessor 가 job 을
          // pick up 해 runExecutionFromQueue 를 호출하는 것을 테스트에서 동기
          // 시뮬레이션한다. execute() 가 enqueue 만 하므로, 이 브릿지가 없으면
          // 기존 execute() 테스트(실행이 돌아간다는 전제)가 전부 깨진다.
          // enqueue 자체만 검증하는 테스트는 이 구현을 mockImplementationOnce 로
          // override 해 순수 recorder 로 바꾼다.
          add: jest
            .fn()
            .mockImplementation(
              (
                _name: string,
                payload: { executionId: string; input?: unknown },
              ) => {
                // fire-and-forget — production worker 처럼 enqueue 는 즉시 반환하고
                // 실행은 background 로 진행한다. await 하면 waiting_for_input
                // (multi-turn) 테스트에서 execute() 가 wait 블로킹까지 멈춰 옛
                // fire-and-forget 타이밍이 깨진다. 테스트는 이후 continuation 을
                // 보내고 flushPromises 로 진행시킨다.
                void live.service
                  .runExecutionFromQueue(payload.executionId, payload.input)
                  .catch(() => undefined);
                return Promise.resolve();
              },
            ),
        },
      },
      // Stateless service — use the real implementation so engine hooks
      // (form/button resume) actually mutate the in-context thread, which
      // lets future ConversationThread tests assert side-effects without
      // re-mocking the service.
      ConversationThreadService,
      // workflow-resumable-execution Phase 1.2 — Graceful Shutdown 추적.
      // 단위 테스트에서는 부작용 없는 mock 으로 충분 (DB UPDATE 가 일어나지
      // 않으며 register/unregister 도 noop 으로 처리 — drain wait 없음).
      {
        provide: ShutdownStateService,
        useValue: {
          isShuttingDown: false,
          inFlightCount: 0,
          retryAfterSec: 30,
          registerInFlight: jest.fn(),
          unregisterInFlight: jest.fn(),
          onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();

  const service = module.get<ExecutionEngineService>(ExecutionEngineService);
  live.service = service;
  live.resolvedService = service;
  const aiTurnOrchestrator = module.get<AiTurnOrchestrator>(AiTurnOrchestrator);
  const formInteraction = module.get<FormInteractionService>(
    FormInteractionService,
  );
  const buttonInteraction = module.get<ButtonInteractionService>(
    ButtonInteractionService,
  );
  const retryTurnService = module.get<RetryTurnService>(RetryTurnService);
  const conversationThreadService = module.get<ConversationThreadService>(
    ConversationThreadService,
  );
  const handlerRegistry = module.get<NodeHandlerRegistry>(NodeHandlerRegistry);
  const mockWebsocketService: EngineServiceHarness['mockWebsocketService'] =
    module.get(WebsocketService);
  const mockExecutionRunQueue: EngineServiceHarness['mockExecutionRunQueue'] =
    module.get(getQueueToken(EXECUTION_RUN_QUEUE));
  const mockConfigService: EngineServiceHarness['mockConfigService'] =
    module.get(ConfigService);

  // Register mock handler (clear previous calls)
  (mockHandler.execute as jest.Mock).mockClear();
  handlerRegistry.register('test_node', mockHandler);

  return Object.assign(state, {
    service,
    aiTurnOrchestrator,
    formInteraction,
    buttonInteraction,
    retryTurnService,
    conversationThreadService,
    mockExecutionRunQueue,
    handlerRegistry,
    mockWebsocketService,
    mockConfigService,
    mockExecutionRepo,
    mockNodeExecutionRepo,
    mockNodeRepo,
    mockWaitingQb,
    retryClaimQb,
    mockEdgeRepo,
    mockWorkflowRepo,
    mockExecutionNodeLogRepo,
    mockTxManagerQuery,
  });
}
