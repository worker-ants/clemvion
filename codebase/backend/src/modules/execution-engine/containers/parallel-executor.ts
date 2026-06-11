import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import {
  ExecutionContext,
  ParallelBranchContext,
} from '../../../nodes/core/node-handler.interface';

export type ParallelErrorPolicy = 'stop' | 'continue' | 'cancel-others-on-fail';

/**
 * refactor 06-concurrency M-5 — branch 별 `nodeOutputCache` 는 shallow copy 라
 * top-level 키 추가는 격리되지만 **값 객체 내부는 공유**된다 (deep clone 비용
 * 회피, spec `4-nodes/1-logic/10-parallel.md` 명시 설계). "값 내부를 mutate 하지
 * 않는다" invariant 는 JSDoc 합의일 뿐 기계 강제가 없어, 위반 핸들러가 추가되면
 * last-write-wins 비결정성이 조용히 발생한다.
 *
 * 이를 **dev/test 환경에서만** 즉시 검출하기 위해 branch clone 직후 공유 값
 * 객체를 **deep** `Object.freeze` 한다 — 중첩 속성까지 위반 mutate 시도가 strict
 * mode 에서 TypeError 로 표면화된다. production 은 미적용 (freeze 비용 회피 + 동작
 * 불변). 적용 지점은 본 helper 호출(=branch context 생성) 한 곳으로 한정한다.
 *
 * **주의 (ai-review W1)**: branch 의 `nodeOutputCache` 는 shallow copy 라 값 객체는
 * **원본과 동일 참조를 공유**한다 — 따라서 freeze 는 부모 context 의 값 객체에도
 * 적용된다. 이는 의도다: 부모/branch 어느 쪽이든 공유 값 내부 mutate 는 spec
 * invariant 위반이므로 양쪽 모두에서 검출돼야 한다. cache 값은 직렬화 가능한
 * output envelope 이라 순환 참조가 없으나, 방어적으로 이미 frozen 인 객체는 재귀
 * 에서 건너뛴다. deep freeze 비용은 첫 branch 실행에 집중되고 이후는 `isFrozen`
 * 조기 반환으로 무시 가능하다.
 *
 * **환경 판별 (ai-review W2·INFO6)**: `NODE_ENV` 미정의(undefined) 시 production
 * 에서 freeze 가 켜지지 않도록 `development`/`test` **allowlist** 로 한정한다
 * (`!== 'production'` 의 음성 판별은 미정의를 dev 로 오인).
 */
/** @internal — test-only export (M-5 가드의 환경 전제 단언용). 프로덕션 코드에서 사용 금지. */
export const FREEZE_BRANCH_CACHE =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

function deepFreeze(value: unknown): void {
  // 배열도 `typeof value === 'object'` 이므로 본 분기에서 함께 처리된다
  // (엘리먼트는 Object.values 순회로 재귀 freeze).
  if (value === null || typeof value !== 'object') return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const v of Object.values(value as Record<string, unknown>)) {
    deepFreeze(v);
  }
}

/**
 * branch-local shallow copy `cache` 의 **값 객체들**만 dev/test 에서 deep freeze
 * 한다 (cache 객체 자체는 freeze 안 함 — top-level 키 추가는 branch 격리 동작).
 * production 에선 no-op. 위 {@link FREEZE_BRANCH_CACHE} 주석 참조.
 */
function freezeSharedCacheValues<T extends Record<string, unknown>>(
  cache: T,
): T {
  if (!FREEZE_BRANCH_CACHE) return cache;
  // cache 자체(branch-local shallow copy)는 freeze 하지 않는다 — top-level 키
  // 추가는 branch 격리 동작이므로 허용. 공유되는 값 객체만 deep freeze.
  for (const v of Object.values(cache)) deepFreeze(v);
  return cache;
}

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
   *   do not leak state across branches.
   * @param runBranch — Engine-provided branch runner. Takes the 0-based branch
   *   index and the branch-scoped {@link ParallelBranchContext}; resolves when the
   *   branch body completes.
   * @param parentParallelConcurrency — 외부 Parallel 의 effectiveConcurrency.
   *   **required (`number | undefined`)** — caller 가 매 호출 명시 전달해야 한다
   *   (W-1, parallel-p2-followups §7): optional 로 두면 미래 호출처가 인자를 누락해도
   *   컴파일이 통과해 중첩 Parallel 의 silent clamp 가 조용히 빠지는 회귀를 못 막는다.
   *   중첩 Parallel 일 때 caller (engine) 가 부모 분기의 {@link ParallelBranchContext}
   *   에서 읽은 값을 넘기면 자기 effective 를 floor(32/parent) 로 silent clamp
   *   (parallel-p2 결정 #3 + G). 외부 Parallel 이 없으면 `undefined` 를 명시 전달하며
   *   이때는 clamp 없음. 본 값은 더 이상 ExecutionContext 의 필드가 아니라
   *   ParallelBranchContext 전용이며 (spec/conventions/execution-context.md §원칙 2),
   *   엔진 호출 경로를 통해서만 운반된다.
   */
  async execute(
    config: ParallelConfig,
    context: ExecutionContext,
    runBranch: (
      branchIndex: number,
      branchContext: ParallelBranchContext,
    ) => Promise<void>,
    parentParallelConcurrency: number | undefined,
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
    // effectiveConcurrency 가 parentParallelConcurrency 인자로 전달되어 있으면
    // 자기 effective 를 floor(32/parent) 로 silent clamp. 외부 × 내부 ≤ 32 보장.
    // 본 값은 부모 분기의 ParallelBranchContext 에서 engine 이 읽어 명시 전달한다
    // (spec/conventions/execution-context.md §원칙 2 — ExecutionContext 필드 아님).
    const parentEffective = parentParallelConcurrency;
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
          const branchContext: ParallelBranchContext = {
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
            // M-5 — dev/test 에서는 공유 값을 freeze 해 invariant 위반을 즉시 검출
            // (production 무변경). freezeSharedCacheValues 주석 참조.
            nodeOutputCache: freezeSharedCacheValues({
              ...context.nodeOutputCache,
            }),
            structuredOutputCache: freezeSharedCacheValues({
              ...context.structuredOutputCache,
            }),
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
