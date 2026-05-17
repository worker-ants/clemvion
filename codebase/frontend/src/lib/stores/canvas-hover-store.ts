import { create } from "zustand";

/**
 * Lightweight store for transient hover state.
 * Separated from the main editor store to avoid triggering re-renders
 * of all editor store subscribers on every mouse move.
 */
interface CanvasHoverState {
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  setHoveredNode: (id: string | null) => void;
  setHoveredEdge: (id: string | null) => void;
  reset: () => void;
}

export const useCanvasHoverStore = create<CanvasHoverState>((set) => ({
  hoveredNodeId: null,
  hoveredEdgeId: null,
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredEdge: (id) => set({ hoveredEdgeId: id }),
  reset: () => set({ hoveredNodeId: null, hoveredEdgeId: null }),
}));
