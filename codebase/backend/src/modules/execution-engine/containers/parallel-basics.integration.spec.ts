/**
 * ExecutionEngineService — Parallel 기본 동작 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * 병렬 분기 동시 실행과 Merge 합류, 병렬 분기 안 외부 취소, done 포트 결과 모으기,
 * 표현식 `branchCount` 평가와 [2, 16] 범위 조정을 다룬다. 완료 출력 · 노드 실행 행 ·
 * 분기 결과 · 안쪽 Parallel · 컨테이너 안 Parallel 은 같은 디렉터리의 다른
 * `parallel-*.integration.spec.ts` 에 있다.
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은
 * `__test-utils__/engine-service-harness.ts` 공용 하네스를 쓴다. describe 이름은 원래
 * 스펙과 같게 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { ExecutionEngineService } from '../execution-engine.service';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { ExecutionStatus } from '../../executions/entities/execution.entity';
import { PARALLEL_BRANCH_COUNT_MAX } from '../graph/parallel-precheck';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
import {
  ExecutionContext,
  NodeHandler,
} from '../../../nodes/core/node-handler.interface';
import { mockOutput } from '../__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  workflowId,
} from '../__test-utils__/engine-service-harness';
import { graphEdge, graphNode } from '../__test-utils__/graph-fixtures';
import {
  resetEngineConfig,
  useParallelEngine,
} from '../__test-utils__/parallel-engine-fixtures';

describe('ExecutionEngineService', () => {
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];
  let mockConfigService: EngineServiceHarness['mockConfigService'];
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockConfigService,
      mockExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = await createEngineServiceHarness());
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    beforeEach(() => {
      useParallelEngine(mockConfigService, 'v1');
    });

    afterEach(() => {
      resetEngineConfig(mockConfigService);
    });

    it('should execute branch bodies concurrently and feed Merge', async () => {
      // Branch handlers record their call order
      const executionOrder: string[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          executionOrder.push('branch');
          return mockOutput({ branchOutput: true, input });
        }),
      };
      const mergeHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          executionOrder.push('merge');
          return {
            config: { strategy: 'wait_all', outputFormat: 'array' },
            output: input,
          };
        }),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          output: input,
          port: ['branch_0', 'branch_1'],
        })),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);
      handlerRegistry.register('merge', mergeHandler);

      // Graph: Trigger -> Parallel -> [branch_0 -> A, branch_1 -> B] -> Merge
      const nodes: Partial<Node>[] = [
        graphNode('trigger', 'test_node', {}, { label: 'Trigger' }),
        graphNode(
          'parallel-1',
          'parallel',
          { branchCount: 2, maxConcurrency: 0, waitAll: true },
          { label: 'Parallel' },
        ),
        graphNode('branch-a', 'branch_node', {}, { label: 'Branch A' }),
        graphNode('branch-b', 'branch_node', {}, { label: 'Branch B' }),
        graphNode(
          'merge-1',
          'merge',
          { strategy: 'wait_all', outputFormat: 'array' },
          { label: 'Merge' },
        ),
      ];

      const edges: Partial<Edge>[] = [
        graphEdge('trigger', 'out', 'parallel-1', { id: 'e1' }),
        graphEdge('parallel-1', 'branch_0', 'branch-a', { id: 'e2' }),
        graphEdge('parallel-1', 'branch_1', 'branch-b', { id: 'e3' }),
        graphEdge('branch-a', 'out', 'merge-1', { id: 'e4' }),
        graphEdge('branch-b', 'out', 'merge-1', { id: 'e5' }),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Branch handlers both executed
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Merge executed once
      expect(mergeHandler.execute).toHaveBeenCalledTimes(1);
      // Execution order: trigger → parallel → branches → merge
      expect(executionOrder).toEqual(['branch', 'branch', 'merge']);
      // Execution completed (not failed)
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

    // ai-review C3 (2026-07-26) — §2.3 Parallel 브랜치 범위 확장.
    // `executeParallelBranchBody` 는 브랜치 내부 노드 경계마다 가드를 호출한다.
    // `maxConcurrency: 1` 로 브랜치를 직렬화(p-limit)해 호출 순서를 결정적으로
    // 만든다: branch0(A1→A2) 가 먼저 완주/중단되고, 그 뒤에야 branch1(B1) 이
    // 시작한다. 실측(2026-07-26, ForEach C3 케이스와 동일한 원인) — `findOneBy` 를
    // 사전에 call-count 로 override 하면 `execute()` → enqueue → worker 브릿지
    // 자신의 재조회가 손상된 row 를 받아 그래프 로드 자체가 조용히 실패한다.
    // "선형 경로 외부 cancel 전파" 기존 테스트와 동일하게, **A1 이 실제로 호출된
    // 뒤** override 를 지연 적용한다.
    it('브랜치 내부 노드 경계에서 외부 cancel 을 관측하면 같은 브랜치의 남은 노드도, 아직 시작 안 한 다른 브랜치도 dispatch 되지 않는다 (C3)', async () => {
      let a1Calls = 0;
      let a2Calls = 0;
      let b1Calls = 0;
      const a1Handler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          a1Calls++;
          // A1 완료 직후부터 외부 cancel 이 관측되도록 무장 — 같은 브랜치의 A2
          // 진입 가드와, 아직 시작 안 한 branch1/B1 의 진입 가드가 이걸 본다.
          mockExecutionRepo.findOneBy.mockImplementation(() =>
            Promise.resolve({
              id: executionId,
              workflowId,
              status: ExecutionStatus.CANCELLED,
              startedAt: new Date(),
            }),
          );
          return mockOutput({ step: 'a1' });
        }),
      };
      const a2Handler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          a2Calls++;
          return mockOutput({ step: 'a2' });
        }),
      };
      const b1Handler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          b1Calls++;
          return mockOutput({ step: 'b1' });
        }),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          config: { branchCount: 2, maxConcurrency: 1, waitAll: true },
          output: input,
          port: ['branch_0', 'branch_1'],
        })),
      };
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('a1_node', a1Handler);
      handlerRegistry.register('a2_node', a2Handler);
      handlerRegistry.register('b1_node', b1Handler);

      const nodes: Partial<Node>[] = [
        graphNode('trigger', 'test_node', {}, { label: 'Trigger' }),
        graphNode(
          'parallel-1',
          'parallel',
          { branchCount: 2, maxConcurrency: 1, waitAll: true },
          { label: 'Parallel' },
        ),
        graphNode('branch-a1', 'a1_node', {}, { label: 'Branch A1' }),
        graphNode('branch-a2', 'a2_node', {}, { label: 'Branch A2' }),
        graphNode('branch-b1', 'b1_node', {}, { label: 'Branch B1' }),
      ];

      const edges: Partial<Edge>[] = [
        graphEdge('trigger', 'out', 'parallel-1', { id: 'e1' }),
        graphEdge('parallel-1', 'branch_0', 'branch-a1', { id: 'e2' }),
        graphEdge('branch-a1', 'out', 'branch-a2', { id: 'e2b' }),
        graphEdge('parallel-1', 'branch_1', 'branch-b1', { id: 'e3' }),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();
      await flushPromises();

      // A1(브랜치0 첫 노드)만 실행되고, A2(같은 브랜치 다음 노드)와 B1(아직
      // 시작 안 한 다른 브랜치)은 dispatch 되지 않는다.
      expect(a1Calls).toBe(1);
      expect(a2Calls).toBe(0);
      expect(b1Calls).toBe(0);
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    it('should collect branch results on the done port', async () => {
      const doneReceived: unknown[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            branchResult: true,
            fromInput: input,
          }),
        ),
      };
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          doneReceived.push(input);
          return mockOutput({ sink: true });
        }),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          output: input,
          port: ['branch_0', 'branch_1'],
        })),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);
      handlerRegistry.register('sink_node', sinkHandler);

      // Graph: Trigger → Parallel → [branch_0→A, branch_1→B] | done → Sink
      const nodes: Partial<Node>[] = [
        graphNode('trigger', 'test_node', {}, { label: 'Trigger' }),
        graphNode(
          'par',
          'parallel',
          { branchCount: 2, maxConcurrency: 0, waitAll: true },
          { label: 'Parallel' },
        ),
        graphNode('a', 'branch_node', {}, { label: 'A' }),
        graphNode('b', 'branch_node', {}, { label: 'B' }),
        graphNode('sink', 'sink_node', {}, { label: 'Sink' }),
      ];

      const edges: Partial<Edge>[] = [
        graphEdge('trigger', 'out', 'par', { id: 'e1' }),
        graphEdge('par', 'branch_0', 'a', { id: 'e2' }),
        graphEdge('par', 'branch_1', 'b', { id: 'e3' }),
        graphEdge('par', 'done', 'sink', { id: 'e4' }),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Both branches executed
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Sink received collected results via done port
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      expect(doneReceived.length).toBe(1);
      // Stage 5 / CONVENTIONS §9.2: Parallel finalises as `{ branches, count }`.
      const received = doneReceived[0] as Record<string, unknown>;
      expect(received.branches).toBeDefined();
      expect(Array.isArray(received.branches)).toBe(true);
      expect((received.branches as unknown[]).length).toBe(2);
      expect(received.count).toBe(2);
    });

    // engine-config-bug — Parallel 의 typeof number 가드는 raw 표현식 문자열을
    // 받으면 false 가 되어 silent default fallback (branchCount=2) 으로
    // 떨어졌다. engineResolvedConfigCache 도입 이후 expression 입력이 evaluated
    // 값으로 컨테이너 동작에 도달해야 한다.
    it('engine-config-bug — uses evaluated branchCount when input is expression {{N}}', async () => {
      const branchCalls: number[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          branchCalls.push(branchCalls.length);
          return mockOutput({ ok: true });
        }),
      };
      // Use a handler that echoes raw branchCount (mirrors the real
      // ParallelHandler's Phase 3 raw-echo) so the bug surface is exercised.
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (
            input: unknown,
            config: Record<string, unknown>,
            context: ExecutionContext,
          ) => {
            const branchCount =
              typeof config.branchCount === 'number' ? config.branchCount : 2;
            const ports = Array.from(
              { length: branchCount },
              (_, i) => `branch_${i}`,
            );
            const rawConfig = context.rawConfig ?? config;
            return {
              config: {
                branchCount: rawConfig.branchCount,
                maxConcurrency: rawConfig.maxConcurrency,
                waitAll: rawConfig.waitAll,
              },
              output: input,
              port: ports,
            };
          },
        ),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);

      const nodes: Partial<Node>[] = [
        graphNode('trigger', 'test_node', {}, { label: 'Trigger' }),
        graphNode(
          'par',
          'parallel',
          { branchCount: '{{4}}', maxConcurrency: 0, waitAll: true },
          { label: 'Par' },
        ),
        ...['a', 'b', 'c', 'd'].map((id) =>
          graphNode(id, 'branch_node', {}, { label: id.toUpperCase() }),
        ),
      ];

      const edges: Partial<Edge>[] = [
        graphEdge('trigger', 'out', 'par', { id: 'e0' }),
        ...['a', 'b', 'c', 'd'].map((id, i) =>
          graphEdge('par', `branch_${i}`, id, { id: `e-par-${id}` }),
        ),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // 4 branch handler invocations — confirms branchCount={{4}} is
      // resolved to 4 BEFORE the engine's runParallel reads it (would
      // have silently defaulted to 2 prior to the fix).
      expect(branchHandler.execute).toHaveBeenCalledTimes(4);
    });

    // Boundary tests for the [PARALLEL_BRANCH_COUNT_MIN, MAX] clamp:
    // values below 2 round up, values above 16 round down. The clamp lives
    // in both the handler (port count = ports.length) and the engine
    // (runParallel branchCount); we exercise the engine path here.
    it('engine-config-bug — clamps branchCount expression to [2, 16] inclusive', async () => {
      // Force the handler to honour the engine clamp by always returning
      // 16 ports (it derives `ports.length` from `branchCount` clamped to
      // 2-16 itself), then assert the engine's view matches.
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (
            input: unknown,
            config: Record<string, unknown>,
            context: ExecutionContext,
          ) => {
            const raw = Number(config.branchCount);
            // 하한 PARALLEL_BRANCH_COUNT_MIN 은 서비스 안 상수라 export 되지 않아 값 2 로 둔다.
            const clamped = Math.max(
              2,
              Math.min(PARALLEL_BRANCH_COUNT_MAX, Math.floor(raw)),
            );
            const ports = Array.from(
              { length: clamped },
              (_, i) => `branch_${i}`,
            );
            const rawConfig = context.rawConfig ?? config;
            return {
              config: { branchCount: rawConfig.branchCount },
              output: input,
              port: ports,
            };
          },
        ),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);

      // {{20}} should clamp to 16 — wire 16 branches.
      const branchIds = Array.from(
        { length: PARALLEL_BRANCH_COUNT_MAX },
        (_, i) => `b${i}`,
      );
      const nodes: Partial<Node>[] = [
        graphNode('trigger', 'test_node', {}, { label: 'Trigger' }),
        graphNode(
          'par',
          'parallel',
          { branchCount: '{{20}}', maxConcurrency: 0, waitAll: true },
          { label: 'Par' },
        ),
        ...branchIds.map((id) => graphNode(id, 'branch_node')),
      ];
      const edges: Partial<Edge>[] = [
        graphEdge('trigger', 'out', 'par', { id: 'e-trig-par' }),
        ...branchIds.map((id, i) =>
          graphEdge('par', `branch_${i}`, id, { id: `e-par-${id}` }),
        ),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // 16 branches actually fired (clamp upper bound respected).
      expect(branchHandler.execute).toHaveBeenCalledTimes(
        PARALLEL_BRANCH_COUNT_MAX,
      );
    });
  });
});
