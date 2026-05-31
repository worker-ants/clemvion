import {
  evaluateGraphWarningRules as evaluateGraphWarningRulesPure,
  evaluateGraphWarningRulesForGraph as evaluateGraphWarningRulesForGraphPure,
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
 * - `Node` entity 는 `id/type/config/label` 을 그대로 가지므로 구조적으로
 *   `GraphRuleNode` 에 호환 — 그대로 넘긴다.
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

function toRuleGraph(graph: {
  nodes: readonly Node[];
  edges: readonly Edge[];
}): { nodes: readonly GraphRuleNode[]; edges: readonly GraphRuleEdge[] } {
  return {
    nodes: graph.nodes as readonly GraphRuleNode[],
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
  return evaluateGraphWarningRulesPure(
    node as GraphRuleNode,
    toRuleGraph(graph),
    rules,
  );
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
