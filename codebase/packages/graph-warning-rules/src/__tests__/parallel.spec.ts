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
      // i18n Principle 3-C: 동적 값을 params 로 분리 노출 (frontend localize 용)
      expect(result!.params).toEqual({
        node: 'Outer',
        child: 'Inner',
        grand: 'Innermost',
      });
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

    // Background 의 `background` 연결선 뒤 본문은 워커가 새 컨텍스트에서 실행한다. 바깥
    // Parallel 의 병렬 분기 본문으로 세지 않고 그 안 Parallel 은 깊이 1부터 센다
    // (REQ-PARALLEL-036, NERV Task CLE-T-B7A8B2).
    describe('Background 본문', () => {
      const outer = mkNode('p1', 'parallel', { label: 'Outer' });
      const inner = mkNode('p2', 'parallel', { label: 'Inner' });
      const bg = mkNode('bg', 'background', { label: 'BG' });
      const bodyP = mkNode('p3', 'parallel', { label: 'BodyP' });

      it('병렬 분기 안 Background 본문의 Parallel 은 바깥 깊이를 이어 세지 않는다', () => {
        const graph = {
          nodes: [outer, inner, bg, bodyP],
          edges: [
            mkEdge('p1', 'p2', 'branch_0'),
            mkEdge('p2', 'bg', 'branch_0'),
            mkEdge('bg', 'p3', 'background'),
          ],
        };
        expect(parallelNestedDepthExceededRule.evaluate(outer, graph)).toBeNull();
        expect(evaluateGraphWarningRulesForGraph(graph, resolver)).toEqual([]);
      });

      it('Background 본문 안에서 Parallel 이 세 겹이면 본문 첫 Parallel 에서 막는다', () => {
        const p4 = mkNode('p4', 'parallel', { label: 'P4' });
        const p5 = mkNode('p5', 'parallel', { label: 'P5' });
        const graph = {
          nodes: [outer, bg, bodyP, p4, p5],
          edges: [
            mkEdge('p1', 'bg', 'branch_0'),
            mkEdge('bg', 'p3', 'background'),
            mkEdge('p3', 'p4', 'branch_0'),
            mkEdge('p4', 'p5', 'branch_0'),
          ],
        };
        expect(parallelNestedDepthExceededRule.evaluate(outer, graph)).toBeNull();
        const results = evaluateGraphWarningRulesForGraph(graph, resolver);
        expect(
          results
            .filter((r) => r.ruleId === 'parallel:nested-depth-exceeded')
            .map((r) => r.nodeId),
        ).toEqual(['p3']);
      });

      it('병렬 분기 안 컨테이너에 둔 Background 본문의 Parallel 도 바깥 깊이를 이어 세지 않는다', () => {
        const loop = mkNode('loop', 'foreach', { label: 'Each' });
        const graph = {
          nodes: [outer, inner, loop, bg, bodyP],
          edges: [
            mkEdge('p1', 'p2', 'branch_0'),
            mkEdge('p2', 'loop', 'branch_0'),
            mkEdge('loop', 'bg', 'body'),
            mkEdge('bg', 'p3', 'background'),
          ],
        };
        expect(parallelNestedDepthExceededRule.evaluate(outer, graph)).toBeNull();
        expect(evaluateGraphWarningRulesForGraph(graph, resolver)).toEqual([]);
      });

      it('Background 의 다른 포트 뒤 노드는 병렬 분기 본문으로 센다', () => {
        const graph = {
          nodes: [outer, inner, bg, bodyP],
          edges: [
            mkEdge('p1', 'p2', 'branch_0'),
            mkEdge('p2', 'bg', 'branch_0'),
            mkEdge('bg', 'p3', 'out'),
          ],
        };
        expect(parallelNestedDepthExceededRule.evaluate(outer, graph)).not.toBeNull();
      });

      it('Background 본문이 아닌 경로로도 닿는 노드는 병렬 분기 본문으로 센다', () => {
        const graph = {
          nodes: [outer, inner, bg, bodyP],
          edges: [
            mkEdge('p1', 'p2', 'branch_0'),
            mkEdge('p2', 'bg', 'branch_0'),
            mkEdge('bg', 'p3', 'background'),
            mkEdge('p2', 'p3', 'branch_1'),
          ],
        };
        expect(parallelNestedDepthExceededRule.evaluate(outer, graph)).not.toBeNull();
      });

      it('Background 본문 안 Parallel 과는 동시 실행 한도를 곱하지 않는다', () => {
        const wide = mkNode('p1', 'parallel', { config: { maxConcurrency: 8 } });
        const bodyWide = mkNode('p3', 'parallel', { config: { maxConcurrency: 8 } });
        expect(
          parallelNestedConcurrencyCapRule.evaluate(wide, {
            nodes: [wide, bg, bodyWide],
            edges: [mkEdge('p1', 'bg', 'branch_0'), mkEdge('bg', 'p3', 'background')],
          }),
        ).toBeNull();
      });
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
      // i18n Principle 3-C: 보간 값 분리 노출
      expect(result!.params).toEqual({
        node: 'Outer',
        child: 'Inner',
        outerEffective: 8,
        innerEffective: 8,
        product: 64,
        cap: 32,
      });
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
      // evaluator 가 evaluate 의 params 를 result 로 전파 (i18n Principle 3-C)
      const depth = results.find((r) => r.ruleId === 'parallel:nested-depth-exceeded');
      expect(depth!.params).toMatchObject({ node: 'Outer', child: 'Inner' });
    });

    it('returns [] for node types with no rules', () => {
      const http = mkNode('h', 'http');
      expect(
        evaluateGraphWarningRulesForGraph({ nodes: [http], edges: [] }, resolver),
      ).toEqual([]);
    });
  });
});
