import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface GraphBuildResult {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

/**
 * Build an adjacency-list-friendly graph from Node[] and Edge[] entities.
 * Filters out:
 *  - Container children (container_id != null)
 *  - Tool area nodes (tool_owner_id != null)
 */
export function buildGraph(nodes: Node[], edges: Edge[]): GraphBuildResult {
  // Filter out container children and tool area nodes
  const topLevelNodes = nodes.filter(
    (node) => node.containerId == null && node.toolOwnerId == null,
  );

  const topLevelNodeIds = new Set(topLevelNodes.map((n) => n.id));

  const graphNodes: GraphNode[] = topLevelNodes.map((n) => ({ id: n.id }));

  // Only include edges where both source and target are top-level nodes
  const graphEdges: GraphEdge[] = edges
    .filter(
      (e) =>
        topLevelNodeIds.has(e.sourceNodeId) &&
        topLevelNodeIds.has(e.targetNodeId),
    )
    .map((e) => ({
      sourceNodeId: e.sourceNodeId,
      sourcePort: e.sourcePort,
      targetNodeId: e.targetNodeId,
      targetPort: e.targetPort,
    }));

  return { graphNodes, graphEdges };
}
