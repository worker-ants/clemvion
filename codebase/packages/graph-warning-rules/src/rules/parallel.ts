import { GraphRuleEdge, GraphRuleGraph, GraphRuleNode, GraphWarningRule } from '../types';

/**
 * parallel-p2 결정 D (2026-05-30): 외부 × 내부 maxConcurrency 곱이 본 cap 초과
 * 시 frontend canvas 사전 경고. runtime 의 silent clamp 가 안전망이지만 사용자가
 * 의도와 실제 차이를 사전 인지하도록 warning.
 */
export const PARALLEL_NESTED_CONCURRENCY_CAP = 32;

/** Background 노드 type 과 그 본문으로 이어지는 출력 포트. */
const BACKGROUND_NODE_TYPE = 'background';
const BACKGROUND_PORT = 'background';

/**
 * `starts` 에서 연결선을 앞으로 따라 닿는 노드 ID 를 모두 모은다. 시작 노드도 넣는다.
 * Background 노드의 `background` 연결선은 따라가지 않는다. 그 뒤 본문은 워커가 새
 * 컨텍스트에서 실행하므로 시작 노드가 속한 본문이 아니다.
 *
 * 저장 규칙의 병렬 분기 본문({@link collectParallelBranchBodyNodeIds})과 실행 사전
 * 검사의 Background 본문 판정(backend `graph/background-body-membership.ts` 의
 * `collectBackgroundOnlyNodeIds`)이 이 함수 하나로 도달 범위를 구한다(NERV Task
 * CLE-T-HH61D6). 두 쪽의 입력 모양과 Background 판별 방법이 달라도 이 판정은 같아야
 * 한다(CLE-NODE-PARALLEL-NEST 「저장 규칙과 실행 검사의 범위」).
 *
 * @param isBackgroundNode 노드가 Background 인지. 주지 않으면 모든 연결선을 따라간다.
 */
export function reachSkippingBackgroundEdges(
  starts: Iterable<string>,
  edges: readonly GraphRuleEdge[],
  isBackgroundNode: (nodeId: string) => boolean = () => false,
): Set<string> {
  const out = new Set<string>();
  const adj = new Map<string, GraphRuleEdge[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e);
    adj.set(e.source, list);
  }
  const queue = [...starts];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    if (out.has(id)) continue;
    out.add(id);
    const background = isBackgroundNode(id);
    for (const e of adj.get(id) ?? []) {
      if (background && e.sourceHandle === BACKGROUND_PORT) continue;
      if (!out.has(e.target)) queue.push(e.target);
    }
  }
  return out;
}

/**
 * Parallel 노드의 병렬 분기 본문 노드 ID 를 모두 모은다. `branch_N` 연결선 대상에서 시작해
 * 연결선을 앞으로 따라간다. 다른 Parallel 의 분기 본문과 섞지 않는다. 시작 노드에서만
 * 앞으로 따라가므로 진입 전 그래프나 다른 컨테이너 분기에는 닿지 않는다.
 *
 * Background 노드의 `background` 연결선은 따라가지 않는다({@link reachSkippingBackgroundEdges}).
 * 본문 안 Parallel 은 깊이 1부터 센다(REQ-PARALLEL-036, NERV Task CLE-T-B7A8B2).
 * Background 본문에서 다시 병렬 분기 쪽으로 이어지는 노드도 다른 경로로 닿지 않으면 넣지
 * 않는다.
 *
 * @param isBackgroundNode 노드가 Background 인지. 주지 않으면 모든 연결선을 따라간다.
 */
export function collectParallelBranchBodyNodeIds(
  parallelNodeId: string,
  edges: readonly GraphRuleEdge[],
  isBackgroundNode: (nodeId: string) => boolean = () => false,
): Set<string> {
  const entries: string[] = [];
  for (const e of edges) {
    if (e.source !== parallelNodeId) continue;
    if (e.sourceHandle != null && /^branch_\d+$/.exec(e.sourceHandle)) {
      entries.push(e.target);
    }
  }
  return reachSkippingBackgroundEdges(entries, edges, isBackgroundNode);
}

/** 노드 인덱스로 Background 여부를 묻는 함수를 만든다. */
function backgroundCheckOf(
  byId: ReadonlyMap<string, GraphRuleNode>,
): (nodeId: string) => boolean {
  return (nodeId) => byId.get(nodeId)?.type === BACKGROUND_NODE_TYPE;
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
    const isBackground = backgroundCheckOf(byId);
    const myBody = collectParallelBranchBodyNodeIds(
      node.id,
      graph.edges,
      isBackground,
    );
    for (const childId of myBody) {
      const child = byId.get(childId);
      if (!child || child.type !== 'parallel') continue;
      const grandBody = collectParallelBranchBodyNodeIds(
        child.id,
        graph.edges,
        isBackground,
      );
      for (const gId of grandBody) {
        const g = byId.get(gId);
        if (g && g.type === 'parallel') {
          return {
            message: `Parallel node "${node.label ?? node.type}" body contains nested Parallel "${child.label ?? child.type}" whose body contains another Parallel "${g.label ?? g.type}". Parallel nesting depth > 2 is not supported.`,
            params: {
              node: node.label ?? node.type,
              child: child.label ?? child.type,
              grand: g.label ?? g.type,
            },
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

    // Background 본문 안 Parallel 은 바깥 Parallel 과 동시에 돌지 않으므로 곱하지 않는다.
    const myBody = collectParallelBranchBodyNodeIds(
      node.id,
      graph.edges,
      backgroundCheckOf(byId),
    );
    for (const childId of myBody) {
      const child = byId.get(childId);
      if (!child || child.type !== 'parallel') continue;
      const cEffective = resolveEffective(child.config);
      const product = myEffective * cEffective;
      if (product > PARALLEL_NESTED_CONCURRENCY_CAP) {
        return {
          message: `Parallel "${node.label ?? node.type}" (effective=${myEffective}) × nested Parallel "${child.label ?? child.type}" (effective=${cEffective}) = ${product} > cap=${PARALLEL_NESTED_CONCURRENCY_CAP}. Runtime will silently clamp the inner concurrency.`,
          params: {
            node: node.label ?? node.type,
            child: child.label ?? child.type,
            outerEffective: myEffective,
            innerEffective: cEffective,
            product,
            cap: PARALLEL_NESTED_CONCURRENCY_CAP,
          },
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
