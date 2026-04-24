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

/**
 * port id 배열을 ResolvedNodePorts 의 descriptor 배열로 변환 (ED-AI-40 로
 * 확장된 shape). port validation 만 검증하는 테스트들이 간결하게 id 만
 * 적으면 되도록 파일 공용 헬퍼로 둔다 (review I-6 — 이전에 두 describe
 * 스코프에 분산 정의됐던 것을 통합).
 */
const toDesc = (ids: string[]) => ids.map((id) => ({ id }));

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

    // 수동 add (workflow-canvas.tsx) 경로가 `definition.defaultConfig` 를
    // 깔고 저장하는 것과 대칭. 어시스턴트 add_node 가 schema default 를
    // 누락한 채 raw 값을 그대로 저장해 mode/layout/maxItems 등 select/enum
    // 필드가 `undefined` 로 남고 프런트 SelectWidget 이 잘못된 첫 option 을
    // 시각적으로 보여주던 regression 을 막는다.
    it('merges definition.defaultConfig under LLM-provided config', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        {
          carousel: {
            mode: 'dynamic',
            layout: 'card',
            items: [],
            maxItems: 10,
            buttons: [],
          },
        },
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '음식 종류 선택',
          position: { x: 0, y: 0 },
          config: {
            buttons: [{ id: 'btn_korean', label: '한식', type: 'port' }],
          },
        },
      });
      expect(result.ok).toBe(true);
      const added = sw.snapshot().nodes.find((n) => n.id === result.id);
      expect(added?.config).toEqual({
        mode: 'dynamic',
        layout: 'card',
        items: [],
        maxItems: 10,
        buttons: [{ id: 'btn_korean', label: '한식', type: 'port' }],
      });
    });

    it('LLM 이 명시한 값은 default 를 override', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        { carousel: { mode: 'dynamic', layout: 'card' } },
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '정적 카루셀',
          position: { x: 0, y: 0 },
          config: { mode: 'static', items: [{ title: '첫 슬라이드' }] },
        },
      });
      expect(result.ok).toBe(true);
      const added = sw.snapshot().nodes.find((n) => n.id === result.id);
      expect(added?.config).toMatchObject({
        mode: 'static',
        layout: 'card',
        items: [{ title: '첫 슬라이드' }],
      });
    });

    // ED-AI-40 (spec §4.3.2): add_node 성공 응답에 runtime ports 가 자동
    // 포함되어, LLM 이 바로 다음 add_edge 에 올바른 source_port 를 채울 수
    // 있게 한다. static / dynamic-ports 모두 동일 shape.
    it('returns runtime ports on success when a portResolver is injected', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        (node) => {
          if (node.type === 'manual_trigger') {
            return { outputs: [{ id: 'out' }], inputs: [] };
          }
          if (node.type === 'carousel') {
            // presentation-buttons 동적 포트 + 정적 error 포트 혼합
            return {
              outputs: [
                { id: 'btn_korean', type: 'data', label: '한식' },
                { id: 'btn_western', type: 'data', label: '양식' },
                { id: 'error', type: 'error' },
              ],
              inputs: [{ id: 'in' }],
            };
          }
          return null;
        },
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '음식 종류 선택',
          position: { x: 500, y: 300 },
          config: {
            buttons: [
              { id: 'btn_korean', label: '한식' },
              { id: 'btn_western', label: '양식' },
            ],
          },
        },
      });
      expect(result.ok).toBe(true);
      expect(result.ports).toBeDefined();
      expect(result.ports?.outputs).toEqual([
        { id: 'btn_korean', type: 'data', label: '한식' },
        { id: 'btn_western', type: 'data', label: '양식' },
        { id: 'error', type: 'error' },
      ]);
      expect(result.ports?.inputs).toEqual([{ id: 'in' }]);
    });

    it('omits ports on success when no portResolver is injected (legacy/test compatibility)', () => {
      const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
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
      expect(result.ports).toBeUndefined();
    });

    it('caps outputs/inputs at 50 per side (defensive against runaway dynamic configs)', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        (node) => {
          if (node.type === 'manual_trigger') {
            return { outputs: [{ id: 'out' }], inputs: [] };
          }
          if (node.type === 'carousel') {
            const manyOutputs = Array.from({ length: 60 }, (_, i) => ({
              id: `btn_${i}`,
            }));
            const manyInputs = Array.from({ length: 55 }, (_, i) => ({
              id: `in_${i}`,
            }));
            return { outputs: manyOutputs, inputs: manyInputs };
          }
          return null;
        },
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: 'Too many buttons',
          position: { x: 0, y: 0 },
          config: {},
        },
      });
      expect(result.ports?.outputs).toHaveLength(50);
      expect(result.ports?.inputs).toHaveLength(50);
      // review W-5: 상한에 걸려 잘린 경우 portsTruncated=true 로 "서버가
      // 일부 포트를 생략했음" 을 LLM/프런트에 신호.
      expect(result.portsTruncated).toBe(true);
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

    // ED-AI-40 mirror: update_node 도 성공 반환에 runtime ports 를 동봉해
    // LLM 이 바로 다음 add_edge 에 정확한 port id 를 쓸 수 있게 한다.
    // 사용 시나리오: carousel 의 buttons config 를 변경해 새 btn_id 가
    // 생겼을 때, update_node 결과의 result.ports.outputs 에 그 id 가 바로
    // 실려 내려와야 한다 (review W-2).
    describe('ED-AI-40 runtime ports on success', () => {
      const CAROUSEL_ID = 'node-1';
      function snapshotWithCarousel(): ShadowSnapshot {
        return {
          nodes: [
            TRIGGER_NODE,
            {
              id: CAROUSEL_ID,
              type: 'carousel',
              category: 'presentation',
              label: 'Menu',
              positionX: 0,
              positionY: 0,
              config: { buttons: [{ id: 'btn_old', label: '이전' }] },
            },
          ],
          edges: [],
        };
      }

      it('returns runtime ports after a config patch when a portResolver is injected', () => {
        const sw = new ShadowWorkflow(
          snapshotWithCarousel(),
          new Set(['carousel']),
          {},
          (node) => {
            if (node.type === 'manual_trigger') {
              return { outputs: [{ id: 'out' }], inputs: [] };
            }
            if (node.type === 'carousel') {
              // config.buttons 를 읽어 resolver 가 해당 port id 들을 돌려준다.
              const cfg = node.config as {
                buttons?: Array<{ id: string; label?: string }>;
              };
              const buttons = cfg.buttons ?? [];
              return {
                outputs: buttons.map((b) => ({
                  id: b.id,
                  type: 'data' as const,
                  ...(b.label ? { label: b.label } : {}),
                })),
                inputs: [{ id: 'in' }],
              };
            }
            return null;
          },
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: {
            id: CAROUSEL_ID,
            patch: {
              config: {
                buttons: [
                  { id: 'btn_korean', label: '한식' },
                  { id: 'btn_western', label: '양식' },
                ],
              },
            },
          },
        });
        expect(result.ok).toBe(true);
        expect(result.ports?.outputs).toEqual([
          { id: 'btn_korean', type: 'data', label: '한식' },
          { id: 'btn_western', type: 'data', label: '양식' },
        ]);
        expect(result.ports?.inputs).toEqual([{ id: 'in' }]);
        expect(result.portsTruncated).toBeUndefined();
      });

      it('omits ports on success when no portResolver is injected (legacy/test compatibility)', () => {
        const sw = new ShadowWorkflow(
          snapshotWithCarousel(),
          new Set(['carousel']),
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: { id: CAROUSEL_ID, patch: { position: { x: 9, y: 9 } } },
        });
        expect(result.ok).toBe(true);
        expect(result.ports).toBeUndefined();
        expect(result.portsTruncated).toBeUndefined();
      });

      it('caps outputs/inputs at 50 per side and sets portsTruncated=true', () => {
        const sw = new ShadowWorkflow(
          snapshotWithCarousel(),
          new Set(['carousel']),
          {},
          (node) => {
            if (node.type === 'manual_trigger') {
              return { outputs: [{ id: 'out' }], inputs: [] };
            }
            if (node.type === 'carousel') {
              return {
                outputs: Array.from({ length: 60 }, (_, i) => ({
                  id: `btn_${i}`,
                })),
                inputs: Array.from({ length: 55 }, (_, i) => ({
                  id: `in_${i}`,
                })),
              };
            }
            return null;
          },
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: { id: CAROUSEL_ID, patch: { position: { x: 1, y: 1 } } },
        });
        expect(result.ports?.outputs).toHaveLength(50);
        expect(result.ports?.inputs).toHaveLength(50);
        expect(result.portsTruncated).toBe(true);
      });
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

  // handler.validate 의 domain rule (버튼 수 상한, 필수 필드 누락, 중복 id 등)
  // 을 shadow 에 **비차단 warning** 으로만 노출. 이전 설계 (hard-reject) 는
  // LLM 이 같은 config 를 교정하지 못할 때 무한 retry loop 를 유발해 실사용
  // 세션에서 심각한 피해가 있었음 (2026-04-24 사용자 제보). 현 정책: 저장은
  // 항상 진행, result.configWarnings 필드로만 LLM 에 통지 — 다음 턴에
  // 선택적 교정하거나 실행 시점 execution-engine 이 최종 차단.
  describe('handler.validate warnings (비차단, configWarnings)', () => {
    const maxButtonsValidator = (
      _type: string,
      config: Record<string, unknown>,
    ) => {
      const buttons = config.buttons as unknown[] | undefined;
      if (buttons && buttons.length > 10) {
        return {
          valid: false,
          errors: ['Maximum 10 buttons allowed per node'],
        };
      }
      return { valid: true, errors: [] };
    };

    it('add_node: validator 실패해도 저장은 진행 + configWarnings 동봉', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        {},
        maxButtonsValidator,
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '11버튼 캐러셀',
          position: { x: 0, y: 0 },
          config: {
            buttons: Array.from({ length: 11 }, (_, i) => ({
              id: `btn_${i}`,
              label: `B${i}`,
              type: 'port',
            })),
          },
        },
      });
      expect(result.ok).toBe(true);
      expect(result.configWarnings).toEqual([
        'Maximum 10 buttons allowed per node',
      ]);
      // 저장됨 — manual_trigger + 방금 추가한 carousel.
      expect(sw.snapshot().nodes).toHaveLength(2);
    });

    it('add_node: validator 통과 시 configWarnings 는 실리지 않음', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        {},
        maxButtonsValidator,
      );
      const result = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '정상 캐러셀',
          position: { x: 0, y: 0 },
          config: { buttons: [{ id: 'btn_ok', label: 'OK', type: 'port' }] },
        },
      });
      expect(result.ok).toBe(true);
      expect(result.configWarnings).toBeUndefined();
    });

    it('update_node: validator 실패해도 patch 는 그대로 적용 + configWarnings 동봉', () => {
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        {},
        maxButtonsValidator,
      );
      const add = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '초기',
          position: { x: 10, y: 20 },
          config: { buttons: [{ id: 'btn_a', label: 'A', type: 'port' }] },
        },
      });
      expect(add.ok).toBe(true);

      const invalidButtons = Array.from({ length: 11 }, (_, i) => ({
        id: `btn_${i}`,
        label: `B${i}`,
        type: 'port',
      }));
      const result = sw.apply({
        name: 'update_node',
        arguments: {
          id: add.id!,
          patch: { config: { buttons: invalidButtons } },
        },
      });
      expect(result.ok).toBe(true);
      expect(result.configWarnings).toEqual([
        'Maximum 10 buttons allowed per node',
      ]);
      // patch 는 applied — 버튼이 11 개로 반영됨.
      const after = sw.snapshot().nodes.find((n) => n.id === add.id)!;
      expect((after.config.buttons as unknown[]).length).toBe(11);
    });

    it('update_node: label/position-only patch 는 validator 호출 안 함', () => {
      const calls: Array<Record<string, unknown>> = [];
      const trackingValidator = (
        _type: string,
        config: Record<string, unknown>,
      ) => {
        calls.push(config);
        return { valid: true, errors: [] };
      };
      const sw = new ShadowWorkflow(
        baseSnapshot(),
        new Set(['carousel']),
        {},
        undefined,
        {},
        trackingValidator,
      );
      const add = sw.apply({
        name: 'add_node',
        arguments: {
          type: 'carousel',
          label: '초기',
          position: { x: 0, y: 0 },
          config: { buttons: [] },
        },
      });
      expect(add.ok).toBe(true);
      expect(calls).toHaveLength(1);

      const result = sw.apply({
        name: 'update_node',
        arguments: {
          id: add.id!,
          patch: { label: '새이름', position: { x: 100, y: 200 } },
        },
      });
      expect(result.ok).toBe(true);
      expect(calls).toHaveLength(1);
      expect(result.configWarnings).toBeUndefined();
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

    // ED-AI: LLM 이 `update_node({id: "SendEmail", ...})` 처럼 노드의 label
    // 문자열을 id 자리에 실수로 넣는 실패 패턴. 서버가 "이건 label 이고
    // 실제 id 는 <uuid> 입니다" 를 자동으로 hint 로 돌려줘 다음 라운드에서
    // 곧장 정정되도록 유도한다.
    describe('NODE_NOT_FOUND label-lookalike hint', () => {
      function snapshotWithNamedNode(): ShadowSnapshot {
        return {
          nodes: [
            TRIGGER_NODE,
            {
              id: '11111111-2222-3333-4444-555555555555',
              type: 'send_email',
              category: 'integration',
              label: 'SendEmail',
              positionX: 500,
              positionY: 300,
              config: {},
            },
          ],
          edges: [],
        };
      }

      it('update_node: attaches a hint when the id argument matches an existing node label', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: {
            id: 'SendEmail', // label 을 id 자리에 넣은 실수
            patch: { config: { subject: 'Hello' } },
          },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toBeDefined();
        // review W-8: hint 포맷이 "[hint] ... matches the label ... [/hint]"
        // 고정 마커 패턴을 따르는지 확정해 prompt 와 실제 출력이 드리프트
        // 하지 않도록 한다.
        expect(result.hint).toMatch(/^\[hint\] /);
        expect(result.hint).toMatch(/matches the label of an existing node/);
        expect(result.hint).toMatch(/ \[\/hint\]$/);
        expect(result.hint).toMatch(/SendEmail/);
        expect(result.hint).toMatch(/11111111-2222-3333-4444-555555555555/);
      });

      it('remove_node: attaches the same hint on label-as-id mistakes', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'remove_node',
          arguments: { id: 'SendEmail' },
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toMatch(/11111111-2222-3333-4444-555555555555/);
      });

      it('add_edge: hints on the source side when source_id matches a node label', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'SendEmail', // label 실수
            target_id: TRIGGER_NODE.id,
          },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toMatch(/SendEmail/);
        expect(result.hint).toMatch(/11111111-2222-3333-4444-555555555555/);
      });

      it('no hint when the given value does not match any node label', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: {
            id: '00000000-0000-0000-0000-dead0000dead', // 진짜 unknown UUID
            patch: { config: {} },
          },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toBeUndefined();
      });

      it('add_edge: prefers cascading failed-add_node hint over label-lookalike when both could apply', () => {
        // add_node 실패 → cascading FIFO 가 채워짐. 이후 add_edge 에서 label
        // 실수까지 섞인 상황. cascading hint 가 더 구체적이므로 우선.
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        sw.apply({
          name: 'add_node',
          arguments: {
            type: 'ghost_type',
            label: 'MissingNode',
            position: { x: 0, y: 0 },
            config: {},
          },
        });
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: 'SendEmail', // label 실수
            target_id: '00000000-0000-0000-0000-dead0000dead', // fabricated UUID
          },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        // cascading 힌트 먼저.
        expect(result.hint).toMatch(/prior add_node failed/);
      });

      // review W-1: target 만 label 인 경로(source 는 실제 UUID) 가 fallback
      // 분기에서 정상적으로 감지되는지 별도 고정.
      it('add_edge: hints on the target side when only target_id matches a label', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: TRIGGER_NODE.id,
            target_id: 'SendEmail', // target 쪽 label 실수
          },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toMatch(/SendEmail/);
        expect(result.hint).toMatch(/11111111-2222-3333-4444-555555555555/);
      });

      // review I-15: source / target 둘 다 label 인 케이스 — source 힌트
      // 하나만 내려가 메시지가 모호해지지 않는다.
      it('add_edge: emits only one hint (source) when both ends are labels', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: 'aaaa1111-0000-0000-0000-000000000001',
                type: 'template',
                category: 'presentation',
                label: 'LabelA',
                positionX: 0,
                positionY: 0,
                config: {},
              },
              {
                id: 'bbbb2222-0000-0000-0000-000000000002',
                type: 'template',
                category: 'presentation',
                label: 'LabelB',
                positionX: 0,
                positionY: 0,
                config: {},
              },
            ],
            edges: [],
          },
          new Set(['template']),
        );
        const result = sw.apply({
          name: 'add_edge',
          arguments: { source_id: 'LabelA', target_id: 'LabelB' },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toMatch(/LabelA/);
        // target 라벨은 노출되지 않는다 — 단일 source 힌트.
        expect(result.hint).not.toMatch(/LabelB/);
      });

      // review I-13: 공백 전용 입력은 "empty-ish" 로 간주되어 hint 가 붙지
      // 않아야 한다 (기존 호출부가 '   ' 값을 label 실수로 오인하지 않도록).
      it('does not attach a hint for whitespace-only id values', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: { id: '   ', patch: { config: {} } },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        expect(result.hint).toBeUndefined();
      });

      // review I-14: cascading FIFO 가 비어있을 때 label-lookalike 가 실제로
      // fallback 으로 선택되는 반례를 명시. (이미 앞 케이스들이 이 경로를
      // 거치지만, "우선순위 역방향 증거" 로서 별도 고정.)
      it('falls back to label-lookalike when the cascading FIFO is empty', () => {
        const sw = new ShadowWorkflow(
          snapshotWithNamedNode(),
          new Set(['send_email']),
        );
        // 일부러 add_node 실패를 발생시키지 않음 → cascading FIFO 비어있음.
        const result = sw.apply({
          name: 'add_edge',
          arguments: {
            source_id: TRIGGER_NODE.id,
            target_id: 'SendEmail',
          },
        });
        expect(result.error).toBe('NODE_NOT_FOUND');
        // cascading 힌트 메시지가 아니라 label-lookalike 힌트가 떠야 한다.
        expect(result.hint).not.toMatch(/prior add_node failed/);
        expect(result.hint).toMatch(/matches the label/);
      });

      it('sanitizes label in the hint (newlines / angle brackets are neutralised)', () => {
        const sw = new ShadowWorkflow(
          {
            nodes: [
              TRIGGER_NODE,
              {
                id: '99999999-8888-7777-6666-555555555555',
                type: 'template',
                category: 'presentation',
                label: 'Bad\n## HACK\n<script>alert(1)</script>',
                positionX: 0,
                positionY: 0,
                config: {},
              },
            ],
            edges: [],
          },
          new Set(['template']),
        );
        const result = sw.apply({
          name: 'update_node',
          arguments: {
            id: 'Bad\n## HACK\n<script>alert(1)</script>',
            patch: { config: {} },
          },
        });
        expect(result.hint).toBeDefined();
        expect(result.hint).not.toMatch(/\n/);
        expect(result.hint).not.toMatch(/<script>/);
      });
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
    // Spec 이 호출하는 resolver 는 `ResolvedNodePorts = {outputs: [{id, ...}],
    // inputs: [{id, ...}]}` shape. ED-AI-40 로 `outputs` 를 string[] 에서
    // descriptor 배열로 확장했다. 파일 최상위의 `toDesc` 헬퍼로 id 배열만
    // 적으면 그대로 descriptor 로 감싸진다.
    const makeResolver = (carouselOutputs: string[]) => {
      return (node: { type: string }) => {
        if (node.type === 'manual_trigger') {
          return { outputs: toDesc(['out']), inputs: toDesc([]) };
        }
        if (node.type === 'carousel') {
          return {
            outputs: toDesc(carouselOutputs),
            inputs: toDesc(['in']),
          };
        }
        if (node.type === 'http_request') {
          return {
            outputs: toDesc(['out', 'error']),
            inputs: toDesc(['in']),
          };
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
            return { outputs: toDesc(['iter']), inputs: toDesc(['in']) };
          if (node.type === 'http_request')
            return { outputs: toDesc(['out']), inputs: toDesc(['in']) };
          if (node.type === 'manual_trigger')
            return { outputs: toDesc(['out']), inputs: toDesc([]) };
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
