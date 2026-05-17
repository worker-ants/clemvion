import { GraphNode, GraphEdge } from './graph-builder';

export interface BackEdgeResult {
  forwardEdges: GraphEdge[];
  backEdges: GraphEdge[];
}

/**
 * DFS-based back-edge identification for a directed graph.
 * Classifies every edge as either a forward-edge or a back-edge.
 * Back-edges are edges that point from a descendant to an ancestor
 * in the DFS tree (i.e., they create cycles).
 *
 * Removing back-edges from the graph yields a DAG suitable for
 * topological sorting, while the back-edges themselves indicate
 * where the execution should loop back at runtime.
 */
export function identifyBackEdges(
  nodes: GraphNode[],
  edges: GraphEdge[],
): BackEdgeResult {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build adjacency list keyed by sourceNodeId,
  // storing the original edge objects for classification.
  const adjacency = new Map<string, GraphEdge[]>();
  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)!.push(edge);
  }

  const WHITE = 0; // unvisited
  const GRAY = 1; // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  for (const id of nodeIds) {
    color.set(id, WHITE);
  }

  const backEdgeSet = new Set<GraphEdge>();

  for (const startId of nodeIds) {
    if (color.get(startId) !== WHITE) continue;

    const stack: Array<{ nodeId: string; edgeIndex: number }> = [
      { nodeId: startId, edgeIndex: 0 },
    ];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const outEdges = adjacency.get(top.nodeId) ?? [];

      if (top.edgeIndex >= outEdges.length) {
        color.set(top.nodeId, BLACK);
        stack.pop();
        continue;
      }

      const edge = outEdges[top.edgeIndex];
      top.edgeIndex++;

      const targetColor = color.get(edge.targetNodeId);

      if (targetColor === GRAY) {
        // Target is an ancestor in the current DFS path → back-edge
        backEdgeSet.add(edge);
      } else if (targetColor === WHITE) {
        color.set(edge.targetNodeId, GRAY);
        stack.push({ nodeId: edge.targetNodeId, edgeIndex: 0 });
      }
      // BLACK targets are cross/forward edges in DFS terminology → not back-edges
    }
  }

  const forwardEdges: GraphEdge[] = [];
  const backEdges: GraphEdge[] = [];

  for (const edge of edges) {
    if (backEdgeSet.has(edge)) {
      backEdges.push(edge);
    } else {
      forwardEdges.push(edge);
    }
  }

  return { forwardEdges, backEdges };
}
