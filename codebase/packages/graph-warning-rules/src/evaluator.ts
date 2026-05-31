import {
  GraphRuleGraph,
  GraphRuleNode,
  GraphWarningRule,
  GraphWarningRuleResult,
} from './types';

/**
 * 단일 노드 + graph 에 대해 그 노드 type 의 graphWarningRules 를 모두 평가.
 * triggered rule 만 결과로 반환.
 *
 * 본 함수는 순수 — 동일 graph snapshot 에 대해 결정적 결과. caller 가
 * debounce / memoization 책임.
 */
export function evaluateGraphWarningRules(
  node: GraphRuleNode,
  graph: GraphRuleGraph,
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
 * `rulesResolver` 가 node.type → graphWarningRules 매핑을 제공.
 *
 * workflow save endpoint / frontend canvas 가 한 번에 graph 전체의 위반 목록을
 * 얻는 경로. severity 'error' 가 하나라도 있으면 caller (workflow save) 가
 * reject 결정.
 */
export function evaluateGraphWarningRulesForGraph(
  graph: GraphRuleGraph,
  rulesResolver: (nodeType: string) => readonly GraphWarningRule[] | undefined,
): GraphWarningRuleResult[] {
  const all: GraphWarningRuleResult[] = [];
  for (const node of graph.nodes) {
    const rules = rulesResolver(node.type);
    if (!rules || rules.length === 0) continue;
    all.push(...evaluateGraphWarningRules(node, graph, rules));
  }
  return all;
}
