import { Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

export type ParallelErrorPolicy = 'stop' | 'continue';

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

export interface ParallelResult {
  settled: PromiseSettledResult<void>[];
  failures: BranchFailure[];
}

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
  /**
   * @param config — Parallel node config (branchCount, maxConcurrency, waitAll, errorPolicy).
   * @param context — Shared execution context. Each branch receives a shallow clone
   *   that clears `itemContext` / `loopContext` so inner ForEach/Loop containers
   *   do not leak state across branches.
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
    const effectiveConcurrency =
      maxConcurrency > 0 ? maxConcurrency : branchCount;
    const errorPolicy: ParallelErrorPolicy = config.errorPolicy ?? 'stop';

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
          };
          await runBranch(i, branchContext);
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
    if (errorPolicy === 'stop' && failures.length > 0) {
      throw failures[0].error;
    }

    return { settled, failures };
  }
}
