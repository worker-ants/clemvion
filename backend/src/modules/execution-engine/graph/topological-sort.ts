import { GraphNode, GraphEdge } from './graph-builder';

/**
 * Kahn's algorithm for topological sort of a DAG.
 * Handles disconnected components by processing all nodes with zero in-degree.
 *
 * @throws Error if the graph contains a cycle
 */
export function topologicalSort(
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    inDegree.set(
      edge.targetNodeId,
      (inDegree.get(edge.targetNodeId) ?? 0) + 1,
    );
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  // Sort for deterministic output
  queue.sort();

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacency.get(current) ?? [];
    const readyNeighbors: string[] = [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        readyNeighbors.push(neighbor);
      }
    }
    // Sort newly ready neighbors for deterministic order
    readyNeighbors.sort();
    for (const n of readyNeighbors) {
      queue.push(n);
    }
  }

  if (sorted.length !== nodeIds.size) {
    throw new Error(
      'Graph contains a cycle: topological sort could not process all nodes',
    );
  }

  return sorted;
}
