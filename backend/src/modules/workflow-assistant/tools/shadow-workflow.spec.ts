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
});
