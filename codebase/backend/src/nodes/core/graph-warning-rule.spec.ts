import {
  evaluateGraphWarningRules,
  evaluateGraphWarningRulesForGraph,
  GraphWarningRule,
} from './graph-warning-rule';
import type { Node } from '../../modules/nodes/entities/node.entity';
import type { Edge } from '../../modules/edges/entities/edge.entity';
import { parallelNodeMetadata } from '../logic/parallel/parallel.schema';

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
      // 노드는 toRuleNode 로 명시 매핑 (id/type/config/label), 엣지는
      // source/sourceHandle 로 매핑.
      expect(captured!.nodes).toEqual([
        { id: 'a', type: 'parallel', config: {}, label: 'a' },
        { id: 'b', type: 'http', config: {}, label: 'b' },
      ]);
      expect(captured!.edges).toEqual([
        {
          source: 'a',
          sourceHandle: 'branch_0',
          target: 'b',
          targetHandle: 'in',
        },
      ]);
    });

    it('skips a node whose type is undefined (no compile-time cast safety net)', () => {
      // entity 필드 누락(예: type undefined) 시 as 단언이면 런타임에서야 터지지만,
      // toRuleNode 는 평가 graph 에서 안전하게 제외한다.
      const typeless = {
        id: 'x',
        label: 'x',
        workflowId: 'wf-1',
        config: {},
      } as unknown as Node;
      const ok = makeNode('p', 'parallel', 'P');
      const graph = { nodes: [typeless, ok], edges: [] };
      let captured: { nodes: readonly { id: string }[] } | undefined;
      const rules: GraphWarningRule[] = [
        {
          id: 'capture',
          severity: 'warning',
          evaluate: (_n, g) => {
            captured = g;
            return null;
          },
        },
      ];
      // type 누락 노드를 직접 평가해도 throw 없이 빈 결과.
      expect(evaluateGraphWarningRules(typeless, graph, rules)).toEqual([]);
      // 정상 노드를 평가하면 graph.nodes 에서 type 누락 노드는 빠진다.
      evaluateGraphWarningRules(ok, graph, rules);
      expect(captured!.nodes.map((n) => n.id)).toEqual(['p']);
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

  describe('end-to-end with real parallelNodeMetadata.graphWarningRules', () => {
    // adapter (Node/Edge entity → 순수 shape) → 실제 패키지 rule 평가까지 통합.
    // resolver 는 backend registry 가 하듯 type → metadata.graphWarningRules 를 준다.
    const realResolver = (
      type: string,
    ): readonly GraphWarningRule[] | undefined =>
      type === 'parallel' ? parallelNodeMetadata.graphWarningRules : undefined;

    const branchEdge = (id: string, source: string, target: string): Edge =>
      makeEdge(id, source, target, 'branch_0');

    it('3-level nested Parallel graph surfaces parallel:nested-depth-exceeded', () => {
      const outer = makeNode('p1', 'parallel', 'Outer');
      const inner = makeNode('p2', 'parallel', 'Inner');
      const innermost = makeNode('p3', 'parallel', 'Innermost');
      const graph = {
        nodes: [outer, inner, innermost],
        edges: [branchEdge('e1', 'p1', 'p2'), branchEdge('e2', 'p2', 'p3')],
      };

      const results = evaluateGraphWarningRulesForGraph(graph, realResolver);
      const depthError = results.find(
        (r) => r.ruleId === 'parallel:nested-depth-exceeded',
      );
      expect(depthError).toBeDefined();
      expect(depthError!.severity).toBe('error');
      expect(depthError!.nodeId).toBe('p1');
      expect(depthError!.message).toContain('depth > 2');
    });
  });
});
