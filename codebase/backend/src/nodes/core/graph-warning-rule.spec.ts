import {
  evaluateGraphWarningRules,
  evaluateGraphWarningRulesForGraph,
  GraphWarningRule,
} from './graph-warning-rule';
import type { Node } from '../../modules/nodes/entities/node.entity';
import type { Edge } from '../../modules/edges/entities/edge.entity';

describe('GraphWarningRule (parallel-p2 결정 D + E + I)', () => {
  const makeNode = (id: string, type: string, label = id): Node =>
    ({
      id,
      type,
      label,
      workflowId: 'wf-1',
      config: {},
    }) as unknown as Node;

  const makeEdge = (
    id: string,
    source: string,
    target: string,
    sourcePort = 'out',
  ): Edge =>
    ({
      id,
      sourceNodeId: source,
      targetNodeId: target,
      sourcePort,
      targetPort: 'in',
      workflowId: 'wf-1',
    }) as unknown as Edge;

  describe('evaluateGraphWarningRules — single node', () => {
    it('returns [] when no rules trigger', () => {
      const node = makeNode('n1', 'parallel');
      const graph = { nodes: [node], edges: [] };
      const rules: GraphWarningRule[] = [
        {
          id: 'never-fires',
          severity: 'error',
          evaluate: () => null,
        },
      ];
      expect(evaluateGraphWarningRules(node, graph, rules)).toEqual([]);
    });

    it('returns a result entry for each triggered rule', () => {
      const node = makeNode('n1', 'parallel', 'OuterParallel');
      const graph = { nodes: [node], edges: [] };
      const rules: GraphWarningRule[] = [
        {
          id: 'rule-a',
          severity: 'error',
          evaluate: (n) => ({ message: `error from ${n.label}` }),
        },
        {
          id: 'rule-b',
          severity: 'warning',
          evaluate: () => ({ message: 'warning fires' }),
        },
      ];
      const results = evaluateGraphWarningRules(node, graph, rules);
      expect(results).toEqual([
        {
          ruleId: 'rule-a',
          severity: 'error',
          nodeId: 'n1',
          message: 'error from OuterParallel',
        },
        {
          ruleId: 'rule-b',
          severity: 'warning',
          nodeId: 'n1',
          message: 'warning fires',
        },
      ]);
    });

    it('passes the graph to the evaluator, mapping Edge entities to the pure shape', () => {
      const a = makeNode('a', 'parallel');
      const b = makeNode('b', 'http');
      const edge = makeEdge('e1', 'a', 'b', 'branch_0');
      const graph = { nodes: [a, b], edges: [edge] };
      let captured:
        | {
            nodes: readonly { id: string }[];
            edges: readonly { source: string; sourceHandle?: string | null }[];
          }
        | undefined;
      const rules: GraphWarningRule[] = [
        {
          id: 'capture-graph',
          severity: 'warning',
          evaluate: (_n, g) => {
            captured = g;
            return null;
          },
        },
      ];
      evaluateGraphWarningRules(a, graph, rules);
      // 노드는 entity 그대로 통과 (구조적 호환), 엣지는 source/sourceHandle 로 매핑.
      expect(captured!.nodes).toBe(graph.nodes);
      expect(captured!.edges).toEqual([
        { source: 'a', sourceHandle: 'branch_0', target: 'b', targetHandle: 'in' },
      ]);
    });
  });

  describe('evaluateGraphWarningRulesForGraph — whole graph', () => {
    it('returns combined results for all matching nodes', () => {
      const p1 = makeNode('p1', 'parallel', 'P1');
      const p2 = makeNode('p2', 'parallel', 'P2');
      const http = makeNode('h1', 'http', 'HTTP');
      const graph = { nodes: [p1, p2, http], edges: [] };
      const parallelRules: GraphWarningRule[] = [
        {
          id: 'parallel:always-warn',
          severity: 'warning',
          evaluate: (n) => ({ message: `from ${n.label}` }),
        },
      ];
      const resolver = (type: string) =>
        type === 'parallel' ? parallelRules : undefined;

      const results = evaluateGraphWarningRulesForGraph(graph, resolver);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.nodeId).sort()).toEqual(['p1', 'p2']);
      expect(results.every((r) => r.severity === 'warning')).toBe(true);
    });

    it('returns [] when no node types have rules', () => {
      const graph = { nodes: [makeNode('h', 'http')], edges: [] };
      const results = evaluateGraphWarningRulesForGraph(graph, () => undefined);
      expect(results).toEqual([]);
    });

    it('mixes error and warning severities — caller decides reject', () => {
      const a = makeNode('a', 'parallel');
      const b = makeNode('b', 'parallel');
      const graph = { nodes: [a, b], edges: [] };
      const rules: GraphWarningRule[] = [
        {
          id: 'err-on-a',
          severity: 'error',
          evaluate: (n) => (n.id === 'a' ? { message: 'a is bad' } : null),
        },
        {
          id: 'warn-always',
          severity: 'warning',
          evaluate: () => ({ message: 'soft hint' }),
        },
      ];
      const results = evaluateGraphWarningRulesForGraph(graph, () => rules);
      const hasError = results.some((r) => r.severity === 'error');
      const hasWarning = results.some((r) => r.severity === 'warning');
      expect(hasError).toBe(true);
      expect(hasWarning).toBe(true);
      expect(results).toHaveLength(3); // a: err + warn, b: warn only
    });
  });
});
