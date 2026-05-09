import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Parallel fans the input out to branch_0..branch_{N-1} ports. Its own
 * `output` passes through the input (branch outputs are handled by
 * ParallelExecutor). `port` is an array (multi-port routing).
 */
export const parallelNodeOutputSchema = z
  .object({
    config: z
      .object({
        branchCount: z.number().optional(),
        maxConcurrency: z.number().optional(),
        waitAll: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const parallelNodeConfigSchema = z
  .object({
    branchCount: z
      .number()
      .int()
      .min(2)
      .max(16)
      .default(2)
      .meta({
        ui: {
          label: 'Branch Count',
          widget: 'number',
          hint: '병렬 실행할 분기 수 (2~16). branch_0 ~ branch_{N-1} 출력 포트가 동적으로 생성됩니다.',
        },
      }),
    maxConcurrency: z
      .number()
      .int()
      .min(0)
      .max(16)
      .default(0)
      .meta({
        ui: {
          label: 'Max Concurrency',
          widget: 'number',
          hint: '동시에 실행할 분기의 최대 개수 (0 = branchCount와 동일, 제한 없음). 값이 branchCount보다 작으면 나머지는 슬롯이 빌 때까지 대기합니다.',
        },
      }),
    waitAll: z
      .boolean()
      .default(true)
      .meta({
        ui: {
          label: 'Wait for All Branches',
          widget: 'checkbox',
          hint: 'true: 모든 분기 완료 후 다음 노드로 진행. Phase P1에서는 항상 true로 동작하며 false는 미지원입니다.',
        },
      }),
  })
  .passthrough();
export type ParallelConfig = z.infer<typeof parallelNodeConfigSchema>;

// branch_0 ~ branch_{N-1} 은 dynamicPorts로 동적 생성.
// done 포트는 PARALLEL_ENGINE=v1에서 모든 분기 완료 후 수집된 결과를 출력.
export const parallelNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'done', label: 'Done', type: 'data' }],
};

/**
 * Imperative escape hatch — the cross-field "maxConcurrency must be an
 * integer in [0, 16]" + "branchCount must be an integer in [2, 16]" rules
 * are already enforced by the zod schema (`int().min().max()`), so the
 * remaining domain check is just the integer-ness guard for explicit values.
 * Kept here to match handler.validate's Korean messages 1:1.
 */
export function validateParallelConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const rawBranch = c.branchCount;
  if (rawBranch !== undefined) {
    if (typeof rawBranch !== 'number' || !Number.isFinite(rawBranch)) {
      errors.push('branchCount는 정수여야 합니다.');
    } else if (!Number.isInteger(rawBranch)) {
      errors.push('branchCount는 정수여야 합니다.');
    } else if (rawBranch < 2 || rawBranch > 16) {
      errors.push('branchCount는 2 이상 16 이하의 값이어야 합니다.');
    }
  }

  if (c.maxConcurrency !== undefined) {
    const rawMax = c.maxConcurrency;
    if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
      errors.push('maxConcurrency는 숫자여야 합니다.');
    } else if (!Number.isInteger(rawMax)) {
      errors.push('maxConcurrency는 정수여야 합니다.');
    } else if (rawMax < 0 || rawMax > 16) {
      errors.push(
        'maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).',
      );
    }
  }

  if (c.waitAll !== undefined && typeof c.waitAll !== 'boolean') {
    errors.push('waitAll는 boolean이어야 합니다.');
  }

  return errors;
}

export const parallelNodeMetadata: NodeComponentMetadata = {
  type: 'parallel',
  category: 'logic',
  label: 'Parallel',
  description:
    'Fan-out input to N branches. PARALLEL_ENGINE=v1 일 때 각 분기가 동시 실행되며, 그렇지 않으면 토폴로지 순서로 순차 진행됩니다.',
  icon: 'Split',
  color: '#3B82F6',
  executionMetadata: { kind: 'parallel' },
  isDynamicPorts: true,
  dynamicPorts: { kind: 'parallel-branches' },
  summaryTemplate: '{{branchCount}} branches',
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - branchCount range/integer rules from handler.validate
  //  - maxConcurrency range/integer rules from handler.validate
  //  - waitAll type rule from handler.validate
  // The mini-DSL rule below catches the most common mistake at canvas-badge
  // level (out-of-range branchCount); the typed/integer/cross-field guards
  // live in `validateConfig` because the mini-DSL has no Number.isInteger.
  warningRules: [
    {
      id: 'parallel:branch-count-out-of-range',
      when: 'branchCount < 2 || branchCount > 16',
      message: 'branchCount 는 2 이상 16 이하여야 합니다.',
    },
  ],
  validateConfig: validateParallelConfig,
};
