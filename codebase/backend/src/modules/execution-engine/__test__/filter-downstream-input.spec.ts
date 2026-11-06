/**
 * Filter 다음 노드가 실제로 받는 입력을 실측해 고정한다 (NERV Task CLE-T-4EV45V).
 *
 * 실제 엔진(`ExecutionEngineService`)과 실제 `FilterHandler` 로
 * `source → filter ─match────→ matchSink`
 *            `└─unmatched→ unmatchedSink`
 * 그래프를 돌리고 두 다음 노드가 실행되는지, 무엇을 `$input` 으로 받는지 단언한다.
 *
 * 이 파일은 측정 결과를 그대로 적은 것이다. 엔진 라우팅은 바꾸지 않는다. 결과가
 * [Filter 노드](CLE-NODE-FILTER) 의 "각 연결선은 `output.match` / `output.unmatched`
 * 하위 키를 다음 노드 입력으로 넘긴다" 와 다르면 어느 쪽을 고칠지는 NERV Task
 * CLE-T-2F5H0E 가 정한다. 엔진이나 스펙을 고치면 이 파일의 단언도 함께 바꾼다.
 *
 * `execution-engine.service.spec.ts` 의 공용 셋업은 Parallel 작업과 겹치지 않게
 * 쓰지 않고, 이 측정에 필요한 의존성만 따로 묶었다.
 */
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ExecutionEngineService } from '../execution-engine.service';
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
import { ExecutionEventEmitter } from '../events/execution-event-emitter.service';
import { GraphTraversalService } from '../graph/graph-traversal.service';
import { ContinuationBusService } from '../continuation/continuation-bus.service';
import { ConversationThreadService } from '../conversation-thread/conversation-thread.service';
import { ShutdownStateService } from '../shutdown/shutdown-state.service';
import { ExecutionNodeLog } from '../entities/execution-node-log.entity';
import { BACKGROUND_EXECUTION_QUEUE } from '../queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from '../queues/execution-run.queue';
import { BusinessMetricsService } from '../../metrics/business-metrics.service';
import { WebsocketService } from '../../websocket/websocket.service';
import { LlmService } from '../../llm/llm.service';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import { NodeExecution } from '../../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { Edge, EdgeType } from '../../edges/entities/edge.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import { FilterHandler } from '../../../nodes/logic/filter/filter.handler';
import { mockOutput } from './mock-output';

const workflowId = 'wf-filter';
const executionId = 'exec-filter';

type SinkCall = { input: unknown; config: Record<string, unknown> };

const node = (
  id: string,
  type: string,
  category: NodeCategory,
  config: Record<string, unknown> = {},
): Partial<Node> => ({
  id,
  workflowId,
  type,
  category,
  label: id,
  config,
  isDisabled: false,
  containerId: undefined,
  toolOwnerId: undefined,
});

const edge = (
  source: string,
  sourcePort: string,
  target: string,
): Partial<Edge> => ({
  id: `${source}.${sourcePort}->${target}`,
  workflowId,
  sourceNodeId: source,
  sourcePort,
  targetNodeId: target,
  targetPort: 'in',
  type: EdgeType.DATA,
});

