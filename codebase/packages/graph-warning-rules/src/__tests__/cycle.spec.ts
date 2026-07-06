import {
  evaluateGraphCycleWarnings,
  UNESCAPABLE_CYCLE_RULE_ID,
} from '../rules/cycle';
import { GraphRuleGraph } from '../types';

const node = (id: string, type: string) => ({ id, type });
const edge = (
  source: string,
  target: string,
  extra?: { sourceHandle?: string; targetHandle?: string },
) => ({ source, target, ...extra });

describe('evaluateGraphCycleWarnings', () => {
  it('순환이 없으면 경고 없음', () => {
    const graph: GraphRuleGraph = {
      nodes: [node('a', 'action'), node('b', 'action'), node('c', 'action')],
      edges: [edge('a', 'b'), edge('b', 'c')],
    };
    expect(evaluateGraphCycleWarnings(graph)).toEqual([]);
  });

  it('분기 노드 없는 순환(pass-through) → back-edge source 에 warning', () => {
    // a → b → c → a, 모두 pass-through(action) — 탈출 불가.
    const graph: GraphRuleGraph = {
      nodes: [node('a', 'action'), node('b', 'action'), node('c', 'action')],
      edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    };
    const results = evaluateGraphCycleWarnings(graph);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe(UNESCAPABLE_CYCLE_RULE_ID);
    expect(results[0].severity).toBe('warning');
    expect(results[0].nodeId).toBe('c'); // back-edge(c→a) 의 source
  });

  it('분기 노드가 back-edge source 면 escapable → 경고 없음', () => {
    // a → sw(switch) → a : back-edge(sw→a) 의 source 가 분기 노드 → 탈출 가능.
    const graph: GraphRuleGraph = {
      nodes: [node('a', 'action'), node('sw', 'switch')],
      edges: [edge('a', 'sw'), edge('sw', 'a')],
    };
    expect(evaluateGraphCycleWarnings(graph)).toEqual([]);
  });

  it('if_else / ai_agent / text_classifier 도 분기 노드로 인정', () => {
    for (const branchType of ['if_else', 'ai_agent', 'text_classifier']) {
      const graph: GraphRuleGraph = {
        nodes: [node('a', 'action'), node('br', branchType)],
        edges: [edge('a', 'br'), edge('br', 'a')],
      };
      expect(evaluateGraphCycleWarnings(graph)).toEqual([]);
    }
  });

  it('컨테이너 반복(body/emit) 구조 엣지는 순환으로 보지 않음', () => {
    // loop.body → child → loop.emit — 컨테이너 iteration 이지 그래프 사이클 아님.
    const graph: GraphRuleGraph = {
      nodes: [node('loop', 'loop'), node('child', 'action')],
      edges: [
        edge('loop', 'child', { sourceHandle: 'body' }),
        edge('child', 'loop', { targetHandle: 'emit' }),
      ],
    };
    expect(evaluateGraphCycleWarnings(graph)).toEqual([]);
  });

  it('자기연결(pass-through) 도 탈출 불가 순환으로 경고', () => {
    const graph: GraphRuleGraph = {
      nodes: [node('a', 'action')],
      edges: [edge('a', 'a')],
    };
    const results = evaluateGraphCycleWarnings(graph);
    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe('a');
  });
});
