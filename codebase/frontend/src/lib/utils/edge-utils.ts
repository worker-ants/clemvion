import { getNodeDefinition } from "@/lib/node-definitions";
import { resolveDynamicPorts } from "@/lib/node-definitions/resolve-dynamic-ports";
import type { Node, Edge } from "@xyflow/react";

/**
 * Port type classification for edge coloring.
 * Matches the handle color scheme in custom-node.tsx:
 *   data → green, system → blue, error → red, container → purple
 */
export type EdgePortType = "data" | "error" | "system" | "container";

export const PORT_TYPE_COLORS: Record<EdgePortType, string> = {
  data: "#22c55e",
  system: "#3b82f6",
  error: "#ef4444",
  container: "#a855f7",
};

/**
 * Resolve the port type for an edge based on the source handle name and source
 * node type. This mirrors the handle color logic in custom-node.tsx so edges
 * match the color of their source port.
 */
export function resolvePortType(
  sourceHandle: string | null | undefined,
  sourceNodeType: string,
): EdgePortType {
  if (!sourceHandle) return "data";

  // Container body output
  if (sourceHandle === "body") return "container";

  // Error port
  if (sourceHandle === "error") return "error";

  // AI Agent system ports
  if (sourceNodeType === "ai_agent") {
    if (sourceHandle === "out" || sourceHandle === "user_ended" || sourceHandle === "max_turns") {
      return "system";
    }
    // Custom condition ports are data
    return "data";
  }

  // Container "done" port is a system flow port
  const def = getNodeDefinition(sourceNodeType);
  if (def?.isContainer && sourceHandle === "done") return "system";

  // Check static definition for error ports
  if (def) {
    const port = def.outputs.find((p) => p.id === sourceHandle);
    if (port?.type === "error") return "error";
  }

  return "data";
}

/**
 * Get the color string for an edge based on its port type.
 */
export function getEdgeColor(portType: EdgePortType): string {
  return PORT_TYPE_COLORS[portType];
}

/**
 * Build edge data with port type information for a new edge.
 */
export function buildEdgeData(
  sourceHandle: string | null | undefined,
  sourceNodeType: string,
): Record<string, unknown> {
  const portType = resolvePortType(sourceHandle, sourceNodeType);
  return {
    sourcePort: sourceHandle ?? "out",
    portType,
    portColor: PORT_TYPE_COLORS[portType],
  };
}

/**
 * Get connected edge IDs for a given node.
 */
export function getConnectedEdgeIds(nodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      ids.add(edge.id);
    }
  }
  return ids;
}

/**
 * Drop edges that reference a handle which no longer exists on the current
 * node — typically happens when a node's dynamic-port config has changed
 * since the workflow was saved (e.g. AI Agent switched single_turn → multi_turn,
 * Info Extractor mode flip, Switch/Classifier case removal). React Flow logs
 * a `Couldn't create edge for source handle id: "..."` warning for each such
 * edge, and the edge is rendered as a disconnected stub.
 *
 * Returns both the kept edges and the ones dropped — callers can surface the
 * drop to the user (e.g. a toast) so the implicit deletion isn't silent.
 *
 * Called at load time, before edges enter the store.
 */
export function dropStaleEdges(
  edges: Edge[],
  nodes: Node[],
): { edges: Edge[]; dropped: Edge[] } {
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // `null` means "definition not available — skip validation". This keeps
  // permissive behaviour distinct from "this node has zero valid ports".
  const outputsByNode = new Map<string, Set<string> | null>();
  const inputsByNode = new Map<string, Set<string> | null>();

  function validOutputs(node: Node): Set<string> | null {
    if (outputsByNode.has(node.id)) return outputsByNode.get(node.id) ?? null;
    const data = node.data as { type?: string; config?: Record<string, unknown> };
    const def = data.type ? getNodeDefinition(data.type) : undefined;
    if (!def) {
      outputsByNode.set(node.id, null);
      return null;
    }
    const ports = resolveDynamicPorts(data.type ?? "", data.config ?? {}, def);
    const set = new Set(ports.map((p) => p.id));
    outputsByNode.set(node.id, set);
    return set;
  }

  function validInputs(node: Node): Set<string> | null {
    if (inputsByNode.has(node.id)) return inputsByNode.get(node.id) ?? null;
    const data = node.data as { type?: string };
    const def = data.type ? getNodeDefinition(data.type) : undefined;
    if (!def) {
      inputsByNode.set(node.id, null);
      return null;
    }
    const set = new Set(def.inputs.map((p) => p.id));
    inputsByNode.set(node.id, set);
    return set;
  }

  const kept: Edge[] = [];
  const dropped: Edge[] = [];
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      dropped.push(edge);
      continue;
    }

    const sourceOutputs = validOutputs(source);
    if (sourceOutputs && edge.sourceHandle && !sourceOutputs.has(edge.sourceHandle)) {
      dropped.push(edge);
      continue;
    }

    const targetInputs = validInputs(target);
    if (targetInputs && edge.targetHandle && !targetInputs.has(edge.targetHandle)) {
      dropped.push(edge);
      continue;
    }

    kept.push(edge);
  }
  return { edges: kept, dropped };
}

/**
 * Enrich edges with port type data from the nodes array.
 * Used during workflow load.
 */
export function enrichEdgesWithPortData(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeTypeMap = new Map<string, string>();
  for (const node of nodes) {
    const type = (node.data as { type?: string })?.type;
    if (type) nodeTypeMap.set(node.id, type);
  }

  return edges.map((edge) => {
    const sourceNodeType = nodeTypeMap.get(edge.source) ?? "";
    const portData = buildEdgeData(edge.sourceHandle, sourceNodeType);
    return { ...edge, data: { ...(edge.data as Record<string, unknown> ?? {}), ...portData } };
  });
}
