import { getNodeDefinition } from "@/lib/node-definitions";
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
