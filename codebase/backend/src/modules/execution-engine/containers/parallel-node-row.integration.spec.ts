/**
 * ExecutionEngineService — Parallel 노드 실행 행 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * Parallel 노드 실행 행을 COMPLETED · FAILED · CANCELLED 로 한 번만 마감하는지와
 * 컨테이너 실행 경로(`runContainer` · `afterExecute`)가 던질 때 열린 행을 마감하는지를 다룬다.
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은
 * `__test-utils__/engine-service-harness.ts`, describe 범위 준비는
 * `__test-utils__/parallel-engine-fixtures.ts` 를 쓴다. describe 이름은 원래 스펙과 같게
 * 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { ExecutionEngineService } from '../execution-engine.service';
import { ExecutionCancelledError } from '../workflow-errors';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { ParallelExecutor } from './parallel-executor';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { mockOutput } from '../__test__/mock-output';
import { ForEachHandler } from '../../../nodes/logic/foreach/foreach.handler';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  flushPromises,
  workflowId,
} from '../__test-utils__/engine-service-harness';
import { graphEdge, graphNode } from '../__test-utils__/graph-fixtures';
import {
  resetEngineConfig,
  useDoneOutputFixture,
  useParallelEngine,
} from '../__test-utils__/parallel-engine-fixtures';

describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];
  let mockConfigService: EngineServiceHarness['mockConfigService'];
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockConfigService,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = h);
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    afterEach(() => {
      resetEngineConfig(mockConfigService);
    });

    // CLE-NODE-PARALLEL v3 (CLE-T-2HD471) — 완료 출력 `{ branches, count, skipped? }`
    // 와 `port: 'done'`(단일 문자열). 실패한 병렬 분기 자리는 `null`, 실패 정보는
    // `skipped[{ index, error: { code, message } }]` (REQ-PARALLEL-012 · 017 · 029).
    describe('done 포트 완료 출력 (CLE-NODE-PARALLEL v3)', () => {
      const { doneReceived, registerHandler, runGraph, failingGraph } =
        useDoneOutputFixture(() => h);

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
              graphNode('a', 'slow_ok_node'),
              graphNode('b', 'slow_ok_node'),
              graphNode('sink', 'sink_node'),
            ],
            [
              graphEdge('par', 'branch_0', 'a'),
              graphEdge('par', 'branch_1', 'b'),
              graphEdge('par', 'done', 'sink'),
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
          useParallelEngine(mockConfigService, 'off');
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runGraph(
            {},
            [
              graphNode('a', 'ok_node'),
              graphNode('b', 'ok_node'),
              graphNode('sink', 'sink_node'),
            ],
            [
              graphEdge('par', 'branch_0', 'a'),
              graphEdge('par', 'branch_1', 'b'),
              graphEdge('par', 'done', 'sink'),
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
                graphNode('a', 'ok_node'),
                graphNode('b', 'ok_node'),
                graphNode('sink', 'sink_node'),
              ],
              [
                graphEdge('par', 'branch_0', 'a'),
                graphEdge('par', 'branch_1', 'b'),
                graphEdge('par', 'done', 'sink'),
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

        // CLE-T-JQHZ99 — 본문 실행 전 사전 검사에서 던지면 `runParallel` 은 행을 마감하지
        // 않는다. `executeAndDispatchNode` 가 열린 행을 FAILED 로 마감해 RUNNING 으로 남지 않는다.
        it('사전 검사 실패(PARALLEL_INVALID_CHILD)면 Parallel 행을 FAILED 로 한 번 마감하고 failed 이벤트를 한 번 보낸다', async () => {
          handlerRegistry.register(
            'form_like',
            {
              validate: () => ({ valid: true, errors: [] }),
              execute: jest.fn(async () => mockOutput({ form: true })),
            },
            { kind: 'blocking', interaction: 'form' },
          );
          registerHandler('ok_node', async () => mockOutput({ ok: true }));
          await runGraph(
            {},
            [
              graphNode('a', 'ok_node'),
              graphNode('f', 'form_like'),
              graphNode('sink', 'sink_node'),
            ],
            [
              graphEdge('par', 'branch_0', 'a'),
              graphEdge('par', 'branch_1', 'f'),
              graphEdge('par', 'done', 'sink'),
            ],
          );

          expect(parRows(NodeExecutionStatus.COMPLETED)).toHaveLength(0);
          const failed = parRows(NodeExecutionStatus.FAILED);
          expect(failed).toHaveLength(1);
          expect(failed[0].id).toBe('ne-par');
          expect(failed[0].error).toEqual({
            message: expect.stringMatching(/^PARALLEL_INVALID_CHILD: /),
          });
          const failedEvents = parEvents('execution.node.failed');
          expect(failedEvents).toHaveLength(1);
          expect(parEvents('execution.node.completed')).toHaveLength(0);
          expect(doneReceived).toEqual([]);
        });

        // CLE-T-JQHZ99 — Loop · ForEach · Map 도 같은 catch 를 쓴다. `runContainer` 가 행을
        // 마감하기 전에 던져도 컨테이너 행이 RUNNING 으로 남거나 두 번 마감되면 안 된다.
        describe('컨테이너 실행 경로가 던질 때', () => {
          const feRows = (status: NodeExecutionStatus) =>
            savedRows.filter((r) => r.nodeId === 'fe' && r.status === status);
          const feEvents = (eventType: string) =>
            mockWebsocketService.emitNodeEvent.mock.calls.filter(
              (c) => c[1] === 'fe' && c[2] === eventType,
            );

          const runForeach = async (rejectWith: Error) => {
            handlerRegistry.register('foreach', new ForEachHandler(), {
              kind: 'container',
            });
            registerHandler('items_node', async () =>
              mockOutput({ items: [{ n: 1 }] }),
            );
            registerHandler('double_node', async () => mockOutput({ d: 1 }));
            mockNodeRepo.findBy.mockResolvedValue([
              graphNode('trigger', 'test_node'),
              graphNode('src', 'items_node'),
              graphNode('fe', 'foreach', { arrayField: 'items' }),
              { ...graphNode('body', 'double_node'), containerId: 'fe' },
            ]);
            mockEdgeRepo.findBy.mockResolvedValue([
              graphEdge('trigger', 'out', 'src'),
              graphEdge('src', 'out', 'fe'),
              graphEdge('fe', 'body', 'body'),
              { ...graphEdge('body', 'out', 'fe'), targetPort: 'emit' },
            ]);
            const runContainerSpy = jest
              .spyOn(
                service as unknown as {
                  runContainer: () => Promise<void>;
                },
                'runContainer',
              )
              .mockRejectedValue(rejectWith);
            try {
              await service.execute(
                workflowId,
                { start: true },
                { workspaceId: 'ws-1' },
              );
              await flushPromises();
            } finally {
              runContainerSpy.mockRestore();
            }
          };

          it('runContainer 가 reject 되면 컨테이너 행을 FAILED 로 한 번 마감하고 failed 이벤트를 한 번 보낸다', async () => {
            await runForeach(new Error('container boom'));

            expect(feRows(NodeExecutionStatus.FAILED)).toHaveLength(1);
            expect(feRows(NodeExecutionStatus.CANCELLED)).toHaveLength(0);
            expect(feRows(NodeExecutionStatus.COMPLETED)).toHaveLength(0);
            expect(feEvents('execution.node.failed')).toHaveLength(1);
            expect(feEvents('execution.node.completed')).toHaveLength(0);
          });

          it('runContainer 가 외부 취소로 reject 되면 컨테이너 행을 CANCELLED 로 마감한다', async () => {
            await runForeach(new ExecutionCancelledError());

            expect(feRows(NodeExecutionStatus.CANCELLED)).toHaveLength(1);
            expect(feRows(NodeExecutionStatus.FAILED)).toHaveLength(0);
            expect(feEvents('execution.node.cancelled')).toHaveLength(1);
            expect(feEvents('execution.node.failed')).toHaveLength(0);
          });
        });

        // `afterExecute` 는 병렬 분기 루프가 넘기는 훅이다. 던지면 열린 행을 마감하고 다시 던진다.
        it('afterExecute 가 던지면 열린 행을 FAILED 로 마감하고 에러를 다시 던진다', async () => {
          const row = {
            id: 'ne-x',
            executionId: 'exec-x',
            nodeId: 'par',
            status: NodeExecutionStatus.RUNNING,
          } as unknown as NodeExecution;
          const boom = new Error('after boom');
          const priv = service as unknown as {
            executeNode: jest.Mock;
            dispatchByNodeKind: jest.Mock;
            executeAndDispatchNode: (o: unknown) => Promise<unknown>;
          };
          const executeSpy = jest
            .spyOn(priv, 'executeNode')
            .mockResolvedValue({ nodeExecution: row } as never);
          const dispatchSpy = jest.spyOn(priv, 'dispatchByNodeKind');
          try {
            await expect(
              priv.executeAndDispatchNode({
                executionId: 'exec-x',
                node: graphNode('par', 'parallel'),
                nodeInput: {},
                context: { nodeOutputCache: {} },
                executedNodes: new Set<string>(),
                executionMeta: undefined,
                nodeMap: new Map(),
                outgoingEdgeMap: new Map(),
                allNodes: [],
                allEdges: [],
                afterExecute: () => {
                  throw boom;
                },
              }),
            ).rejects.toBe(boom);
            expect(dispatchSpy).not.toHaveBeenCalled();
          } finally {
            executeSpy.mockRestore();
            dispatchSpy.mockRestore();
          }

          expect(parRows(NodeExecutionStatus.FAILED)).toHaveLength(1);
          expect(parRows(NodeExecutionStatus.RUNNING)).toHaveLength(0);
          expect(parEvents('execution.node.failed')).toHaveLength(1);
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
    });
  });
});
