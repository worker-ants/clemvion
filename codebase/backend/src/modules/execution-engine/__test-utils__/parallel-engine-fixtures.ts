/**
 * Parallel 통합 스펙(`containers/parallel-*.integration.spec.ts`) 공용 픽스처.
 *
 * - `useParallelEngine` · `resetEngineConfig`: 하네스 `ConfigService.get` mock 의
 *   `PARALLEL_ENGINE` 응답을 바꾸고 되돌린다.
 * - `useDoneOutputFixture`: 「done 포트 완료 출력」 describe 범위의 준비와 헬퍼다.
 *   그 describe 안에서 부르면 `beforeEach` · `afterEach` 를 그 자리에 등록한다.
 */
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
import { NodeHandler } from '../../../nodes/core/node-handler.interface';
import { mockOutput } from '../__test__/mock-output';
import {
  type EngineServiceHarness,
  defaultEngineConfig,
  flushPromises,
  workflowId,
} from './engine-service-harness';
import { graphEdge, graphNode } from './graph-fixtures';

export type ParallelEngineMode = 'v1' | 'off';

/** `PARALLEL_ENGINE` 만 `mode` 로 답하고 나머지 키는 하네스 기본 응답을 쓴다. */
export function useParallelEngine(
  mockConfigService: EngineServiceHarness['mockConfigService'],
  mode: ParallelEngineMode,
): void {
  mockConfigService.get.mockImplementation(
    (key: string, defaultValue?: unknown) => {
      if (key === 'PARALLEL_ENGINE') return mode;
      return defaultEngineConfig(key, defaultValue);
    },
  );
}

/** 호출 기록까지 지우고 하네스 기본 응답으로 되돌린다. */
export function resetEngineConfig(
  mockConfigService: EngineServiceHarness['mockConfigService'],
): void {
  mockConfigService.get.mockReset();
  mockConfigService.get.mockImplementation(defaultEngineConfig);
}

export interface DoneOutputFixture {
  /** `sink_node` 가 받은 입력. 테스트마다 비운다. */
  doneReceived: unknown[];
  /** `sink_node` 가 받은 설정(표현식을 푼 값). 테스트마다 비운다. */
  sinkConfigs: Record<string, unknown>[];
  registerHandler: (
    type: string,
    execute: (
      input: unknown,
      config: Record<string, unknown>,
    ) => Promise<unknown>,
  ) => NodeHandler;
  /** 구조화 출력 기록의 호출 인자를 호출 순서대로 돌려준다. */
  structuredWrites: () => unknown[][];
  /** `nodeId` 의 마지막 구조화 출력 기록. 없으면 `undefined`. */
  structuredOf: (nodeId: string) => Record<string, unknown> | undefined;
  /** 바깥 Parallel(`par`)의 마지막 구조화 출력 기록. */
  parallelStructured: () => Record<string, unknown> | undefined;
  /** trigger → par 뒤에 `extraNodes` · `extraEdges` 를 붙여 실행한다. */
  runGraph: (
    parallelConfig: Record<string, unknown>,
    extraNodes: Partial<Node>[],
    extraEdges: Partial<Edge>[],
  ) => Promise<void>;
  /** trigger → par → [branch_0 → a(ok), branch_1 → b(fail)] | done → sink */
  failingGraph: (failure: () => never) => {
    nodes: Partial<Node>[];
    edges: Partial<Edge>[];
  };
}

/**
 * 「done 포트 완료 출력」 describe 범위의 준비.
 *
 * 테스트마다 `PARALLEL_ENGINE=v1` 로 두고, 받은 설정을 그대로 돌려주며 `branch_0` ·
 * `branch_1` 을 여는 `parallel` 핸들러와 입력 · 설정을 모으는 `sink_node` 핸들러를
 * 등록한다. 구조화 출력 기록 스파이는 `afterEach` 에서 되돌린다.
 *
 * `harness` 는 바깥 `beforeEach` 가 만든 지금 테스트의 하네스를 돌려준다.
 */
