import {
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
    input: unknown,
    config: Record<string, unknown>,
  ): Promise<NodeHandlerOutput> {
    const branchCount =
      typeof config.branchCount === 'number' &&
      Number.isFinite(config.branchCount)
        ? Math.max(2, Math.min(16, Math.floor(config.branchCount)))
        : 2;

    const maxConcurrency =
      typeof config.maxConcurrency === 'number' &&
      Number.isFinite(config.maxConcurrency)
        ? Math.max(0, Math.min(16, Math.floor(config.maxConcurrency)))
        : 0;

    const waitAll = typeof config.waitAll === 'boolean' ? config.waitAll : true;

    const ports = Array.from({ length: branchCount }, (_, i) => `branch_${i}`);

    return {
      config: { branchCount, maxConcurrency, waitAll },
      output: input,
      port: ports,
    };
  }
}
