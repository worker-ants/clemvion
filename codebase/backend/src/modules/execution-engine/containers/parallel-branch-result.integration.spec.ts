/**
 * ExecutionEngineService — Parallel 병렬 분기 결과 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * 병렬 분기의 결과 노드 고르기(REQ-PARALLEL-030), 분기 캐시 사본 동기화
 * (REQ-PARALLEL-009), 분기 안 런타임 블로킹 가드를 다룬다.
 *
 * `execution-engine.service.spec.ts` 에서 나눠 냈다. 서비스 구성은
 * `__test-utils__/engine-service-harness.ts`, describe 범위 준비는
 * `__test-utils__/parallel-engine-fixtures.ts` 를 쓴다. describe 이름은 원래 스펙과 같게
 * 두어 테스트 전체 이름이 바뀌지 않는다.
 */
import { NodeHandlerRegistry } from '../../../nodes/core/node-handler.registry';
import { ExecutionContextService } from '../context/execution-context.service';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
import { mockOutput } from '../__test__/mock-output';
import { ForEachHandler } from '../../../nodes/logic/foreach/foreach.handler';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
} from '../__test-utils__/engine-service-harness';
import { graphEdge, graphNode } from '../__test-utils__/graph-fixtures';
import {
  resetEngineConfig,
  setupDoneOutputFixture,
} from '../__test-utils__/parallel-engine-fixtures';

describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let handlerRegistry: NodeHandlerRegistry;
  let contextService: ExecutionContextService;
  let mockConfigService: EngineServiceHarness['mockConfigService'];

  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({ handlerRegistry, contextService, mockConfigService } = h);
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    afterEach(() => {
      resetEngineConfig(mockConfigService);
    });

    // CLE-NODE-PARALLEL v3 (CLE-T-2HD471) — 완료 출력 `{ branches, count, skipped? }`
    // 와 `port: 'done'`(단일 문자열). 실패한 병렬 분기 자리는 `null`, 실패 정보는
    // `skipped[{ index, error: { code, message } }]` (REQ-PARALLEL-012 · 017 · 029).
    describe('done 포트 완료 출력 (CLE-NODE-PARALLEL v3)', () => {
      const { doneReceived, registerHandler, runGraph } =
        setupDoneOutputFixture(() => h);

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
              graphNode('a', 'ok_node'),
              ...branch1Nodes,
              graphNode('sink', 'sink_node'),
            ],
            [
              graphEdge('par', 'branch_0', 'a'),
              ...branch1Edges,
              graphEdge('par', 'done', 'sink'),
            ],
          );
          expect(doneReceived).toHaveLength(1);
          return (doneReceived[0] as { branches: unknown[] }).branches[1];
        };

        // 앞 실행이 남긴 출력이 캐시에 있는 채로 Parallel 이 시작하는 상황(메인 그래프의
        // 되돌아가는 연결선 사이클, 재시도)을 만든다. 루트 컨텍스트의 캐시에 미리 심고
        // 병렬 분기 사본이 그 값을 그대로 들고 시작하게 한다.
        // 스파이는 아래 afterEach 가 되돌린다.
        let seedSpy: jest.SpyInstance | undefined;
        const seedRootCache = (seed: Record<string, unknown>) => {
          const createContext =
            contextService.createContext.bind(contextService);
          seedSpy = jest
            .spyOn(contextService, 'createContext')
            .mockImplementation((...args) => {
              const created = createContext(...args);
              Object.assign(created.nodeOutputCache, seed);
              return created;
            });
        };
        afterEach(() => {
          seedSpy?.mockRestore();
          seedSpy = undefined;
        });

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
              graphNode('cond', 'cond_node'),
              graphNode('n-false', 'mark_node'),
              graphNode('n-true', 'never_node'),
            ],
            [
              graphEdge('par', 'branch_1', 'cond'),
              graphEdge('cond', 'false', 'n-false'),
              graphEdge('cond', 'true', 'n-true'),
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
            [graphNode('cond', 'cond_node'), graphNode('later', 'never_node')],
            [
              graphEdge('par', 'branch_1', 'cond'),
              graphEdge('cond', 'false', 'later'),
            ],
          );

          expect(result).toEqual({ checked: true });
          expect(result).not.toHaveProperty('_selectedPort');
        });

        it('실행된 노드가 없으면 null 이다 (비활성 노드 · skip_node 로 건너뛴 노드)', async () => {
          registerHandler('fail_node', async () => {
            throw new Error('skipped by policy');
          });
          const disabled = { ...graphNode('off', 'ok_node'), isDisabled: true };

          const result = await withBranch1(
            [
              graphNode('skip', 'fail_node', {
                errorHandling: { policy: 'skip_node' },
              }),
              disabled,
            ],
            [
              graphEdge('par', 'branch_1', 'skip'),
              graphEdge('skip', 'out', 'off'),
            ],
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
              graphNode('b1', 'first_node'),
              graphNode('b2', 'fail_node', {
                errorHandling: { policy: 'skip_node' },
              }),
            ],
            [graphEdge('par', 'branch_1', 'b1'), graphEdge('b1', 'out', 'b2')],
          );

          expect(result).toEqual({ first: true });
        });

        // Parallel 이 같은 실행에서 다시 실행되면 앞 실행의 출력이 캐시에 남아 있다.
        // 이번 실행이 쓴 노드만 결과로 센다.
        it('캐시에 남은 앞 실행 출력은 결과로 고르지 않는다 (이번에 건너뛴 노드)', async () => {
          registerHandler('fail_node', async () => {
            throw new Error('skipped by policy');
          });
          seedRootCache({ skip: { stale: true } });
          const result = await withBranch1(
            [
              graphNode('skip', 'fail_node', {
                errorHandling: { policy: 'skip_node' },
              }),
            ],
            [graphEdge('par', 'branch_1', 'skip')],
          );
          expect(result).toBeNull();
        });

        it('캐시에 앞 실행 출력이 있어도 이번에 다시 실행한 노드는 새 출력을 담는다', async () => {
          registerHandler('fresh_node', async () =>
            mockOutput({ fresh: true }),
          );
          seedRootCache({ b1: { stale: true } });
          const result = await withBranch1(
            [graphNode('b1', 'fresh_node')],
            [graphEdge('par', 'branch_1', 'b1')],
          );
          expect(result).toEqual({ fresh: true });
        });

        it('이번 출력이 앞 실행 출력과 같은 원시값이어도 새로 쓴 노드로 센다', async () => {
          // 객체가 아닌 출력은 캐시에 값 그대로 들어가 참조가 아니라 값이 같다.
          registerHandler('same_value_node', async () =>
            mockOutput('same-value'),
          );
          seedRootCache({ b1: 'same-value' });
          const result = await withBranch1(
            [graphNode('b1', 'same_value_node')],
            [graphEdge('par', 'branch_1', 'b1')],
          );
          expect(result).toBe('same-value');
        });

        it('use_default_output 이 앞 실행과 같은 defaultOutput 참조를 다시 써도 새로 쓴 노드로 센다', async () => {
          // defaultOutput 은 설정에 든 객체 하나라서 실패할 때마다 같은 참조가 캐시에 쓰인다.
          registerHandler('fail_node', async () => {
            throw new Error('always fails');
          });
          const defaultOutput = { fallback: true };
          seedRootCache({ b1: defaultOutput });
          const result = await withBranch1(
            [
              graphNode('b1', 'fail_node', {
                errorHandling: {
                  policy: 'use_default_output',
                  defaultOutput,
                },
              }),
            ],
            [graphEdge('par', 'branch_1', 'b1')],
          );
          expect(result).toEqual({ fallback: true });
        });

        it('끝나는 노드가 둘 이상 실행되면 엔진 위상 정렬 순서(같은 단계는 노드 ID 순)의 마지막 노드를 고른다', async () => {
          registerHandler('start_node', async () =>
            mockOutput({ start: true }),
          );
          registerHandler('leaf_b', async () => mockOutput({ leaf: 'n-b' }));
          registerHandler('leaf_c', async () => mockOutput({ leaf: 'n-c' }));

          const result = await withBranch1(
            [
              graphNode('n-a', 'start_node'),
              graphNode('n-c', 'leaf_c'),
              graphNode('n-b', 'leaf_b'),
            ],
            [
              graphEdge('par', 'branch_1', 'n-a'),
              graphEdge('n-a', 'out', 'n-c'),
              graphEdge('n-a', 'out', 'n-b'),
            ],
          );

          expect(result).toEqual({ leaf: 'n-c' });
        });
      });

      // branch_0 이 테스트 대상이고 branch_1 은 늘 ok 노드 하나다. 「분기 캐시 동기화」 ·
      // 「분기 안 런타임 블로킹 가드」 가 쓴다.
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
            graphNode('b', 'ok_node'),
            graphNode('sink', 'sink_node'),
          ],
          [
            ...branch0Edges,
            graphEdge('par', 'branch_1', 'b'),
            graphEdge('par', 'done', 'sink'),
          ],
        );
        expect(doneReceived).toHaveLength(1);
        return doneReceived[0] as {
          branches: unknown[];
          skipped?: {
            index: number;
            error: { code: string; message: string };
          }[];
        };
      };

      // 병렬 분기 사본에 출력을 옮기는 쓰기 지점마다 하나씩 고정한다
      // (`commitNodeOutput`: 일반 노드 · use_default_output · route_to_error_port ·
      // 분기 안 컨테이너 마감과 구조화 캐시).
      describe('분기 캐시 동기화 (REQ-PARALLEL-009)', () => {
        // src → fe(body → emit) → after. 본문 노드는 아이템마다 n 을 두 배로 만든다.
        const foreachBranchGraph = ({ withAfter }: { withAfter: boolean }) => {
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
              graphNode('src', 'items_node'),
              graphNode('fe', 'foreach', { arrayField: 'items' }),
              { ...graphNode('body', 'double_node'), containerId: 'fe' },
              ...(withAfter ? [graphNode('after', 'after_node')] : []),
            ],
            edges: [
              graphEdge('par', 'branch_0', 'src'),
              graphEdge('src', 'out', 'fe'),
              graphEdge('fe', 'body', 'body'),
              { ...graphEdge('body', 'out', 'fe'), targetPort: 'emit' },
              ...(withAfter ? [graphEdge('fe', 'done', 'after')] : []),
            ],
          };
        };

        it('분기 안 ForEach 가 결과 노드면 branches[i] 에 컨테이너 최종 출력({ items, count })을 담는다', async () => {
          const g = foreachBranchGraph({ withAfter: false });

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
          const g = foreachBranchGraph({ withAfter: true });

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
              graphNode('ud', 'fail_node', {
                errorHandling: {
                  policy: 'use_default_output',
                  defaultOutput: { fallback: true },
                },
              }),
              graphNode('next', 'next_node'),
            ],
            [
              graphEdge('par', 'branch_0', 'ud'),
              graphEdge('ud', 'out', 'next'),
            ],
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
              graphNode('re', 'fail_node', {
                errorHandling: { policy: 'route_to_error_port' },
              }),
              graphNode('on-error', 'on_error_node'),
            ],
            [
              graphEdge('par', 'branch_0', 're'),
              graphEdge('re', 'error', 'on-error'),
            ],
          );

          expect(errorInputs).toEqual([
            { error: { code: 'UNKNOWN_ERROR', message: 'routed failure' } },
          ]);
          expect(result.branches[0]).toEqual({ handled: true });
        });

        it('분기 안 다음 노드의 표현식이 앞 노드의 구조화 출력(output · port)을 읽는다', async () => {
          // 구조화 캐시도 분기 사본에 옮겨야 `$node["a1"]` 가 방금 쓴 출력을 본다. 평면
          // 캐시에서 다시 만들면 라우팅 표지(_selectedPort)가 output 에 섞인다.
          const readConfigs: Record<string, unknown>[] = [];
          registerHandler('first_node', async () =>
            mockOutput({ x: 5 }, { port: 'out' }),
          );
          registerHandler('read_node', async (_input, config) => {
            readConfigs.push(config);
            return mockOutput({ read: true });
          });

          const result = await runBranch0(
            [
              graphNode('a1', 'first_node'),
              graphNode('a2', 'read_node', {
                x: '{{ $node["a1"].output.x }}',
                port: '{{ $node["a1"].port }}',
                whole: '{{ $node["a1"].output }}',
              }),
            ],
            [graphEdge('par', 'branch_0', 'a1'), graphEdge('a1', 'out', 'a2')],
          );

          expect(readConfigs).toEqual([
            expect.objectContaining({ x: 5, port: 'out', whole: { x: 5 } }),
          ]);
          expect(result.branches[0]).toEqual({ read: true });
        });
      });

      // 정적 검증(planParallelBody)이 못 막는 블로킹 노드는 분기 루프의 런타임 가드가 막는다.
      describe('분기 안 런타임 블로킹 가드', () => {
        it('분기 안에서 실행 중에 waiting_for_input 을 내는 노드는 PARALLEL_INVALID_CHILD 로 분기를 실패시킨다', async () => {
          // 정적 검증(planParallelBody)은 메타데이터가 blocking 인 노드만 막는다. 실행해
          // 봐야 대기 상태가 되는 노드는 분기 루프의 런타임 가드가 막는다. 분기 사본에 출력이
          // 보여야 이 가드가 동작한다.
          registerHandler('waiting_node', async () =>
            mockOutput(null, { status: 'waiting_for_input' }),
          );

          const result = await runBranch0(
            [graphNode('wait', 'waiting_node')],
            [graphEdge('par', 'branch_0', 'wait')],
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
    });
  });
});
