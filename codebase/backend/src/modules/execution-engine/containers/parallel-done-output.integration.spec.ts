/**
 * ExecutionEngineService — Parallel 완료 출력 통합 테스트 (PARALLEL_ENGINE=v1).
 *
 * done 포트 완료 출력 `{ branches, count, skipped? }` 의 모양과 항목 에러 정책,
 * `PARALLEL_ENGINE=off` 되돌림 경로, 병렬 분기 출구 노드 · Background 처리를 다룬다.
 * 「done 포트 완료 출력」 describe 의 다른 주제는 `parallel-node-row` ·
 * `parallel-branch-result` · `parallel-nested` · `parallel-in-container` 스펙에 있다.
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
import { mockOutput } from '../__test__/mock-output';
import { BackgroundHandler } from '../../../nodes/logic/background/background.handler';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
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

  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({ service, handlerRegistry, contextService, mockConfigService } = h);
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    afterEach(() => {
      resetEngineConfig(mockConfigService);
    });

    // CLE-NODE-PARALLEL v3 (CLE-T-2HD471) — 완료 출력 `{ branches, count, skipped? }`
    // 와 `port: 'done'`(단일 문자열). 실패한 병렬 분기 자리는 `null`, 실패 정보는
    // `skipped[{ index, error: { code, message } }]` (REQ-PARALLEL-012 · 017 · 029).
    describe('done 포트 완료 출력 (CLE-NODE-PARALLEL v3)', () => {
      const {
        doneReceived,
        sinkConfigs,
        registerHandler,
        parallelStructured,
        runGraph,
        setupFailingGraph,
        twoBranchGraph,
      } = setupDoneOutputFixture(() => h);

      it('continue 에서 실패한 병렬 분기 자리는 null 이고 skipped 에 { index, error: { code, message } } 가 모인다', async () => {
        const g = setupFailingGraph(() => {
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
            graphNode('a', 'ok_node'),
            graphNode('b', 'fail_node'),
            graphNode('c', 'fail_node'),
            graphNode('sink', 'sink_node'),
          ],
          [
            graphEdge('par', 'branch_0', 'a'),
            graphEdge('par', 'branch_1', 'b'),
            graphEdge('par', 'branch_2', 'c'),
            graphEdge('par', 'done', 'sink'),
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
        const g = twoBranchGraph('ok_node', 'ok_node');
        await runGraph({ errorPolicy: 'continue' }, g.nodes, g.edges);

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
          const g = setupFailingGraph(() => {
            throw new Error('notify failed');
          });
          await runGraph({ errorPolicy }, g.nodes, g.edges);

          expect(doneReceived).toHaveLength(0);
          expect(parallelStructured()?.port).not.toBe('done');
        },
      );

      it('_selectedPort 와 port 는 done 문자열이고 branches[i] 에 엔진 제어 필드가 없다', async () => {
        registerHandler('ok_node', async () => mockOutput({ ok: true }));
        const createSpy = jest.spyOn(contextService, 'createContext');
        try {
          const g = twoBranchGraph('ok_node', 'ok_node');
          await runGraph({}, g.nodes, g.edges);
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
        const createSpy = jest.spyOn(contextService, 'createContext');
        let rootPort: unknown;
        try {
          const g = twoBranchGraph('array_node', 'ok_node', {
            sinkConfig: {
              first: '{{ $node["par"].output.branches[0] }}',
            },
          });
          await runGraph({}, g.nodes, g.edges);
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
        const g = twoBranchGraph('ok_node', 'ok_node', {
          sinkConfig: {
            picked: '{{ $node["par"].output.branches[0].n }}',
            port: '{{ $node["par"].port }}',
          },
        });
        await runGraph({}, g.nodes, g.edges);

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
            graphNode('a1', 'first_node'),
            graphNode('a2', 'second_node'),
            graphNode('b', 'ok_node'),
            graphNode('sink', 'sink_node'),
          ],
          [
            graphEdge('par', 'branch_0', 'a1'),
            graphEdge('a1', 'out', 'a2'),
            graphEdge('par', 'branch_1', 'b'),
            graphEdge('par', 'done', 'sink'),
          ],
        );

        expect(seen.second).toEqual({ step: 1 });
        expect(doneReceived[0]).toEqual({
          branches: [{ step: 2 }, { ok: true }],
          count: 2,
        });
      });

      it('PARALLEL_ENGINE=off 되돌림 경로는 분기를 차례로 실행하고 완료 출력을 만들지 않는다', async () => {
        useParallelEngine(mockConfigService, 'off');
        const executed: string[] = [];
        registerHandler('ok_node', async () => {
          executed.push('ok');
          return mockOutput({ ok: true });
        });
        const g = twoBranchGraph('ok_node', 'ok_node');
        await runGraph({}, g.nodes, g.edges);

        expect(executed).toEqual(['ok', 'ok']);
        // done 뒤 노드는 Parallel 자신의 출력(핸들러 output = null)을 받는다. 설정 에코를
        // 펼친 flat 값이 아니다(NERV Task CLE-T-ZJR3AF). 완료 출력(branches · count ·
        // skipped)은 v1 경로만 만든다.
        expect(doneReceived).toHaveLength(1);
        expect(doneReceived[0]).toBeNull();
        expect(parallelStructured()).toMatchObject({
          output: null,
          port: ['branch_0', 'branch_1'],
        });
      });

      it('Parallel 뒤에 노드가 없어도 continue 실패가 완료 출력에 남는다', async () => {
        const g = setupFailingGraph(() => {
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
            graphNode('x', 'x_node'),
            graphNode('y', 'y_node'),
            graphNode('z', 'z_node'),
            graphNode('m', 'm_node'),
          ],
          [
            graphEdge('par', 'branch_0', 'x'),
            graphEdge('x', 'out', 'y'),
            graphEdge('x', 'out', 'm'),
            graphEdge('par', 'branch_1', 'z'),
            graphEdge('z', 'out', 'm'),
          ],
        );

        expect([...runs].sort()).toEqual(['m', 'x', 'y', 'z']);
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
            graphNode('pre', 'pre_node'),
            graphNode('bg', 'background'),
            graphNode('bgBody', 'ok_node'),
            graphNode('b', 'ok_node'),
            graphNode('sink', 'sink_node'),
          ],
          [
            graphEdge('par', 'branch_0', 'pre'),
            graphEdge('pre', 'out', 'bg'),
            graphEdge('bg', 'background', 'bgBody'),
            graphEdge('par', 'branch_1', 'b'),
            graphEdge('par', 'done', 'sink'),
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
    });
  });
});
