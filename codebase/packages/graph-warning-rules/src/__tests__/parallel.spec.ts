import {
  evaluateGraphWarningRulesForGraph,
  GRAPH_WARNING_RULES_BY_TYPE,
  GraphRuleEdge,
  GraphRuleNode,
  parallelGraphWarningRules,
  parallelNestedConcurrencyCapRule,
  parallelNestedDepthExceededRule,
} from '../index';

const mkNode = (
  id: string,
  type: string,
  opts: { label?: string; config?: Record<string, unknown> } = {},
): GraphRuleNode => ({ id, type, label: opts.label ?? id, config: opts.config });

const mkEdge = (source: string, target: string, sourceHandle = 'out'): GraphRuleEdge => ({
  source,
  target,
  sourceHandle,
  targetHandle: 'in',
});

const resolver = (type: string) => GRAPH_WARNING_RULES_BY_TYPE[type];

describe('parallel graphWarningRules', () => {
  it('exports the two parallel rules keyed by type', () => {
    expect(GRAPH_WARNING_RULES_BY_TYPE.parallel).toBe(parallelGraphWarningRules);
    expect(parallelGraphWarningRules.map((r) => r.id)).toEqual([
      'parallel:nested-depth-exceeded',
      'parallel:nested-concurrency-cap',
    ]);
  });

  describe('parallel:nested-depth-exceeded (error)', () => {
    it('3-level nested Parallel → depth error', () => {
      const outer = mkNode('p1', 'parallel', { label: 'Outer' });
      const inner = mkNode('p2', 'parallel', { label: 'Inner' });
      const innermost = mkNode('p3', 'parallel', { label: 'Innermost' });
      const edges = [mkEdge('p1', 'p2', 'branch_0'), mkEdge('p2', 'p3', 'branch_0')];
      const result = parallelNestedDepthExceededRule.evaluate(outer, {
        nodes: [outer, inner, innermost],
        edges,
      });
      expect(result).not.toBeNull();
      expect(result!.message).toContain('Outer');
      expect(result!.message).toContain('Inner');
      expect(result!.message).toContain('Innermost');
      expect(result!.message).toContain('depth > 2');
    });

    it('2-level nesting passes', () => {
      const outer = mkNode('p1', 'parallel');
      const inner = mkNode('p2', 'parallel');
      const term = mkNode('t', 'http');
      const edges = [mkEdge('p1', 'p2', 'branch_0'), mkEdge('p2', 't', 'branch_0')];
      expect(
        parallelNestedDepthExceededRule.evaluate(outer, {
          nodes: [outer, inner, term],
          edges,
        }),
      ).toBeNull();
    });

    it('non-parallel node is skipped', () => {
      const http = mkNode('h', 'http');
      expect(
        parallelNestedDepthExceededRule.evaluate(http, { nodes: [http], edges: [] }),
      ).toBeNull();
    });
  });

  describe('parallel:nested-concurrency-cap (warning)', () => {
    it('concurrency product > 32 → warning', () => {
      const outer = mkNode('p1', 'parallel', {
        label: 'Outer',
        config: { branchCount: 8, maxConcurrency: 8 },
      });
      const inner = mkNode('p2', 'parallel', {
        label: 'Inner',
        config: { branchCount: 8, maxConcurrency: 8 }, // 8 × 8 = 64
      });
      const edges = [mkEdge('p1', 'p2', 'branch_0')];
      const result = parallelNestedConcurrencyCapRule.evaluate(outer, {
        nodes: [outer, inner],
        edges,
      });
      expect(result).not.toBeNull();
      expect(result!.message).toMatch(/64/);
      expect(result!.message).toMatch(/cap=32/);
    });

    it('product === 32 passes (boundary)', () => {
      const outer = mkNode('p1', 'parallel', {
        config: { branchCount: 4, maxConcurrency: 4 },
      });
      const inner = mkNode('p2', 'parallel', {
        config: { branchCount: 8, maxConcurrency: 8 }, // 4 × 8 = 32
      });
      const edges = [mkEdge('p1', 'p2', 'branch_0')];
      expect(
        parallelNestedConcurrencyCapRule.evaluate(outer, {
          nodes: [outer, inner],
          edges,
        }),
      ).toBeNull();
    });

    it('maxConcurrency=0 uses branchCount as effective', () => {
      const outer = mkNode('p1', 'parallel', {
        config: { branchCount: 16, maxConcurrency: 0 },
      });
      const inner = mkNode('p2', 'parallel', {
        config: { branchCount: 4, maxConcurrency: 0 }, // 16 × 4 = 64
      });
      const edges = [mkEdge('p1', 'p2', 'branch_0')];
      expect(
        parallelNestedConcurrencyCapRule.evaluate(outer, {
          nodes: [outer, inner],
          edges,
        }),
      ).not.toBeNull();
    });
  });

  describe('evaluateGraphWarningRulesForGraph — flat graph', () => {
    it('flat graph (no nesting) → no results', () => {
      const p1 = mkNode('p1', 'parallel', { config: { branchCount: 2 } });
      const http = mkNode('h1', 'http');
      const edges = [mkEdge('p1', 'h1', 'branch_0')];
      const results = evaluateGraphWarningRulesForGraph({ nodes: [p1, http], edges }, resolver);
      expect(results).toEqual([]);
    });

    it('whole-graph evaluation surfaces depth error + concurrency warning', () => {
      const outer = mkNode('p1', 'parallel', {
        label: 'Outer',
        config: { branchCount: 8, maxConcurrency: 8 },
      });
      const inner = mkNode('p2', 'parallel', {
        label: 'Inner',
        config: { branchCount: 8, maxConcurrency: 8 },
      });
      const innermost = mkNode('p3', 'parallel', { label: 'Innermost' });
      const edges = [mkEdge('p1', 'p2', 'branch_0'), mkEdge('p2', 'p3', 'branch_0')];
      const results = evaluateGraphWarningRulesForGraph(
        { nodes: [outer, inner, innermost], edges },
        resolver,
      );
      const ids = results.map((r) => r.ruleId);
      expect(ids).toContain('parallel:nested-depth-exceeded');
      expect(ids).toContain('parallel:nested-concurrency-cap');
      expect(results.some((r) => r.severity === 'error')).toBe(true);
    });

    it('returns [] for node types with no rules', () => {
      const http = mkNode('h', 'http');
      expect(
        evaluateGraphWarningRulesForGraph({ nodes: [http], edges: [] }, resolver),
      ).toEqual([]);
    });
  });
});