export function useDoneOutputFixture(
  harness: () => EngineServiceHarness,
): DoneOutputFixture {
  const doneReceived: unknown[] = [];
  const sinkConfigs: Record<string, unknown>[] = [];
  let structuredSpy: jest.SpyInstance;
  let nodeOutputsSpy: jest.SpyInstance;

  // 구조화 출력 기록을 호출 순서대로 모은다. 노드 실행 완료는 `setNodeOutputs` 로 두
  // 캐시를 함께 쓰고(CLE-T-JDYHCF), 엔진 덮어쓰기는 `setStructuredOutput` 으로 쓴다.
  // 두 메서드 모두 (key, nodeId, structured, …) 순서라 앞 세 인자만 본다.
  const structuredWrites = (): unknown[][] =>
    [structuredSpy, nodeOutputsSpy]
      .flatMap((spy) =>
        spy.mock.calls.map((call: unknown[], i: number) => ({
          order: spy.mock.invocationCallOrder[i],
          call,
        })),
      )
      .sort((a, b) => a.order - b.order)
      .map(({ call }) => call);

  // 같은 노드를 여러 번 기록했으면 마지막 호출의 payload 를 돌려준다.
  const structuredOf = (nodeId: string) => {
    const calls = structuredWrites().filter(
      (call: unknown[]) => call[1] === nodeId,
    );
    return calls.length > 0
      ? (calls[calls.length - 1][2] as Record<string, unknown>)
      : undefined;
  };

  const parallelStructured = () => structuredOf('par');

  const registerHandler: DoneOutputFixture['registerHandler'] = (
    type,
    execute,
  ) => {
    const handler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(execute) as NodeHandler['execute'],
    };
    harness().handlerRegistry.register(type, handler);
    return handler;
  };

  beforeEach(() => {
    const { mockConfigService, handlerRegistry, contextService } = harness();
    useParallelEngine(mockConfigService, 'v1');
    doneReceived.length = 0;
    sinkConfigs.length = 0;
    const parallelHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
      execute: jest.fn(async (_input: unknown, config) => ({
        config,
        output: null,
        port: ['branch_0', 'branch_1'],
      })),
    };
    handlerRegistry.register('parallel', parallelHandler, {
      kind: 'parallel',
    });
    const sinkHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
      execute: jest.fn(async (input: unknown, config) => {
        doneReceived.push(input);
        sinkConfigs.push(config);
        return mockOutput({ sink: true });
      }),
    };
    handlerRegistry.register('sink_node', sinkHandler);
    structuredSpy = jest.spyOn(contextService, 'setStructuredOutput');
    nodeOutputsSpy = jest.spyOn(contextService, 'setNodeOutputs');
  });

  afterEach(() => {
    structuredSpy.mockRestore();
    nodeOutputsSpy.mockRestore();
  });

  const runGraph: DoneOutputFixture['runGraph'] = async (
    parallelConfig,
    extraNodes,
    extraEdges,
  ) => {
    const { service, mockNodeRepo, mockEdgeRepo } = harness();
    mockNodeRepo.findBy.mockResolvedValue([
      graphNode('trigger', 'test_node'),
      graphNode('par', 'parallel', { branchCount: 2, ...parallelConfig }),
      ...extraNodes,
    ]);
    mockEdgeRepo.findBy.mockResolvedValue([
      graphEdge('trigger', 'out', 'par'),
      ...extraEdges,
    ]);
    await service.execute(workflowId, { start: true }, { workspaceId: 'ws-1' });
    await flushPromises();
  };

  const failingGraph: DoneOutputFixture['failingGraph'] = (failure) => {
    // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
    registerHandler('ok_node', async () => mockOutput({ ok: true }));
    // 동기로 던지지 않고 reject 하는 Promise 를 돌려주도록 async 로 둔다.
    // eslint-disable-next-line @typescript-eslint/require-await -- 원래 spec 의 async mock 을 그대로 옮겼다
    registerHandler('fail_node', async () => failure());
    return {
      nodes: [
        graphNode('a', 'ok_node'),
        graphNode('b', 'fail_node'),
        graphNode('sink', 'sink_node'),
      ],
      edges: [
        graphEdge('par', 'branch_0', 'a'),
        graphEdge('par', 'branch_1', 'b'),
        graphEdge('par', 'done', 'sink'),
      ],
    };
  };

  return {
    doneReceived,
    sinkConfigs,
    registerHandler,
    structuredWrites,
    structuredOf,
    parallelStructured,
    runGraph,
    failingGraph,
  };
}
