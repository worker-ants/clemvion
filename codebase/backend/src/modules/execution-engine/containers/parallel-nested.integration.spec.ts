/**
 * ExecutionEngineService — 안쪽 Parallel 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * 병렬 분기 안의 안쪽 Parallel 실행 · 동시 실행 수 곱 상한 · 중첩 깊이 검사
 * (REQ-PARALLEL-024 · 025)와 안쪽 Parallel 본문 사전 검사를 다룬다.
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은
 * `__test-utils__/engine-service-harness.ts`, describe 범위 준비는
 * `__test-utils__/parallel-engine-fixtures.ts` 를 쓴다. describe 이름은 원래 스펙과 같게
 * 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { ExecutionEngineService } from '../execution-engine.service';
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
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
  flushPromises,
} from '../__test-utils__/engine-service-harness';
import { graphEdge, graphNode } from '../__test-utils__/graph-fixtures';
import {
  resetEngineConfig,
  useDoneOutputFixture,
} from '../__test-utils__/parallel-engine-fixtures';

describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockConfigService: EngineServiceHarness['mockConfigService'];

  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({ service, handlerRegistry, mockConfigService } = h);
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
        useDoneOutputFixture(() => h);

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
        // par.branch_0 → par2 → [branch_0 → a, branch_1 → b], par.branch_1 → d,
        // par.done → sink 를 기본 그래프로 한다. 테스트마다 달라지는 부분만 넘긴다.
        const buildInnerParallelGraph = (
          opts: {
            innerConfig?: Record<string, unknown>;
            types?: Partial<Record<'a' | 'b' | 'd', string>>;
            extraNodes?: Partial<Node>[];
            extraEdges?: Partial<Edge>[];
          } = {},
        ) => ({
          nodes: [
            graphNode(
              'par2',
              'parallel',
              opts.innerConfig ?? { branchCount: 2 },
            ),
            graphNode('a', opts.types?.a ?? 'a_node'),
            graphNode('b', opts.types?.b ?? 'b_node'),
            graphNode('d', opts.types?.d ?? 'd_node'),
            graphNode('sink', 'sink_node'),
            ...(opts.extraNodes ?? []),
          ],
          edges: [
            graphEdge('par', 'branch_0', 'par2'),
            graphEdge('par2', 'branch_0', 'a'),
            graphEdge('par2', 'branch_1', 'b'),
            graphEdge('par', 'branch_1', 'd'),
            graphEdge('par', 'done', 'sink'),
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
              extraNodes: [graphNode('c', 'c_node')],
              extraEdges: [graphEdge('par2', 'done', 'c')],
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
              extraNodes: [
                graphNode('c', 'c_probe'),
                graphNode('top', 'top_probe'),
              ],
              extraEdges: [
                graphEdge('par2', 'done', 'c'),
                graphEdge('par', 'done', 'top'),
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
              extraNodes: [graphNode('m', 'm_node')],
              extraEdges: [
                graphEdge('a', 'out', 'm'),
                graphEdge('b', 'out', 'm'),
              ],
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
              extraNodes: [graphNode('c', 'c_node')],
              extraEdges: [graphEdge('par2', 'done', 'c')],
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
              extraNodes: [
                graphNode('bf', 'fail_node'),
                graphNode('c', 'c_probe'),
              ],
              extraEdges: [
                graphEdge('b', 'out', 'bf'),
                graphEdge('par2', 'done', 'c'),
              ],
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
              extraNodes: [graphNode('c', 'c_node')],
              extraEdges: [graphEdge('par2', 'done', 'c')],
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
                graphNode('par2', 'parallel', { branchCount: 2 }),
                graphNode('par3', 'parallel', { branchCount: 2 }),
                graphNode('x', 'x_node'),
                graphNode('d', 'd_node'),
                graphNode('sink', 'sink_node'),
              ],
              [
                graphEdge('par', 'branch_0', 'par2'),
                graphEdge('par2', 'branch_0', 'par3'),
                graphEdge('par3', 'branch_0', 'x'),
                graphEdge('par', 'branch_1', 'd'),
                graphEdge('par', 'done', 'sink'),
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
            child: Partial<Node>[];
            childEdges: Partial<Edge>[];
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
                  graphNode('par2', 'parallel', opts.innerConfig),
                  ...opts.child,
                  graphNode('d', 'd_node'),
                  graphNode('sink', 'sink_node'),
                ],
                [
                  graphEdge('par', 'branch_0', 'par2'),
                  graphEdge('par2', opts.innerPort, opts.child[0].id as string),
                  ...opts.childEdges,
                  graphEdge('par', 'branch_1', 'd'),
                  graphEdge('par', 'done', 'sink'),
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
                  graphNode('par3', 'parallel', { branchCount: 2 }),
                  graphNode('x', 'x_node'),
                ],
                childEdges: [graphEdge('par3', 'branch_0', 'x')],
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
              child: [graphNode('form1', 'form_like')],
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
    });
  });
});
