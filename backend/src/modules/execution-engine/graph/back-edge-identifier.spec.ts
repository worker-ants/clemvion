import { identifyBackEdges } from './back-edge-identifier';
import { GraphNode, GraphEdge } from './graph-builder';

function edge(
  src: string,
  tgt: string,
  srcPort = 'out',
  tgtPort = 'in',
): GraphEdge {
  return {
    sourceNodeId: src,
    sourcePort: srcPort,
    targetNodeId: tgt,
    targetPort: tgtPort,
  };
}

describe('identifyBackEdges', () => {
  it('should find no back-edges in a linear graph', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges: GraphEdge[] = [edge('A', 'B'), edge('B', 'C')];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(0);
    expect(result.forwardEdges).toHaveLength(2);
  });

  it('should identify back-edge in a simple cycle: A -> B -> A', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }];
    const edges: GraphEdge[] = [edge('A', 'B'), edge('B', 'A')];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(1);
    expect(result.backEdges[0]).toEqual(edge('B', 'A'));
    expect(result.forwardEdges).toHaveLength(1);
    expect(result.forwardEdges[0]).toEqual(edge('A', 'B'));
  });

  it('should identify back-edge in a complex cycle: A -> B -> C -> A', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges: GraphEdge[] = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(1);
    expect(result.backEdges[0]).toEqual(edge('C', 'A'));
    expect(result.forwardEdges).toHaveLength(2);
  });

  it('should find no back-edges in a diamond graph', () => {
    const nodes: GraphNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
    ];
    const edges: GraphEdge[] = [
      edge('A', 'B'),
      edge('A', 'C'),
      edge('B', 'D'),
      edge('C', 'D'),
    ];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(0);
    expect(result.forwardEdges).toHaveLength(4);
  });

  it('should handle empty graph', () => {
    const result = identifyBackEdges([], []);

    expect(result.backEdges).toHaveLength(0);
    expect(result.forwardEdges).toHaveLength(0);
  });

  it('should handle single node', () => {
    const nodes: GraphNode[] = [{ id: 'A' }];
    const result = identifyBackEdges(nodes, []);

    expect(result.backEdges).toHaveLength(0);
    expect(result.forwardEdges).toHaveLength(0);
  });

  it('should handle multiple cycles sharing nodes', () => {
    // A -> B -> C -> A (outer cycle)
    //      B -> A      (inner cycle)
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges: GraphEdge[] = [
      edge('A', 'B'),
      edge('B', 'C'),
      edge('C', 'A'),
      edge('B', 'A', 'out2'),
    ];

    const result = identifyBackEdges(nodes, edges);

    // Both C->A and B->A are back-edges
    expect(result.backEdges).toHaveLength(2);
    const backEdgePairs = result.backEdges.map(
      (e) => `${e.sourceNodeId}->${e.targetNodeId}`,
    );
    expect(backEdgePairs).toContain('C->A');
    expect(backEdgePairs).toContain('B->A');
    expect(result.forwardEdges).toHaveLength(2);
  });

  it('should handle switch-like node with mixed forward and back ports', () => {
    // A -> B -> Switch
    // Switch (case1) -> A  (back-edge)
    // Switch (case2) -> D  (forward-edge)
    const nodes: GraphNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'Switch' },
      { id: 'D' },
    ];
    const edges: GraphEdge[] = [
      edge('A', 'B'),
      edge('B', 'Switch'),
      edge('Switch', 'A', 'case1'),
      edge('Switch', 'D', 'case2'),
    ];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(1);
    expect(result.backEdges[0].sourceNodeId).toBe('Switch');
    expect(result.backEdges[0].targetNodeId).toBe('A');
    expect(result.backEdges[0].sourcePort).toBe('case1');
    expect(result.forwardEdges).toHaveLength(3);
  });

  it('should preserve edges not belonging to the node set', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }];
    const edges: GraphEdge[] = [
      edge('A', 'B'),
      edge('B', 'X'), // X not in nodes
    ];

    const result = identifyBackEdges(nodes, edges);

    // B->X is in forward edges (passed through, not a back-edge)
    expect(result.backEdges).toHaveLength(0);
    expect(result.forwardEdges).toHaveLength(2);
  });

  it('should identify self-loop as back-edge', () => {
    const nodes: GraphNode[] = [{ id: 'A' }, { id: 'B' }];
    const edges: GraphEdge[] = [edge('A', 'B'), edge('A', 'A', 'self')];

    const result = identifyBackEdges(nodes, edges);

    expect(result.backEdges).toHaveLength(1);
    expect(result.backEdges[0]).toEqual(edge('A', 'A', 'self'));
    expect(result.forwardEdges).toHaveLength(1);
  });

  it('should ensure forwardEdges + backEdges = all edges', () => {
    const nodes: GraphNode[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
    ];
    const edges: GraphEdge[] = [
      edge('A', 'B'),
      edge('B', 'C'),
      edge('C', 'A'),
      edge('C', 'D'),
      edge('D', 'B'),
    ];

    const result = identifyBackEdges(nodes, edges);

    expect(result.forwardEdges.length + result.backEdges.length).toBe(
      edges.length,
    );
  });
});
