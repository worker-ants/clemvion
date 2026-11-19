/**
 * ExecutionEngineService — Parallel 컨테이너 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은 두 스펙이
 * `__test-utils__/engine-service-harness.ts` 공용 하네스를 같이 쓴다. 최상위 describe 이름은
 * 원래 스펙과 같게 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { BackgroundExecutionJob } from '../queues/background-execution.queue';
import { ExecutionEngineService } from '../execution-engine.service';
import { ExecutionCancelledError } from '../workflow-errors';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { ExecutionContextService } from '../context/execution-context.service';
import { ParallelExecutor } from './parallel-executor';
import { ExecutionStatus } from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { Edge, EdgeType } from '../../edges/entities/edge.entity';
import {
  ExecutionContext,
  NodeHandler,
  ParallelBranchContext,
} from '../../../nodes/core/node-handler.interface';
import { mockOutput } from '../__test__/mock-output';
import { ForEachHandler } from '../../../nodes/logic/foreach/foreach.handler';
import { BackgroundHandler } from '../../../nodes/logic/background/background.handler';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  withWorkspace,
  workflowId,
} from '../__test-utils__/engine-service-harness';

describe('ExecutionEngineService', () => {
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];
  let mockConfigService: { get: jest.Mock };
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockConfigService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = await createEngineServiceHarness());
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    afterEach(() => {
      mockConfigService.get.mockReset();
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );
    });

    it('should execute branch bodies concurrently and feed Merge', async () => {
      // Override ConfigService to enable parallel engine
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

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
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'parallel-1',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'merge-1',
          workflowId,
          type: 'merge',
          category: NodeCategory.LOGIC,
          label: 'Merge',
          config: { strategy: 'wait_all', outputFormat: 'array' },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'parallel-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_0',
          targetNodeId: 'branch-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_1',
          targetNodeId: 'branch-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e4',
          workflowId,
          sourceNodeId: 'branch-a',
          sourcePort: 'out',
          targetNodeId: 'merge-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e5',
          workflowId,
          sourceNodeId: 'branch-b',
          sourcePort: 'out',
          targetNodeId: 'merge-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
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
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

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
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'parallel-1',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 1, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-a1',
          workflowId,
          type: 'a1_node',
          category: NodeCategory.LOGIC,
          label: 'Branch A1',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-a2',
          workflowId,
          type: 'a2_node',
          category: NodeCategory.LOGIC,
          label: 'Branch A2',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-b1',
          workflowId,
          type: 'b1_node',
          category: NodeCategory.LOGIC,
          label: 'Branch B1',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'parallel-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_0',
          targetNodeId: 'branch-a1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2b',
          workflowId,
          sourceNodeId: 'branch-a1',
          sourcePort: 'out',
          targetNodeId: 'branch-a2',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_1',
          targetNodeId: 'branch-b1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
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
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

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
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'par',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'Sink',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'branch_0',
          targetNodeId: 'a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'branch_1',
          targetNodeId: 'b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e4',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
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
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

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
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'par',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Par',
          config: { branchCount: '{{4}}', maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        ...['a', 'b', 'c', 'd'].map((id) => ({
          id,
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: id.toUpperCase(),
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        })),
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e0',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        ...['a', 'b', 'c', 'd'].map((id, i) => ({
          id: `e-par-${id}`,
          workflowId,
          sourceNodeId: 'par',
          sourcePort: `branch_${i}`,
          targetNodeId: id,
          targetPort: 'in',
          type: EdgeType.DATA,
        })),
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
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

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
            const clamped = Math.max(2, Math.min(16, Math.floor(raw)));
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
      const branchIds = Array.from({ length: 16 }, (_, i) => `b${i}`);
      const nodes: Partial<Node>[] = [
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'par',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Par',
          config: { branchCount: '{{20}}', maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        ...branchIds.map((id) => ({
          id,
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: id,
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        })),
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-trig-par',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        ...branchIds.map((id, i) => ({
          id: `e-par-${id}`,
          workflowId,
          sourceNodeId: 'par',
          sourcePort: `branch_${i}`,
          targetNodeId: id,
          targetPort: 'in',
          type: EdgeType.DATA,
        })),
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
      expect(branchHandler.execute).toHaveBeenCalledTimes(16);
    });

    // CLE-NODE-PARALLEL v3 (CLE-T-2HD471) — 완료 출력 `{ branches, count, skipped? }`
    // 와 `port: 'done'`(단일 문자열). 실패한 병렬 분기 자리는 `null`, 실패 정보는
    // `skipped[{ index, error: { code, message } }]` (REQ-PARALLEL-012 · 017 · 029).
    describe('done 포트 완료 출력 (CLE-NODE-PARALLEL v3)', () => {
      const pNode = (
        id: string,
        type: string,
        config: Record<string, unknown> = {},
      ): Partial<Node> => ({
        id,
        workflowId,
        type,
        category:
          type === 'test_node' ? NodeCategory.TRIGGER : NodeCategory.LOGIC,
        label: id,
        config,
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      });
      const pEdge = (
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

      let doneReceived: unknown[];
      let sinkConfigs: Record<string, unknown>[];
      let structuredSpy: jest.SpyInstance;

      const parallelStructured = () => {
        const calls = structuredSpy.mock.calls.filter(
          (call: unknown[]) => call[1] === 'par',
        );
        return calls.length > 0
          ? (calls[calls.length - 1][2] as Record<string, unknown>)
          : undefined;
      };

      const registerHandler = (
        type: string,
        execute: (input: unknown) => Promise<unknown>,
      ) => {
        const handler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(execute) as NodeHandler['execute'],
        };
        handlerRegistry.register(type, handler);
        return handler;
      };

      beforeEach(() => {
        mockConfigService.get.mockImplementation(
          (key: string, defaultValue?: unknown) => {
            if (key === 'PARALLEL_ENGINE') return 'v1';
            if (key === 'MAX_NODE_ITERATIONS') return 100;
            return defaultValue;
          },
        );
        doneReceived = [];
        sinkConfigs = [];
        const parallelHandler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
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
          execute: jest.fn(async (input: unknown, config) => {
            doneReceived.push(input);
            sinkConfigs.push(config);
            return mockOutput({ sink: true });
          }),
        };
        handlerRegistry.register('sink_node', sinkHandler);
        const contextService = (
          service as unknown as { contextService: ExecutionContextService }
        ).contextService;
        structuredSpy = jest.spyOn(contextService, 'setStructuredOutput');
      });

      afterEach(() => {
        structuredSpy.mockRestore();
      });

      const runGraph = async (
        parallelConfig: Record<string, unknown>,
        extraNodes: Partial<Node>[],
        extraEdges: Partial<Edge>[],
      ) => {
        mockNodeRepo.findBy.mockResolvedValue([
          pNode('trigger', 'test_node'),
          pNode('par', 'parallel', { branchCount: 2, ...parallelConfig }),
          ...extraNodes,
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          pEdge('trigger', 'out', 'par'),
          ...extraEdges,
        ]);
        await service.execute(
          workflowId,
          { start: true },
          { workspaceId: 'ws-1' },
        );
        await flushPromises();
      };

      // trigger → par → [branch_0 → a(ok), branch_1 → b(fail)] | done → sink
      const failingGraph = (failure: () => never) => {
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        registerHandler('fail_node', async () => failure());
        return {
          nodes: [
            pNode('a', 'ok_node'),
            pNode('b', 'fail_node'),
            pNode('sink', 'sink_node'),
          ],
          edges: [
            pEdge('par', 'branch_0', 'a'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        };
      };

      it('continue 에서 실패한 병렬 분기 자리는 null 이고 skipped 에 { index, error: { code, message } } 가 모인다', async () => {
        const g = failingGraph(() => {
          throw new Error('notify failed');
        });
        await runGraph({ errorPolicy: 'continue' }, g.nodes, g.edges);

        expect(doneReceived).toEqual([
          {
            branches: [{ ok: true }, null],
            count: 2,
            skipped: [
              {
                index: 1,
                error: { code: 'UNKNOWN_ERROR', message: 'notify failed' },
              },
            ],
          },
        ]);
        expect(parallelStructured()).toEqual(
          expect.objectContaining({
            output: {
              branches: [{ ok: true }, null],
              count: 2,
              skipped: [
                {
                  index: 1,
                  error: { code: 'UNKNOWN_ERROR', message: 'notify failed' },
                },
              ],
            },
            port: 'done',
          }),
        );
      });

      // CLE-T-REC4X3 — 공용 규칙(`containers/iteration-error-code.ts`). 백엔드가 싣는 code 는 그대로 나간다.
      it('skipped[].error.code 는 백엔드가 실은 code 이고 Error 가 아닌 값을 던지면 UNKNOWN_ERROR 다', async () => {
        class LimitedError extends Error {
          readonly code = 'MAKESHOP_RATE_LIMITED';
        }
        let call = 0;
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        registerHandler('fail_node', async () => {
          call += 1;
          if (call === 1) throw new LimitedError('custom');
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally exercises the non-Error branch (executor coerces to UNKNOWN_ERROR)
          throw 'plain string failure';
        });
        await runGraph(
          { errorPolicy: 'continue', branchCount: 3 },
          [
            pNode('a', 'ok_node'),
            pNode('b', 'fail_node'),
            pNode('c', 'fail_node'),
            pNode('sink', 'sink_node'),
          ],
          [
            pEdge('par', 'branch_0', 'a'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'branch_2', 'c'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        const received = doneReceived[0] as {
          branches: unknown[];
          count: number;
          skipped: { index: number; error: Record<string, unknown> }[];
        };
        expect(received.branches).toEqual([{ ok: true }, null, null]);
        expect(received.count).toBe(3);
        // index 오름차순. error 는 code · message 두 필드만 싣는다(스택 · 원본 객체 없음).
        expect(received.skipped.map((s) => s.index)).toEqual([1, 2]);
        const codes = received.skipped.map((s) => s.error.code).sort();
        expect(codes).toEqual(['MAKESHOP_RATE_LIMITED', 'UNKNOWN_ERROR']);
        for (const s of received.skipped) {
          expect(Object.keys(s.error).sort()).toEqual(['code', 'message']);
        }
        expect(
          received.skipped.find((s) => s.error.code === 'UNKNOWN_ERROR')?.error
            .message,
        ).toBe('plain string failure');
      });

      it('실패한 병렬 분기가 없으면 skipped 키를 싣지 않는다 (REQ-PARALLEL-029)', async () => {
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        await runGraph(
          { errorPolicy: 'continue' },
          [
            pNode('a', 'ok_node'),
            pNode('b', 'ok_node'),
            pNode('sink', 'sink_node'),
          ],
          [
            pEdge('par', 'branch_0', 'a'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        expect(doneReceived).toHaveLength(1);
        expect(doneReceived[0]).not.toHaveProperty('skipped');
        expect(doneReceived[0]).toEqual({
          branches: [{ ok: true }, { ok: true }],
          count: 2,
        });
        const structured = parallelStructured();
        expect(structured?.output).not.toHaveProperty('skipped');
        expect(structured?.port).toBe('done');
        expect(structured).not.toHaveProperty('meta');
      });

      it.each(['stop', 'cancel-others-on-fail'])(
        'errorPolicy=%s 면 병렬 분기 실패 때 done 포트를 거치지 않는다',
        async (errorPolicy) => {
          const g = failingGraph(() => {
            throw new Error('notify failed');
          });
          await runGraph({ errorPolicy }, g.nodes, g.edges);

          expect(doneReceived).toHaveLength(0);
          expect(parallelStructured()?.port).not.toBe('done');
        },
      );

      // CLE-T-JXD0W5 — Parallel 행도 done 포트 완료 출력 · 노드 전체 실행 시간으로 한 번만
      // COMPLETED 가 되고, 분기 실패(stop · cancel-others-on-fail)면 FAILED 로 끝난다.
      describe('Parallel 노드 실행 행 (CLE-T-JXD0W5)', () => {
        let savedRows: Partial<NodeExecution>[];

        beforeEach(() => {
          savedRows = [];
          mockNodeExecutionRepo.save.mockImplementation(
            (entity: Partial<NodeExecution>) => {
              savedRows.push({ ...entity });
              return Promise.resolve(entity);
            },
          );
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        const parRows = (status: NodeExecutionStatus) =>
          savedRows.filter((r) => r.nodeId === 'par' && r.status === status);
        const parEvents = (eventType: string) =>
          mockWebsocketService.emitNodeEvent.mock.calls.filter(
            (c) => c[1] === 'par' && c[2] === eventType,
          );

        it('완료 출력 { config, output: { branches, count }, port: done } 와 전체 실행 시간으로 COMPLETED 를 한 번 저장한다', async () => {
          const clockStart = Date.UTC(2026, 10, 15, 0, 0, 0);
          jest.useFakeTimers({
            now: clockStart,
            doNotFake: [
              'hrtime',
              'nextTick',
              'performance',
              'queueMicrotask',
              'setImmediate',
              'clearImmediate',
              'setInterval',
              'clearInterval',
              'setTimeout',
              'clearTimeout',
            ],
          });
          let branchDoneAt = 0;
          registerHandler('slow_ok_node', () => {
            // 분기가 시계를 1초 민다. 시작 시점에 쟀다면 실행 시간이 0 이다.
            jest.setSystemTime(Date.now() + 1000);
            branchDoneAt = Date.now();
            return Promise.resolve(mockOutput({ ok: true }));
          });
          await runGraph(
            {},
            [
              pNode('a', 'slow_ok_node'),
              pNode('b', 'slow_ok_node'),
              pNode('sink', 'sink_node'),
            ],
            [
              pEdge('par', 'branch_0', 'a'),
              pEdge('par', 'branch_1', 'b'),
              pEdge('par', 'done', 'sink'),
            ],
          );

          const completed = parRows(NodeExecutionStatus.COMPLETED);
          expect(completed).toHaveLength(1);
          expect(completed[0].outputData).toEqual({
            config: expect.objectContaining({ branchCount: 2 }),
            output: { branches: [{ ok: true }, { ok: true }], count: 2 },
            port: 'done',
          });
          expect(completed[0].finishedAt!.getTime()).toBe(branchDoneAt);
          expect(completed[0].durationMs).toBe(branchDoneAt - clockStart);
          const events = parEvents('execution.node.completed');
          expect(events).toHaveLength(1);
          expect(events[0][3]).toEqual(
            expect.objectContaining({
              output: completed[0].outputData,
              duration: completed[0].durationMs,
            }),
          );
        });

        it.each(['stop', 'cancel-others-on-fail'])(
          'errorPolicy=%s 분기 실패면 Parallel 행을 FAILED 로 마감하고 completed 이벤트를 보내지 않는다',
          async (errorPolicy) => {
            const g = failingGraph(() => {
              throw new Error('notify failed');
            });
            await runGraph({ errorPolicy }, g.nodes, g.edges);

            expect(parRows(NodeExecutionStatus.COMPLETED)).toHaveLength(0);
            const failed = parRows(NodeExecutionStatus.FAILED);
            expect(failed).toHaveLength(1);
            expect(failed[0].id).toBe('ne-par');
            expect(parEvents('execution.node.completed')).toHaveLength(0);
            expect(parEvents('execution.node.failed')).toHaveLength(1);
          },
        );

        it('PARALLEL_ENGINE=off 되돌림 경로는 핸들러 반환값으로 COMPLETED 를 한 번 저장하고 completed 이벤트를 한 번 보낸다', async () => {
          mockConfigService.get.mockImplementation(
            (key: string, defaultValue?: unknown) => {
              if (key === 'PARALLEL_ENGINE') return 'off';
              if (key === 'MAX_NODE_ITERATIONS') return 100;
              return defaultValue;
            },
          );
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runGraph(
            {},
            [
              pNode('a', 'ok_node'),
              pNode('b', 'ok_node'),
              pNode('sink', 'sink_node'),
            ],
            [
              pEdge('par', 'branch_0', 'a'),
              pEdge('par', 'branch_1', 'b'),
              pEdge('par', 'done', 'sink'),
            ],
          );

          const completed = parRows(NodeExecutionStatus.COMPLETED);
          expect(completed).toHaveLength(1);
          // 완료 출력(branches · count)은 v1 경로만 만든다.
          expect(JSON.stringify(completed[0].outputData)).not.toContain(
            'branches',
          );
          expect(parRows(NodeExecutionStatus.FAILED)).toHaveLength(0);
          expect(parEvents('execution.node.completed')).toHaveLength(1);
        });

        it('Parallel 실행 중 외부 취소면 Parallel 행을 CANCELLED 로 마감하고 cancelled 이벤트를 보낸다', async () => {
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          const executor = (
            service as unknown as { parallelExecutor: ParallelExecutor }
          ).parallelExecutor;
          const executeSpy = jest
            .spyOn(executor, 'execute')
            .mockRejectedValue(new ExecutionCancelledError());
          try {
            await runGraph(
              {},
              [
                pNode('a', 'ok_node'),
                pNode('b', 'ok_node'),
                pNode('sink', 'sink_node'),
              ],
              [
                pEdge('par', 'branch_0', 'a'),
                pEdge('par', 'branch_1', 'b'),
                pEdge('par', 'done', 'sink'),
              ],
            );
          } finally {
            executeSpy.mockRestore();
          }

          expect(parRows(NodeExecutionStatus.CANCELLED)).toHaveLength(1);
          expect(parRows(NodeExecutionStatus.FAILED)).toHaveLength(0);
          expect(parRows(NodeExecutionStatus.COMPLETED)).toHaveLength(0);
          expect(parEvents('execution.node.cancelled')).toHaveLength(1);
          expect(parEvents('execution.node.completed')).toHaveLength(0);
        });

        it('continue 정책의 분기 실패는 Parallel 행을 done 완료 출력으로 COMPLETED 저장한다', async () => {
          const g = failingGraph(() => {
            throw new Error('notify failed');
          });
          await runGraph({ errorPolicy: 'continue' }, g.nodes, g.edges);

          const completed = parRows(NodeExecutionStatus.COMPLETED);
          expect(completed).toHaveLength(1);
          expect(
            (completed[0].outputData as { output: Record<string, unknown> })
              .output,
          ).toEqual(
            expect.objectContaining({
              branches: [{ ok: true }, null],
              count: 2,
            }),
          );
          expect(parRows(NodeExecutionStatus.FAILED)).toHaveLength(0);
        });
      });

      it('_selectedPort 와 port 는 done 문자열이고 branches[i] 에 엔진 제어 필드가 없다', async () => {
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        const contextService = (
          service as unknown as { contextService: ExecutionContextService }
        ).contextService;
        const createSpy = jest.spyOn(contextService, 'createContext');
        try {
          await runGraph(
            {},
            [
              pNode('a', 'ok_node'),
              pNode('b', 'ok_node'),
              pNode('sink', 'sink_node'),
            ],
            [
              pEdge('par', 'branch_0', 'a'),
              pEdge('par', 'branch_1', 'b'),
              pEdge('par', 'done', 'sink'),
            ],
          );
          const rootContext = createSpy.mock.results[0]?.value as {
            nodeOutputCache: Record<string, Record<string, unknown>>;
          };
          expect(rootContext.nodeOutputCache.par._selectedPort).toBe('done');
          // 분기 노드는 done 포트 뒤에 다시 실행되지 않는다(문자열 _selectedPort 가
          // branch_N 연결선을 막는다).
          expect(doneReceived).toHaveLength(1);
        } finally {
          createSpy.mockRestore();
        }
        const branches = (doneReceived[0] as { branches: unknown[] }).branches;
        for (const b of branches) {
          expect(b).not.toHaveProperty('_selectedPort');
        }
        expect(parallelStructured()?.port).toBe('done');
      });

      // 분기 마지막 노드가 배열을 port 와 함께 돌려주면 branches[i] 는 엔진 봉투가 아니라
      // 그 배열이다. done 문자열 포트는 그대로다(NERV Task CLE-T-T30D5S · CLE-T-2HD471).
      it('분기 결과가 배열이면 branches[i] 는 그 배열이고 port 는 done 문자열이다', async () => {
        registerHandler('array_node', async () => ({
          config: {},
          output: [1, 2],
          port: 'success',
        }));
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        const contextService = (
          service as unknown as { contextService: ExecutionContextService }
        ).contextService;
        const createSpy = jest.spyOn(contextService, 'createContext');
        let rootPort: unknown;
        try {
          await runGraph(
            {},
            [
              pNode('a', 'array_node'),
              pNode('b', 'ok_node'),
              pNode('sink', 'sink_node', {
                first: '{{ $node["par"].output.branches[0] }}',
              }),
            ],
            [
              pEdge('par', 'branch_0', 'a'),
              pEdge('par', 'branch_1', 'b'),
              pEdge('par', 'done', 'sink'),
            ],
          );
          const rootContext = createSpy.mock.results[0]?.value as {
            nodeOutputCache: Record<string, Record<string, unknown>>;
          };
          rootPort = rootContext.nodeOutputCache.par._selectedPort;
        } finally {
          createSpy.mockRestore();
        }

        expect(rootPort).toBe('done');
        expect(parallelStructured()?.port).toBe('done');
        expect(doneReceived).toHaveLength(1);
        expect(doneReceived[0]).toEqual({
          branches: [[1, 2], { ok: true }],
          count: 2,
        });
        expect(sinkConfigs[0]).toEqual(
          expect.objectContaining({ first: [1, 2] }),
        );
      });

      it('done 뒤 노드의 표현식이 branches[0].<필드> 와 port 를 읽는다', async () => {
        registerHandler('ok_node', async () => mockOutput({ ok: true, n: 7 }));
        await runGraph(
          {},
          [
            pNode('a', 'ok_node'),
            pNode('b', 'ok_node'),
            pNode('sink', 'sink_node', {
              picked: '{{ $node["par"].output.branches[0].n }}',
              port: '{{ $node["par"].port }}',
            }),
          ],
          [
            pEdge('par', 'branch_0', 'a'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        expect(sinkConfigs).toHaveLength(1);
        expect(sinkConfigs[0]).toEqual(
          expect.objectContaining({ picked: 7, port: 'done' }),
        );
      });

      // 병렬 분기 컨텍스트는 캐시 얕은 복사본을 쓴다(REQ-PARALLEL-009). 분기 안에서
      // 방금 실행한 노드 출력이 그 사본에 보여야 다음 노드 입력과 포트 라우팅이 맞다.
      it('병렬 분기 안 다음 노드는 앞 노드 출력을 입력으로 받는다', async () => {
        const seen: Record<string, unknown> = {};
        registerHandler('first_node', async () => mockOutput({ step: 1 }));
        registerHandler('second_node', async (input) => {
          seen.second = input;
          return mockOutput({ step: 2 });
        });
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        await runGraph(
          {},
          [
            pNode('a1', 'first_node'),
            pNode('a2', 'second_node'),
            pNode('b', 'ok_node'),
            pNode('sink', 'sink_node'),
          ],
          [
            pEdge('par', 'branch_0', 'a1'),
            pEdge('a1', 'out', 'a2'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        expect(seen.second).toEqual({ step: 1 });
        expect(doneReceived[0]).toEqual({
          branches: [{ step: 2 }, { ok: true }],
          count: 2,
        });
      });

      describe('결과 노드 (REQ-PARALLEL-030)', () => {
        // branch_0 → a(ok). branch_1 은 테스트마다 다르다.
        const withBranch1 = async (
          branch1Nodes: Partial<Node>[],
          branch1Edges: Partial<Edge>[],
        ) => {
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runGraph(
            {},
            [
              pNode('a', 'ok_node'),
              ...branch1Nodes,
              pNode('sink', 'sink_node'),
            ],
            [
              pEdge('par', 'branch_0', 'a'),
              ...branch1Edges,
              pEdge('par', 'done', 'sink'),
            ],
          );
          return (doneReceived[0] as { branches: unknown[] }).branches[1];
        };

        // 앞 실행이 남긴 출력이 캐시에 있는 채로 Parallel 이 시작하는 상황(메인 그래프의
        // 되돌아가는 연결선 사이클, 재시도)을 만든다. 루트 컨텍스트의 캐시에 미리 심고
        // 병렬 분기 사본이 그 값을 그대로 들고 시작하게 한다.
        const seedRootCache = (seed: Record<string, unknown>) => {
          const contextService = (
            service as unknown as { contextService: ExecutionContextService }
          ).contextService;
          const createContext =
            contextService.createContext.bind(contextService);
          return jest
            .spyOn(contextService, 'createContext')
            .mockImplementation((...args) => {
              const created = createContext(...args);
              Object.assign(created.nodeOutputCache, seed);
              return created;
            });
        };

        it('분기 안 If 가 위상 순서상 마지막 노드를 고르지 않으면 실제로 실행된 노드의 출력을 담는다', async () => {
          // 위상 순서: cond → n-false → n-true. cond 가 false 를 고르므로 n-true 는
          // 실행되지 않고 n-false 가 결과다.
          const executed: string[] = [];
          registerHandler('cond_node', async () =>
            mockOutput({ checked: true }, { port: 'false' }),
          );
          registerHandler('mark_node', async (input) => {
            executed.push(JSON.stringify(input));
            return mockOutput({ picked: 'false-path' });
          });
          registerHandler('never_node', async () => {
            executed.push('never');
            return mockOutput({ picked: 'true-path' });
          });

          const result = await withBranch1(
            [
              pNode('cond', 'cond_node'),
              pNode('n-false', 'mark_node'),
              pNode('n-true', 'never_node'),
            ],
            [
              pEdge('par', 'branch_1', 'cond'),
              pEdge('cond', 'false', 'n-false'),
              pEdge('cond', 'true', 'n-true'),
            ],
          );

          expect(executed).toEqual([JSON.stringify({ checked: true })]);
          expect(result).toEqual({ picked: 'false-path' });
        });

        it('앞쪽 노드만 실행되면 그 노드의 출력을 담고 엔진 제어 필드는 뺀다', async () => {
          // cond 가 연결선이 없는 true 를 고르므로 뒤 노드는 실행되지 않는다.
          registerHandler('cond_node', async () =>
            mockOutput({ checked: true }, { port: 'true' }),
          );
          registerHandler('never_node', async () =>
            mockOutput({ picked: 'false-path' }),
          );

          const result = await withBranch1(
            [pNode('cond', 'cond_node'), pNode('later', 'never_node')],
            [pEdge('par', 'branch_1', 'cond'), pEdge('cond', 'false', 'later')],
          );

          expect(result).toEqual({ checked: true });
          expect(result).not.toHaveProperty('_selectedPort');
        });

        it('실행된 노드가 없으면 null 이다 (비활성 노드 · skip_node 로 건너뛴 노드)', async () => {
          registerHandler('fail_node', async () => {
            throw new Error('skipped by policy');
          });
          const disabled = { ...pNode('off', 'ok_node'), isDisabled: true };

          const result = await withBranch1(
            [
              pNode('skip', 'fail_node', {
                errorHandling: { policy: 'skip_node' },
              }),
              disabled,
            ],
            [pEdge('par', 'branch_1', 'skip'), pEdge('skip', 'out', 'off')],
          );

          expect(result).toBeNull();
          // skip_node 는 실패가 아니라 건너뜀이라 skipped 에 들어가지 않는다.
          expect(doneReceived[0]).not.toHaveProperty('skipped');
        });

        it('위상 순서상 마지막 노드가 skip_node 로 건너뛰어지면 앞서 실행된 노드의 출력을 담는다', async () => {
          // 건너뛴 노드는 출력을 남기지 않으므로 b2 가 아니라 b1 이 결과다.
          registerHandler('first_node', async () =>
            mockOutput({ first: true }),
          );
          registerHandler('fail_node', async () => {
            throw new Error('skipped by policy');
          });

          const result = await withBranch1(
            [
              pNode('b1', 'first_node'),
              pNode('b2', 'fail_node', {
                errorHandling: { policy: 'skip_node' },
              }),
            ],
            [pEdge('par', 'branch_1', 'b1'), pEdge('b1', 'out', 'b2')],
          );

          expect(result).toEqual({ first: true });
        });

        // Parallel 이 같은 실행에서 다시 실행되면 앞 실행의 출력이 캐시에 남아 있다.
        // 이번 실행이 쓴 노드만 결과로 센다.
        it('캐시에 남은 앞 실행 출력은 결과로 고르지 않는다 (이번에 건너뛴 노드)', async () => {
          registerHandler('fail_node', async () => {
            throw new Error('skipped by policy');
          });
          const seedSpy = seedRootCache({ skip: { stale: true } });
          try {
            const result = await withBranch1(
              [
                pNode('skip', 'fail_node', {
                  errorHandling: { policy: 'skip_node' },
                }),
              ],
              [pEdge('par', 'branch_1', 'skip')],
            );
            expect(result).toBeNull();
          } finally {
            seedSpy.mockRestore();
          }
        });

        it('캐시에 앞 실행 출력이 있어도 이번에 다시 실행한 노드는 새 출력을 담는다', async () => {
          registerHandler('fresh_node', async () =>
            mockOutput({ fresh: true }),
          );
          const seedSpy = seedRootCache({ b1: { stale: true } });
          try {
            const result = await withBranch1(
              [pNode('b1', 'fresh_node')],
              [pEdge('par', 'branch_1', 'b1')],
            );
            expect(result).toEqual({ fresh: true });
          } finally {
            seedSpy.mockRestore();
          }
        });

        it('이번 출력이 앞 실행 출력과 같은 원시값이어도 새로 쓴 노드로 센다', async () => {
          // 객체가 아닌 출력은 캐시에 값 그대로 들어가 참조가 아니라 값이 같다.
          registerHandler('same_value_node', async () =>
            mockOutput('same-value'),
          );
          const seedSpy = seedRootCache({ b1: 'same-value' });
          try {
            const result = await withBranch1(
              [pNode('b1', 'same_value_node')],
              [pEdge('par', 'branch_1', 'b1')],
            );
            expect(result).toBe('same-value');
          } finally {
            seedSpy.mockRestore();
          }
        });

        it('use_default_output 이 앞 실행과 같은 defaultOutput 참조를 다시 써도 새로 쓴 노드로 센다', async () => {
          // defaultOutput 은 설정에 든 객체 하나라서 실패할 때마다 같은 참조가 캐시에 쓰인다.
          registerHandler('fail_node', async () => {
            throw new Error('always fails');
          });
          const defaultOutput = { fallback: true };
          const seedSpy = seedRootCache({ b1: defaultOutput });
          try {
            const result = await withBranch1(
              [
                pNode('b1', 'fail_node', {
                  errorHandling: {
                    policy: 'use_default_output',
                    defaultOutput,
                  },
                }),
              ],
              [pEdge('par', 'branch_1', 'b1')],
            );
            expect(result).toEqual({ fallback: true });
          } finally {
            seedSpy.mockRestore();
          }
        });

        it('끝나는 노드가 둘 이상 실행되면 엔진 위상 정렬 순서(같은 단계는 노드 ID 순)의 마지막 노드를 고른다', async () => {
          registerHandler('start_node', async () =>
            mockOutput({ start: true }),
          );
          registerHandler('leaf_b', async () => mockOutput({ leaf: 'n-b' }));
          registerHandler('leaf_c', async () => mockOutput({ leaf: 'n-c' }));

          const result = await withBranch1(
            [
              pNode('n-a', 'start_node'),
              pNode('n-c', 'leaf_c'),
              pNode('n-b', 'leaf_b'),
            ],
            [
              pEdge('par', 'branch_1', 'n-a'),
              pEdge('n-a', 'out', 'n-c'),
              pEdge('n-a', 'out', 'n-b'),
            ],
          );

          expect(result).toEqual({ leaf: 'n-c' });
        });
      });

      // 병렬 분기 사본에 출력을 옮기는 쓰기 지점마다 하나씩 고정한다
      // (`commitNodeOutput`: 일반 노드 · use_default_output · route_to_error_port ·
      // 분기 안 컨테이너 마감과 구조화 캐시).
      describe('분기 캐시 동기화 (REQ-PARALLEL-009)', () => {
        // branch_0 이 테스트 대상이고 branch_1 은 늘 ok 노드 하나다.
        const runBranch0 = async (
          branch0Nodes: Partial<Node>[],
          branch0Edges: Partial<Edge>[],
          parallelConfig: Record<string, unknown> = {},
        ) => {
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runGraph(
            parallelConfig,
            [
              ...branch0Nodes,
              pNode('b', 'ok_node'),
              pNode('sink', 'sink_node'),
            ],
            [
              ...branch0Edges,
              pEdge('par', 'branch_1', 'b'),
              pEdge('par', 'done', 'sink'),
            ],
          );
          return doneReceived[0] as {
            branches: unknown[];
            skipped?: {
              index: number;
              error: { code: string; message: string };
            }[];
          };
        };

        // src → fe(body → emit) → after. 본문 노드는 아이템마다 n 을 두 배로 만든다.
        const foreachBranchGraph = (withAfter: boolean) => {
          handlerRegistry.register('foreach', new ForEachHandler(), {
            kind: 'container',
          });
          registerHandler('items_node', async () =>
            mockOutput({ items: [{ n: 1 }, { n: 2 }] }),
          );
          registerHandler('double_node', async (input) =>
            mockOutput({ doubled: (input as { n: number }).n * 2 }),
          );
          return {
            nodes: [
              pNode('src', 'items_node'),
              pNode('fe', 'foreach', { arrayField: 'items' }),
              { ...pNode('body', 'double_node'), containerId: 'fe' },
              ...(withAfter ? [pNode('after', 'after_node')] : []),
            ],
            edges: [
              pEdge('par', 'branch_0', 'src'),
              pEdge('src', 'out', 'fe'),
              pEdge('fe', 'body', 'body'),
              { ...pEdge('body', 'out', 'fe'), targetPort: 'emit' },
              ...(withAfter ? [pEdge('fe', 'done', 'after')] : []),
            ],
          };
        };

        it('분기 안 ForEach 가 결과 노드면 branches[i] 에 컨테이너 최종 출력({ items, count })을 담는다', async () => {
          const g = foreachBranchGraph(false);

          const result = await runBranch0(g.nodes, g.edges);

          expect(result.branches[0]).toEqual({
            items: [{ doubled: 2 }, { doubled: 4 }],
            count: 2,
          });
        });

        it('분기 안 ForEach 의 done 뒤 노드는 컨테이너 최종 출력을 입력으로 받는다', async () => {
          const afterInputs: unknown[] = [];
          registerHandler('after_node', async (input) => {
            afterInputs.push(input);
            return mockOutput({ after: true });
          });
          const g = foreachBranchGraph(true);

          const result = await runBranch0(g.nodes, g.edges);

          // 핸들러가 처음 낸 출력({ output: null })이 아니라 마감한 출력이다.
          expect(afterInputs).toEqual([
            { items: [{ doubled: 2 }, { doubled: 4 }], count: 2 },
          ]);
          expect(result.branches[0]).toEqual({ after: true });
        });

        it('use_default_output 으로 이어진 노드는 defaultOutput 을 입력으로 받는다', async () => {
          const nextInputs: unknown[] = [];
          registerHandler('fail_node', async () => {
            throw new Error('always fails');
          });
          registerHandler('next_node', async (input) => {
            nextInputs.push(input);
            return mockOutput({ next: true });
          });

          const result = await runBranch0(
            [
              pNode('ud', 'fail_node', {
                errorHandling: {
                  policy: 'use_default_output',
                  defaultOutput: { fallback: true },
                },
              }),
              pNode('next', 'next_node'),
            ],
            [pEdge('par', 'branch_0', 'ud'), pEdge('ud', 'out', 'next')],
          );

          expect(nextInputs).toEqual([{ fallback: true }]);
          expect(result.branches[0]).toEqual({ next: true });
        });

        it('route_to_error_port 노드 뒤 노드는 에러 정보를 입력으로 받는다', async () => {
          const errorInputs: unknown[] = [];
          registerHandler('fail_node', async () => {
            throw new Error('routed failure');
          });
          registerHandler('on_error_node', async (input) => {
            errorInputs.push(input);
            return mockOutput({ handled: true });
          });

          const result = await runBranch0(
            [
              pNode('re', 'fail_node', {
                errorHandling: { policy: 'route_to_error_port' },
              }),
              pNode('on-error', 'on_error_node'),
            ],
            [pEdge('par', 'branch_0', 're'), pEdge('re', 'error', 'on-error')],
          );

          expect(errorInputs).toEqual([
            { error: { code: 'UNKNOWN_ERROR', message: 'routed failure' } },
          ]);
          expect(result.branches[0]).toEqual({ handled: true });
        });

        it('분기 안에서 실행 중에 waiting_for_input 을 내는 노드는 PARALLEL_INVALID_CHILD 로 분기를 실패시킨다', async () => {
          // 정적 검증(planParallelBody)은 메타데이터가 blocking 인 노드만 막는다. 실행해
          // 봐야 대기 상태가 되는 노드는 분기 루프의 런타임 가드가 막는다. 분기 사본에 출력이
          // 보여야 이 가드가 동작한다.
          registerHandler('waiting_node', async () =>
            mockOutput(null, { status: 'waiting_for_input' }),
          );

          const result = await runBranch0(
            [pNode('wait', 'waiting_node')],
            [pEdge('par', 'branch_0', 'wait')],
            { errorPolicy: 'continue' },
          );

          expect(result.branches).toEqual([null, { ok: true }]);
          expect(result.skipped).toEqual([
            {
              index: 0,
              error: {
                code: 'UNKNOWN_ERROR',
                message: expect.stringContaining('PARALLEL_INVALID_CHILD'),
              },
            },
          ]);
        });
      });

      it('PARALLEL_ENGINE=off 되돌림 경로는 분기를 차례로 실행하고 완료 출력을 만들지 않는다', async () => {
        mockConfigService.get.mockImplementation(
          (key: string, defaultValue?: unknown) => {
            if (key === 'PARALLEL_ENGINE') return 'off';
            if (key === 'MAX_NODE_ITERATIONS') return 100;
            return defaultValue;
          },
        );
        const executed: string[] = [];
        registerHandler('ok_node', async () => {
          executed.push('ok');
          return mockOutput({ ok: true });
        });
        await runGraph(
          {},
          [
            pNode('a', 'ok_node'),
            pNode('b', 'ok_node'),
            pNode('sink', 'sink_node'),
          ],
          [
            pEdge('par', 'branch_0', 'a'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        expect(executed).toEqual(['ok', 'ok']);
        // done 뒤 노드는 Parallel 자신의 출력을 받는다. 완료 출력(branches · count ·
        // skipped)은 v1 경로만 만든다.
        expect(doneReceived).toHaveLength(1);
        expect(doneReceived[0]).not.toHaveProperty('branches');
        expect(parallelStructured()).toMatchObject({
          output: null,
          port: ['branch_0', 'branch_1'],
        });
      });

      it('Parallel 뒤에 노드가 없어도 continue 실패가 완료 출력에 남는다', async () => {
        const g = failingGraph(() => {
          throw new Error('notify failed');
        });
        await runGraph(
          { errorPolicy: 'continue' },
          g.nodes.filter((n) => n.id !== 'sink'),
          g.edges.filter((e) => e.targetNodeId !== 'sink'),
        );

        expect(parallelStructured()?.output).toEqual({
          branches: [{ ok: true }, null],
          count: 2,
          skipped: [
            {
              index: 1,
              error: { code: 'UNKNOWN_ERROR', message: 'notify failed' },
            },
          ],
        });
      });

      it('병렬 분기 출구 노드가 같은 병렬 분기 안 노드로도 이어지면 그 노드를 메인 루프가 다시 실행하지 않는다', async () => {
        // branch_0 → x → y, x → m(합류), branch_1 → z → m. x 는 출구 노드다. 출구 노드의
        // 도달 가능성을 넘길 때 같은 병렬 분기 본문 노드 y 까지 메인 루프에 넣으면 y 가
        // 두 번 실행된다.
        const runs: string[] = [];
        for (const id of ['x', 'y', 'z', 'm']) {
          registerHandler(`${id}_node`, async () => {
            runs.push(id);
            return mockOutput({ from: id });
          });
        }
        await runGraph(
          {},
          [
            pNode('x', 'x_node'),
            pNode('y', 'y_node'),
            pNode('z', 'z_node'),
            pNode('m', 'm_node'),
          ],
          [
            pEdge('par', 'branch_0', 'x'),
            pEdge('x', 'out', 'y'),
            pEdge('x', 'out', 'm'),
            pEdge('par', 'branch_1', 'z'),
            pEdge('z', 'out', 'm'),
          ],
        );

        expect([...runs].sort()).toEqual(['m', 'x', 'y', 'z']);
      });

      // CLE-T-GGZSC2 — 병렬 분기 안의 안쪽 Parallel 도 엔진의 Parallel 실행 경로를 탄다.
      // 고치기 전에는 바깥 병렬 분기 루프가 안쪽 Parallel 의 핸들러만 실행하고 안쪽 병렬
      // 분기 노드를 자기 루프에서 차례로 실행했다. 안쪽 done 연결선은 열리지 않았고
      // 동시 실행 수 조정과 깊이 검사도 적용되지 않았다.
      describe('병렬 분기 안의 안쪽 Parallel (REQ-PARALLEL-024 · 025)', () => {
        const recordingHandlers = (ids: string[]) => {
          const runs: string[] = [];
          const inputs: Record<string, unknown> = {};
          for (const id of ids) {
            registerHandler(`${id}_node`, async (input) => {
              runs.push(id);
              inputs[id] = input;
              return mockOutput({ from: id });
            });
          }
          return { runs, inputs };
        };
        // 핸들러가 받는 실행 컨텍스트를 읽는다. 병렬 분기 안의 노드면 그 분기의 캐시
        // 사본이다. spy 는 엔진이 넘긴 인자만 보므로 캐시에 실제로 남은 값은 이렇게 읽는다.
        const registerProbe = (
          type: string,
          read: (ctx: ExecutionContext) => void,
        ) => {
          const handler: NodeHandler = {
            validate: () => ({ valid: true, errors: [] }),
            execute: jest.fn(
              async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
                read(ctx);
                return mockOutput({ probed: type });
              },
            ) as NodeHandler['execute'],
          };
          handlerRegistry.register(type, handler);
        };
        // structuredSpy 의 호출 인자는 (executionId, nodeId, payload) 순서다. 같은 노드를
        // 여러 번 기록했으면 마지막 호출의 payload 를 돌려준다.
        const structuredOf = (nodeId: string) => {
          const matched = structuredSpy.mock.calls
            .map((call: unknown[]) => {
              const [, id, payload] = call;
              return { id, payload };
            })
            .filter((call) => call.id === nodeId);
          return matched.length > 0
            ? (matched[matched.length - 1].payload as Record<string, unknown>)
            : undefined;
        };
        // par.branch_0 → par2 → [branch_0 → a, branch_1 → b], par.branch_1 → d,
        // par.done → sink 를 기본 그래프로 한다. 테스트마다 달라지는 부분만 넘긴다.
        const buildInnerParallelGraph = (
          opts: {
            innerConfig?: Record<string, unknown>;
            types?: Partial<Record<'a' | 'b' | 'd', string>>;
            extraNodes?: ReturnType<typeof pNode>[];
            extraEdges?: ReturnType<typeof pEdge>[];
          } = {},
        ) => ({
          nodes: [
            pNode('par2', 'parallel', opts.innerConfig ?? { branchCount: 2 }),
            pNode('a', opts.types?.a ?? 'a_node'),
            pNode('b', opts.types?.b ?? 'b_node'),
            pNode('d', opts.types?.d ?? 'd_node'),
            pNode('sink', 'sink_node'),
            ...(opts.extraNodes ?? []),
          ],
          edges: [
            pEdge('par', 'branch_0', 'par2'),
            pEdge('par2', 'branch_0', 'a'),
            pEdge('par2', 'branch_1', 'b'),
            pEdge('par', 'branch_1', 'd'),
            pEdge('par', 'done', 'sink'),
            ...(opts.extraEdges ?? []),
          ],
        });
        const runInnerParallelGraph = async (
          outerConfig: Record<string, unknown>,
          opts: Parameters<typeof buildInnerParallelGraph>[0] = {},
        ) => {
          const g = buildInnerParallelGraph(opts);
          await runGraph(outerConfig, g.nodes, g.edges);
        };

        it('안쪽 Parallel 이 자기 병렬 분기를 실행하고 done 포트로 완료 출력을 낸다', async () => {
          // 안쪽 done 뒤에 c 를 잇는다.
          const { runs, inputs } = recordingHandlers(['a', 'b', 'c', 'd']);
          await runInnerParallelGraph(
            {},
            {
              extraNodes: [pNode('c', 'c_node')],
              extraEdges: [pEdge('par2', 'done', 'c')],
            },
          );

          const innerDone = {
            branches: [{ from: 'a' }, { from: 'b' }],
            count: 2,
          };
          expect([...runs].sort()).toEqual(['a', 'b', 'c', 'd']);
          expect(inputs.c).toEqual(innerDone);
          expect(structuredOf('par2')).toEqual(
            expect.objectContaining({ output: innerDone, port: 'done' }),
          );
          // 바깥 병렬 분기 0 의 결과 노드는 안쪽 done 뒤의 c 다.
          expect(doneReceived).toEqual([
            { branches: [{ from: 'c' }, { from: 'd' }], count: 2 },
          ]);
        });

        it('캐시에 남은 안쪽 · 바깥 완료 출력의 구조화 출력 output 에는 라우팅 표지 _selectedPort 가 없다', async () => {
          // 평면 출력을 쓰면 구조화 출력의 output 을 그 값으로 다시 만든다. 구조화 출력을
          // 먼저 쓰면 `$node["Parallel"].output` 에 `_selectedPort` 가 섞인다.
          recordingHandlers(['a', 'b', 'd']);
          const seen: Record<string, unknown> = {};
          registerProbe('c_probe', (ctx) => {
            seen.innerInBranch = ctx.structuredOutputCache?.['par2'];
          });
          registerProbe('top_probe', (ctx) => {
            seen.innerAtRoot = ctx.structuredOutputCache?.['par2'];
            seen.outer = ctx.structuredOutputCache?.['par'];
          });
          await runInnerParallelGraph(
            {},
            {
              extraNodes: [pNode('c', 'c_probe'), pNode('top', 'top_probe')],
              extraEdges: [
                pEdge('par2', 'done', 'c'),
                pEdge('par', 'done', 'top'),
              ],
            },
          );

          const innerDone = {
            branches: [{ from: 'a' }, { from: 'b' }],
            count: 2,
          };
          // 바깥 병렬 분기 0 의 사본과 루트 컨텍스트 둘 다 본다.
          expect(seen.innerInBranch).toEqual(
            expect.objectContaining({ output: innerDone, port: 'done' }),
          );
          expect(seen.innerAtRoot).toEqual(
            expect.objectContaining({ output: innerDone, port: 'done' }),
          );
          expect(seen.outer).toEqual(
            expect.objectContaining({
              output: {
                branches: [{ probed: 'c_probe' }, { from: 'd' }],
                count: 2,
              },
              port: 'done',
            }),
          );
        });

        it('안쪽 Parallel 이 바깥 병렬 분기의 마지막 노드면 바깥 branches[i] 는 안쪽 완료 출력이고 안쪽 병렬 분기 노드는 후보가 아니다', async () => {
          recordingHandlers(['a', 'b', 'd']);
          await runInnerParallelGraph({});

          expect(doneReceived).toEqual([
            {
              branches: [
                { branches: [{ from: 'a' }, { from: 'b' }], count: 2 },
                { from: 'd' },
              ],
              count: 2,
            },
          ]);
        });

        it('안쪽 Parallel 의 합류 노드는 한 번만 실행되고 안쪽 병렬 분기 출력을 입력으로 받는다', async () => {
          // 안쪽 병렬 분기 a, b 가 모두 m 으로 합류한다.
          const { runs, inputs } = recordingHandlers(['a', 'b', 'm', 'd']);
          await runInnerParallelGraph(
            {},
            {
              extraNodes: [pNode('m', 'm_node')],
              extraEdges: [pEdge('a', 'out', 'm'), pEdge('b', 'out', 'm')],
            },
          );

          expect([...runs].sort()).toEqual(['a', 'b', 'd', 'm']);
          // 입력이 여럿이면 원본 노드 ID 별로 모인다. 안쪽 병렬 분기가 쓴 출력이 바깥
          // 병렬 분기 사본에도 보여야 한다.
          expect(inputs.m).toEqual({ a: { from: 'a' }, b: { from: 'b' } });
          expect(doneReceived).toEqual([
            { branches: [{ from: 'm' }, { from: 'd' }], count: 2 },
          ]);
        });

        it('안쪽 Parallel 의 병렬 분기는 동시에 실행된다', async () => {
          let inFlight = 0;
          let maxInFlight = 0;
          registerHandler('slow_node', async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setImmediate(resolve));
            inFlight -= 1;
            return mockOutput({ slow: true });
          });
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runInnerParallelGraph(
            {},
            { types: { a: 'slow_node', b: 'slow_node', d: 'ok_node' } },
          );
          await flushPromises();

          expect(maxInFlight).toBe(2);
          expect(doneReceived).toHaveLength(1);
        });

        it('바깥 × 안쪽 동시 실행 수 곱이 32 를 넘으면 안쪽 동시 실행 수를 줄이고 meta.clampedConcurrency 에 기록한다', async () => {
          recordingHandlers(['a', 'b', 'd']);
          await runInnerParallelGraph(
            { maxConcurrency: 16 },
            { innerConfig: { branchCount: 2, maxConcurrency: 4 } },
          );

          // 16 × 4 = 64 > 32 → 안쪽은 max(1, floor(32 / 16)) = 2.
          expect(structuredOf('par2')).toEqual(
            expect.objectContaining({
              port: 'done',
              meta: {
                clampedConcurrency: {
                  intended: 4,
                  actual: 2,
                  parentEffective: 16,
                  cap: 32,
                },
              },
            }),
          );
          expect(structuredOf('par')).toBeDefined();
          expect(structuredOf('par')).not.toHaveProperty('meta');
        });

        it('바깥 × 안쪽 동시 실행 수 곱이 32 이하면 안쪽 완료 출력에 meta 가 없다', async () => {
          recordingHandlers(['a', 'b', 'd']);
          await runInnerParallelGraph(
            { maxConcurrency: 8 },
            { innerConfig: { branchCount: 2, maxConcurrency: 4 } },
          );

          // 8 × 4 = 32 ≤ 32 → 줄이지 않는다.
          expect(structuredOf('par2')).toEqual(
            expect.objectContaining({ port: 'done' }),
          );
          expect(structuredOf('par2')).not.toHaveProperty('meta');
        });

        it('안쪽 Parallel 의 항목 에러 정책이 continue 면 실패한 안쪽 병렬 분기가 안쪽 완료 출력의 skipped 에 남고 바깥 병렬 분기는 이어진다', async () => {
          const { runs, inputs } = recordingHandlers(['a', 'c', 'd']);
          registerHandler('fail_node', async () => {
            throw new Error('inner failed');
          });
          await runInnerParallelGraph(
            {},
            {
              innerConfig: { branchCount: 2, errorPolicy: 'continue' },
              types: { b: 'fail_node' },
              extraNodes: [pNode('c', 'c_node')],
              extraEdges: [pEdge('par2', 'done', 'c')],
            },
          );

          const innerDone = {
            branches: [{ from: 'a' }, null],
            count: 2,
            skipped: [
              {
                index: 1,
                error: { code: 'UNKNOWN_ERROR', message: 'inner failed' },
              },
            ],
          };
          expect([...runs].sort()).toEqual(['a', 'c', 'd']);
          expect(inputs.c).toEqual(innerDone);
          expect(structuredOf('par2')).toEqual(
            expect.objectContaining({ output: innerDone, port: 'done' }),
          );
          expect(doneReceived).toEqual([
            { branches: [{ from: 'c' }, { from: 'd' }], count: 2 },
          ]);
        });

        it('안쪽 병렬 분기가 실패해도 그때까지 쓴 출력은 바깥 병렬 분기의 사본에 옮겨진다', async () => {
          // 안쪽 병렬 분기 1: b(성공) → bf(실패). 실패한 병렬 분기도 `finally` 에서
          // 쓴 출력을 바깥 병렬 분기 사본에 옮기므로 안쪽 done 뒤의 c 가 b 를 본다.
          const { runs } = recordingHandlers(['a', 'b', 'd']);
          registerHandler('fail_node', async () => {
            throw new Error('inner failed');
          });
          let partial: unknown;
          registerProbe('c_probe', (ctx) => {
            partial = ctx.nodeOutputCache['b'];
          });
          await runInnerParallelGraph(
            {},
            {
              innerConfig: { branchCount: 2, errorPolicy: 'continue' },
              extraNodes: [pNode('bf', 'fail_node'), pNode('c', 'c_probe')],
              extraEdges: [pEdge('b', 'out', 'bf'), pEdge('par2', 'done', 'c')],
            },
          );

          expect([...runs].sort()).toEqual(['a', 'b', 'd']);
          expect(structuredOf('par2')).toEqual(
            expect.objectContaining({
              output: expect.objectContaining({
                branches: [{ from: 'a' }, null],
                skipped: [expect.objectContaining({ index: 1 })],
              }),
            }),
          );
          expect(partial).toEqual({ from: 'b' });
        });

        it('안쪽 Parallel 의 항목 에러 정책이 stop 이면 안쪽 실패가 바깥 병렬 분기의 실패가 되고 바깥 항목 에러 정책을 따른다', async () => {
          const { runs } = recordingHandlers(['a', 'c', 'd']);
          registerHandler('fail_node', async () => {
            throw new Error('inner failed');
          });
          await runInnerParallelGraph(
            { errorPolicy: 'continue' },
            {
              innerConfig: { branchCount: 2, errorPolicy: 'stop' },
              types: { b: 'fail_node' },
              extraNodes: [pNode('c', 'c_node')],
              extraEdges: [pEdge('par2', 'done', 'c')],
            },
          );

          // 안쪽 done 뒤 c 는 실행되지 않는다. 바깥 병렬 분기 0 이 실패로 남는다.
          expect(runs).not.toContain('c');
          expect(runs).toContain('d');
          expect(doneReceived).toEqual([
            {
              branches: [null, { from: 'd' }],
              count: 2,
              skipped: [
                {
                  index: 0,
                  error: expect.objectContaining({ message: 'inner failed' }),
                },
              ],
            },
          ]);
        });

        it('중첩 깊이가 2 를 넘으면 바깥 항목 에러 정책과 상관없이 병렬 분기를 시작하기 전에 실행을 PARALLEL_NESTED_DEPTH_EXCEEDED 로 실패시킨다', async () => {
          // par(continue).branch_0 → par2.branch_0 → par3.branch_0 → x
          const { runs } = recordingHandlers(['x', 'd']);
          const failSpy = jest.spyOn(
            service as unknown as {
              finalizeFailedExecution: (...args: unknown[]) => Promise<void>;
            },
            'finalizeFailedExecution',
          );
          try {
            await runGraph(
              { errorPolicy: 'continue' },
              [
                pNode('par2', 'parallel', { branchCount: 2 }),
                pNode('par3', 'parallel', { branchCount: 2 }),
                pNode('x', 'x_node'),
                pNode('d', 'd_node'),
                pNode('sink', 'sink_node'),
              ],
              [
                pEdge('par', 'branch_0', 'par2'),
                pEdge('par2', 'branch_0', 'par3'),
                pEdge('par3', 'branch_0', 'x'),
                pEdge('par', 'branch_1', 'd'),
                pEdge('par', 'done', 'sink'),
              ],
            );

            expect(runs).toEqual([]);
            expect(doneReceived).toEqual([]);
            expect(failSpy).toHaveBeenCalledWith(
              expect.anything(),
              expect.objectContaining({
                message: expect.stringMatching(
                  /^PARALLEL_NESTED_DEPTH_EXCEEDED: /,
                ),
              }),
            );
          } finally {
            failSpy.mockRestore();
          }
        });

        // CLE-T-2CW3X0 — 바깥 Parallel 이 병렬 분기를 시작하기 전에 안쪽 Parallel 본문을
        // 미리 검사한다. 안쪽 병렬 분기 수는 아직 모르므로 설정값과 상관없이 최대값으로
        // 잡고 모든 `branch_N` 연결선을 따라간다.
        describe('안쪽 Parallel 본문 사전 검사', () => {
          // par(continue).branch_0 → par2.<innerPort> → <child>, par.branch_1 → d
          const runWithInnerChild = async (opts: {
            innerConfig: Record<string, unknown>;
            innerPort: string;
            child: ReturnType<typeof pNode>[];
            childEdges: ReturnType<typeof pEdge>[];
          }) => {
            const { runs } = recordingHandlers(['x', 'd']);
            const failSpy = jest.spyOn(
              service as unknown as {
                finalizeFailedExecution: (...args: unknown[]) => Promise<void>;
              },
              'finalizeFailedExecution',
            );
            try {
              await runGraph(
                { errorPolicy: 'continue' },
                [
                  pNode('par2', 'parallel', opts.innerConfig),
                  ...opts.child,
                  pNode('d', 'd_node'),
                  pNode('sink', 'sink_node'),
                ],
                [
                  pEdge('par', 'branch_0', 'par2'),
                  pEdge('par2', opts.innerPort, opts.child[0].id as string),
                  ...opts.childEdges,
                  pEdge('par', 'branch_1', 'd'),
                  pEdge('par', 'done', 'sink'),
                ],
              );
              const failedMessages = failSpy.mock.calls.map(
                (call: unknown[]) => (call[1] as Error).message,
              );
              return { runs, failedMessages };
            } finally {
              failSpy.mockRestore();
            }
          };

          it.each([
            ['설정한 병렬 분기 수(2)를 넘는 branch_3', { branchCount: 2 }],
            ['병렬 분기 수가 표현식', { branchCount: '{{ $input.count }}' }],
          ])(
            '안쪽 Parallel 의 %s 아래 Parallel 도 깊이 초과로 보고 병렬 분기를 시작하기 전에 실행을 실패시킨다',
            async (_label, innerConfig) => {
              const { runs, failedMessages } = await runWithInnerChild({
                innerConfig,
                innerPort: 'branch_3',
                child: [
                  pNode('par3', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                ],
                childEdges: [pEdge('par3', 'branch_0', 'x')],
              });

              expect(runs).toEqual([]);
              expect(doneReceived).toEqual([]);
              expect(failedMessages).toEqual([
                expect.stringMatching(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /),
              ]);
            },
          );

          it('안쪽 Parallel 본문의 블로킹 노드도 병렬 분기를 시작하기 전에 PARALLEL_INVALID_CHILD 로 실행을 실패시킨다', async () => {
            // 안쪽 본문은 바깥 병렬 분기 본문 안의 연결선만 따라가므로 늘 바깥 본문에도
            // 들어 있다. 그래서 사전 검사와 바깥 본문 검사 가운데 어느 쪽이 던져도 이 테스트는
            // 통과한다. 고정하는 것은 "바깥 병렬 분기를 시작하기 전에 실행이 실패한다" 는 동작이다.
            handlerRegistry.register(
              'form_like',
              {
                validate: () => ({ valid: true, errors: [] }),
                execute: jest.fn(async () => mockOutput({ form: true })),
              },
              { kind: 'blocking', interaction: 'form' },
            );

            const { runs, failedMessages } = await runWithInnerChild({
              innerConfig: { branchCount: 2 },
              innerPort: 'branch_0',
              child: [pNode('form1', 'form_like')],
              childEdges: [],
            });

            // 바깥 항목 에러 정책이 continue 라도 바깥 병렬 분기 1 의 d 가 실행되지 않는다.
            expect(runs).toEqual([]);
            expect(doneReceived).toEqual([]);
            expect(failedMessages).toEqual([
              expect.stringMatching(/^PARALLEL_INVALID_CHILD: /),
            ]);
          });
        });
      });

      // CLE-T-TDAV1G — 병렬 분기 루프도 Parallel 이 받은 입력이 아니라 Background 노드가
      // 받은 입력으로 본문을 큐에 넣는다(CLE-NODE-BACKGROUND 의 진입 입력 표).
      it('병렬 분기 안 Background 는 Parallel 입력이 아니라 Background 노드가 받은 입력(앞 노드 출력)으로 본문을 큐에 넣는다 (CLE-T-TDAV1G)', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        registerHandler('pre_node', async () =>
          mockOutput({ marker: 'pre-output' }),
        );
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        const queueAdd = (
          service as unknown as { backgroundQueue: { add: jest.Mock } }
        ).backgroundQueue.add;
        queueAdd.mockClear();

        await runGraph(
          {},
          [
            pNode('pre', 'pre_node'),
            pNode('bg', 'background'),
            pNode('bgBody', 'ok_node'),
            pNode('b', 'ok_node'),
            pNode('sink', 'sink_node'),
          ],
          [
            pEdge('par', 'branch_0', 'pre'),
            pEdge('pre', 'out', 'bg'),
            pEdge('bg', 'background', 'bgBody'),
            pEdge('par', 'branch_1', 'b'),
            pEdge('par', 'done', 'sink'),
          ],
        );

        const jobs = queueAdd.mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(jobs.map((job) => job.bodyEntryNodeIds)).toEqual([['bgBody']]);
        expect(jobs.map((job) => job.input)).toEqual([
          { marker: 'pre-output' },
        ]);
      });

      // CLE-T-0DGHGF — 컨테이너 본문 루프와 동기 서브 워크플로우 루프도 Parallel 을 엔진의
      // Parallel 실행 경로로 넘긴다. 고치기 전에는 두 루프가 Parallel 핸들러만 실행했다.
      // 핸들러가 연 branch_N 포트로 병렬 분기 노드를 차례로 실행했고 done 포트는 열리지
      // 않았다(PARALLEL_ENGINE=off 와 같은 모양).
      describe('컨테이너 본문 · 동기 서브 워크플로우 안의 Parallel (CLE-T-0DGHGF)', () => {
        const recordRuns = (ids: string[]) => {
          const runs: string[] = [];
          const inputs: Record<string, unknown[]> = {};
          for (const id of ids) {
            registerHandler(`${id}_node`, async (input) => {
              runs.push(id);
              (inputs[id] ??= []).push(input);
              return mockOutput({ from: id });
            });
          }
          return { runs, inputs };
        };
        // structuredSpy 의 호출 인자는 (executionId, nodeId, payload) 순서다.
        const structuredOf = (nodeId: string) => {
          const matched = structuredSpy.mock.calls.filter(
            (call: unknown[]) => call[1] === nodeId,
          );
          return matched.length > 0
            ? (matched[matched.length - 1][2] as Record<string, unknown>)
            : undefined;
        };
        const inFe = (node: Partial<Node>): Partial<Node> => ({
          ...node,
          containerId: 'fe',
        });
        const emitFrom = (source: string): Partial<Edge> => ({
          ...pEdge(source, 'out', 'fe'),
          targetPort: 'emit',
        });
        // src → fe(ForEach, 아이템 두 개). 본문은 테스트마다 넘긴다.
        const foreachWithBody = (
          body: { nodes: Partial<Node>[]; edges: Partial<Edge>[] },
          foreachConfig: Record<string, unknown> = {},
        ) => {
          handlerRegistry.register('foreach', new ForEachHandler(), {
            kind: 'container',
          });
          registerHandler('items_node', async () =>
            mockOutput({ items: [{ n: 1 }, { n: 2 }] }),
          );
          return {
            nodes: [
              pNode('src', 'items_node'),
              pNode('fe', 'foreach', { arrayField: 'items', ...foreachConfig }),
              ...body.nodes.map(inFe),
            ],
            edges: [pEdge('src', 'out', 'fe'), ...body.edges],
          };
        };
        // 본문: cpar.branch_0 → a, cpar.branch_1 → b, cpar.done → after → emit
        const parallelBody = (cparConfig: Record<string, unknown> = {}) => ({
          nodes: [
            pNode('cpar', 'parallel', { branchCount: 2, ...cparConfig }),
            pNode('a', 'a_node'),
            pNode('b', 'b_node'),
            pNode('after', 'after_node'),
          ],
          edges: [
            pEdge('fe', 'body', 'cpar'),
            pEdge('cpar', 'branch_0', 'a'),
            pEdge('cpar', 'branch_1', 'b'),
            pEdge('cpar', 'done', 'after'),
            emitFrom('after'),
          ],
        });
        // trigger → src 로 시작하는 그래프를 실행한다. 실행을 실패로 마감했으면 그 메시지를
        // 돌려준다.
        const runFromTrigger = async (
          nodes: Partial<Node>[],
          edges: Partial<Edge>[],
        ) => {
          const failSpy = jest.spyOn(
            service as unknown as {
              finalizeFailedExecution: (...args: unknown[]) => Promise<void>;
            },
            'finalizeFailedExecution',
          );
          try {
            mockNodeRepo.findBy.mockResolvedValue([
              pNode('trigger', 'test_node'),
              ...nodes,
            ]);
            mockEdgeRepo.findBy.mockResolvedValue([
              pEdge('trigger', 'out', 'src'),
              ...edges,
            ]);
            await service.execute(
              workflowId,
              { start: true },
              { workspaceId: 'ws-1' },
            );
            await flushPromises();
            return failSpy.mock.calls.map(
              (call: unknown[]) => (call[1] as Error).message,
            );
          } finally {
            failSpy.mockRestore();
          }
        };

        describe('컨테이너 본문', () => {
          it('ForEach 본문 안 Parallel 이 회차마다 병렬 분기를 실행하고 done 뒤 노드가 완료 출력을 받는다', async () => {
            const { runs, inputs } = recordRuns(['a', 'b', 'after']);
            const g = foreachWithBody(parallelBody());
            await runFromTrigger(
              [...g.nodes, pNode('sink', 'sink_node')],
              [...g.edges, pEdge('fe', 'done', 'sink')],
            );

            expect([...runs].sort()).toEqual([
              'a',
              'a',
              'after',
              'after',
              'b',
              'b',
            ]);
            // 병렬 분기 입력은 회차 아이템이다.
            expect(inputs.a).toEqual([{ n: 1 }, { n: 2 }]);
            const done = { branches: [{ from: 'a' }, { from: 'b' }], count: 2 };
            expect(inputs.after).toEqual([done, done]);
            expect(structuredOf('cpar')).toEqual(
              expect.objectContaining({ output: done, port: 'done' }),
            );
            expect(doneReceived).toEqual([
              { items: [{ from: 'after' }, { from: 'after' }], count: 2 },
            ]);
          });

          it('ForEach 본문 안 Parallel 의 병렬 분기에 둔 Background 도 회차마다 컨테이너 ID 와 회차 반복 변수를 실어 본문을 큐에 넣는다 (CLE-T-MR6ZH3)', async () => {
            handlerRegistry.register('background', new BackgroundHandler(), {
              kind: 'background',
            });
            const { runs } = recordRuns(['b', 'after', 'bgBody']);
            const queueAdd = (
              service as unknown as { backgroundQueue: { add: jest.Mock } }
            ).backgroundQueue.add;
            queueAdd.mockClear();
            const g = foreachWithBody({
              nodes: [
                pNode('cpar', 'parallel', { branchCount: 2 }),
                pNode('bg', 'background'),
                pNode('bgBody', 'bgBody_node'),
                pNode('b', 'b_node'),
                pNode('after', 'after_node'),
              ],
              edges: [
                pEdge('fe', 'body', 'cpar'),
                pEdge('cpar', 'branch_0', 'bg'),
                pEdge('bg', 'background', 'bgBody'),
                pEdge('cpar', 'branch_1', 'b'),
                pEdge('cpar', 'done', 'after'),
                emitFrom('after'),
              ],
            });
            await runFromTrigger(g.nodes, g.edges);

            // 본문 노드는 회차 루프 · 병렬 분기 루프에서 실행하지 않는다.
            expect(runs.filter((id) => id === 'bgBody')).toHaveLength(0);
            const jobs = queueAdd.mock.calls.map(
              (call: unknown[]) => call[1] as BackgroundExecutionJob,
            );
            expect(jobs.map((job) => job.bodyEntryNodeIds)).toEqual([
              ['bgBody'],
              ['bgBody'],
            ]);
            expect(jobs.map((job) => job.containerScopeId)).toEqual([
              'fe',
              'fe',
            ]);
            // 병렬 분기가 이어받은 바깥 반복 변수를 그 회차 값으로 싣는다.
            expect(jobs.map((job) => job.itemContext?.item)).toEqual([
              { n: 1 },
              { n: 2 },
            ]);
          });

          it('병렬 분기 노드는 바깥 ForEach 의 반복 변수를 읽는다 (REQ-PARALLEL-009)', async () => {
            const seenItems: unknown[] = [];
            handlerRegistry.register('a_node', {
              validate: () => ({ valid: true, errors: [] }),
              execute: jest.fn(
                async (
                  _input: unknown,
                  _cfg: unknown,
                  ctx: ExecutionContext,
                ) => {
                  seenItems.push(ctx.itemContext?.item);
                  return mockOutput({ from: 'a' });
                },
              ) as NodeHandler['execute'],
            });
            recordRuns(['b', 'after']);
            const g = foreachWithBody(parallelBody());
            await runFromTrigger(g.nodes, g.edges);

            expect(seenItems).toEqual([{ n: 1 }, { n: 2 }]);
          });

          it('emit 원천이 병렬 분기 안 노드여도 회차 결과를 모은다', async () => {
            recordRuns(['a', 'b']);
            const g = foreachWithBody({
              nodes: [
                pNode('cpar', 'parallel', { branchCount: 2 }),
                pNode('a', 'a_node'),
                pNode('b', 'b_node'),
              ],
              edges: [
                pEdge('fe', 'body', 'cpar'),
                pEdge('cpar', 'branch_0', 'a'),
                pEdge('cpar', 'branch_1', 'b'),
                emitFrom('a'),
              ],
            });
            await runFromTrigger(
              [...g.nodes, pNode('sink', 'sink_node')],
              [...g.edges, pEdge('fe', 'done', 'sink')],
            );

            expect(doneReceived).toEqual([
              { items: [{ from: 'a' }, { from: 'a' }], count: 2 },
            ]);
          });

          it('병렬 분기 안 ForEach 의 본문 Parallel 은 바깥 병렬 분기 깊이를 이어받아 곱 상한 32 를 따른다 (REQ-PARALLEL-025)', async () => {
            recordRuns(['a', 'b', 'after', 'd']);
            const g = foreachWithBody(parallelBody({ maxConcurrency: 4 }));
            await runGraph(
              { maxConcurrency: 16 },
              [...g.nodes, pNode('d', 'd_node')],
              [
                pEdge('par', 'branch_0', 'src'),
                ...g.edges,
                pEdge('par', 'branch_1', 'd'),
              ],
            );

            // 16 × 4 = 64 > 32 → 안쪽은 max(1, floor(32 / 16)) = 2.
            expect(structuredOf('cpar')).toEqual(
              expect.objectContaining({
                port: 'done',
                meta: {
                  clampedConcurrency: {
                    intended: 4,
                    actual: 2,
                    parentEffective: 16,
                    cap: 32,
                  },
                },
              }),
            );
          });

          it('병렬 분기 안 ForEach 본문에서 깊이 3 이 되는 Parallel 은 바깥 병렬 분기를 시작하기 전에 실행을 실패시킨다 (REQ-PARALLEL-024)', async () => {
            const { runs } = recordRuns(['x', 'y', 'd']);
            // par(1).branch_0 → src → fe → 본문 cpar(2).branch_0 → cpar3(3) → x
            const g = foreachWithBody({
              nodes: [
                pNode('cpar', 'parallel', { branchCount: 2 }),
                pNode('cpar3', 'parallel', { branchCount: 2 }),
                pNode('x', 'x_node'),
                pNode('y', 'y_node'),
              ],
              edges: [
                pEdge('fe', 'body', 'cpar'),
                pEdge('cpar', 'branch_0', 'cpar3'),
                pEdge('cpar3', 'branch_0', 'x'),
                pEdge('cpar', 'branch_1', 'y'),
                emitFrom('y'),
              ],
            });
            const failSpy = jest.spyOn(
              service as unknown as {
                finalizeFailedExecution: (...args: unknown[]) => Promise<void>;
              },
              'finalizeFailedExecution',
            );
            try {
              await runGraph(
                { errorPolicy: 'continue' },
                [...g.nodes, pNode('d', 'd_node'), pNode('sink', 'sink_node')],
                [
                  pEdge('par', 'branch_0', 'src'),
                  ...g.edges,
                  pEdge('par', 'branch_1', 'd'),
                  pEdge('par', 'done', 'sink'),
                ],
              );

              // 바깥 항목 에러 정책이 continue 라도 바깥 병렬 분기 1 의 d 가 실행되지 않는다.
              expect(runs).toEqual([]);
              expect(doneReceived).toEqual([]);
              expect(
                failSpy.mock.calls.map(
                  (call: unknown[]) => (call[1] as Error).message,
                ),
              ).toEqual([
                expect.stringMatching(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /),
              ]);
            } finally {
              failSpy.mockRestore();
            }
          });

          it('ForEach 본문의 깊이 위반은 회차를 시작하기 전에 실행을 실패시켜 ForEach 의 continue 가 흡수하지 않는다 (REQ-PARALLEL-024)', async () => {
            const { runs } = recordRuns(['x', 'y']);
            // 본문 cpar(1).branch_0 → cpar2(2).branch_0 → cpar3(3) → x
            const g = foreachWithBody(
              {
                nodes: [
                  pNode('cpar', 'parallel', { branchCount: 2 }),
                  pNode('cpar2', 'parallel', { branchCount: 2 }),
                  pNode('cpar3', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                  pNode('y', 'y_node'),
                ],
                edges: [
                  pEdge('fe', 'body', 'cpar'),
                  pEdge('cpar', 'branch_0', 'cpar2'),
                  pEdge('cpar2', 'branch_0', 'cpar3'),
                  pEdge('cpar3', 'branch_0', 'x'),
                  pEdge('cpar', 'branch_1', 'y'),
                  emitFrom('y'),
                ],
              },
              { errorPolicy: 'continue' },
            );
            const failedMessages = await runFromTrigger(
              [...g.nodes, pNode('sink', 'sink_node')],
              [...g.edges, pEdge('fe', 'done', 'sink')],
            );

            expect(runs).toEqual([]);
            expect(doneReceived).toEqual([]);
            expect(failedMessages).toEqual([
              expect.stringMatching(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /),
            ]);
          });

          // CLE-T-BTR4ZA — 컨테이너 안 Background 의 `background` 포트 뒤 노드도 그 컨테이너의
          // `containerId` 를 가진다. 워커는 그 본문을 새 컨텍스트에서 깊이 1 부터 세어 실행하므로
          // 사전 검사도 깊이 1 부터 센다(CLE-NODE-PARALLEL 「놓인 위치별 실행과 중첩 깊이」).
          describe('컨테이너 안 Background 본문의 Parallel 사전 깊이 검사 (CLE-T-BTR4ZA)', () => {
            // fe 본문: fe.body → bg, bg.main → y(emit), bg.background → 본문
            const foreachWithBackgroundBody = (bgBody: {
              nodes: Partial<Node>[];
              edges: Partial<Edge>[];
            }) => {
              handlerRegistry.register('background', new BackgroundHandler(), {
                kind: 'background',
              });
              return foreachWithBody({
                nodes: [
                  pNode('bg', 'background'),
                  pNode('y', 'y_node'),
                  ...bgBody.nodes,
                ],
                edges: [
                  pEdge('fe', 'body', 'bg'),
                  pEdge('bg', 'main', 'y'),
                  emitFrom('y'),
                  ...bgBody.edges,
                ],
              });
            };
            const queueAddOf = () =>
              (service as unknown as { backgroundQueue: { add: jest.Mock } })
                .backgroundQueue.add;
            const queuedEntries = () =>
              queueAddOf().mock.calls.map(
                (call: unknown[]) =>
                  (call[1] as BackgroundExecutionJob).bodyEntryNodeIds,
              );
            // 실행을 실패로 마감했으면 그 메시지를 돌려준다.
            const failuresOf = async (run: () => Promise<void>) => {
              const failSpy = jest.spyOn(
                service as unknown as {
                  finalizeFailedExecution: (
                    ...args: unknown[]
                  ) => Promise<void>;
                },
                'finalizeFailedExecution',
              );
              try {
                await run();
                return failSpy.mock.calls.map(
                  (call: unknown[]) => (call[1] as Error).message,
                );
              } finally {
                failSpy.mockRestore();
              }
            };

            it('깊이 2 병렬 분기 안 ForEach 의 Background 본문 Parallel 은 깊이 1 로 보고 회차마다 본문을 큐에 넣는다', async () => {
              recordRuns(['y', 'd', 'e', 'x']);
              queueAddOf().mockClear();
              // par(1).branch_0 → par2(2).branch_0 → src → fe, 본문 bg.background → bpar → x
              const g = foreachWithBackgroundBody({
                nodes: [
                  pNode('bpar', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                ],
                edges: [
                  pEdge('bg', 'background', 'bpar'),
                  pEdge('bpar', 'branch_0', 'x'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [
                    pNode('par2', 'parallel', { branchCount: 2 }),
                    ...g.nodes,
                    pNode('d', 'd_node'),
                    pNode('e', 'e_node'),
                  ],
                  [
                    pEdge('par', 'branch_0', 'par2'),
                    pEdge('par2', 'branch_0', 'src'),
                    pEdge('par2', 'branch_1', 'e'),
                    ...g.edges,
                    pEdge('par', 'branch_1', 'd'),
                  ],
                ),
              );

              expect(failures).toEqual([]);
              expect(queuedEntries()).toEqual([['bpar'], ['bpar']]);
            });

            it('깊이 1 병렬 분기 안 ForEach 의 Background 본문에 둔 Parallel 안 Parallel(워커 깊이 2)을 막지 않는다', async () => {
              recordRuns(['y', 'd', 'x', 'z']);
              queueAddOf().mockClear();
              // par(1).branch_0 → src → fe, 본문 bg.background → bpar → bpar2 → x
              const g = foreachWithBackgroundBody({
                nodes: [
                  pNode('bpar', 'parallel', { branchCount: 2 }),
                  pNode('bpar2', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                  pNode('z', 'z_node'),
                ],
                edges: [
                  pEdge('bg', 'background', 'bpar'),
                  pEdge('bpar', 'branch_0', 'bpar2'),
                  pEdge('bpar2', 'branch_0', 'x'),
                  pEdge('bpar', 'branch_1', 'z'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [...g.nodes, pNode('d', 'd_node')],
                  [
                    pEdge('par', 'branch_0', 'src'),
                    ...g.edges,
                    pEdge('par', 'branch_1', 'd'),
                  ],
                ),
              );

              expect(failures).toEqual([]);
              expect(queuedEntries()).toEqual([['bpar'], ['bpar']]);
            });

            it('Background 본문에서도 깊이 3 이 되는 Parallel 은 회차를 시작하기 전에 실행을 실패시킨다', async () => {
              const { runs } = recordRuns(['y', 'x']);
              queueAddOf().mockClear();
              // 맨 바깥 fe, 본문 bg.background → bpar(1) → bpar2(2) → bpar3(3) → x
              const g = foreachWithBackgroundBody({
                nodes: [
                  pNode('bpar', 'parallel', { branchCount: 2 }),
                  pNode('bpar2', 'parallel', { branchCount: 2 }),
                  pNode('bpar3', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                ],
                edges: [
                  pEdge('bg', 'background', 'bpar'),
                  pEdge('bpar', 'branch_0', 'bpar2'),
                  pEdge('bpar2', 'branch_0', 'bpar3'),
                  pEdge('bpar3', 'branch_0', 'x'),
                ],
              });
              const failures = await runFromTrigger(g.nodes, g.edges);

              expect(runs).toEqual([]);
              expect(queuedEntries()).toEqual([]);
              expect(failures).toEqual([
                expect.stringMatching(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /),
              ]);
            });

            it('회차 본문과 Background 본문 양쪽에서 닿는 Parallel 은 컨테이너 깊이로 센다', async () => {
              const { runs } = recordRuns(['y', 'd', 'x', 'bb']);
              queueAddOf().mockClear();
              // par(1).branch_0 → src → fe(본문 깊이 2). mpar 는 bg.main 과 Background 본문 bb
              // 양쪽에서 닿는다. 회차 루프에서 깊이 2 로 실행되므로 그 안의 mpar2 는 깊이 3 이다.
              handlerRegistry.register('background', new BackgroundHandler(), {
                kind: 'background',
              });
              const g = foreachWithBody({
                nodes: [
                  pNode('bg', 'background'),
                  pNode('bb', 'bb_node'),
                  pNode('mpar', 'parallel', { branchCount: 2 }),
                  pNode('mpar2', 'parallel', { branchCount: 2 }),
                  pNode('x', 'x_node'),
                  pNode('y', 'y_node'),
                ],
                edges: [
                  pEdge('fe', 'body', 'bg'),
                  pEdge('bg', 'main', 'mpar'),
                  pEdge('bg', 'background', 'bb'),
                  pEdge('bb', 'out', 'mpar'),
                  pEdge('mpar', 'branch_0', 'mpar2'),
                  pEdge('mpar2', 'branch_0', 'x'),
                  pEdge('mpar', 'branch_1', 'y'),
                  emitFrom('y'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [...g.nodes, pNode('d', 'd_node')],
                  [
                    pEdge('par', 'branch_0', 'src'),
                    ...g.edges,
                    pEdge('par', 'branch_1', 'd'),
                  ],
                ),
              );

              expect(runs).toEqual([]);
              expect(failures).toEqual([
                expect.stringMatching(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /),
              ]);
            });
          });

          it('PARALLEL_ENGINE=off 이면 컨테이너 본문 Parallel 은 지금처럼 병렬 분기 노드를 차례로 실행하고 완료 출력을 만들지 않는다', async () => {
            mockConfigService.get.mockImplementation(
              (key: string, defaultValue?: unknown) => {
                if (key === 'PARALLEL_ENGINE') return 'off';
                if (key === 'MAX_NODE_ITERATIONS') return 100;
                return defaultValue;
              },
            );
            const { runs, inputs } = recordRuns(['a', 'b', 'after']);
            const g = foreachWithBody(parallelBody());
            await runFromTrigger(g.nodes, g.edges);

            // 메인 루프의 되돌림 경로와 같다. done 뒤 노드도 회차마다 위상 순서대로
            // 실행되지만 완료 출력(branches · count)이 아니라 Parallel 자신의 출력을 받는다.
            expect([...runs].sort()).toEqual([
              'a',
              'a',
              'after',
              'after',
              'b',
              'b',
            ]);
            expect(inputs.after).toHaveLength(2);
            for (const input of inputs.after) {
              expect(input).not.toHaveProperty('branches');
            }
            expect(structuredOf('cpar')).toMatchObject({
              output: null,
              port: ['branch_0', 'branch_1'],
            });
          });
        });

        describe('동기 서브 워크플로우', () => {
          const runInline = async (
            nodes: Partial<Node>[],
            edges: Partial<Edge>[],
            prepare: (ctx: ExecutionContext) => void = () => undefined,
          ) => {
            mockNodeRepo.findBy.mockResolvedValue(nodes);
            mockEdgeRepo.findBy.mockResolvedValue(edges);
            const contextService = (
              service as unknown as { contextService: ExecutionContextService }
            ).contextService;
            const context = withWorkspace(
              contextService.createContext(executionId, workflowId),
            );
            prepare(context);
            const result = await service.executeInline(
              workflowId,
              { start: true },
              {
                executionId,
                context,
                executedNodes: new Set<string>(),
                recursionDepth: 1,
              },
            );
            return { result, context };
          };

          it('서브 워크플로우 안 Parallel 이 병렬 분기를 실행하고 done 뒤 노드가 완료 출력을 받는다', async () => {
            const { runs, inputs } = recordRuns(['a', 'b', 'after']);
            const { result } = await runInline(
              [
                pNode('spar', 'parallel', { branchCount: 2 }),
                pNode('a', 'a_node'),
                pNode('b', 'b_node'),
                pNode('after', 'after_node'),
              ],
              [
                pEdge('spar', 'branch_0', 'a'),
                pEdge('spar', 'branch_1', 'b'),
                pEdge('spar', 'done', 'after'),
              ],
            );

            expect([...runs].sort()).toEqual(['a', 'after', 'b']);
            expect(inputs.after).toEqual([
              { branches: [{ from: 'a' }, { from: 'b' }], count: 2 },
            ]);
            expect(result).toEqual({ from: 'after' });
          });

          it('병렬 분기 안에서 불러도 서브 워크플로우의 Parallel 깊이는 새로 센다', async () => {
            const { runs } = recordRuns(['a', 'b', 'c']);
            // spar(1).branch_0 → spar2(2) → [a, b], spar.branch_1 → c. 호출한 쪽 깊이를
            // 이어받으면 spar 가 깊이 2 가 되어 spar2 에서 깊이 초과로 실패한다.
            const { context } = await runInline(
              [
                pNode('spar', 'parallel', {
                  branchCount: 2,
                  maxConcurrency: 16,
                }),
                pNode('spar2', 'parallel', {
                  branchCount: 2,
                  maxConcurrency: 4,
                }),
                pNode('a', 'a_node'),
                pNode('b', 'b_node'),
                pNode('c', 'c_node'),
              ],
              [
                pEdge('spar', 'branch_0', 'spar2'),
                pEdge('spar2', 'branch_0', 'a'),
                pEdge('spar2', 'branch_1', 'b'),
                pEdge('spar', 'branch_1', 'c'),
              ],
              (ctx) => {
                (ctx as ParallelBranchContext).parentParallelConcurrency = 16;
              },
            );

            expect([...runs].sort()).toEqual(['a', 'b', 'c']);
            // spar 는 맨 바깥(깊이 1)이라 줄이지 않는다. spar2 는 spar 의 동시 실행 수를
            // 기준으로 줄인다(16 × 4 = 64 > 32).
            expect(structuredOf('spar')).not.toHaveProperty('meta');
            expect(structuredOf('spar2')).toEqual(
              expect.objectContaining({
                meta: {
                  clampedConcurrency: {
                    intended: 4,
                    actual: 2,
                    parentEffective: 16,
                    cap: 32,
                  },
                },
              }),
            );
            // 호출한 쪽 컨텍스트의 값은 되돌려 놓는다.
            expect(
              (context as ParallelBranchContext).parentParallelConcurrency,
            ).toBe(16);
          });
        });
      });
    });
  });
});
