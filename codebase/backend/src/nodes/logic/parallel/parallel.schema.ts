import { z } from 'zod';
import {
  GraphWarningRule,
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import type { Node } from '../../../modules/nodes/entities/node.entity';
import type { Edge } from '../../../modules/edges/entities/edge.entity';

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
    c.errorPolicy !== 'continue'
  ) {
    errors.push("errorPolicy must be 'stop' or 'continue'.");
  }

  return errors;
}

/**
 * Helper — 노드 N (Parallel) 의 분기 body 안에 있는 모든 자식 노드 id 를 BFS 로
 * 수집. `branch_N` outgoing edge 만 시작점 (다른 컨테이너 분기와 의미 다름).
 * cross-node-warning-rules 평가에서 nested-Parallel 탐지에 사용.
 */
function collectParallelBranchBodyNodeIds(
  parallelNodeId: string,
  edges: readonly Edge[],
): Set<string> {
  const out = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.sourceNodeId) ?? [];
    list.push(e.targetNodeId);
    adj.set(e.sourceNodeId, list);
  }
  // branch_N entry points
  const entries: string[] = [];
  for (const e of edges) {
    if (e.sourceNodeId !== parallelNodeId) continue;
    if (/^branch_\d+$/.exec(e.sourcePort)) entries.push(e.targetNodeId);
  }
  const queue = [...entries];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    if (out.has(id)) continue;
    out.add(id);
    for (const next of adj.get(id) ?? []) {
      if (!out.has(next)) queue.push(next);
    }
  }
  return out;
}

/**
 * parallel-p2 결정 #3 (2026-05-30): 중첩 Parallel 깊이 ≤ 2. 자기 분기 body 안에
 * 또 Parallel 이 있고, 그 내부 Parallel 의 분기 body 안에 또 Parallel 이 있으면
 * depth=3 으로 reject.
 */
const parallelNestedDepthExceededRule: GraphWarningRule = {
  id: 'parallel:nested-depth-exceeded',
  severity: 'error',
  evaluate: (node: Node, graph) => {
    if (node.type !== 'parallel') return null;
    const myBody = collectParallelBranchBodyNodeIds(node.id, graph.edges);
    for (const childId of myBody) {
      const child = graph.nodes.find((n) => n.id === childId);
      if (!child || child.type !== 'parallel') continue;
      const grandBody = collectParallelBranchBodyNodeIds(child.id, graph.edges);
      for (const gId of grandBody) {
        const g = graph.nodes.find((n) => n.id === gId);
        if (g && g.type === 'parallel') {
          return {
            message: `Parallel node "${node.label ?? node.type}" body contains nested Parallel "${child.label ?? child.type}" whose body contains another Parallel "${g.label ?? g.type}". Parallel nesting depth > 2 is not supported.`,
          };
        }
      }
    }
    return null;
  },
};

/**
 * parallel-p2 결정 #3 + D (2026-05-30): 외부 × 내부 maxConcurrency 곱이
 * NESTED_PARALLEL_CONCURRENCY_CAP (32) 초과 시 frontend canvas 사전 경고.
 * runtime 의 silent clamp 가 안전망이지만 사용자가 의도와 실제 차이를 사전
 * 인지하도록 warning.
 */
const PARALLEL_NESTED_CONCURRENCY_CAP_FOR_RULE = 32;
const parallelNestedConcurrencyCapRule: GraphWarningRule = {
  id: 'parallel:nested-concurrency-cap',
  severity: 'warning',
  evaluate: (node: Node, graph) => {
    if (node.type !== 'parallel') return null;
    const myCfg = node.config ?? {};
    const myMax =
      typeof myCfg.maxConcurrency === 'number' ? myCfg.maxConcurrency : 0;
    const myBranch =
      typeof myCfg.branchCount === 'number' ? myCfg.branchCount : 2;
    const myEffective = myMax > 0 ? myMax : myBranch;

    const myBody = collectParallelBranchBodyNodeIds(node.id, graph.edges);
    for (const childId of myBody) {
      const child = graph.nodes.find((n) => n.id === childId);
      if (!child || child.type !== 'parallel') continue;
      const cCfg = child.config ?? {};
      const cMax =
        typeof cCfg.maxConcurrency === 'number' ? cCfg.maxConcurrency : 0;
      const cBranch =
        typeof cCfg.branchCount === 'number' ? cCfg.branchCount : 2;
      const cEffective = cMax > 0 ? cMax : cBranch;
      const product = myEffective * cEffective;
      if (product > PARALLEL_NESTED_CONCURRENCY_CAP_FOR_RULE) {
        return {
          message: `Parallel "${node.label ?? node.type}" (effective=${myEffective}) × nested Parallel "${child.label ?? child.type}" (effective=${cEffective}) = ${product} > cap=${PARALLEL_NESTED_CONCURRENCY_CAP_FOR_RULE}. Runtime will silently clamp the inner concurrency.`,
        };
      }
    }
    return null;
  },
};

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
  // parallel-p2 결정 D + E + I (2026-05-30). 본 PR 은 등재만 — workflow save
  // endpoint / frontend canvas 의 평가 호출은 후속 PR. runtime planParallelBody
  // (PARALLEL_NESTED_DEPTH_EXCEEDED throw) 와 메시지 의미 일관성 보장.
  graphWarningRules: [
    parallelNestedDepthExceededRule,
    parallelNestedConcurrencyCapRule,
  ],
  validateConfig: validateParallelConfig,
};