describe('Filter 다음 노드가 받는 입력 (CLE-T-4EV45V 실측)', () => {
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let emitExecutionEvent: jest.Mock;
  let mockNodeRepo: { findBy: jest.Mock; findOneBy: jest.Mock };
  let mockEdgeRepo: { findBy: jest.Mock };
  let sourceItems: unknown;
  let matchCalls: SinkCall[];
  let unmatchedCalls: SinkCall[];

  beforeEach(async () => {
    let lastSaved: Partial<Execution> = {
      id: executionId,
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: {},
      startedAt: new Date(),
    };
    const mockExecutionRepo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
      })),
      manager: {
        transaction: jest.fn(async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([{ id: 'x' }]) }),
        ),
      },
      create: jest.fn().mockReturnValue({ ...lastSaved }),
      save: jest.fn((entity: Partial<Execution>) => {
        lastSaved = { ...lastSaved, ...entity };
        return Promise.resolve(lastSaved);
      }),
      findOneBy: jest.fn(() => Promise.resolve({ ...lastSaved })),
      findOne: jest.fn(() => Promise.resolve({ ...lastSaved })),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([{ id: executionId }]),
    };
    const mockNodeExecutionRepo = {
      create: jest.fn((data: Partial<NodeExecution>) => ({
        id: `ne-${data.nodeId}`,
        ...data,
        startedAt: new Date(),
      })),
      save: jest.fn((entity: Partial<NodeExecution>) =>
        Promise.resolve(entity),
      ),
      findOne: jest.fn(({ where }: { where: { nodeId: string } }) =>
        Promise.resolve({
          id: `ne-${where.nodeId}`,
          executionId,
          nodeId: where.nodeId,
          startedAt: new Date(),
        }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };
    mockNodeRepo = {
      findBy: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    mockEdgeRepo = { findBy: jest.fn() };
    const mockWorkflow = {
      id: workflowId,
      name: 'Filter downstream',
      isActive: true,
      workspaceId: 'ws-1',
    };
    emitExecutionEvent = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        ExecutionEngineService,
        AiTurnOrchestrator,
        FormInteractionService,
        ButtonInteractionService,
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
        ConversationThreadService,
        { provide: getRepositoryToken(Execution), useValue: mockExecutionRepo },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: mockNodeExecutionRepo,
        },
        { provide: getRepositoryToken(Node), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Edge), useValue: mockEdgeRepo },
        {
          provide: getRepositoryToken(Workflow),
          useValue: {
            findOneBy: jest.fn().mockResolvedValue(mockWorkflow),
            findOne: jest.fn().mockResolvedValue({
              ...mockWorkflow,
              workspace: { id: 'ws-1', settings: {} },
            }),
          },
        },
        {
          provide: getRepositoryToken(ExecutionNodeLog),
          useValue: {
            insert: jest.fn().mockResolvedValue({ identifiers: [] }),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn(
              async (cb: (manager: unknown) => Promise<unknown>) =>
                cb({
                  save: jest.fn(async (target: unknown, entity?: unknown) => {
                    if (target === Execution) {
                      return mockExecutionRepo.save(entity as Execution);
                    }
                    if (target === NodeExecution) {
                      return mockNodeExecutionRepo.save(
                        entity as NodeExecution,
                      );
                    }
                    return entity;
                  }),
                  query: jest.fn().mockResolvedValue([{ id: executionId }]),
                }),
            ),
          },
        },
        {
          provide: ContinuationBusService,
          useValue: {
            on: jest.fn(),
            publish: jest.fn().mockResolvedValue('jobId-stub'),
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: WebsocketService,
          useValue: {
            emitExecutionEvent,
            emitNodeEvent: jest.fn(),
            registerExecutionRouting: jest.fn(),
            releaseExecutionRouting: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, defaultValue?: unknown) => defaultValue,
            ),
          },
        },
        {
          provide: LlmService,
          useValue: { hasDefaultLlmConfig: jest.fn().mockResolvedValue(false) },
        },
        {
          provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
        {
          // execute() 는 enqueue 만 한다. 운영의 worker 처럼 바로 이어 실행한다.
          provide: getQueueToken(EXECUTION_RUN_QUEUE),
          useValue: {
            add: jest.fn(
              (
                _name: string,
                payload: { executionId: string; input?: unknown },
              ) => {
                void service
                  .runExecutionFromQueue(payload.executionId, payload.input)
                  .catch(() => undefined);
                return Promise.resolve();
              },
            ),
          },
        },
        {
          provide: ShutdownStateService,
          useValue: {
            isShuttingDown: false,
            inFlightCount: 0,
            retryAfterSec: 30,
            registerInFlight: jest.fn(),
            unregisterInFlight: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ExecutionEngineService);
    handlerRegistry = module.get(NodeHandlerRegistry);

    sourceItems = [];
    matchCalls = [];
    unmatchedCalls = [];
    handlerRegistry.register('filter', new FilterHandler());
    handlerRegistry.register('items_source', {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(() =>
        Promise.resolve(mockOutput({ items: sourceItems })),
      ),
    });
    const registerSink = (type: string, calls: SinkCall[]) =>
      handlerRegistry.register(type, {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn((input: unknown, config: Record<string, unknown>) => {
          calls.push({ input, config });
          return Promise.resolve(mockOutput({ sink: true }));
        }),
      });
    registerSink('match_sink', matchCalls);
    registerSink('unmatched_sink', unmatchedCalls);
  });

  // 다음 노드 설정에 표현식을 넣어 엔진이 그 노드에 무엇을 보여 주는지도 함께 잰다.
  const sinkConfig = {
    viaInput: '{{ $input }}',
    viaNodeMatch: '{{ $node["filter"].output.match }}',
    viaNodeUnmatched: '{{ $node["filter"].output.unmatched }}',
    viaNodePort: '{{ $node["filter"].port }}',
  };

  const waitForTerminalEvent = async () => {
    const deadline = Date.now() + 5_000;
    const terminal = () =>
      emitExecutionEvent.mock.calls.some(
        ([, type]) =>
          type === 'execution.completed' || type === 'execution.failed',
      );
    while (!terminal() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  const runFilterGraph = async (items: unknown) => {
    sourceItems = items;
    mockNodeRepo.findBy.mockResolvedValue([
      node('source', 'items_source', NodeCategory.TRIGGER),
      node('filter', 'filter', NodeCategory.LOGIC, {
        inputField: 'items',
        conditions: [{ field: 'ok', operator: 'eq', value: true }],
        combineMode: 'and',
        strictComparison: true,
      }),
      node('m', 'match_sink', NodeCategory.LOGIC, sinkConfig),
      node('u', 'unmatched_sink', NodeCategory.LOGIC, sinkConfig),
    ]);
    mockEdgeRepo.findBy.mockResolvedValue([
      edge('source', 'out', 'filter'),
      edge('filter', 'match', 'm'),
      edge('filter', 'unmatched', 'u'),
    ]);
    await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
    await waitForTerminalEvent();
    expect(emitExecutionEvent).toHaveBeenCalledWith(
      executionId,
      'execution.completed',
      expect.anything(),
    );
  };

  const alice = { name: 'alice', ok: true };
  const bob = { name: 'bob', ok: false };
  const carol = { name: 'carol', ok: true };

  it.each([
    ['항목이 섞였을 때', [alice, bob, carol], [alice, carol], [bob]],
    ['입력 배열이 비었을 때', [], [], []],
    ['모든 항목이 맞을 때', [alice, carol], [alice, carol], []],
    ['모든 항목이 맞지 않을 때', [bob], [], [bob]],
  ])(
    '%s 두 다음 노드가 모두 한 번씩 실행되고 $input 으로 match · unmatched 를 함께 담은 객체를 받는다',
    async (_label, items, expectedMatch, expectedUnmatched) => {
      await runFilterGraph(items);

      // Filter 는 `port` 를 돌려주지 않아 `_selectedPort` 가 없다. 그래서 엔진은
      // 두 연결선을 모두 열고, 결과가 빈 배열이어도 다음 노드를 건너뛰지 않는다.
      expect(matchCalls).toHaveLength(1);
      expect(unmatchedCalls).toHaveLength(1);

      // 연결선의 sourcePort 와 상관없이 두 다음 노드는 같은 값을 받는다. 그 값은
      // Filter `output` 전체이고 `output.match` / `output.unmatched` 하위 키가 아니다.
      const whole = { match: expectedMatch, unmatched: expectedUnmatched };
      expect(matchCalls[0].input).toEqual(whole);
      expect(unmatchedCalls[0].input).toEqual(whole);

      // 다음 노드 설정의 표현식도 같다. 하위 키는 `$node["filter"]` 로 읽어야 한다.
      for (const call of [matchCalls[0], unmatchedCalls[0]]) {
        expect(call.config.viaInput).toEqual(whole);
        expect(call.config.viaNodeMatch).toEqual(expectedMatch);
        expect(call.config.viaNodeUnmatched).toEqual(expectedUnmatched);
      }
    },
  );

  it('Filter 의 $node["filter"].port 는 비어 있다 (port 를 돌려주지 않는다)', async () => {
    await runFilterGraph([alice, bob]);

    expect(matchCalls).toHaveLength(1);
    expect(matchCalls[0].config.viaNodePort).toBeNull();
    expect(unmatchedCalls[0].config.viaNodePort).toBeNull();
  });

  it('inputField 가 null 로 해석되면 두 다음 노드가 모두 빈 match · unmatched 를 받는다', async () => {
    await runFilterGraph(null);

    const empty = { match: [], unmatched: [] };
    expect(matchCalls).toHaveLength(1);
    expect(unmatchedCalls).toHaveLength(1);
    expect(matchCalls[0].input).toEqual(empty);
    expect(unmatchedCalls[0].input).toEqual(empty);
  });
});
