/**
 * parallel-p2 통합 테스트 (parallel-p2-followups §4).
 *
 * - HTTP 노드 분기에서 첫 실패 시 다른 분기의 HTTP 호출이 abort 되는지
 *   (cancel-others-on-fail × HTTP fetch signal cascade)
 * - nested Parallel concurrency cap silent clamp (ParallelExecutor)
 *
 * 런타임 nested-depth 가드(`PARALLEL_NESTED_DEPTH_EXCEEDED` throw) 검증은
 * execution-engine.service.spec.ts 의 planParallelBody 테스트로 이전했고,
 * 정적 save-time 규칙(`parallel:nested-depth-exceeded`)은 parallel.schema.spec.ts
 * 가 커버한다. 본 spec 은 cancel-others-on-fail signal cascade + concurrency
 * clamp 만 다룬다 — ExecutionEngineService 의 전체 mock 셋업을 피한다.
 */
import { ParallelExecutor } from '../containers/parallel-executor';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

// SUMMARY#4 (W-1): parentParallelConcurrency 는 required `number | undefined` —
// 최외각 Parallel 테스트에서 `undefined` 를 명시 전달하는 이유:
// W-1 시그니처 강화로 optional → required number|undefined 로 바뀌어
// 타입 체커가 인자 누락을 오류로 잡기 위해 undefined 를 명시해야 한다.
describe('parallel-p2 integration (§4 followups)', () => {
  const baseContext: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };

  describe('cancel-others-on-fail × HTTP fetch signal cascade', () => {
    it('첫 분기 실패 시 다른 분기에 전달된 signal 이 abort 되어 fetch 가 즉시 중단', async () => {
      const executor = new ParallelExecutor();
      // 두 branch — 0 은 즉시 throw, 1 은 abort 까지 기다리는 fetch-like 호출
      const fetchAbortObserved = jest.fn();
      const result = await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          baseContext,
          async (i, branchCtx) => {
            if (i === 0) {
              throw new Error('first-branch-fails');
            }
            // branch_1 은 fetch 처럼 abort 시 reject. 무한 대기.
            await new Promise<void>((_, reject) => {
              const signal = branchCtx.abortSignal;
              if (!signal) return reject(new Error('no signal'));
              if (signal.aborted) {
                fetchAbortObserved();
                reject(
                  Object.assign(new Error('aborted'), { name: 'AbortError' }),
                );
                return;
              }
              signal.addEventListener(
                'abort',
                () => {
                  fetchAbortObserved();
                  reject(
                    Object.assign(new Error('aborted'), { name: 'AbortError' }),
                  );
                },
                { once: true },
              );
            });
          },
          undefined,
        )
        .catch((e: Error) => e);
      expect((result as Error).message).toBe('first-branch-fails');
      expect(fetchAbortObserved).toHaveBeenCalledTimes(1);
    });

    it('errorPolicy=stop 은 cancel-others 효과 없음 — branch 1 이 throw 되어 끝까지 진행', async () => {
      const executor = new ParallelExecutor();
      let branch1Completed = false;
      await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'stop',
          },
          baseContext,
          async (i, branchCtx) => {
            if (i === 0) {
              throw new Error('first-fails');
            }
            // branch_1: stop 정책에서는 cancel-others 컨트롤러가 생성되지 않으므로
            // abortSignal 은 undefined. 작업을 끝까지 완료.
            expect(branchCtx.abortSignal).toBeUndefined();
            await new Promise((r) => setTimeout(r, 10));
            branch1Completed = true;
          },
          undefined,
        )
        .catch(() => undefined);
      expect(branch1Completed).toBe(true);
    });

    // ai-review(15_43_17 INFO#4 / 15_55_44 INFO) — addEventListener 경로가 아닌
    // 즉시 `signal.aborted` 분기(parallel-executor 의 분기 진입 시점 사전 체크) 커버.
    // 상위 context.abortSignal 을 진입 전 이미 abort 상태로 전달하면 executor 가
    // cancelController 로 cascade(§5) → 모든 분기가 시작 즉시 aborted signal 을 본다.
    it('상위 abortSignal 이 이미 abort 된 채 진입 → 분기가 즉시 signal.aborted 경로로 reject', async () => {
      const executor = new ParallelExecutor();
      const immediateAbortObserved = jest.fn();
      const viaListener = jest.fn();
      const preAborted = new AbortController();
      preAborted.abort(); // 진입 전 이미 abort
      const ctx: ExecutionContext = {
        ...baseContext,
        abortSignal: preAborted.signal,
      };
      await executor
        .execute(
          {
            branchCount: 2,
            maxConcurrency: 0,
            waitAll: true,
            errorPolicy: 'cancel-others-on-fail',
          },
          ctx,
          async (_i, branchCtx) => {
            const signal = branchCtx.abortSignal;
            if (!signal) throw new Error('no signal');
            if (signal.aborted) {
              immediateAbortObserved();
              throw Object.assign(new Error('aborted'), { name: 'AbortError' });
            }
            // 여기 도달 = 즉시 경로 미발화 (listener 경로로 빠짐) → 실패로 간주.
            await new Promise<void>((_, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  viaListener();
                  reject(new Error('via-listener'));
                },
                { once: true },
              );
            });
          },
          undefined,
        )
        .catch(() => undefined);
      // 상위 signal 이 cancelController 로 cascade → 분기들이 즉시-abort 경로로 진입.
      expect(immediateAbortObserved).toHaveBeenCalled();
      expect(viaListener).not.toHaveBeenCalled();
    });
  });

  describe('nested Parallel concurrency cap silent clamp', () => {
    it('외부 effective × 내부 effective > 32 시 내부 effective 가 silent clamp', async () => {
      const executor = new ParallelExecutor();
      let observedPeak = 0;
      let currentRunning = 0;
      const result = await executor.execute(
        { branchCount: 8, maxConcurrency: 8, waitAll: true },
        baseContext,
        async () => {
          currentRunning++;
          observedPeak = Math.max(observedPeak, currentRunning);
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
        // 외부 Parallel 의 effective=16 가 set 됐다고 가정
        16,
      );
      // intended 내부 effective = 8, allowed = floor(32/16) = 2 → clamp to 2
      // SUMMARY#1/#3: clamp 하한(최소 1 브랜치 실행) 및 상한 양방향 검증
      expect(observedPeak).toBeGreaterThan(0);
      expect(observedPeak).toBeLessThanOrEqual(2);
      expect(result.clampedConcurrency).toEqual({
        intended: 8,
        actual: 2,
        parentEffective: 16,
        cap: 32,
      });
    });

    it('외부 × 내부 ≤ 32 시 clamp 없음', async () => {
      const executor = new ParallelExecutor();
      const result = await executor.execute(
        { branchCount: 4, maxConcurrency: 4, waitAll: true },
        baseContext,
        async () => {
          await new Promise((r) => setTimeout(r, 1));
        },
        8,
      );
      // 8 × 4 = 32 ≤ 32 → no clamp
      expect(result.clampedConcurrency).toBeUndefined();
    });

    // ai-review(15_43_17 INFO#3 / 15_55_44 INFO) — clamp 하한 경계.
    // parentEffective=32 → allowed = max(1, floor(32/32)) = 1 → 내부가 1 로 clamp.
    // `Math.max(1, …)` 가 0 으로의 clamp(=deadlock)를 막아 최소 1 분기는 실행됨을 확정.
    it('외부 effective=32 → 내부 1 로 clamp (하한 1, deadlock 방지)', async () => {
      const executor = new ParallelExecutor();
      let observedPeak = 0;
      let currentRunning = 0;
      const result = await executor.execute(
        { branchCount: 2, maxConcurrency: 2, waitAll: true },
        baseContext,
        async () => {
          currentRunning++;
          observedPeak = Math.max(observedPeak, currentRunning);
          await new Promise((r) => setTimeout(r, 5));
          currentRunning--;
        },
        32, // 외부 effective=32 → allowed = floor(32/32) = 1
      );
      // 하한 보장: 동시 실행 peak 가 정확히 1 (0 으로 clamp 되지 않아 진행됨).
      expect(observedPeak).toBe(1);
      expect(result.clampedConcurrency).toEqual({
        intended: 2,
        actual: 1,
        parentEffective: 32,
        cap: 32,
      });
    });
  });
});
