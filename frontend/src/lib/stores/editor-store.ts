"use client";

import { create } from "zustand";
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import { toast } from "sonner";
import { workflowsApi } from "@/lib/api/workflows";
import { getNodeDefinition } from "@/lib/node-definitions";

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
  setNodeContainer: (id: string, containerId: string | null) => void;
  selectNode: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  saveWorkflow: () => Promise<boolean>;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

const MAX_UNDO = 50;

/**
 * Read the containerId stored on a node's `data` payload. Returns null when
 * the node isn't part of any container.
 */
function getContainerId(node: Node | undefined | null): string | null {
  if (!node) return null;
  const data = node.data as Record<string, unknown> | undefined;
  const value = data?.containerId;
  return typeof value === "string" ? value : null;
}

function isContainerNode(node: Node | undefined | null): boolean {
  if (!node) return false;
  const type = (node.data as { type?: string } | undefined)?.type;
  if (!type) return false;
  return getNodeDefinition(type)?.isContainer ?? false;
}

/**
 * Apply a container assignment to a single child node. `containerId` is a
 * pure metadata field — no visual containment / parentId is wired up — so
 * the engine treats the node as part of a container body without React Flow
 * having to re-parent it on the canvas.
 */
function applyContainerAssignment(
  nodes: Node[],
  nodeId: string,
  containerId: string | null,
): Node[] {
  const child = nodes.find((n) => n.id === nodeId);
  if (!child) return nodes;
  // Trigger nodes are workflow entry points and can't be re-executed by a
  // container — the backend rejects them with CONTAINER_INVALID_CHILD too.
  const childCategory = (child.data as { category?: string }).category;
  if (containerId && childCategory === "trigger") {
    return nodes;
  }
  if (getContainerId(child) === containerId) return nodes;

  return nodes.map((n) =>
    n.id === nodeId
      ? { ...n, data: { ...n.data, containerId: containerId ?? null } }
      : n,
  );
}

/**
 * Inspect a pending connection for a body/emit conflict before any state
 * change. Returns a human-readable error string when the connection should be
 * blocked (different container claims the same node), or null when the edge
 * is allowed. Lets `onConnect` short-circuit and surface a toast without
 * mutating store state.
 */
function detectContainerConflict(
  nodes: Node[],
  connection: Connection,
): string | null {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return null;

  // Body port: the target must either be unassigned or already a child of
  // this exact container. Anything else means the user is trying to claim a
  // node that another container already owns.
  if (
    isContainerNode(sourceNode) &&
    connection.sourceHandle === "body"
  ) {
    const targetContainer = getContainerId(targetNode);
    if (targetContainer && targetContainer !== sourceNode.id) {
      const otherLabel = labelOf(nodes, targetContainer);
      const targetLabel = labelOf(nodes, targetNode.id);
      return `Cannot connect: "${targetLabel}" is already a body child of "${otherLabel}". Detach it from "${otherLabel}" first.`;
    }
  }

  // Emit port: the source must either be unassigned or already a child of
  // this exact container.
  if (
    isContainerNode(targetNode) &&
    connection.targetHandle === "emit"
  ) {
    const sourceContainer = getContainerId(sourceNode);
    if (sourceContainer && sourceContainer !== targetNode.id) {
      const otherLabel = labelOf(nodes, sourceContainer);
      const sourceLabel = labelOf(nodes, sourceNode.id);
      return `Cannot connect: "${sourceLabel}" is already a body child of "${otherLabel}". Detach it from "${otherLabel}" first.`;
    }
  }

  return null;
}

function labelOf(nodes: Node[], id: string): string {
  const node = nodes.find((n) => n.id === id);
  if (!node) return id;
  return ((node.data as { label?: string }).label as string | undefined) ?? id;
}

/**
 * When the user connects two nodes, infer container membership so multi-step
 * body chains (`Loop.body → A → B → C → Loop.emit`) automatically capture
 * every intermediate node into the container without manual setup.
 *
 * IMPORTANT: callers must run {@link detectContainerConflict} first and bail
 * before invoking this helper when a conflict is detected. The body/emit
 * rules below assume conflicts have already been ruled out — they overwrite
 * existing assignments unconditionally so the explicit body/emit wire wins.
 *
 * Rules:
 * 1. Container's `body` output → target gets the container's id (force).
 * 2. Source → container's `emit` input → source gets the container's id (force).
 * 3. Otherwise, if exactly one side already belongs to a container and the
 *    other is unassigned, propagate that container id to the unassigned side.
 *    Two different containers leave both sides untouched.
 */
