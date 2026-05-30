"use client";

import { create } from "zustand";
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import { toast } from "sonner";
import { workflowsApi } from "@/lib/api/workflows";
import { getNodeDefinition } from "@/lib/node-definitions";
import { buildEdgeData } from "@/lib/utils/edge-utils";
import { useCanvasHoverStore } from "./canvas-hover-store";
import { registerAssistantEditorBridge } from "./assistant-editor-bridge";

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

  // Version history panel
  versionHistoryOpen: boolean;
  // Bumped after every successful canvas save so subscribers (e.g., the
  // version history panel) can refetch.
  saveCount: number;

  // parallel-p2 결정 D + E + I (2026-05-30) — cross-node graphWarningRules
  // 평가 결과. graph 변경 시점에 debounced fetch, 결과로 저장 버튼 disable
  // (hasError) + 노드 배지 표시 (후속). SoT: spec/conventions/cross-node-warning-rules.md.
  graphWarnings: {
    results: Array<{
      ruleId: string;
      severity: "error" | "warning";
      nodeId: string;
      message: string;
    }>;
    hasError: boolean;
    hasWarning: boolean;
  };

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
  /**
   * 단일 top-level config 필드 값을 병합 반영한다. `updateNodeConfig` 는
   * config 전체를 교체하는 반면 본 action 은 기존 config 를 보존하고 지정
   * 필드만 덮어쓴다. Assistant 의 candidate picker 에서 사용자가 선택한
   * integration/LLM/KB/workflow id 를 주입하는 경로 (spec ED-AI-39).
   * 호출 시 Undo 스택에 push 되므로 Ctrl+Z 로 되돌릴 수 있다.
   */
  updateNodeConfigField: (
    id: string,
    fieldPath: string,
    value: unknown,
  ) => void;
  setNodeContainer: (id: string, containerId: string | null) => void;
  selectNode: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setVersionHistoryOpen: (open: boolean) => void;
  saveWorkflow: () => Promise<boolean>;
  /**
   * graph-warnings endpoint 호출 후 결과를 store 에 저장. graph 변경 시점에
   * debounced 호출 권고 (워크플로 에디터의 useEffect 에서). 본 action 의
   * 호출 빈도는 caller 책임.
   */
  fetchGraphWarnings: () => Promise<void>;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  /**
   * Dispatcher invoked by the AI Assistant (`assistant-store`) for each
   * successful edit tool call streamed from the backend. Maps tool name →
   * existing mutator. `add_node`/`remove_node`/`add_edge`/`remove_edge`
   * already push undo via their respective mutators; `update_node` label
   * or position-only patches also push undo explicitly here so the full set
   * of Assistant-initiated edits can be reverted with Ctrl+Z.
   */
  applyAssistantOperation: (
    name: string,
    args: Record<string, unknown>,
    result: unknown,
  ) => void;
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

/** Shallow comparison of containerId across two node lists (matched by id). */
function nodesContainerIdsEqual(a: Node[], b: Node[]): boolean {
  if (a.length !== b.length) return false;
  const aMap = new Map(a.map((n) => [n.id, getContainerId(n)]));
  for (const node of b) {
    if (aMap.get(node.id) !== getContainerId(node)) return false;
  }
  return true;
}

/**
 * Compute every node's `containerId` purely as a function of the current
 * edges:
 *
 *   1. Reset all assignments to `null` (so edges that have since been removed
 *      no longer claim a node).
 *   2. Iterate `propagateContainerOnConnect` over every remaining edge until
 *      no further change happens (fixed point) — chain rules need previously
 *      assigned containerIds to fire, so a single pass isn't enough.
 *
 * This makes deletion automatic: drop the body edge → the node falls back to
 * `null` unless an emit edge or a chain still anchors it to the same
 * container. Used on workflow load, edge removal, and node removal.
 */
