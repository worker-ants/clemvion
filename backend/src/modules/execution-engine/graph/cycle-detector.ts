import { GraphNode, GraphEdge } from './graph-builder';

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
}

/**
 * DFS-based cycle detection for a directed graph.
 * Returns whether a cycle exists and the cycle path if found.
 */
export function detectCycle(
  nodes: GraphNode[],
  edges: GraphEdge[],
): CycleDetectionResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }

  const WHITE = 0; // unvisited
  const GRAY = 1; // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const id of nodeIds) {
    color.set(id, WHITE);
    parent.set(id, null);
  }

  for (const startId of nodeIds) {
    if (color.get(startId) !== WHITE) continue;

    const stack: Array<{ nodeId: string; neighborIndex: number }> = [
      { nodeId: startId, neighborIndex: 0 },
    ];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const neighbors = adjacency.get(top.nodeId) ?? [];

      if (top.neighborIndex >= neighbors.length) {
        // All neighbors processed
        color.set(top.nodeId, BLACK);
        stack.pop();
        continue;
      }

      const neighbor = neighbors[top.neighborIndex];
      top.neighborIndex++;

      const neighborColor = color.get(neighbor);

      if (neighborColor === GRAY) {
        // Found a cycle - reconstruct the path
        const cyclePath = [neighbor];
        for (let i = stack.length - 1; i >= 0; i--) {
          cyclePath.push(stack[i].nodeId);
          if (stack[i].nodeId === neighbor) break;
        }
        cyclePath.reverse();
        return { hasCycle: true, cyclePath };
      }

      if (neighborColor === WHITE) {
        color.set(neighbor, GRAY);
        parent.set(neighbor, top.nodeId);
        stack.push({ nodeId: neighbor, neighborIndex: 0 });
      }
    }
  }

  return { hasCycle: false };
}