function propagateContainerOnConnect(
  nodes: Node[],
  connection: Connection,
): Node[] {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return nodes;

  let nextSourceContainer = getContainerId(sourceNode);
  let nextTargetContainer = getContainerId(targetNode);

  // Rule 1 — body port forces the target into this container. Conflicts must
  // have been intercepted by detectContainerConflict already.
  if (
    isContainerNode(sourceNode) &&
    connection.sourceHandle === "body"
  ) {
    nextTargetContainer = sourceNode.id;
  }

  // Rule 2 — emit port forces the source into this container.
  if (
    isContainerNode(targetNode) &&
    connection.targetHandle === "emit"
  ) {
    nextSourceContainer = targetNode.id;
  }

  // Rule 3 — chain propagation between two regular nodes.
  if (
    !isContainerNode(sourceNode) &&
    !isContainerNode(targetNode) &&
    nextSourceContainer !== nextTargetContainer
  ) {
    if (nextSourceContainer && !nextTargetContainer) {
      nextTargetContainer = nextSourceContainer;
    } else if (!nextSourceContainer && nextTargetContainer) {
      nextSourceContainer = nextTargetContainer;
    }
    // If both sides belong to different containers, leave them alone.
  }

  if (
    nextSourceContainer === getContainerId(sourceNode) &&
    nextTargetContainer === getContainerId(targetNode)
  ) {
    return nodes;
  }

  let result = nodes;
  if (nextSourceContainer !== getContainerId(sourceNode)) {
    result = applyContainerAssignment(result, sourceNode.id, nextSourceContainer);
  }
  if (nextTargetContainer !== getContainerId(targetNode)) {
    result = applyContainerAssignment(result, targetNode.id, nextTargetContainer);
  }
  return result;
}

/**
 * Re-run container propagation across every existing edge until the assignment
 * stabilises. Used when loading a saved workflow so wires drawn before this
 * propagation logic existed (or any other drift) get back-filled — without it
 * users see `CONTAINER_MISSING_EMIT` even though their wiring looks correct.
 *
 * Iterates to a fixed point because chain propagation depends on already-set
 * containerIds: assigning A in pass 1 may unlock B in pass 2.
 */
function backfillContainerAssignments(nodes: Node[], edges: Edge[]): Node[] {
  let current = nodes;
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const e of edges) {
      const next = propagateContainerOnConnect(current, {
        source: e.source,
        sourceHandle: e.sourceHandle ?? null,
        target: e.target,
        targetHandle: e.targetHandle ?? null,
      });
      if (next !== current) {
        current = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return current;
}

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

  setWorkflow: (id, name, nodes, edges) => {
    // Back-fill containerId on existing nodes so workflows that were saved
    // before edge auto-propagation existed (or wires that bypassed
    // onConnect) still have their body chains identified at execution time.
    const backfilled = backfillContainerAssignments(nodes, edges);
    // Mark dirty when the back-fill actually changed assignments so the user
    // can persist the recovered state on the next save.
    const recovered = backfilled !== nodes;
    set({
      workflowId: id,
      workflowName: name,
      nodes: backfilled,
      edges,
      isDirty: recovered,
      undoStack: [],
      redoStack: [],
    });
  },

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

      // Handle remove operations: push undo, clean up edges + orphaned children
      const removedIds = new Set(
        filteredChanges
          .filter((c) => c.type === "remove")
          .map((c) => c.id),
      );

      if (removedIds.size > 0) {
        const snapshot = { nodes: [...state.nodes], edges: [...state.edges] };
        const newStack = [...state.undoStack, snapshot].slice(-MAX_UNDO);
        return {
          nodes: applyNodeChanges(filteredChanges, state.nodes).map((n) => {
            const data = n.data as Record<string, unknown>;
            const cId = data?.containerId;
            if (typeof cId === "string" && removedIds.has(cId)) {
              return { ...n, data: { ...data, containerId: null } };
            }
            return n;
          }),
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
    // Reject the edge upfront if it would force a node into a different
    // container than the one it already belongs to. Otherwise the wire would
    // appear connected in the canvas while the container assignment silently
    // disagreed, and the engine would surface CONTAINER_MISSING_EMIT only at
    // execution time.
    const conflict = detectContainerConflict(get().nodes, connection);
    if (conflict) {
      toast.error(conflict);
      return;
    }
    get().pushUndo();
    set((state) => {
      const nextEdges = addEdge({ ...connection, type: "custom" }, state.edges);
      const nextNodes = propagateContainerOnConnect(state.nodes, connection);
      return {
        edges: nextEdges,
        nodes: nextNodes,
        isDirty: true,
      };
    });
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
      // Drop the node, drop its edges, AND orphan-clean: any other node that
      // pointed to this id as its container loses the reference (so it doesn't
      // dangle as "in (deleted)").
      nodes: state.nodes
        .filter((n) => n.id !== id)
        .map((n) => {
          const data = n.data as Record<string, unknown>;
          if (data?.containerId !== id) return n;
          return { ...n, data: { ...data, containerId: null } };
        }),
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

  setNodeContainer: (id, containerId) => {
    get().pushUndo();
    set((state) => ({
      nodes: applyContainerAssignment(state.nodes, id, containerId),
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
          const d = n.data as {
            type: string;
            category: string;
            label: string;
            config: Record<string, unknown>;
            isDisabled: boolean;
            containerId?: string | null;
          };
          return {
            id: n.id,
            type: d.type,
            category: d.category,
            label: d.label,
            positionX: n.position.x,
            positionY: n.position.y,
            config: d.config || {},
            isDisabled: d.isDisabled || false,
            containerId: d.containerId ?? null,
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
