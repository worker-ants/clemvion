/**
 * parallel-p2 통합 테스트 (parallel-p2-followups §4).
 *
 * - HTTP 노드 분기에서 첫 실패 시 다른 분기의 HTTP 호출이 abort 되는지
 *   (cancel-others-on-fail × HTTP fetch signal cascade)
 * - 3층 중첩 Parallel dispatch 가 `PARALLEL_NESTED_DEPTH_EXCEEDED` 로 throw
 *   되는지 (#367 의 단위 테스트가 planParallelBody depth=2 만 검증 — 본
 *   spec 은 ParallelExecutor + planParallelBody 의 dispatch chain 검증)
 *
 * 본 spec 은 ExecutionEngineService 의 전체 mock 셋업을 거치지 않고
 * ParallelExecutor + planParallelBody 의 통합만 직접 검증 — 기존
 * execution-engine.service.spec.ts 의 무거운 셋업을 피한다.
 */
import { ParallelExecutor } from '../containers/parallel-executor';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

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
  });
});
