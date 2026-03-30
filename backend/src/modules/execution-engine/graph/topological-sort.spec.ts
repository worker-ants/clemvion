import { topologicalSort } from './topological-sort';
import { GraphNode, GraphEdge } from './graph-builder';

describe('topologicalSort', () => {
  it('should sort a linear chain: A -> B -> C', () => {
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

    const result = topologicalSort(nodes, edges);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('should sort a diamond: A -> B, A -> C, B -> D, C -> D', () => {
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

    const result = topologicalSort(nodes, edges);

    // A must come first, D must come last
    expect(result[0]).toBe('A');
    expect(result[result.length - 1]).toBe('D');
    // B and C must come after A and before D
    expect(result.indexOf('B')).toBeGreaterThan(result.indexOf('A'));
    expect(result.indexOf('C')).toBeGreaterThan(result.indexOf('A'));
    expect(result.indexOf('B')).toBeLessThan(result.indexOf('D'));
    expect(result.indexOf('C')).toBeLessThan(result.indexOf('D'));
  });

  it('should handle a single node', () => {
    const nodes: GraphNode[] = [{ id: 'A' }];
    const edges: GraphEdge[] = [];

    const result = topologicalSort(nodes, edges);
    expect(result).toEqual(['A']);
  });

  it('should handle disconnected components', () => {
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
        sourceNodeId: 'C',
        sourcePort: 'out',
        targetNodeId: 'D',
        targetPort: 'in',
      },
    ];

    const result = topologicalSort(nodes, edges);
    expect(result).toHaveLength(4);
    // A before B
    expect(result.indexOf('A')).toBeLessThan(result.indexOf('B'));
    // C before D
    expect(result.indexOf('C')).toBeLessThan(result.indexOf('D'));
  });

  it('should handle fan-out: A -> B, A -> C, A -> D', () => {
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
        sourceNodeId: 'A',
        sourcePort: 'out',
        targetNodeId: 'D',
        targetPort: 'in',
      },
    ];

    const result = topologicalSort(nodes, edges);
    expect(result[0]).toBe('A');
    expect(result).toHaveLength(4);
    // B, C, D all come after A
    expect(result.indexOf('B')).toBeGreaterThan(0);
    expect(result.indexOf('C')).toBeGreaterThan(0);
    expect(result.indexOf('D')).toBeGreaterThan(0);
  });

  it('should throw on cyclic graph', () => {
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

    expect(() => topologicalSort(nodes, edges)).toThrow('cycle');
  });
});
