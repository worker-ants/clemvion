import { ShadowWorkflow, ShadowSnapshot } from './shadow-workflow';

const TRIGGER_NODE = {
  id: '00000000-0000-0000-0000-000000000001',
  type: 'manual_trigger',
  category: 'trigger' as const,
  label: 'Start',
  positionX: 250,
  positionY: 300,
  config: {},
};

function baseSnapshot(): ShadowSnapshot {
  return {
    nodes: [TRIGGER_NODE],
    edges: [],
  };
}

describe('ShadowWorkflow', () => {
  describe('add_node', () => {
    it('adds a node, assigns a new UUID, and returns ok', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Fetch API',
          position: { x: 500, y: 300 },
          config: { method: 'GET' },
        },
      });
      expect(result.ok).toBe(true);
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      const snap = sw.snapshot();
      expect(snap.nodes).toHaveLength(2);
      const added = snap.nodes.find((n) => n.id === result.id);
      expect(added?.label).toBe('Fetch API');
      expect(added?.config).toEqual({ method: 'GET' });
    });

    it('rejects unknown node types', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'mystery_node',
          label: 'X',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_NODE_TYPE');
    });

    it('rejects label conflicts and suggests an alternative', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Start',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('LABEL_CONFLICT');
      expect(result.suggested).toBe('Start (2)');
    });

    it('infers category from registry', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']), {
        http_request: 'integration',
      });
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Fetch',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(true);
      const added = sw.snapshot().nodes.find((n) => n.id === result.id);
      expect(added?.category).toBe('integration');
    });
  });

  describe('update_node', () => {
    it('merges config patch onto existing node', () => {
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'node-1',
              type: 'http_request',
              category: 'integration',
              label: 'HTTP',
              positionX: 500,
              positionY: 300,
              config: { method: 'GET' },
            },
          ],
          edges: [],
        },
        new Set(['http_request']),
      );
      const result = sw.apply({
        name: 'update_node',
        arguments: {
          id: 'node-1',
          patch: { config: { url: 'https://example.com' } },
        },
      });
      expect(result.ok).toBe(true);
      const snap = sw.snapshot();
      expect(snap.nodes[1].config).toEqual({
        method: 'GET',
        url: 'https://example.com',
      });
    });

    it('rejects when node not found', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set());
      const result = sw.apply({
        name: 'update_node',
        arguments: { id: 'missing', patch: { label: 'Y' } },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NODE_NOT_FOUND');
    });

    it('rejects label conflict on rename', () => {
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'node-1',
              type: 'http_request',
              category: 'integration',
              label: 'A',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [],
        },
        new Set(['http_request']),
      );
      const result = sw.apply({
        name: 'update_node',
        arguments: { id: 'node-1', patch: { label: 'Start' } },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('LABEL_CONFLICT');
    });
  });

  describe('remove_node', () => {
    it('removes node and connected edges', () => {
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'node-1',
              type: 'http_request',
              category: 'integration',
              label: 'HTTP',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: TRIGGER_NODE.id,
              targetNodeId: 'node-1',
              sourcePort: 'out',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
        new Set(['http_request']),
      );
      const result = sw.apply({
        name: 'remove_node',
        arguments: { id: 'node-1' },
      });
      expect(result.ok).toBe(true);
      expect(result.removedEdgeIds).toEqual(['e1']);
      expect(sw.snapshot().nodes).toHaveLength(1);
      expect(sw.snapshot().edges).toHaveLength(0);
    });

    it('refuses to remove manual_trigger', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set());
      const result = sw.apply({
        name: 'remove_node',
        arguments: { id: TRIGGER_NODE.id },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('MANUAL_TRIGGER_PROTECTED');
    });
  });

  describe('add_edge', () => {
    const twoNodeSnap = (): ShadowSnapshot => ({
      nodes: [
        TRIGGER_NODE,
        {
          id: 'node-1',
          type: 'http_request',
          category: 'integration',
          label: 'HTTP',
          positionX: 500,
          positionY: 300,
          config: {},
        },
      ],
      edges: [],
    });

    it('adds a data edge between existing nodes', () => {
      const sw = new ShadowWorkflow(twoNodeSnap(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: 'node-1',
        },
      });
      expect(result.ok).toBe(true);
      const edges = sw.snapshot().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].sourceNodeId).toBe(TRIGGER_NODE.id);
      expect(edges[0].targetNodeId).toBe('node-1');
      expect(edges[0].sourcePort).toBe('out');
      expect(edges[0].targetPort).toBe('in');
    });

    it('rejects when either endpoint is missing', () => {
      const sw = new ShadowWorkflow(twoNodeSnap(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: 'missing',
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NODE_NOT_FOUND');
    });

    it('rejects self loop', () => {
      const sw = new ShadowWorkflow(twoNodeSnap(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: 'node-1',
          target_id: 'node-1',
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('CYCLE_DETECTED');
    });

    it('rejects cycles through multi-hop edges', () => {
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'A',
              type: 'http_request',
              category: 'integration',
              label: 'A',
              positionX: 0,
              positionY: 0,
              config: {},
            },
            {
              id: 'B',
              type: 'http_request',
              category: 'integration',
              label: 'B',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: 'A',
              targetNodeId: 'B',
              sourcePort: 'out',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
        new Set(['http_request']),
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: { source_id: 'B', target_id: 'A' },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('CYCLE_DETECTED');
    });

    describe('container loopback (iteration control)', () => {
      /**
       * 컨테이너 (Loop/Foreach/Map 등) 내부 자식에서 자기 (또는 조상) 컨테이너
       * 의 emit 포트로 되돌아가는 에지는 실행 엔진이 `back-edge` 로 해석하는
       * 의도된 반복 로직이므로 Shadow 도 cycle 로 차단하지 않는다.
       */
      it('allows a child → its direct container edge (basic Loop)', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'loop',
                type: 'loop',
                category: 'logic',
                label: 'Loop',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'child',
                type: 'http_request',
                category: 'integration',
                label: 'Inner',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'loop',
              },
            ],
            edges: [
              {
                id: 'e1',
                sourceNodeId: 'loop',
                sourcePort: 'body',
                targetNodeId: 'child',
                targetPort: 'in',
                type: 'data',
              },
            ],
          },
          new Set(['loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'child',
            source_port: 'out',
            target_id: 'loop',
            target_port: 'emit',
          },
        });
        expect(result.ok).toBe(true);
      });

      it('allows nested children to loop back to an ancestor container', () => {
        // Foreach > Loop > child → outer Foreach 로 점프 (조상 체인)
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'outer',
                type: 'foreach',
                category: 'logic',
                label: 'Outer',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'inner',
                type: 'loop',
                category: 'logic',
                label: 'Inner',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'outer',
              },
              {
                id: 'grandchild',
                type: 'http_request',
                category: 'integration',
                label: 'GC',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'inner',
              },
            ],
            edges: [],
          },
          new Set(['foreach', 'loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'grandchild',
            source_port: 'out',
            target_id: 'outer',
            target_port: 'emit',
          },
        });
        expect(result.ok).toBe(true);
      });

      it('still rejects an edge from a child to an unrelated (non-ancestor) container', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'loopA',
                type: 'loop',
                category: 'logic',
                label: 'A',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'loopB',
                type: 'loop',
                category: 'logic',
                label: 'B',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'childA',
                type: 'http_request',
                category: 'integration',
                label: 'CA',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'loopA',
              },
            ],
            // cycle 을 형성하려면:
            //   loopA.body → childA (container → child 명시)
            //   loopB.out  → loopA.in (pre-existing)
            //   childA.out → loopB.emit (이번에 추가 시도)
            // = loopA → childA → loopB → loopA 회로.
            // childA 의 조상은 loopA 뿐이라 loopB 는 예외 대상이 아님 →
            // cycle 판정이 유지되어야 한다.
            edges: [
              {
                id: 'pre1',
                sourceNodeId: 'loopA',
                sourcePort: 'body',
                targetNodeId: 'childA',
                targetPort: 'in',
                type: 'data',
              },
              {
                id: 'pre2',
                sourceNodeId: 'loopB',
                sourcePort: 'out',
                targetNodeId: 'loopA',
                targetPort: 'in',
                type: 'data',
              },
            ],
          },
          new Set(['loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'childA',
            source_port: 'out',
            target_id: 'loopB', // loopA 의 조상이 아님
            target_port: 'emit',
          },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('CYCLE_DETECTED');
      });

      it('rejects a child → container edge with non-emit target port', () => {
        // 포트 한정: `emit` 이 아닌 입력(`in` 등) 으로 돌아오는 에지는
        // iteration back-edge 의 의도가 아니라 일반 cycle 이므로 차단.
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'loop',
                type: 'loop',
                category: 'logic',
                label: 'Loop',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'child',
                type: 'http_request',
                category: 'integration',
                label: 'Inner',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'loop',
              },
            ],
            edges: [
              {
                id: 'e1',
                sourceNodeId: 'loop',
                sourcePort: 'body',
                targetNodeId: 'child',
                targetPort: 'in',
                type: 'data',
              },
            ],
          },
          new Set(['loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'child',
            source_port: 'out',
            target_id: 'loop',
            target_port: 'in', // not emit
          },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('CYCLE_DETECTED');
      });

      it('keeps an existing loopback edge out of the reachability graph', () => {
        // wouldCreateCycle 의 DFS skip 로직 직접 검증: 이미 child → loop.emit
        // back-edge 가 있는 상태에서 "외부 노드 → loop" 에지를 새로 추가하면
        // 허용되어야 한다. skip 이 없으면 외부→loop→body→child→emit→loop 을
        // 따라가 loop 에 도달할 수 있어 오판 가능 (단 실제로는 loop 로 돌아가
        // 도 source 인 외부 노드는 도달하지 않음). 본 테스트는 skip 로직이
        // 정상 적용되는지 최소한으로 고정.
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'loop',
                type: 'loop',
                category: 'logic',
                label: 'Loop',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'child',
                type: 'http_request',
                category: 'integration',
                label: 'Inner',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'loop',
              },
              {
                id: 'ext',
                type: 'http_request',
                category: 'integration',
                label: 'Ext',
                positionX: 0,
                positionY: 0,
                config: {},
              },
            ],
            edges: [
              {
                id: 'body',
                sourceNodeId: 'loop',
                sourcePort: 'body',
                targetNodeId: 'child',
                targetPort: 'in',
                type: 'data',
              },
              {
                id: 'loopback',
                sourceNodeId: 'child',
                sourcePort: 'out',
                targetNodeId: 'loop',
                targetPort: 'emit',
                type: 'data',
              },
            ],
          },
          new Set(['loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'ext',
            source_port: 'out',
            target_id: 'loop',
            target_port: 'in',
          },
        });
        expect(result.ok).toBe(true);
        expect(sw.snapshot().edges).toHaveLength(3);
      });

      it('tolerates corrupted containerId chains (A.container = B, B.container = A)', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'A',
                type: 'loop',
                category: 'logic',
                label: 'A',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'B',
              },
              {
                id: 'B',
                type: 'loop',
                category: 'logic',
                label: 'B',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'A',
              },
              {
                id: 'X',
                type: 'http_request',
                category: 'integration',
                label: 'X',
                positionX: 0,
                positionY: 0,
                config: {},
              },
            ],
            edges: [],
          },
          new Set(['loop', 'http_request']),
        );
        // 손상된 체인을 따라가도 무한 루프 없이 종료되고 통상 cycle 검사가
        // 수행되어야 한다 (X → A 같은 안전한 에지는 허용).
        const result = sw.apply({
          name: 'add_edge',
          arguments: { source_id: 'X', target_id: 'A' },
        });
        expect(result.ok).toBe(true);
      });

      it('records the loopback edge in the snapshot with correct ports', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'loop',
                type: 'loop',
                category: 'logic',
                label: 'Loop',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'child',
                type: 'http_request',
                category: 'integration',
                label: 'Inner',
                positionX: 0,
                positionY: 0,
                config: {},
                containerId: 'loop',
              },
            ],
            edges: [],
          },
          new Set(['loop', 'http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'child',
            source_port: 'out',
            target_id: 'loop',
            target_port: 'emit',
          },
        });
        expect(result.ok).toBe(true);
        const edges = sw.snapshot().edges;
        expect(edges).toHaveLength(1);
        expect(edges[0]).toMatchObject({
          sourceNodeId: 'child',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
        });
      });

      it('still rejects genuine cycles among top-level nodes (regression)', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'A',
                type: 'http_request',
                category: 'integration',
                label: 'A',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'B',
                type: 'http_request',
                category: 'integration',
                label: 'B',
                positionX: 0,
                positionY: 0,
                config: {},
              },
            ],
            edges: [
              {
                id: 'e1',
                sourceNodeId: 'A',
                sourcePort: 'out',
                targetNodeId: 'B',
                targetPort: 'in',
                type: 'data',
              },
            ],
          },
          new Set(['http_request']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: { source_id: 'B', target_id: 'A' },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('CYCLE_DETECTED');
      });
    });
  });

  describe('remove_edge', () => {
    it('removes the edge by id', () => {
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'node-1',
              type: 'http_request',
              category: 'integration',
              label: 'HTTP',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: TRIGGER_NODE.id,
              targetNodeId: 'node-1',
              sourcePort: 'out',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
        new Set(['http_request']),
      );
      const result = sw.apply({
        name: 'remove_edge',
        arguments: { id: 'e1' },
      });
      expect(result.ok).toBe(true);
      expect(sw.snapshot().edges).toHaveLength(0);
    });

    it('reports ok=false when edge missing', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set());
      const result = sw.apply({
        name: 'remove_edge',
        arguments: { id: 'ghost' },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('EDGE_NOT_FOUND');
    });
  });

  describe('unknown tool', () => {
    it('returns ok=false with UNKNOWN_TOOL', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set());
      const result = sw.apply({
        name: 'wat',
        arguments: {},
      } as never);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_TOOL');
    });
  });

  // Assistant 가 LLM 이 생성한 config 를 그대로 커밋하지 않도록,
  // addNode/updateNode 커밋 전에 expression-engine.validate() 를 돌린다.
  describe('expression validation guard', () => {
    it('rejects add_node when config contains unsupported expression syntax', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Fetch',
          position: { x: 0, y: 0 },
          config: { url: '{{ $input.endpoint ?? "/default" }}' },
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_EXPRESSION');
      expect(result.invalidExpressions?.[0].path).toBe('url');
      expect(result.message).toMatch(/Invalid expression/);
      // 실패 시 shadow 상태는 그대로여야 한다.
      expect(sw.snapshot().nodes).toHaveLength(1);
    });

    it('accepts add_node with optional chaining (supported syntax)', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Fetch',
          position: { x: 0, y: 0 },
          config: {
            url: '{{ $node["Upstream"]?.output?.endpoint }}',
          },
        },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects update_node patch containing invalid expression', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const add = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Fetch',
          position: { x: 0, y: 0 },
          config: { url: '/v1' },
        },
      });
      expect(add.ok).toBe(true);
      const before = sw.snapshot().nodes.find((n) => n.id === add.id)!.config;

      const result = sw.apply({
        name: 'update_node',
        arguments: {
          id: add.id!,
          patch: {
            config: { body: '{{ $input.items.map(x => x) }}' },
          },
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_EXPRESSION');

      // 패치가 reject 되었으므로 config 는 수정되기 전 상태여야 한다.
      const after = sw.snapshot().nodes.find((n) => n.id === add.id)!.config;
      expect(after).toEqual(before);
    });

    it('surfaces deep field paths in the result', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['switch']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'switch',
          label: 'Route',
          position: { x: 0, y: 0 },
          config: {
            cases: [
              { id: 'case_ok', condition: '{{ $input.ok == true }}' },
              { id: 'case_bad', condition: '{{ $input.count ?? 0 }}' },
            ],
          },
        },
      });
      expect(result.ok).toBe(false);
      expect(result.invalidExpressions?.[0].path).toBe('cases[1].condition');
    });
  });

  // LLM 이 자주 저지르는 3가지 실수 계열에 대해 에러 응답이 자체 복구 단서를
  // 충분히 싣는지 고정한다 (assistant 자체 점검 플로우의 1차 방어선).
  describe('error enrichment for UNKNOWN_NODE_TYPE / LABEL_CONFLICT / cascading NODE_NOT_FOUND', () => {
    it('UNKNOWN_NODE_TYPE: maps common "error_message" alias to the template node with a clear hint', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['template', 'http_request', 'switch']),
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'error_message',
          label: 'InvalidSelection',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_NODE_TYPE');
      expect(result.suggestedType).toBe('template');
      expect(result.knownTypes).toEqual(
        expect.arrayContaining(['template', 'http_request', 'switch']),
      );
      expect(result.hint).toMatch(/template/);
      expect(result.hint).toMatch(/error_message/);
    });

    it('UNKNOWN_NODE_TYPE: returns Levenshtein-closest suggestion when no alias hit', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['http_request', 'send_email', 'carousel']),
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'send_mail', // 1 character off from send_email
          label: 'Send',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_NODE_TYPE');
      expect(result.suggestedType).toBe('send_email');
      expect(result.hint).toMatch(/send_email/);
    });

    it('UNKNOWN_NODE_TYPE: omits suggestedType when no known type is within edit-distance threshold', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'mystery_node_type_xyz',
          label: 'X',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_NODE_TYPE');
      expect(result.suggestedType).toBeUndefined();
      expect(result.hint).toMatch(/knownTypes/);
      expect(result.knownTypes).toEqual(['http_request']);
    });

    it('UNKNOWN_NODE_TYPE: caps knownTypes at 40 entries to keep the payload compact', () => {
      const many: string[] = [];
      for (let i = 0; i < 60; i++) many.push(`node_type_${i}`);
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(many));
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'completely_unrelated_payload_name',
          label: 'X',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.knownTypes).toHaveLength(40);
    });

    it('LABEL_CONFLICT: attaches repeatCount + hint when the SAME label conflicts twice in a row', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const first = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Start', // already taken by TRIGGER_NODE
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(first.ok).toBe(false);
      expect(first.error).toBe('LABEL_CONFLICT');
      expect(first.repeatCount).toBeUndefined(); // first attempt, no escalation
      const second = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Start',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(second.ok).toBe(false);
      expect(second.error).toBe('LABEL_CONFLICT');
      expect(second.repeatCount).toBe(2);
      expect(second.hint).toMatch(/suggested/i);
    });

    it('NODE_NOT_FOUND on add_edge after a failed add_node: attaches a cascading-failure hint', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      // Step 1: add_node fails due to UNKNOWN_NODE_TYPE.
      const failed = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'ghost_type',
          label: 'Ghost',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(failed.ok).toBe(false);
      // Step 2: LLM forges ahead with add_edge using a fabricated UUID.
      const edge = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: '00000000-0000-0000-0000-dead0000dead',
        },
      });
      expect(edge.ok).toBe(false);
      expect(edge.error).toBe('NODE_NOT_FOUND');
      expect(edge.hint).toMatch(/prior add_node failed/);
      expect(edge.hint).toMatch(/Ghost/);
    });

    it.each([
      ['user_input', 'form'],
      ['survey', 'form'],
      ['choice', 'carousel'],
      ['category', 'carousel'],
      ['router', 'switch'],
      ['email', 'send_email'],
      ['display', 'template'],
    ])(
      'UNKNOWN_NODE_TYPE: maps common LLM-invented type %s → %s via alias map',
      (attempted, expected) => {
        const sw = new ShadowWorkflow(
          baseSnapshot(),
          new Set(['template', 'form', 'carousel', 'switch', 'send_email']),
        );
        const result = sw.apply({
          name: 'add_node',
          arguments: {
            type: attempted,
            label: `Test_${attempted}`,
            position: { x: 0, y: 0 },
            config: {},
          },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('UNKNOWN_NODE_TYPE');
        expect(result.suggestedType).toBe(expected);
      },
    );

    it('UNKNOWN_NODE_TYPE: falls through to Levenshtein when alias exists but not in knownTypes', () => {
      // 별칭 맵은 hit 하지만 workspace 에 해당 타입이 등록되지 않은 환경이라면
      // 별칭을 suggestedType 으로 제시하면 안 된다. Levenshtein fallback 으로
      // 실제 등록 타입 중 가장 가까운 것을 제안해야 한다.
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        // `template` 이 registry 에 없음 - error_message alias 가 매핑 대상 상실
        new Set(['http_request', 'send_email']),
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'error_message',
          label: 'X',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_NODE_TYPE');
      // alias 는 skip — suggestedType 은 없거나 registered 타입이어야 한다.
      expect(result.suggestedType).not.toBe('template');
      // knownTypes 에는 `template` 이 나오지 않는다 (registry 에 없으므로).
      expect(result.knownTypes).not.toContain('template');
    });

    it('LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint', () => {
      // LABEL_CONFLICT 는 "이름만 겹침" 상태. 이어지는 add_edge NODE_NOT_FOUND
      // 힌트에 LABEL_CONFLICT 라벨이 끼면 "앞선 노드 생성 실패" 라는 틀린
      // 진단을 주기 때문에 cascading window 에 기록하지 않아야 한다.
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      const conflict = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'http_request',
          label: 'Start', // trigger label 과 충돌
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(conflict.ok).toBe(false);
      expect(conflict.error).toBe('LABEL_CONFLICT');
      // 이후 add_edge 가 NODE_NOT_FOUND 여도 hint 에 LABEL_CONFLICT 라벨이
      // 실리지 않아야 한다.
      const edge = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: '00000000-0000-0000-0000-dead0000dead',
        },
      });
      expect(edge.ok).toBe(false);
      expect(edge.error).toBe('NODE_NOT_FOUND');
      expect(edge.hint).toBeUndefined();
    });

    it('NODE_NOT_FOUND hint sanitizes user-provided labels (strips newlines, fullwidth-escapes angle brackets)', () => {
      // 프롬프트 인젝션 방어: label 이 `\n## HACK` 이나 `<script>` 같은
      // 문자열이면 JSON.stringify + sanitizer 로 중화되어야 한다.
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
      sw.apply({
        name: 'add_node',
        arguments: {
          type: 'ghost',
          label: 'Bad\n## HACK\n<script>alert(1)</script>',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      const edge = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: '00000000-0000-0000-0000-dead0000dead',
        },
      });
      expect(edge.hint).toBeDefined();
      // 개행이 제거되어 마크다운 헤더가 살아남지 못함
      expect(edge.hint).not.toMatch(/\n/);
      // 꺾쇠는 fullwidth 로 중화
      expect(edge.hint).not.toMatch(/<script>/);
    });

    it('NODE_NOT_FOUND hint is cleared after the failing label is successfully re-added', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['http_request', 'template']),
      );
      // Fail first.
      sw.apply({
        name: 'add_node',
        arguments: {
          type: 'ghost_type',
          label: 'Recovered',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      // Recover with a valid type.
      const ok = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'template',
          label: 'Recovered',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(ok.ok).toBe(true);
      // Now a later edge still failing with NODE_NOT_FOUND should NOT name
      // the recovered label in the cascading hint (it already succeeded).
      const edge = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          target_id: '00000000-0000-0000-0000-dead0000dead',
        },
      });
      expect(edge.ok).toBe(false);
      expect(edge.error).toBe('NODE_NOT_FOUND');
      // No failed labels remaining → no hint.
      expect(edge.hint).toBeUndefined();
    });
  });

  // PORT_NOT_FOUND: 사용자가 설정한 동적 포트 (carousel 버튼 / switch case
  // 등) 가 config 미완으로 생성되지 않은 상황에서 LLM 이 해당 port id 로
  // add_edge 를 시도하는 케이스를 가드한다. portResolver 가 주입된 경우에만
  // 작동. 기존 permissive 동작은 resolver 없이 호출되는 테스트 / 레거시
  // 경로에서 유지된다.
  describe('add_edge port validation (PORT_NOT_FOUND)', () => {
    const twoCarouselSnap = (): ShadowSnapshot => ({
      nodes: [
        TRIGGER_NODE,
        {
          id: 'node-carousel',
          type: 'carousel',
          category: 'presentation',
          label: '메뉴 선택',
          positionX: 0,
          positionY: 0,
          // config 가 비어있음 → buttons 가 설정되지 않아 동적 포트 없음.
          config: {},
        },
        {
          id: 'node-target',
          type: 'http_request',
          category: 'integration',
          label: '후속',
          positionX: 0,
          positionY: 0,
          config: {},
        },
      ],
      edges: [],
    });
    // Source / target 에 대해 "어떤 포트가 존재하는가" 를 돌려주는 mock.
    // Carousel 은 config 기반으로 동적 — 여기서는 config 비어있어 out 단일.
    // http_request 는 static out/error + in.
    const makeResolver = (carouselOutputs: string[]) => {
      return (node: { type: string }) => {
        if (node.type === 'manual_trigger') {
          return { outputs: ['out'], inputs: [] };
        }
        if (node.type === 'carousel') {
          return { outputs: carouselOutputs, inputs: ['in'] };
        }
        if (node.type === 'http_request') {
          return { outputs: ['out', 'error'], inputs: ['in'] };
        }
        return null;
      };
    };

    it("rejects add_edge whose source_port is not in the node's resolved outputs", () => {
      const sw = new ShadowWorkflow(
        twoCarouselSnap(),
        new Set(['carousel', 'http_request']),
        {},
        makeResolver(['out']), // btn_korean 없음
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: 'node-carousel',
          source_port: 'btn_korean',
          target_id: 'node-target',
          target_port: 'in',
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PORT_NOT_FOUND');
      expect(result.portInfo).toEqual({
        side: 'source',
        attemptedPort: 'btn_korean',
        nodeLabel: '메뉴 선택',
        nodeType: 'carousel',
        knownPorts: ['out'],
      });
      // hint 는 config 미완 시나리오를 가장 먼저 언급.
      expect(result.hint).toMatch(/user-configured/);
      expect(result.hint).toContain('btn_korean');
    });

    it("rejects add_edge whose target_port is not in the node's resolved inputs", () => {
      const sw = new ShadowWorkflow(
        twoCarouselSnap(),
        new Set(['carousel', 'http_request']),
        {},
        makeResolver(['out']),
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          source_port: 'out',
          target_id: 'node-target',
          target_port: 'bogus_input',
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PORT_NOT_FOUND');
      expect(result.portInfo?.side).toBe('target');
      expect(result.portInfo?.attemptedPort).toBe('bogus_input');
    });

    it('accepts add_edge when source_port matches a resolved dynamic port', () => {
      // config 가 채워져 btn_a 포트가 생성된 carousel.
      const sw = new ShadowWorkflow(
        twoCarouselSnap(),
        new Set(['carousel', 'http_request']),
        {},
        makeResolver(['btn_a', 'btn_b', 'out']),
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: 'node-carousel',
          source_port: 'btn_a',
          target_id: 'node-target',
          target_port: 'in',
        },
      });
      expect(result.ok).toBe(true);
    });

    it('skips port validation when resolver returns null for an unknown node type', () => {
      // "예상치 못한 노드 타입" 을 만나면 null → 기존 permissive 동작 유지.
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'node-unknown',
              type: 'custom_plugin_node',
              category: 'integration',
              label: 'Custom',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [],
        },
        new Set(['custom_plugin_node']),
        {},
        () => null, // 모든 노드 해석 불가
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,
          source_port: 'anything',
          target_id: 'node-unknown',
          target_port: 'whatever',
        },
      });
      expect(result.ok).toBe(true);
    });

    it('allows the `emit` container loopback target port even if resolver does not expose it (spec §4.4)', () => {
      // Loop/foreach 자식 → 조상 컨테이너 emit 포트는 실행 엔진이 특별 처리.
      // Resolver 가 emit 을 input 에 싣지 않아도 valid 로 간주되어야 한다.
      const sw = new ShadowWorkflow(
        {
          nodes: [
            TRIGGER_NODE,
            {
              id: 'loop-container',
              type: 'loop',
              category: 'logic',
              label: 'Loop',
              positionX: 0,
              positionY: 0,
              config: {},
            },
            {
              id: 'loop-child',
              type: 'http_request',
              category: 'integration',
              label: 'Fetch',
              positionX: 0,
              positionY: 0,
              config: {},
              // 자식이 조상 컨테이너를 containerId 로 참조.
              containerId: 'loop-container',
            },
          ],
          edges: [],
        },
        new Set(['loop', 'http_request']),
        {},
        (node) => {
          if (node.type === 'loop')
            return { outputs: ['iter'], inputs: ['in'] };
          if (node.type === 'http_request')
            return { outputs: ['out'], inputs: ['in'] };
          if (node.type === 'manual_trigger')
            return { outputs: ['out'], inputs: [] };
          return null;
        },
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: 'loop-child',
          source_port: 'out',
          target_id: 'loop-container',
          target_port: 'emit',
        },
      });
      expect(result.ok).toBe(true);
    });

    it('is skipped entirely when no portResolver is passed (legacy / test callers)', () => {
      // 기존 호출자 호환성 — resolver 없이 생성된 ShadowWorkflow 는 예전처럼
      // 임의 포트 이름을 허용한다.
      const sw = new ShadowWorkflow(
        twoCarouselSnap(),
        new Set(['carousel', 'http_request']),
      );
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: 'node-carousel',
          source_port: 'btn_any_bogus_name',
          target_id: 'node-target',
          target_port: 'in',
        },
      });
      expect(result.ok).toBe(true);
    });
  });
});
