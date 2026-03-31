"use client";

import { create } from "zustand";
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import { workflowsApi } from "@/lib/api/workflows";

interface EditorState {
  // Workflow metadata
  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;
  isSaving: boolean;

  // Canvas state
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  // Undo/Redo
  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;

  // Actions
  setWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[]) => void;
  setWorkflowName: (name: string) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  selectNode: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  saveWorkflow: () => Promise<boolean>;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

const MAX_UNDO = 50;

export const useEditorStore = create<EditorState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  isDirty: false,
  isSaving: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  undoStack: [],
  redoStack: [],

  setWorkflow: (id, name, nodes, edges) =>
    set({ workflowId: id, workflowName: name, nodes, edges, isDirty: false, undoStack: [], redoStack: [] }),

  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),

  onNodesChange: (changes) => {
    set((state) => {
      // Filter out remove changes for manual_trigger nodes
      const filteredChanges = changes.filter((change) => {
        if (change.type === "remove") {
          const node = state.nodes.find((n) => n.id === change.id);
          if (node?.data?.type === "manual_trigger") return false;
        }
        return true;
      });
      if (filteredChanges.length === 0) return state;

      // Handle remove operations: push undo, clean up edges, clear selection
      const removedIds = new Set(
        filteredChanges
          .filter((c) => c.type === "remove")
          .map((c) => c.id),
      );

      if (removedIds.size > 0) {
        const snapshot = { nodes: [...state.nodes], edges: [...state.edges] };
        const newStack = [...state.undoStack, snapshot].slice(-MAX_UNDO);
        return {
          nodes: applyNodeChanges(filteredChanges, state.nodes),
          edges: state.edges.filter(
            (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
          ),
          undoStack: newStack,
          redoStack: [],
          isDirty: true,
          selectedNodeId:
            state.selectedNodeId && removedIds.has(state.selectedNodeId)
              ? null
              : state.selectedNodeId,
        };
      }

      return {
        nodes: applyNodeChanges(filteredChanges, state.nodes),
        isDirty: true,
      };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    get().pushUndo();
    set((state) => ({
      edges: addEdge({ ...connection, type: "custom" }, state.edges),
      isDirty: true,
    }));
  },

  addNode: (node) => {
    get().pushUndo();
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
  },

  removeNode: (id) => {
    get().pushUndo();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  updateNodeConfig: (id, config) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n,
      ),
      isDirty: true,
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),

  saveWorkflow: async () => {
    const { workflowId, workflowName, nodes, edges, isSaving } = get();
    if (!workflowId || isSaving) return false;

    set({ isSaving: true });
    try {
      const payload = {
        name: workflowName,
        nodes: nodes.map((n) => {
          const d = n.data as { type: string; category: string; label: string; config: Record<string, unknown>; isDisabled: boolean };
          return {
            id: n.id,
            type: d.type,
            category: d.category,
            label: d.label,
            positionX: n.position.x,
            positionY: n.position.y,
            config: d.config || {},
            isDisabled: d.isDisabled || false,
          };
        }),
        edges: edges.map((e) => ({
          sourceNodeId: e.source,
          sourcePort: e.sourceHandle || "out",
          targetNodeId: e.target,
          targetPort: e.targetHandle || "in",
        })),
      };

      await workflowsApi.saveCanvas(workflowId, payload);
      set({ isDirty: false });
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  pushUndo: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot = { nodes: [...nodes], edges: [...edges] };
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO);
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { nodes, edges, undoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set((state) => ({
      nodes: prev.nodes,
      edges: prev.edges,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, { nodes, edges }],
      isDirty: true,
    }));
  },

  redo: () => {
    const { nodes, edges, redoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set((state) => ({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, { nodes, edges }],
      isDirty: true,
    }));
  },
}));
