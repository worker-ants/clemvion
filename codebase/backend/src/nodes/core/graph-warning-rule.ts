import type { Node } from '../../modules/nodes/entities/node.entity';
import type { Edge } from '../../modules/edges/entities/edge.entity';

/**
 * graph 구조 전체를 보고 평가하는 cross-node warningRule (parallel-p2 결정 D + E +
 * I, 2026-05-30 — SoT: spec/conventions/cross-node-warning-rules.md).
 *
 * 기존 `NodeComponentMetadata.warningRules` 의 mini-DSL 은 단일 노드의 config 만
 * 평가하므로 부모-자식 cross 평가 (외부 Parallel 의 maxConcurrency × 내부
 * Parallel 의 maxConcurrency / Parallel 노드의 분기 서브그래프 안에 또 Parallel
 * 이 있는지) 를 표현 불가. 본 메커니즘은 graph 전체를 함수 인자로 받아 평가하는
 * 형태로 그 한계를 해소한다.
 *
 * 평가 시점:
 *  - **runtime (의무)** — 노드 핸들러 또는 엔진의 graph 검증 단계가 자기 노드
 *    중심으로 `evaluateGraphWarningRules(node, graph)` 를 호출한다.
 *  - **workflow save endpoint (후속)** — POST/PUT workflow 의 nodes/edges 갱신
 *    저장 시점에 모든 노드를 순회하며 평가. `severity: 'error'` triggered 시
 *    400 reject. 본 plan 의 후속 PR.
 *  - **frontend canvas (후속)** — 같은 함수 정의를 shared package 로 분리해
 *    canvas 가 graph 변경 시점마다 평가 + severity 별 배지. 본 plan 의 후속 PR.
 *
 * @example
 *   const rule: GraphWarningRule = {
 *     id: 'parallel:nested-depth-exceeded',
 *     severity: 'error',
 *     evaluate: (node, graph) => {
 *       const depth = computeParallelDepth(node, graph);
 *       return depth > 2
 *         ? { message: `Parallel "${node.label}" nesting depth ${depth} > 2` }
 *         : null;
 *     },
 *   };
 */
export interface GraphWarningRule {
  /** 안정적 식별자 (예: `parallel:nested-depth-exceeded`). canvas 배지 dedupe / 로그 추적 키. */
  id: string;
  /**
   * `error` — workflow save endpoint reject + canvas 빨간 배지 + 저장 불가.
   * `warning` — 로깅 / response 포함, 저장은 통과, canvas 노란 배지.
   */
  severity: 'error' | 'warning';
  /**
   * 평가 함수. triggered 시 메시지를 담은 객체 반환, 미triggered 시 null.
   * 인자:
   *  - `node` — rule 이 등재된 NodeComponentMetadata 의 노드 인스턴스 (graph 안의 자기 자신)
   *  - `graph` — workflow 의 nodes/edges 전체 view (read-only)
   */
  evaluate: (
    node: Node,
    graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  ) => { message: string } | null;
}

export interface GraphWarningRuleResult {
  ruleId: string;
  severity: 'error' | 'warning';
  nodeId: string;
  message: string;
}

/**
 * 단일 노드 + graph 에 대해 그 노드 metadata 의 graphWarningRules 를 모두 평가.
 * triggered rule 만 결과로 반환. 사용처는 workflow save validate / canvas /
 * runtime graph 검증 — 본 PR 은 backend 단의 type + util 만, 호출처는 후속 PR.
 *
 * 본 함수는 순수 — 동일 graph snapshot 에 대해 결정적 결과. caller 가
 * debounce / memoization 책임.
 */
export function evaluateGraphWarningRules(
  node: Node,
  graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  rules: readonly GraphWarningRule[],
): GraphWarningRuleResult[] {
  const results: GraphWarningRuleResult[] = [];
  for (const rule of rules) {
    const triggered = rule.evaluate(node, graph);
    if (triggered) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        nodeId: node.id,
        message: triggered.message,
      });
    }
  }
  return results;
}

/**
 * graph 전체를 순회하며 각 노드의 등재된 graphWarningRules 를 모두 평가.
 * `nodeMetadataResolver` 가 node.type → graphWarningRules 매핑을 제공.
 *
 * workflow save endpoint / frontend canvas 가 한 번에 graph 전체의 위반 목록을
 * 얻는 경로. severity 'error' 가 하나라도 있으면 caller (workflow save) 가
 * reject 결정.
 */
export function evaluateGraphWarningRulesForGraph(
  graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  nodeMetadataResolver: (
    nodeType: string,
  ) => readonly GraphWarningRule[] | undefined,
): GraphWarningRuleResult[] {
  const all: GraphWarningRuleResult[] = [];
  for (const node of graph.nodes) {
    const rules = nodeMetadataResolver(node.type);
    if (!rules || rules.length === 0) continue;
    all.push(...evaluateGraphWarningRules(node, graph, rules));
  }
  return all;
}
