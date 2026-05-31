import { GraphRuleEdge, GraphRuleGraph, GraphRuleNode, GraphWarningRule } from '../types';

/**
 * parallel-p2 결정 D (2026-05-30): 외부 × 내부 maxConcurrency 곱이 본 cap 초과
 * 시 frontend canvas 사전 경고. runtime 의 silent clamp 가 안전망이지만 사용자가
 * 의도와 실제 차이를 사전 인지하도록 warning.
 */
export const PARALLEL_NESTED_CONCURRENCY_CAP = 32;

/**
 * Helper — 노드 N (Parallel) 의 분기 body 안에 있는 모든 자식 노드 id 를 BFS 로
 * 수집. `branch_N` outgoing edge 만 시작점 (다른 컨테이너 분기와 의미 다름).
 * cross-node-warning-rules 평가에서 nested-Parallel 탐지에 사용.
 */
export function collectParallelBranchBodyNodeIds(
  parallelNodeId: string,
  edges: readonly GraphRuleEdge[],
): Set<string> {
  const out = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  // branch_N entry points
  const entries: string[] = [];
  for (const e of edges) {
    if (e.source !== parallelNodeId) continue;
    if (e.sourceHandle != null && /^branch_\d+$/.exec(e.sourceHandle)) {
      entries.push(e.target);
    }
  }
  // BFS 는 entries (각 branch_N 분기의 entrypoint) 에서만 시작하고 adjacency 를
  // 따라 forward 로만 확장하므로, 실제 방문 범위는 해당 Parallel 분기 body 이후로
  // 한정된다 (entrypoint 이전의 그래프나 다른 컨테이너 분기는 도달하지 않음).
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
 * id → node 인덱스를 graph 당 한 번 구성. 두 rule 의 inner loop 가 `nodes.find`
 * 선형 탐색 (O(V²)) 대신 O(1) 조회를 쓰도록 한다.
 */
function buildNodeIndex(graph: GraphRuleGraph): Map<string, GraphRuleNode> {
  const index = new Map<string, GraphRuleNode>();
  for (const n of graph.nodes) index.set(n.id, n);
  return index;
}

/**
 * Parallel 노드 config 에서 effective concurrency 계산. maxConcurrency 가
 * 양수면 그 값, 아니면 branchCount (기본 2). outer/inner 양쪽에서 공유.
 */
function resolveEffective(config: Record<string, unknown> | undefined): number {
  const cfg = config ?? {};
  const max = typeof cfg.maxConcurrency === 'number' ? cfg.maxConcurrency : 0;
  const branch = typeof cfg.branchCount === 'number' ? cfg.branchCount : 2;
  return max > 0 ? max : branch;
}

/**
 * parallel-p2 결정 #3 (2026-05-30): 중첩 Parallel 깊이 ≤ 2. 자기 분기 body 안에
 * 또 Parallel 이 있고, 그 내부 Parallel 의 분기 body 안에 또 Parallel 이 있으면
 * depth=3 으로 reject.
 */
export const parallelNestedDepthExceededRule: GraphWarningRule = {
  id: 'parallel:nested-depth-exceeded',
  severity: 'error',
  evaluate: (node: GraphRuleNode, graph: GraphRuleGraph) => {
    if (node.type !== 'parallel') return null;
    const byId = buildNodeIndex(graph);
    const myBody = collectParallelBranchBodyNodeIds(node.id, graph.edges);
    for (const childId of myBody) {
      const child = byId.get(childId);
      if (!child || child.type !== 'parallel') continue;
      const grandBody = collectParallelBranchBodyNodeIds(child.id, graph.edges);
      for (const gId of grandBody) {
        const g = byId.get(gId);
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
 * PARALLEL_NESTED_CONCURRENCY_CAP (32) 초과 시 frontend canvas 사전 경고.
 */
export const parallelNestedConcurrencyCapRule: GraphWarningRule = {
  id: 'parallel:nested-concurrency-cap',
  severity: 'warning',
  evaluate: (node: GraphRuleNode, graph: GraphRuleGraph) => {
    if (node.type !== 'parallel') return null;
    const byId = buildNodeIndex(graph);
    const myEffective = resolveEffective(node.config);

    const myBody = collectParallelBranchBodyNodeIds(node.id, graph.edges);
    for (const childId of myBody) {
      const child = byId.get(childId);
      if (!child || child.type !== 'parallel') continue;
      const cEffective = resolveEffective(child.config);
      const product = myEffective * cEffective;
      if (product > PARALLEL_NESTED_CONCURRENCY_CAP) {
        return {
          message: `Parallel "${node.label ?? node.type}" (effective=${myEffective}) × nested Parallel "${child.label ?? child.type}" (effective=${cEffective}) = ${product} > cap=${PARALLEL_NESTED_CONCURRENCY_CAP}. Runtime will silently clamp the inner concurrency.`,
        };
      }
    }
    return null;
  },
};

/** Parallel 노드 type 의 cross-node graphWarningRules. */
export const parallelGraphWarningRules: readonly GraphWarningRule[] = [
  parallelNestedDepthExceededRule,
  parallelNestedConcurrencyCapRule,
];
