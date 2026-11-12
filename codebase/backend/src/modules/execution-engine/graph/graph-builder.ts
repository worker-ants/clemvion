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
 *
 * `scopeContainerId` 를 주면 맨 바깥 노드 대신 그 컨테이너의 본문 노드
 * (`containerId === scopeContainerId`)로 그래프를 만든다. 다른 컨테이너의 본문 노드와
 * 도구 영역 노드는 똑같이 뺀다. 컨테이너 본문 안 Background 의 본문을 워커가 실행할 때
 * 쓴다(CLE-T-MR6ZH3).
 */
export function buildGraph(
  nodes: Node[],
  edges: Edge[],
  scopeContainerId: string | null = null,
): GraphBuildResult {
  // Filter out other levels' container children and tool area nodes
  const topLevelNodes = nodes.filter(
    (node) =>
      (node.containerId ?? null) === scopeContainerId &&
      node.toolOwnerId == null,
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
