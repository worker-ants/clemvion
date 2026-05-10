import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { parallelNodeMetadata } from './parallel.schema';

/**
 * Parallel 노드 핸들러.
 *
 * 입력을 그대로 pass-through 하고 `branch_0` ~ `branch_{branchCount-1}`
 * 포트를 동시에 활성화한다. 실제 병렬 실행은 `PARALLEL_ENGINE=v1` 모드에서
 * ExecutionEngineService 가 ParallelExecutor 로 위임해 수행한다.
 * Feature flag off 모드에서는 엔진이 기존 순차 루프로 각 분기를 실행한다.
 */
export class ParallelHandler implements NodeHandler {
  metadata = parallelNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) mirrors all of handler's
    // legacy inline rules verbatim (Korean messages preserved 1:1).
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const branchCount =
      typeof config.branchCount === 'number' &&
      Number.isFinite(config.branchCount)
        ? Math.max(2, Math.min(16, Math.floor(config.branchCount)))
        : 2;

    const ports = Array.from({ length: branchCount }, (_, i) => `branch_${i}`);

    // CONVENTIONS Principle 7 — config echoes raw branchCount /
    // maxConcurrency / waitAll. parallel's fields are bounded literals
    // (numeric / boolean) so raw and evaluated are identical in the
    // common case; rawConfig is still used for consistency + so future
    // expression-templated fields (if added) auto-flow through.
    //
    // CONVENTIONS Principle 9 (container handler / engine override):
    // `output: null` mirrors loop/foreach/map. The engine overrides on
    // completion with `{ branches: [...] }` (allSettled-shaped entries).
    const rawConfig = context.rawConfig ?? config;
    return {
      config: {
        branchCount: rawConfig.branchCount,
        maxConcurrency: rawConfig.maxConcurrency,
        waitAll: rawConfig.waitAll,
      },
      output: null,
      port: ports,
    };
  }
}
