/**
 * @workflow/graph-warning-rules
 *
 * SSOT for cross-node graphWarningRules — graph 구조 전체를 보고 평가하는
 * warning/error rule 정의. backend (workflow save validate + endpoint) 와
 * frontend canvas (graph 변경 시점 사전 평가) 가 같은 정의를 공유한다.
 *
 * Usage (backend, workflow save validate):
 *
 *   import {
 *     evaluateGraphWarningRulesForGraph,
 *     GRAPH_WARNING_RULES_BY_TYPE,
 *   } from '@workflow/graph-warning-rules';
 *
 *   // Edge entity → GraphRuleEdge 매핑 후 평가
 *   const graph = {
 *     nodes,
 *     edges: edges.map((e) => ({
 *       source: e.sourceNodeId,
 *       sourceHandle: e.sourcePort,
 *       target: e.targetNodeId,
 *       targetHandle: e.targetPort,
 *     })),
 *   };
 *   const results = evaluateGraphWarningRulesForGraph(
 *     graph,
 *     (type) => GRAPH_WARNING_RULES_BY_TYPE[type],
 *   );
 *
 * Usage (frontend canvas): node.data / ReactFlow edge 가 이미
 * `source/sourceHandle/target` shape 이므로 그대로 넘긴다.
 *
 * SoT: spec/conventions/cross-node-warning-rules.md.
 */

export type {
  GraphRuleNode,
  GraphRuleEdge,
  GraphRuleGraph,
  GraphWarningRule,
  GraphWarningRuleResult,
} from './types';

export {
  evaluateGraphWarningRules,
  evaluateGraphWarningRulesForGraph,
} from './evaluator';

export {
  PARALLEL_NESTED_CONCURRENCY_CAP,
  collectParallelBranchBodyNodeIds,
  parallelNestedDepthExceededRule,
  parallelNestedConcurrencyCapRule,
  parallelGraphWarningRules,
} from './rules/parallel';

import { GraphWarningRule } from './types';
import { parallelGraphWarningRules } from './rules/parallel';

/**
 * node type → graphWarningRules 매핑. frontend 가 backend metadata 없이
 * node type 만으로 rulesResolver 를 구성할 수 있도록 노출한다. backend 는
 * registry metadata 경로를 그대로 쓰지만, 두 surface 가 동일 정의를 공유한다.
 *
 * v1 은 하드코딩 맵이다. 신규 node type 의 graphWarningRules 를 추가하려면 본
 * 파일을 직접 수정한다. 외부에서 type 등록을 허용하는 `registerGraphWarningRules`
 * 류의 동적 registration 메커니즘은 향후 옵션 (현재 node type 수가 적어 불필요).
 * `Readonly` + `Object.freeze` 로 외부에서 키 추가/변형을 막는다.
 */
export const GRAPH_WARNING_RULES_BY_TYPE: Readonly<
  Record<string, readonly GraphWarningRule[]>
> = Object.freeze({
  parallel: parallelGraphWarningRules,
});
