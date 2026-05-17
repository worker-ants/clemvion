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
          hint: 'Number of parallel branches (2-16). branch_0 ~ branch_{N-1} output ports are generated dynamically.',
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
          hint: 'Max branches running concurrently (0 = same as branchCount, unlimited). When smaller than branchCount, the rest wait until a slot frees up.',
        },
      }),
    waitAll: z
      .boolean()
      .default(true)
      .meta({
        ui: {
          label: 'Wait for All Branches',
          widget: 'checkbox',
          hint: 'true: continue to the next node only after all branches finish. Phase P1 hardcodes true; false is not supported yet.',
        },
      }),
    // W-7: 분기 에러 정책. parallel-specific 필드 (공통 errorHandling 와 별개)
    // 로 노출 — 사용자가 stop/continue 를 명확히 선택. 미설정 시 'stop'.
    errorPolicy: z
      .enum(['stop', 'continue'])
      .default('stop')
      .meta({
        ui: {
          label: 'Error Policy',
          widget: 'select',
          hint: 'stop: throw on first branch failure (Parallel node FAILS). continue: wait for all branches, collect rejected branches in output.branches[i].error.',
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
 * Kept here to match handler.validate's warning messages 1:1.
 */
export function validateParallelConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const rawBranch = c.branchCount;
  if (rawBranch !== undefined) {
    if (typeof rawBranch !== 'number' || !Number.isFinite(rawBranch)) {
      errors.push('branchCount must be an integer.');
    } else if (!Number.isInteger(rawBranch)) {
      errors.push('branchCount must be an integer.');
    } else if (rawBranch < 2 || rawBranch > 16) {
      errors.push('branchCount must be a value between 2 and 16.');
    }
  }

  if (c.maxConcurrency !== undefined) {
    const rawMax = c.maxConcurrency;
    if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
      errors.push('maxConcurrency must be a number.');
    } else if (!Number.isInteger(rawMax)) {
      errors.push('maxConcurrency must be an integer.');
    } else if (rawMax < 0 || rawMax > 16) {
      errors.push(
        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
      );
    }
  }

  if (c.waitAll !== undefined && typeof c.waitAll !== 'boolean') {
    errors.push('waitAll must be a boolean.');
  }

  if (
    c.errorPolicy !== undefined &&
    c.errorPolicy !== 'stop' &&
    c.errorPolicy !== 'continue'
  ) {
    errors.push("errorPolicy must be 'stop' or 'continue'.");
  }

  return errors;
}

export const parallelNodeMetadata: NodeComponentMetadata = {
  type: 'parallel',
  category: 'logic',
  label: 'Parallel',
  description:
    'Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.',
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
      message: 'branchCount must be 2 to 16.',
    },
  ],
  validateConfig: validateParallelConfig,
};
