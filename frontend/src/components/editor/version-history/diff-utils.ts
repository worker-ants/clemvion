import type {
  VersionSnapshot,
  VersionSnapshotEdge,
  VersionSnapshotNode,
} from "@/lib/api/workflows";

export interface NodeDiff {
  added: VersionSnapshotNode[];
  removed: VersionSnapshotNode[];
  modified: Array<{
    before: VersionSnapshotNode;
    after: VersionSnapshotNode;
    fields: string[];
  }>;
}

export interface EdgeDiff {
  added: VersionSnapshotEdge[];
  removed: VersionSnapshotEdge[];
}

export interface SnapshotDiff {
  nodes: NodeDiff;
  edges: EdgeDiff;
  nameChanged: { before: string; after: string } | null;
}

const NODE_COMPARE_FIELDS: Array<keyof VersionSnapshotNode> = [
  "label",
  "type",
  "category",
  "positionX",
  "positionY",
  "config",
  "isDisabled",
  "description",
  "containerId",
  "toolOwnerId",
];

function edgeKey(edge: VersionSnapshotEdge): string {
  return `${edge.sourceNodeId}::${edge.sourcePort}->${edge.targetNodeId}::${edge.targetPort}`;
}

function fieldEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffSnapshots(
  before: VersionSnapshot,
  after: VersionSnapshot,
): SnapshotDiff {
  const beforeNodeMap = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodeMap = new Map(after.nodes.map((n) => [n.id, n]));

  const addedNodes: VersionSnapshotNode[] = [];
  const removedNodes: VersionSnapshotNode[] = [];
  const modified: NodeDiff["modified"] = [];

  for (const node of after.nodes) {
    const prev = beforeNodeMap.get(node.id);
    if (!prev) {
      addedNodes.push(node);
      continue;
    }
    const changedFields = NODE_COMPARE_FIELDS.filter(
      (f) => !fieldEqual(prev[f], node[f]),
    );
    if (changedFields.length > 0) {
      modified.push({ before: prev, after: node, fields: changedFields });
    }
  }
  for (const node of before.nodes) {
    if (!afterNodeMap.has(node.id)) removedNodes.push(node);
  }

  const beforeEdgeMap = new Map(before.edges.map((e) => [edgeKey(e), e]));
  const afterEdgeMap = new Map(after.edges.map((e) => [edgeKey(e), e]));

  const addedEdges: VersionSnapshotEdge[] = [];
  const removedEdges: VersionSnapshotEdge[] = [];
  for (const [k, e] of afterEdgeMap.entries()) {
    if (!beforeEdgeMap.has(k)) addedEdges.push(e);
  }
  for (const [k, e] of beforeEdgeMap.entries()) {
    if (!afterEdgeMap.has(k)) removedEdges.push(e);
  }

  const nameChanged =
    before.name !== after.name
      ? { before: before.name, after: after.name }
      : null;

  return {
    nodes: { added: addedNodes, removed: removedNodes, modified },
    edges: { added: addedEdges, removed: removedEdges },
    nameChanged,
  };
}
