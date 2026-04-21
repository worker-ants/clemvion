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
