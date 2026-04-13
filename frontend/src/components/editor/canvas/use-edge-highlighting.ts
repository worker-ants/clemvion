import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useCanvasHoverStore } from "@/lib/stores/canvas-hover-store";

interface EdgeHighlightResult {
  /** Edges with className set for highlighted ones. Same reference as input when no focus is active. */
  enhancedEdges: Edge[];
  /** Whether any edge focus is currently active (triggers CSS dimming). */
  isFocusActive: boolean;
  /** Source and target node IDs when hovering an edge (for node glow effect). */
  hoveredEdgeNodes: { sourceId: string; targetId: string } | null;
}

/**
 * Hook that computes edge highlighting state.
 *
 * Priority: hoveredEdge > hoveredNode > selectedNode
 *
 * Performance:
 * - When no focus: returns original edges reference (zero React Flow diff)
 * - When focus active: only highlighted edges get new objects (className change)
 * - Dimming of non-highlighted edges is pure CSS (no re-renders)
 */
export function useEdgeHighlighting(edges: Edge[]): EdgeHighlightResult {
  const hoveredNodeId = useCanvasHoverStore((s) => s.hoveredNodeId);
  const hoveredEdgeId = useCanvasHoverStore((s) => s.hoveredEdgeId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  // Pre-compute a nodeId→edgeIds index for O(1) lookup
  const edgeIndex = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!index.has(edge.source)) index.set(edge.source, new Set());
      if (!index.has(edge.target)) index.set(edge.target, new Set());
      index.get(edge.source)!.add(edge.id);
      index.get(edge.target)!.add(edge.id);
    }
    return index;
  }, [edges]);

  const highlightedEdgeIds = useMemo(() => {
    if (hoveredEdgeId) {
      // Verify the edge actually exists
      const exists = edges.some((e) => e.id === hoveredEdgeId);
      if (!exists) return null;
      return new Set([hoveredEdgeId]);
    }
    const focusNodeId = hoveredNodeId ?? selectedNodeId;
    if (focusNodeId) return edgeIndex.get(focusNodeId) ?? null;
    return null;
  }, [hoveredEdgeId, hoveredNodeId, selectedNodeId, edges, edgeIndex]);

  const isFocusActive = highlightedEdgeIds !== null && highlightedEdgeIds.size > 0;

  const enhancedEdges = useMemo(() => {
    if (!isFocusActive || !highlightedEdgeIds) return edges;

    return edges.map((edge) => {
      const wasHighlighted = (edge.data as Record<string, unknown> | undefined)?.isHighlighted === true;
      if (highlightedEdgeIds.has(edge.id)) {
        if (wasHighlighted && edge.className?.includes("edge-highlighted")) return edge;
        const classes = new Set((edge.className ?? "").split(/\s+/).filter(Boolean));
        classes.add("edge-highlighted");
        return {
          ...edge,
          className: [...classes].join(" "),
          data: { ...(edge.data as Record<string, unknown> ?? {}), isHighlighted: true },
        };
      }
      if (wasHighlighted) {
        const classes = new Set((edge.className ?? "").split(/\s+/).filter(Boolean));
        classes.delete("edge-highlighted");
        return {
          ...edge,
          className: classes.size > 0 ? [...classes].join(" ") : undefined,
          data: { ...(edge.data as Record<string, unknown> ?? {}), isHighlighted: false },
        };
      }
      return edge;
    });
  }, [edges, highlightedEdgeIds, isFocusActive]);

  const hoveredEdgeNodes = useMemo(() => {
    if (!hoveredEdgeId) return null;
    const edge = edges.find((e) => e.id === hoveredEdgeId);
    if (!edge) return null;
    return { sourceId: edge.source, targetId: edge.target };
  }, [hoveredEdgeId, edges]);

  return { enhancedEdges, isFocusActive, hoveredEdgeNodes };
}