function deriveContainerAssignments(nodes: Node[], edges: Edge[]): Node[] {
  // 옛 구현은 매 pass 마다 nodes.find (O(N)) 와 nodes.map (O(N)) 을 반복해서
  // 16 × |edges| × O(N) 비용을 지불했다. 대형 워크플로 (500 node × 500 edge) 에서
  // 4M 회 비교가 발생해 UI 가 렉 걸렸다 (W-23).
  //
  // 개선: containerId 만 Map<nodeId, string | null> 로 분리해 in-place 갱신.
  // 노드 메타데이터(타입·카테고리)는 별도 Map 으로 1회 캐시. fixed-point 도달 후
  // 단일 nodes.map 으로 결과를 emit (immutable 보장).
  if (nodes.length === 0) return nodes;
  const nodeMap = new Map<string, Node>();
  const containerIdById = new Map<string, string | null>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    containerIdById.set(n.id, null);
  }

  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const e of edges) {
      if (
        propagateContainerInMap(nodeMap, containerIdById, {
          source: e.source,
          sourceHandle: e.sourceHandle ?? null,
          target: e.target,
          targetHandle: e.targetHandle ?? null,
        })
      ) {
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 단일 패스로 결과 노드 배열을 emit. containerId 변경이 없는 노드는 원본 그대로.
  let mutated = false;
  const result = nodes.map((n) => {
    const data = n.data as Record<string, unknown> | undefined;
    const oldValue =
      data && typeof data.containerId === 'string' ? data.containerId : null;
    const newValue = containerIdById.get(n.id) ?? null;
    if (oldValue === newValue) return n;
    mutated = true;
    return { ...n, data: { ...(data ?? {}), containerId: newValue } };
  });
  return mutated ? result : nodes;
}

/**
 * `propagateContainerOnConnect` 의 in-place 변형. containerIdById 를 직접
 * 갱신하고 변경 여부만 boolean 으로 반환한다. 기존 함수와 동일한 3개 규칙을
 * 적용한다.
 */
function propagateContainerInMap(
  nodeMap: Map<string, Node>,
  containerIdById: Map<string, string | null>,
  connection: Connection,
): boolean {
  const sourceNode = connection.source
    ? nodeMap.get(connection.source)
    : undefined;
  const targetNode = connection.target
    ? nodeMap.get(connection.target)
    : undefined;
  if (!sourceNode || !targetNode) return false;

  const prevSource = containerIdById.get(sourceNode.id) ?? null;
  const prevTarget = containerIdById.get(targetNode.id) ?? null;
  let nextSource = prevSource;
  let nextTarget = prevTarget;

  // Rule 1 — body port forces the target into this container.
  if (isContainerNode(sourceNode) && connection.sourceHandle === 'body') {
    nextTarget = sourceNode.id;
  }
  // Rule 2 — emit port forces the source into this container.
  if (isContainerNode(targetNode) && connection.targetHandle === 'emit') {
    nextSource = targetNode.id;
  }
  // Rule 3 — chain propagation between two regular nodes.
  if (
    !isContainerNode(sourceNode) &&
    !isContainerNode(targetNode) &&
    nextSource !== nextTarget
  ) {
    if (nextSource && !nextTarget) {
      nextTarget = nextSource;
    } else if (!nextSource && nextTarget) {
      nextSource = nextTarget;
    }
  }

  // Trigger 노드는 container 멤버가 될 수 없다 (applyContainerAssignment 의
  // category=trigger 가드와 동일 invariant).
  const sourceCategory = (sourceNode.data as { category?: string } | undefined)
    ?.category;
  const targetCategory = (targetNode.data as { category?: string } | undefined)
    ?.category;
  if (sourceCategory === 'trigger') nextSource = prevSource;
  if (targetCategory === 'trigger') nextTarget = prevTarget;

  let changed = false;
  if (nextSource !== prevSource) {
    containerIdById.set(sourceNode.id, nextSource);
    changed = true;
  }
  if (nextTarget !== prevTarget) {
    containerIdById.set(targetNode.id, nextTarget);
    changed = true;
  }
  return changed;
}

// SUMMARY#4: fetchGraphWarnings in-flight 요청 경쟁 조건 해소 — 새 요청 시작 전
// 이전 in-flight 요청을 abort 해 stale 응답이 최신 상태를 덮어쓰지 않도록 한다.
let _graphWarningsAbortController: AbortController | null = null;

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
  versionHistoryOpen: false,
  saveCount: 0,
  graphWarnings: { results: [], hasError: false, hasWarning: false },

  setWorkflow: (id, name, nodes, edges) => {
    // Re-derive containerId from the loaded edges so the in-memory state
    // matches the canonical "edges are the source of truth" model. This
    // recovers stale data (containerId persisted but no longer wired) and
    // back-fills wires drawn before auto-propagation existed.
    const derived = deriveContainerAssignments(nodes, edges);
    const recovered = !nodesContainerIdsEqual(nodes, derived);
    useCanvasHoverStore.getState().reset();
    set({
      workflowId: id,
      workflowName: name,
      nodes: derived,
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
        const remainingNodes = applyNodeChanges(filteredChanges, state.nodes);
        const remainingEdges = state.edges.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
        );
        return {
          // Re-derive after node removal — disposing of a container or a body
          // member changes which container claims which node.
          nodes: deriveContainerAssignments(remainingNodes, remainingEdges),
          edges: remainingEdges,
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
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges);
      // Edge removal can leave a node without any wire that justifies its
      // containerId — re-derive so the assignment stays in lock-step with
      // the visible wiring. (Add changes don't need this; onConnect handles
      // them and applies propagation at insert time.)
      const hasRemove = changes.some((c) => c.type === "remove");
      const nextNodes = hasRemove
        ? deriveContainerAssignments(state.nodes, nextEdges)
        : state.nodes;
      return {
        edges: nextEdges,
        nodes: nextNodes,
        isDirty: true,
      };
    });
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
      const sourceNode = state.nodes.find((n) => n.id === connection.source);
      const sourceNodeType = (sourceNode?.data as { type?: string })?.type ?? "";
      const edgeData = buildEdgeData(connection.sourceHandle, sourceNodeType);
      const nextEdges = addEdge(
        { ...connection, type: "custom", data: edgeData },
        state.edges,
      );
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
    set((state) => {
      const remainingNodes = state.nodes.filter((n) => n.id !== id);
      const remainingEdges = state.edges.filter(
        (e) => e.source !== id && e.target !== id,
      );
      return {
        // Re-derive containerIds — removing a node also removes its edges,
        // which may strand other nodes' container assignments.
        nodes: deriveContainerAssignments(remainingNodes, remainingEdges),
        edges: remainingEdges,
        selectedNodeId:
          state.selectedNodeId === id ? null : state.selectedNodeId,
        isDirty: true,
      };
    });
  },

  updateNodeConfig: (id, config) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n,
      ),
      isDirty: true,
    }));
  },

  updateNodeConfigField: (id, fieldPath, value) => {
    // top-level 필드만 취급하는 spec ED-AI-39 의 범위에 맞춰 현재는 dot-path
    // 가 아닌 단일 키로만 동작한다. 향후 nested 가 필요해지면 lodash.set 패턴
    // 으로 확장 가능하나, 현재 4종 widget 의 field 는 모두 top-level.
    // review W-6: prototype pollution 방어 — SSE 스트림에 `__proto__` /
    // `constructor` / `prototype` 이 실려 와도 Object.prototype 을 건드리지
    // 않도록 조기 반환.
    if (
      fieldPath === "__proto__" ||
      fieldPath === "constructor" ||
      fieldPath === "prototype"
    ) {
      return;
    }
    get().pushUndo();
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n;
        const prevData = n.data as { config?: Record<string, unknown> };
        const prevConfig = prevData.config ?? {};
        return {
          ...n,
          data: {
            ...n.data,
            config: { ...prevConfig, [fieldPath]: value },
          },
        };
      }),
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
  setVersionHistoryOpen: (open) => set({ versionHistoryOpen: open }),

  applyAssistantOperation: (name, args, result) => {
    const res = (result ?? {}) as { ok?: boolean; id?: string };
    if (!res.ok) return;
    const s = get();
    if (name === "add_node") {
      const type = String(args.type ?? "");
      if (!type || !res.id) return;
      const def = getNodeDefinition(type);
      const position = (args.position ?? {}) as { x?: number; y?: number };
      const node: Node = {
        id: res.id,
        type: "custom",
        position: { x: Number(position.x ?? 0), y: Number(position.y ?? 0) },
        data: {
          type,
          label: String(args.label ?? type),
          category: def?.category ?? "logic",
          config: (args.config ?? {}) as Record<string, unknown>,
          isDisabled: false,
          containerId: null,
        },
      };
      s.addNode(node);
    } else if (name === "update_node") {
      const id = String(args.id ?? "");
      if (!id) return;
      const patch = (args.patch ?? {}) as {
        label?: string;
        config?: Record<string, unknown>;
        position?: { x?: number; y?: number };
      };
      // Push undo once for the whole patch so Ctrl+Z reverts every field at
      // the same time (matches manual UI edits which save label/position/
      // config together).
      s.pushUndo();
      if (patch.config) {
        // 백엔드 ShadowWorkflow.updateNode 는 `{ ...node.config, ...patch.config }`
        // 로 shallow merge 한다. 프론트가 전체 치환하면 LLM 이 일부 필드만
        // 패치한 경우 나머지 필드가 캔버스에서 소실되고 저장 시 영구 유실된다.
        const patchConfig = patch.config;
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== id) return n;
            const prevConfig =
              (n.data?.config as Record<string, unknown> | undefined) ?? {};
            return {
              ...n,
              data: {
                ...n.data,
                config: { ...prevConfig, ...patchConfig },
              },
            };
          }),
          isDirty: true,
        }));
      }
      if (patch.label || patch.position) {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== id) return n;
            const next = { ...n };
            if (patch.label) {
              next.data = { ...next.data, label: patch.label };
            }
            if (patch.position) {
              next.position = {
                x: Number(patch.position.x ?? n.position.x),
                y: Number(patch.position.y ?? n.position.y),
              };
            }
            return next;
          }),
          isDirty: true,
        }));
      }
    } else if (name === "remove_node") {
      const id = String(args.id ?? "");
      if (id) s.removeNode(id);
    } else if (name === "add_edge") {
      const sourceId = String(args.source_id ?? args.sourceId ?? "");
      const targetId = String(args.target_id ?? args.targetId ?? "");
      if (!sourceId || !targetId) return;
      s.onConnect({
        source: sourceId,
        sourceHandle:
          (args.source_port as string | undefined) ??
          (args.sourcePort as string | undefined) ??
          "out",
        target: targetId,
        targetHandle:
          (args.target_port as string | undefined) ??
          (args.targetPort as string | undefined) ??
          "in",
      });
    } else if (name === "remove_edge") {
      const edgeId = String(args.id ?? "");
      if (!edgeId) return;
      s.pushUndo();
      set((state) => {
        const nextEdges = state.edges.filter((e) => e.id !== edgeId);
        // Re-derive container assignments so removing this wire doesn't leave
        // stale containerId values behind (engine would otherwise reject with
        // CONTAINER_MISSING_EMIT / CONTAINER_INVALID_CHILD). Mirrors the
        // edge-removal handling in onEdgesChange.
        const nextNodes = deriveContainerAssignments(state.nodes, nextEdges);
        return {
          edges: nextEdges,
          nodes: nextNodes,
          isDirty: true,
        };
      });
    }
  },

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
      // Edits made during the in-flight save are persisted with the next save,
      // not this one. Only clear isDirty if the canvas still matches what we
      // actually sent; otherwise the in-flight edits remain unsaved-dirty.
      set((state) => {
        const stillEqual =
          state.nodes.length === nodes.length &&
          state.edges.length === edges.length &&
          JSON.stringify(state.nodes) === JSON.stringify(nodes) &&
          JSON.stringify(state.edges) === JSON.stringify(edges);
        return {
          isDirty: stillEqual ? false : state.isDirty,
          saveCount: state.saveCount + 1,
        };
      });
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  fetchGraphWarnings: async () => {
    const { workflowId } = get();
    if (!workflowId) return;
    // SUMMARY#4: 이전 in-flight 요청 abort — race condition 방어
    _graphWarningsAbortController?.abort();
    _graphWarningsAbortController = new AbortController();
    const { signal } = _graphWarningsAbortController;
    try {
      const response = await workflowsApi.graphWarnings(workflowId, { signal });
      if (signal.aborted) return; // 응답 도착 시 이미 abort 됐으면 상태 갱신 skip
      const body = (response.data ?? response) as {
        results: Array<{
          ruleId: string;
          severity: "error" | "warning";
          nodeId: string;
          message: string;
        }>;
        hasError: boolean;
        hasWarning: boolean;
      };
      set({ graphWarnings: body });
    } catch (error) {
      if (signal.aborted) return; // AbortError — 후속 요청이 있으므로 무시
      // 평가 실패는 경고만 — 저장 차단까지 가지 않음 (backend 단의 reject 가
      // 안전망). 새 그래프 상태에 대한 평가가 실패한 경우 기존 결과 유지.
      console.warn("fetchGraphWarnings failed", error);
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

// Register the editor-side handler for Assistant edit operations so the
// assistant-store can apply `tool_call` events via a shared registry without
// either store importing the other directly.
registerAssistantEditorBridge((name, args, result) => {
  useEditorStore.getState().applyAssistantOperation(name, args, result);
});
