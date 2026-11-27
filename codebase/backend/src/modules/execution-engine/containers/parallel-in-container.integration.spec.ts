/**
 * ExecutionEngineService — 컨테이너 본문 · 동기 서브 워크플로우 안의 Parallel 통합 테스트
 * (PARALLEL_ENGINE=v1).
 *
 * ForEach 본문 · 컨테이너 안 Background 본문 · 동기 서브 워크플로우에 둔 Parallel 이
 * 엔진의 Parallel 실행 경로를 타는지와 그 위치의 중첩 깊이 검사를 다룬다.
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은
 * `__test-utils__/engine-service-harness.ts`, describe 범위 준비는
 * `__test-utils__/parallel-engine-fixtures.ts` 를 쓴다. describe 이름은 원래 스펙과 같게
 * 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { BackgroundExecutionJob } from '../queues/background-execution.queue';
import { ExecutionEngineService } from '../execution-engine.service';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { ExecutionContextService } from '../context/execution-context.service';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
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
import { graphEdge, graphNode } from '../__test-utils__/graph-fixtures';
import {
  resetEngineConfig,
  setupDoneOutputFixture,
  useParallelEngine,
} from '../__test-utils__/parallel-engine-fixtures';

describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let contextService: ExecutionContextService;
  let mockConfigService: EngineServiceHarness['mockConfigService'];
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      contextService,
      mockConfigService,
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
      const { doneReceived, registerHandler, structuredOf, runGraph } =
        setupDoneOutputFixture(() => h);

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
        const inFe = (node: Partial<Node>): Partial<Node> => ({
          ...node,
          containerId: 'fe',
        });
        const emitFrom = (source: string): Partial<Edge> => ({
          ...graphEdge(source, 'out', 'fe'),
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
              graphNode('src', 'items_node'),
              graphNode('fe', 'foreach', {
                arrayField: 'items',
                ...foreachConfig,
              }),
              ...body.nodes.map(inFe),
            ],
            edges: [graphEdge('src', 'out', 'fe'), ...body.edges],
          };
        };
        // 본문: cpar.branch_0 → a, cpar.branch_1 → b, cpar.done → after → emit
        const parallelBody = (cparConfig: Record<string, unknown> = {}) => ({
          nodes: [
            graphNode('cpar', 'parallel', { branchCount: 2, ...cparConfig }),
            graphNode('a', 'a_node'),
            graphNode('b', 'b_node'),
            graphNode('after', 'after_node'),
          ],
          edges: [
            graphEdge('fe', 'body', 'cpar'),
            graphEdge('cpar', 'branch_0', 'a'),
            graphEdge('cpar', 'branch_1', 'b'),
            graphEdge('cpar', 'done', 'after'),
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
              graphNode('trigger', 'test_node'),
              ...nodes,
            ]);
            mockEdgeRepo.findBy.mockResolvedValue([
              graphEdge('trigger', 'out', 'src'),
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
              [...g.nodes, graphNode('sink', 'sink_node')],
              [...g.edges, graphEdge('fe', 'done', 'sink')],
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
                graphNode('cpar', 'parallel', { branchCount: 2 }),
                graphNode('bg', 'background'),
                graphNode('bgBody', 'bgBody_node'),
                graphNode('b', 'b_node'),
                graphNode('after', 'after_node'),
              ],
              edges: [
                graphEdge('fe', 'body', 'cpar'),
                graphEdge('cpar', 'branch_0', 'bg'),
                graphEdge('bg', 'background', 'bgBody'),
                graphEdge('cpar', 'branch_1', 'b'),
                graphEdge('cpar', 'done', 'after'),
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
                graphNode('cpar', 'parallel', { branchCount: 2 }),
                graphNode('a', 'a_node'),
                graphNode('b', 'b_node'),
              ],
              edges: [
                graphEdge('fe', 'body', 'cpar'),
                graphEdge('cpar', 'branch_0', 'a'),
                graphEdge('cpar', 'branch_1', 'b'),
                emitFrom('a'),
              ],
            });
            await runFromTrigger(
              [...g.nodes, graphNode('sink', 'sink_node')],
              [...g.edges, graphEdge('fe', 'done', 'sink')],
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
              [...g.nodes, graphNode('d', 'd_node')],
              [
                graphEdge('par', 'branch_0', 'src'),
                ...g.edges,
                graphEdge('par', 'branch_1', 'd'),
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
                graphNode('cpar', 'parallel', { branchCount: 2 }),
                graphNode('cpar3', 'parallel', { branchCount: 2 }),
                graphNode('x', 'x_node'),
                graphNode('y', 'y_node'),
              ],
              edges: [
                graphEdge('fe', 'body', 'cpar'),
                graphEdge('cpar', 'branch_0', 'cpar3'),
                graphEdge('cpar3', 'branch_0', 'x'),
                graphEdge('cpar', 'branch_1', 'y'),
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
                [
                  ...g.nodes,
                  graphNode('d', 'd_node'),
                  graphNode('sink', 'sink_node'),
                ],
                [
                  graphEdge('par', 'branch_0', 'src'),
                  ...g.edges,
                  graphEdge('par', 'branch_1', 'd'),
                  graphEdge('par', 'done', 'sink'),
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
                  graphNode('cpar', 'parallel', { branchCount: 2 }),
                  graphNode('cpar2', 'parallel', { branchCount: 2 }),
                  graphNode('cpar3', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                  graphNode('y', 'y_node'),
                ],
                edges: [
                  graphEdge('fe', 'body', 'cpar'),
                  graphEdge('cpar', 'branch_0', 'cpar2'),
                  graphEdge('cpar2', 'branch_0', 'cpar3'),
                  graphEdge('cpar3', 'branch_0', 'x'),
                  graphEdge('cpar', 'branch_1', 'y'),
                  emitFrom('y'),
                ],
              },
              { errorPolicy: 'continue' },
            );
            const failedMessages = await runFromTrigger(
              [...g.nodes, graphNode('sink', 'sink_node')],
              [...g.edges, graphEdge('fe', 'done', 'sink')],
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
                  graphNode('bg', 'background'),
                  graphNode('y', 'y_node'),
                  ...bgBody.nodes,
                ],
                edges: [
                  graphEdge('fe', 'body', 'bg'),
                  graphEdge('bg', 'main', 'y'),
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
                  graphNode('bpar', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                ],
                edges: [
                  graphEdge('bg', 'background', 'bpar'),
                  graphEdge('bpar', 'branch_0', 'x'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [
                    graphNode('par2', 'parallel', { branchCount: 2 }),
                    ...g.nodes,
                    graphNode('d', 'd_node'),
                    graphNode('e', 'e_node'),
                  ],
                  [
                    graphEdge('par', 'branch_0', 'par2'),
                    graphEdge('par2', 'branch_0', 'src'),
                    graphEdge('par2', 'branch_1', 'e'),
                    ...g.edges,
                    graphEdge('par', 'branch_1', 'd'),
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
                  graphNode('bpar', 'parallel', { branchCount: 2 }),
                  graphNode('bpar2', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                  graphNode('z', 'z_node'),
                ],
                edges: [
                  graphEdge('bg', 'background', 'bpar'),
                  graphEdge('bpar', 'branch_0', 'bpar2'),
                  graphEdge('bpar2', 'branch_0', 'x'),
                  graphEdge('bpar', 'branch_1', 'z'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [...g.nodes, graphNode('d', 'd_node')],
                  [
                    graphEdge('par', 'branch_0', 'src'),
                    ...g.edges,
                    graphEdge('par', 'branch_1', 'd'),
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
                  graphNode('bpar', 'parallel', { branchCount: 2 }),
                  graphNode('bpar2', 'parallel', { branchCount: 2 }),
                  graphNode('bpar3', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                ],
                edges: [
                  graphEdge('bg', 'background', 'bpar'),
                  graphEdge('bpar', 'branch_0', 'bpar2'),
                  graphEdge('bpar2', 'branch_0', 'bpar3'),
                  graphEdge('bpar3', 'branch_0', 'x'),
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
                  graphNode('bg', 'background'),
                  graphNode('bb', 'bb_node'),
                  graphNode('mpar', 'parallel', { branchCount: 2 }),
                  graphNode('mpar2', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                  graphNode('y', 'y_node'),
                ],
                edges: [
                  graphEdge('fe', 'body', 'bg'),
                  graphEdge('bg', 'main', 'mpar'),
                  graphEdge('bg', 'background', 'bb'),
                  graphEdge('bb', 'out', 'mpar'),
                  graphEdge('mpar', 'branch_0', 'mpar2'),
                  graphEdge('mpar2', 'branch_0', 'x'),
                  graphEdge('mpar', 'branch_1', 'y'),
                  emitFrom('y'),
                ],
              });
              const failures = await failuresOf(() =>
                runGraph(
                  {},
                  [...g.nodes, graphNode('d', 'd_node')],
                  [
                    graphEdge('par', 'branch_0', 'src'),
                    ...g.edges,
                    graphEdge('par', 'branch_1', 'd'),
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
            useParallelEngine(mockConfigService, 'off');
            const { runs, inputs } = recordRuns(['a', 'b', 'after']);
            const g = foreachWithBody(parallelBody());
            await runFromTrigger(g.nodes, g.edges);

            // 메인 루프의 되돌림 경로와 같다. done 뒤 노드도 회차마다 위상 순서대로
            // 실행되지만 완료 출력(branches · count)이 아니라 Parallel 자신의 출력(핸들러
            // output = null)을 받는다(NERV Task CLE-T-ZJR3AF).
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
              expect(input).toBeNull();
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
                graphNode('spar', 'parallel', { branchCount: 2 }),
                graphNode('a', 'a_node'),
                graphNode('b', 'b_node'),
                graphNode('after', 'after_node'),
              ],
              [
                graphEdge('spar', 'branch_0', 'a'),
                graphEdge('spar', 'branch_1', 'b'),
                graphEdge('spar', 'done', 'after'),
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
                graphNode('spar', 'parallel', {
                  branchCount: 2,
                  maxConcurrency: 16,
                }),
                graphNode('spar2', 'parallel', {
                  branchCount: 2,
                  maxConcurrency: 4,
                }),
                graphNode('a', 'a_node'),
                graphNode('b', 'b_node'),
                graphNode('c', 'c_node'),
              ],
              [
                graphEdge('spar', 'branch_0', 'spar2'),
                graphEdge('spar2', 'branch_0', 'a'),
                graphEdge('spar2', 'branch_1', 'b'),
                graphEdge('spar', 'branch_1', 'c'),
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
