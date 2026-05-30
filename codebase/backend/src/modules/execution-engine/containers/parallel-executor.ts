import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

export type ParallelErrorPolicy = 'stop' | 'continue' | 'cancel-others-on-fail';

export interface ParallelConfig {
  branchCount: number;
  maxConcurrency: number;
  waitAll: boolean;
  errorPolicy?: ParallelErrorPolicy;
}

export interface BranchFailure {
  branchIndex: number;
  error: Error;
}

export interface ClampedConcurrency {
  intended: number;
  actual: number;
  parentEffective: number;
  cap: number;
}

export interface ParallelResult {
  settled: PromiseSettledResult<void>[];
  failures: BranchFailure[];
  /**
   * 중첩 Parallel 의 effectiveConcurrency 가 cap=32 의 silent clamp 로 줄었을 때
   * 기록. 미발생 (cap 미적용 또는 외부 Parallel 없음) 시 undefined.
   * 엔진은 이 값을 `NodeExecution.meta.clampedConcurrency` 에 기록해 runtime
   * 추적성 확보 (parallel-p2 결정 #3 + G + D, 2026-05-30).
   */
  clampedConcurrency?: ClampedConcurrency;
}

/**
 * 중첩 Parallel 의 외부 × 내부 effectiveConcurrency 곱셈 cap (parallel-p2 결정 #3).
 * 외부 maxConcurrency 16 × 내부 16 = 256 worker 폭발을 방지. silent clamp + meta
 * 기록 + debug 로그로 가시성 확보.
 */
export const NESTED_PARALLEL_CONCURRENCY_CAP = 32;

/**
 * Pure concurrency orchestrator for the Parallel logic node.
 *
 * Runs N branch bodies via `Promise.allSettled` with a `p-limit`
 * semaphore (respecting `maxConcurrency`). Branch body execution is the
 * engine's responsibility — this class only owns the concurrency contract,
 * per-branch context isolation (shallow clone), and errorPolicy aggregation.
 */
@Injectable()
export class ParallelExecutor {
  private readonly logger = new Logger(ParallelExecutor.name);

