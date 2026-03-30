import { detectCycle } from './cycle-detector';
import { GraphNode, GraphEdge } from './graph-builder';

describe('detectCycle', () => {
  it('should detect no cycle in a linear graph', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges: GraphEdge[] = [
      {
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'B',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'B',
        sourcePort: 'out',
        targetNodeId: 'C',
        targetPort: 'in',
      },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(false);
    expect(result.cyclePath).toBeUndefined();
  });

  it('should detect a simple cycle: A -> B -> A', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }];
    const edges: GraphEdge[] = [
      {
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'B',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'B',
        sourcePort: 'out',
        targetNodeId: 'A',
        targetPort: 'in',
      },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect a complex cycle: A -> B -> C -> A', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges: GraphEdge[] = [
      {
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'B',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'B',
        sourcePort: 'out',
        targetNodeId: 'C',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'C',
        sourcePort: 'out',
        targetNodeId: 'A',
        targetPort: 'in',
      },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(3);
  });

  it('should detect no cycle in a diamond graph', () => {
    const nodes: GraphNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
    ];
    const edges: GraphEdge[] = [
      {
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'B',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'C',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'B',
        sourcePort: 'out',
        targetNodeId: 'D',
        targetPort: 'in',
      },
      {
        sourceNodeId: 'C',
        sourcePort: 'out',
        targetNodeId: 'D',
        targetPort: 'in',
      },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(false);
  });

  it('should handle empty graph', () => {
    const result = detectCycle([], []);
    expect(result.hasCycle).toBe(false);
  });

  it('should handle single node', () => {
    const nodes: GraphNode[] = [{ id: 'A' }];
    const result = detectCycle(nodes, []);
    expect(result.hasCycle).toBe(false);
  });
});
