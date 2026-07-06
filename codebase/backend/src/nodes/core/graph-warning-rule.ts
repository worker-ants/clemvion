import {
  evaluateGraphWarningRules as evaluateGraphWarningRulesPure,
  evaluateGraphWarningRulesForGraph as evaluateGraphWarningRulesForGraphPure,
  evaluateGraphCycleWarnings as evaluateGraphCycleWarningsPure,
  GraphRuleEdge,
  GraphRuleNode,
  type GraphWarningRule,
  type GraphWarningRuleResult,
} from '@workflow/graph-warning-rules';
import type { Node } from '../../modules/nodes/entities/node.entity';
import type { Edge } from '../../modules/edges/entities/edge.entity';

/**
 * graph 구조 전체를 보고 평가하는 cross-node warningRule 의 backend 진입점.
 *
 * 실제 rule 정의·평가 로직의 SSOT 는 shared package `@workflow/graph-warning-rules`
 * 로 분리되었다 (frontend canvas 와 공유). 본 파일은 backend 의 TypeORM
 * `Node`/`Edge` entity 를 패키지의 순수 graph shape (`GraphRuleNode` /
 * `GraphRuleEdge`) 로 매핑하는 thin adapter 만 남긴다.
 *
 * - `Node` entity 는 `id/type/config/label` 을 가지므로 `toRuleNode` 로 명시
 *   매핑한다 (`as` 단언 대신 — entity 필드 리팩터링을 컴파일 타임에 감지).
 *   `type` 누락 entity 는 평가 불가하므로 graph 에서 제외한다.
 * - `Edge` entity 는 `sourceNodeId/targetNodeId/sourcePort/targetPort` 명명이라
 *   패키지의 `source/target/sourceHandle/targetHandle` 로 매핑이 필요하다.
 *
 * SoT: spec/conventions/cross-node-warning-rules.md.
 */

// 패키지 타입을 backend 코드에서 한 경로로 import 할 수 있게 re-export.
export type {
  GraphWarningRule,
  GraphWarningRuleResult,
  GraphRuleNode,
  GraphRuleEdge,
} from '@workflow/graph-warning-rules';

/** backend `Edge` entity → 패키지 `GraphRuleEdge` 매핑. */
function toRuleEdge(edge: Edge): GraphRuleEdge {
  return {
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePort,
    target: edge.targetNodeId,
    targetHandle: edge.targetPort,
  };
}

/**
 * backend `Node` entity → 패키지 `GraphRuleNode` 매핑. `as` 단언 대신 명시
 * 매핑으로 컴파일 타임 안전성 확보. `type` 누락(undefined) entity 는 평가
 * 대상이 될 수 없으므로 null 반환 → caller 가 graph 에서 제외한다.
 */
function toRuleNode(node: Node): GraphRuleNode | null {
  if (node.type == null) return null;
  return {
    id: node.id,
    type: node.type,
    config: node.config,
    label: node.label,
  };
}

function toRuleGraph(graph: {
  nodes: readonly Node[];
  edges: readonly Edge[];
}): { nodes: readonly GraphRuleNode[]; edges: readonly GraphRuleEdge[] } {
  const nodes: GraphRuleNode[] = [];
  for (const node of graph.nodes) {
    const mapped = toRuleNode(node);
    if (mapped) nodes.push(mapped);
  }
  return {
    nodes,
    edges: graph.edges.map(toRuleEdge),
  };
}

/**
 * 단일 노드 + graph (entity shape) 에 대해 graphWarningRules 를 평가.
 * entity 를 순수 shape 으로 매핑한 뒤 패키지 util 로 위임.
 */
export function evaluateGraphWarningRules(
  node: Node,
  graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  rules: readonly GraphWarningRule[],
): GraphWarningRuleResult[] {
  const ruleNode = toRuleNode(node);
  if (!ruleNode) return [];
  return evaluateGraphWarningRulesPure(ruleNode, toRuleGraph(graph), rules);
}

/**
 * graph 전체 (entity shape) 를 순회하며 각 노드의 graphWarningRules 를 평가.
 * `nodeMetadataResolver` 가 node.type → graphWarningRules 매핑을 제공.
 */
export function evaluateGraphWarningRulesForGraph(
  graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  nodeMetadataResolver: (
    nodeType: string,
  ) => readonly GraphWarningRule[] | undefined,
): GraphWarningRuleResult[] {
  return evaluateGraphWarningRulesForGraphPure(
    toRuleGraph(graph),
    nodeMetadataResolver,
  );
}

/**
 * graph 전역 사이클(탈출 불가 무한 루프) 경고 평가 (entity shape). per-node-type
 * rule 과 달리 그래프 전체를 1회 순회하는 graph-level 규칙이라 별도 진입점으로
 * 노출한다. severity 'warning' 만 발행하므로 저장을 차단하지 않고 canvas 배지로만
 * 드러난다 (warn-not-block, spec/3-workflow-editor/2-edge.md §2.2/§2.3).
 */
export function evaluateGraphCycleWarnings(graph: {
  nodes: readonly Node[];
  edges: readonly Edge[];
}): GraphWarningRuleResult[] {
  return evaluateGraphCycleWarningsPure(toRuleGraph(graph));
}
