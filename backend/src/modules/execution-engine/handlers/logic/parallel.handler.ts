import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../node-handler.interface';

/**
 * Parallel 노드 핸들러.
 * 입력 데이터를 N개 분기 포트(`branch_0` ~ `branch_{branchCount-1}`)에 동시 전송한다.
 * 실행 엔진은 `port: string[]`을 활성 포트 목록으로 해석해 모든 분기를 동시에 진행시킨다.
 */
export class ParallelHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const raw = config.branchCount;
    const branchCount =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : 2;
    if (!Number.isInteger(branchCount)) {
      errors.push('branchCount는 정수여야 합니다.');
    }
    if (branchCount < 2 || branchCount > 16) {
      errors.push('branchCount는 2 이상 16 이하의 값이어야 합니다.');
    }
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

    const ports = Array.from({ length: branchCount }, (_, i) => `branch_${i}`);

    return {
      config: { branchCount },
      output: input,
      port: ports,
    };
  }
}
