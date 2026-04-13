import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Edge } from "@xyflow/react";
import { useEdgeHighlighting } from "../use-edge-highlighting";
import { useCanvasHoverStore } from "@/lib/stores/canvas-hover-store";
import { useEditorStore } from "@/lib/stores/editor-store";

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "custom",
});

const edges: Edge[] = [
  makeEdge("e1", "a", "b"),
  makeEdge("e2", "b", "c"),
  makeEdge("e3", "c", "d"),
];

describe("useEdgeHighlighting", () => {
  beforeEach(() => {
    useCanvasHoverStore.setState({
      hoveredNodeId: null,
      hoveredEdgeId: null,
    });
    useEditorStore.setState({ selectedNodeId: null });
  });

  it("returns original edges reference when no focus is active", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    expect(result.current.enhancedEdges).toBe(edges);
    expect(result.current.isFocusActive).toBe(false);
    expect(result.current.hoveredEdgeNodes).toBeNull();
  });

  it("highlights connected edges when a node is hovered", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredNodeId: "b" });
    });

    expect(result.current.isFocusActive).toBe(true);
    const highlighted = result.current.enhancedEdges.filter(
      (e) => e.className?.includes("edge-highlighted"),
    );
    expect(highlighted.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
  });

  it("highlights only one edge when an edge is hovered", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredEdgeId: "e2" });
    });

    expect(result.current.isFocusActive).toBe(true);
    const highlighted = result.current.enhancedEdges.filter(
      (e) => e.className?.includes("edge-highlighted"),
    );
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe("e2");
  });

  it("prioritizes hoveredEdge over hoveredNode", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredNodeId: "b", hoveredEdgeId: "e3" });
    });

    const highlighted = result.current.enhancedEdges.filter(
      (e) => e.className?.includes("edge-highlighted"),
    );
    // Only e3 should be highlighted, not e1/e2 from node "b"
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe("e3");
  });

  it("falls back to selectedNodeId when no hover state", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useEditorStore.setState({ selectedNodeId: "c" });
    });

    expect(result.current.isFocusActive).toBe(true);
    const highlighted = result.current.enhancedEdges.filter(
      (e) => e.className?.includes("edge-highlighted"),
    );
    expect(highlighted.map((e) => e.id).sort()).toEqual(["e2", "e3"]);
  });

  it("removes highlight when focus is cleared", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredNodeId: "b" });
    });
    expect(result.current.isFocusActive).toBe(true);

    act(() => {
      useCanvasHoverStore.setState({ hoveredNodeId: null });
    });
    expect(result.current.isFocusActive).toBe(false);
    expect(result.current.enhancedEdges).toBe(edges);
  });

  it("sets isHighlighted in edge data for highlighted edges", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredEdgeId: "e1" });
    });

    const e1 = result.current.enhancedEdges.find((e) => e.id === "e1");
    expect((e1?.data as Record<string, unknown>)?.isHighlighted).toBe(true);
  });

  it("returns hoveredEdgeNodes when edge is hovered", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredEdgeId: "e2" });
    });

    expect(result.current.hoveredEdgeNodes).toEqual({
      sourceId: "b",
      targetId: "c",
    });
  });

  it("returns null hoveredEdgeNodes when hovered edge does not exist", () => {
    const { result } = renderHook(() => useEdgeHighlighting(edges));

    act(() => {
      useCanvasHoverStore.setState({ hoveredEdgeId: "nonexistent" });
    });

    expect(result.current.isFocusActive).toBe(false);
    expect(result.current.hoveredEdgeNodes).toBeNull();
  });
});