  /**
   * @param config — Parallel node config (branchCount, maxConcurrency, waitAll, errorPolicy).
   * @param context — Shared execution context. Each branch receives a shallow clone
   *   that clears `itemContext` / `loopContext` so inner ForEach/Loop containers
   *   do not leak state across branches. `parentParallelConcurrency` (if set)
   *   triggers the nested concurrency clamp (parallel-p2 결정 #3 + G).
   * @param runBranch — Engine-provided branch runner. Takes the 0-based branch
   *   index and the branch-scoped context; resolves when the branch body completes.
   */
  async execute(
    config: ParallelConfig,
    context: ExecutionContext,
    runBranch: (
      branchIndex: number,
      branchContext: ExecutionContext,
    ) => Promise<void>,
  ): Promise<ParallelResult> {
    const branchCount = Math.max(
      2,
      Math.min(16, Math.floor(config.branchCount)),
    );
    const maxConcurrency = Math.max(
      0,
      Math.min(16, Math.floor(config.maxConcurrency)),
    );
    const intendedEffective = maxConcurrency > 0 ? maxConcurrency : branchCount;

    // 중첩 Parallel concurrency cap (parallel-p2 결정 #3 + G + D). 외부 Parallel 의
    // effectiveConcurrency 가 context.parentParallelConcurrency 에 set 되어 있으면
    // 자기 effective 를 floor(32/parent) 로 silent clamp. 외부 × 내부 ≤ 32 보장.
    const parentEffective = context.parentParallelConcurrency;
    let effectiveConcurrency = intendedEffective;
    let clampedConcurrency: ClampedConcurrency | undefined;
    if (parentEffective !== undefined && parentEffective > 0) {
      const allowed = Math.max(
        1,
        Math.floor(NESTED_PARALLEL_CONCURRENCY_CAP / parentEffective),
      );
      if (intendedEffective > allowed) {
        effectiveConcurrency = allowed;
        clampedConcurrency = {
          intended: intendedEffective,
          actual: allowed,
          parentEffective,
          cap: NESTED_PARALLEL_CONCURRENCY_CAP,
        };
        this.logger.debug(
          `[ParallelExecutor] nested concurrency clamp: parent=${parentEffective} × intended=${intendedEffective} > cap=${NESTED_PARALLEL_CONCURRENCY_CAP}; actual=${allowed}`,
        );
      }
    }
    const errorPolicy: ParallelErrorPolicy = config.errorPolicy ?? 'stop';

    // parallel-p2 §5 (결정 A + H, 2026-05-30): cancel-others-on-fail 일 때 자기
    // 분기 그룹용 AbortController 를 만들고 branch context 에 그 signal 을 전파.
    // 첫 분기 실패 시 controller.abort() 호출 → signal-aware 노드 (HTTP / DB /
    // AI / Email — node-cancellation.md 컨벤션) 가 즉시 cleanup.
    // 외부에서 전달된 context.abortSignal 이 있으면 그 abort 도 cascade — 상위
    // cancellation 이 본 그룹에도 전파됨.
    const cancelController =
      errorPolicy === 'cancel-others-on-fail' ? new AbortController() : null;
    const upstreamSignal = context.abortSignal;
    if (cancelController && upstreamSignal) {
      if (upstreamSignal.aborted) {
        cancelController.abort();
      } else {
        const onUpstreamAbort = () => cancelController.abort();
        upstreamSignal.addEventListener('abort', onUpstreamAbort, {
          once: true,
        });
        cancelController.signal.addEventListener(
          'abort',
          () => upstreamSignal.removeEventListener('abort', onUpstreamAbort),
          { once: true },
        );
      }
    }
    const branchSignal = cancelController
      ? cancelController.signal
      : upstreamSignal;

    const limit = pLimit(effectiveConcurrency);
    const indices = Array.from({ length: branchCount }, (_, i) => i);

    const settled = await Promise.allSettled(
      indices.map((i) =>
        limit(async () => {
          const branchContext: ExecutionContext = {
            ...context,
            // WARN #14 (Concurrency) — 중첩 객체를 두 브랜치가 await 경계를
            // 넘어 쓰면 last-write-wins 비결정성 발생. structuredClone 으로
            // deep clone 하여 브랜치 간 격리.
            variables: structuredClone(context.variables),
            // INFO #9 (Concurrency) — `nodeOutputCache` / `structuredOutputCache` 의
            // **shallow copy**. 현재 spec 상 parallel 의 각 branch 는 배타적 노드
            // 집합 (서로 다른 nodeId 들) 을 갖도록 강제되므로 (planParallelBody +
            // CONTAINER_INVALID_CHILD 검증) 같은 키 충돌은 발생할 수 없지만,
            // 향후 sub-workflow 가 branch 안에서 부모와 같은 nodeId 를 가질
            // 가능성에 대비해 top-level reference 를 분리해 last-write-wins 를
            // 컴파일 타임 차단한다. 값 객체는 여전히 공유 (deep clone 비용 회피)
            // — branch 가 cache 값의 내부를 mutate 하면 안 된다는 invariant 는
            // node-handler.interface.ts 의 ExecutionContext JSDoc 에 명시.
            nodeOutputCache: { ...context.nodeOutputCache },
            structuredOutputCache: { ...context.structuredOutputCache },
            itemContext: undefined,
            loopContext: undefined,
            // 결정 G: 내부 Parallel 이 자기 effective 를 clamp 하기 위해
            // 외부 effective 를 전파. 깊이 ≤ 2 가드 (planParallelBody) 하에서
            // 한 단계만 누적되므로 단순 set (overwrite).
            parentParallelConcurrency: effectiveConcurrency,
            // 결정 A: cancel-others-on-fail 시 자기 그룹용 controller.signal,
            // 아니면 상위 abortSignal pass-through (있는 경우).
            abortSignal: branchSignal,
          };
          try {
            await runBranch(i, branchContext);
          } catch (err) {
            if (cancelController && !cancelController.signal.aborted) {
              // 첫 실패 시 즉시 다른 분기 abort. 한 번만 발화 (idempotent).
              cancelController.abort();
            }
            throw err;
          }
        }),
      ),
    );

    const failures: BranchFailure[] = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === 'rejected') {
        const reason: unknown = result.reason;
        failures.push({
          branchIndex: i,
          error: reason instanceof Error ? reason : new Error(String(reason)),
        });
      }
    }

    // errorPolicy=stop: surface the first failure so the Parallel node
    // transitions to FAILED via executeNode's catch + errorPolicyHandler.
    // errorPolicy=cancel-others-on-fail: 첫 실패가 다른 분기를 abort 시키므로
    // 그 abort 로 인한 다운스트림 AbortError 는 의도된 결과. 외부에는 첫 실패
    // 의 원인 (root cause) 만 throw 해 의미를 보존.
    if (errorPolicy === 'stop' && failures.length > 0) {
      throw failures[0].error;
    }
    if (errorPolicy === 'cancel-others-on-fail' && failures.length > 0) {
      // 첫 (root cause) failure 를 가장 먼저 throw — AbortError 는 후속 분기의
      // cleanup 결과이므로 사용자 메시지의 신호 대 잡음을 위해 root 만 노출.
      const rootCause =
        failures.find((f) => f.error.name !== 'AbortError')?.error ??
        failures[0].error;
      throw rootCause;
    }

    return { settled, failures, clampedConcurrency };
  }
}
