import { z } from 'zod';
import { parallelGraphWarningRules } from '@workflow/graph-warning-rules';
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
    // 로 노출 — 사용자가 명확히 선택. 미설정 시 'stop'.
    // parallel-p2 §5 (결정 A + H, 2026-05-30): cancel-others-on-fail 추가 —
    // 첫 실패 시 다른 분기의 외부 I/O 를 ExecutionContext.abortSignal 로 abort.
    // 외부 I/O 노드의 signal 전파 의무는 spec/conventions/node-cancellation.md.
    errorPolicy: z
      .enum(['stop', 'continue', 'cancel-others-on-fail'])
      .default('stop')
      .meta({
        ui: {
          label: 'Error Policy',
          widget: 'select',
          hint: 'stop: throw on first branch failure (Parallel node FAILS). continue: wait for all branches, collect rejected branches in output.branches[i].error. cancel-others-on-fail: on first failure, abort other in-flight branches via AbortSignal (signal-aware nodes cleanup early; best-effort).',
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

  if (c.waitAll !== undefined) {
    if (typeof c.waitAll !== 'boolean') {
      errors.push('waitAll must be a boolean.');
    } else if (c.waitAll === false) {
      // 결정 K (2026-05-30): waitAll=false 지원 spec out. Node.js
      // single-threaded main loop pattern 상 "분기 완료 즉시 외부 dispatch"
      // 의미를 살릴 수 없어 활성화 폐기. fire-and-forget 의미가 필요하면
      // Background 노드 사용.
      errors.push(
        'waitAll=false is not supported. Use waitAll=true (default) or the Background node for fire-and-forget semantics.',
      );
    }
  }

  if (
    c.errorPolicy !== undefined &&
    c.errorPolicy !== 'stop' &&
    c.errorPolicy !== 'continue' &&
    c.errorPolicy !== 'cancel-others-on-fail'
  ) {
    errors.push(
      "errorPolicy must be 'stop', 'continue', or 'cancel-others-on-fail'.",
    );
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
  // parallel-p2 결정 D + E + I (2026-05-30). rule 정의의 SSOT 는 shared
  // package `@workflow/graph-warning-rules` (frontend canvas 와 공유). runtime
  // planParallelBody (PARALLEL_NESTED_DEPTH_EXCEEDED throw) 와 메시지 의미
  // 일관성 보장. 패키지 rule 은 순수 graph shape (source/sourceHandle) 를
  // 읽으므로, backend 평가는 graph-warning-rule.ts 의 adapter 가 Edge entity 를
  // 매핑한 뒤 호출한다.
  graphWarningRules: parallelGraphWarningRules,
  validateConfig: validateParallelConfig,
};
