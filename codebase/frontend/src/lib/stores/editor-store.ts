"use client";

import { create } from "zustand";
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge, reconnectEdge } from "@xyflow/react";
import { toast } from "sonner";
import {
  evaluateGraphWarningRulesForGraph,
  evaluateGraphCycleWarnings,
  GRAPH_WARNING_RULES_BY_TYPE,
} from "@workflow/graph-warning-rules";
import type {
  GraphRuleNode,
  GraphRuleEdge,
} from "@workflow/graph-warning-rules";
import { workflowsApi } from "@/lib/api/workflows";
import { getNodeDefinition } from "@/lib/node-definitions";
import { generateUniqueLabel } from "@/lib/utils/generate-unique-label";
import { PASTE_DUPLICATE_OFFSET } from "@/lib/utils/editor-keyboard";
import {
  buildEdgeData,
  isSelfConnection,
  isDuplicateConnection,
} from "@/lib/utils/edge-utils";
import { useCanvasHoverStore } from "./canvas-hover-store";
import { registerAssistantEditorBridge } from "./assistant-editor-bridge";
import { useRecentNodesStore } from "./recent-nodes-store";

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

  /**
   * §3.3 캔버스 클립보드 — 복사된 노드/엣지 스냅샷 (앱 내부 상태, OS 텍스트
   * 클립보드와 별개). null 이면 붙여넣기 no-op. 기존 `useCopyToClipboard`(OS
   * 텍스트 복사) 와 구분하기 위해 이름에 `editor` 를 붙였다.
   */
  editorClipboard: { nodes: Node[]; edges: Edge[] } | null;
  /**
   * §11.3 컨테이너 삭제 확인 다이얼로그 대상. 자식이 있는 컨테이너 삭제 요청 시
   * set 되고, workflow-canvas 가 구독해 다이얼로그를 렌더한다. null 이면 닫힘.
   */
  pendingContainerDelete: {
    id: string;
    label: string;
    childCount: number;
  } | null;

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
      // i18n Principle 3-C: 동적 메시지 보간 값. frontend 가 ruleId 별 ko 템플릿에
      // {{name}} 보간 (translateGraphWarning). 영문 message 는 SoT/fallback.
      params?: Record<string, string | number>;
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
  // opts.skipUndo — 호출자가 직전에 이미 pushUndo 한 경우(§1.2 자동 연결처럼 "노드
  // 생성+연결"을 하나의 undo 체크포인트로 묶을 때) 내부 pushUndo 를 건너뛴다. 기본 false.
  onConnect: (connection: Connection, opts?: { skipUndo?: boolean }) => void;
  /**
   * §1.3 — 기존 엣지의 끝점(source/target 앵커)을 새 포트로 재연결한다. onConnect 과 동일한
   * 유효성(자기연결/중복/컨테이너 충돌)을 적용하되, 중복 검사에서는 재연결 중인 엣지 자신을
   * 제외한다. `reconnectEdge`(id 보존)로 갱신 후 포트색 data·컨테이너 소속을 재도출한다.
   */
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  /**
   * §1.3 — 엣지를 로컬 상태에서 제거한다(undo 가능, 저장 전까지 서버 미반영). 재연결 드래그를
   * 빈 영역에 드롭(detach)했을 때 호출한다. 즉시 REST DELETE 를 쏘는 `workflowsApi.deleteEdge`
   * 와 혼동을 피하려 `removeNode` 와 대칭인 `removeEdge` 로 명명한다.
   * opts.skipUndo — 호출자가 직전에 이미 pushUndo 한 경우(§4.1 엣지 분할처럼 "노드 추가+엣지
   * 제거+엣지 재연결"을 하나의 undo 체크포인트로 묶을 때) 내부 pushUndo 를 건너뛴다(onConnect 대칭).
   */
  removeEdge: (edgeId: string, opts?: { skipUndo?: boolean }) => void;
  /**
   * §2.2 — 드래그 중 유효성. 자기연결은 false(커서 🚫). 중복/사이클은 onConnect·경고가 담당.
   * React Flow `IsValidConnection<Edge>` 시그니처와 맞추기 위해 `Connection | Edge` 를 받는다
   * (재연결 시 기존 Edge 로도 호출됨).
   */
  isValidConnection: (connection: Connection | Edge) => boolean;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  /** §3.3 선택된 노드(+양끝이 선택에 포함된 내부 엣지)를 editorClipboard 로 복사. 선택 없으면 no-op. */
  copySelection: () => void;
  /**
   * §3.3 editorClipboard 를 붙여넣기 — 신규 id·오프셋 배치·유니크 라벨·containerId
   * 재도출. `anchor` 지정 시 복사 묶음의 좌상단이 anchor 에 오도록, 미지정 시 원본
   * 대비 +40,+40 오프셋. 붙여넣은 노드가 새 선택이 된다. clipboard null 이면 no-op.
   */
  pasteClipboard: (anchor?: { x: number; y: number }) => void;
  /** §3.3 Ctrl+D — 선택된 노드(+내부 엣지)를 클립보드 경유 없이 즉시 복제 (단일 undo). */
  duplicateSelection: () => void;
  /** §3.2 Ctrl+A — 모든 노드 선택. */
  selectAll: () => void;
  /** §3.2 Escape — 모든 노드 선택 해제. */
  deselectAll: () => void;
  /**
   * §11.3 삭제 요청 진입점 (✕ 버튼·우클릭 메뉴). 자식 있는 컨테이너면 확인
   * 다이얼로그를 띄우고, 그 외(일반 노드·빈 컨테이너)는 즉시 removeNode.
   */
  requestNodeDelete: (id: string) => void;
  /** §11.3 자식 있는 컨테이너 여부 (Delete 키 `onBeforeDelete` 확인용). */
  needsContainerDeleteConfirm: (id: string) => boolean;
  /** §11.3 컨테이너 삭제 확인 다이얼로그 열기 (`pendingContainerDelete` set). */
  openContainerDeleteConfirm: (id: string) => void;
  /**
   * §11.3 다이얼로그 확정. `"deleteAll"` = 컨테이너 + 자식(containerId===id) cascade
   * 삭제. `"ungroup"` = 컨테이너 노드만 제거(자식은 top-level 승격 — 기존 removeNode).
   */
  confirmContainerDelete: (mode: "deleteAll" | "ungroup") => void;
  /** §11.3 다이얼로그 취소. */
  cancelContainerDelete: () => void;
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
   * 현재 canvas 의 nodes/edges 를 `@workflow/graph-warning-rules` 로 **로컬
   * 평가**해 결과를 store 에 저장한다 (네트워크 round-trip 없음). graph 변경
   * 시점에 debounced 호출 권고 (워크플로 에디터의 useEffect 에서) — 대형
   * 그래프의 평가 비용을 분산하기 위한 것일 뿐, 호출 자체는 동기.
   *
   * 평가는 backend 의 graph-warnings endpoint / saveCanvas validate 와 동일한
   * SSOT (`@workflow/graph-warning-rules`) 를 공유하므로 결과가 일치한다.
   * backend 의 save-time reject 는 "3중 가드" 의 최종 안전망으로 유지된다.
   */
  evaluateGraphWarningsLocal: () => void;
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
 *
 * COUPLING (§4.1 edge split): `buildEdgeSplitPlan`(edge-utils.ts) 의 "onConnect 2회 항상
 * 성공" 원자성 보장은 여기 거부 분기가 source `body` / target `emit` 두 가지뿐이고 분할이 그
 * 둘을 사전 배제한다는 데 의존한다. 이 함수에 **새 거부 분기를 추가하면** 그 분할 원자성 가정이
 * 조용히 깨질 수 있으니 `buildEdgeSplitPlan` 의 제외 규칙(§4.1 / 2-edge.md R-3)도 함께 검토할 것.
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

/**
 * 에디터 스토어의 ReactFlow 노드 `data` 페이로드 shape. ReactFlow 기본 `Node`
 * 의 `data` 는 `Record<string, unknown>` 이지만, 본 앱은 node 의 정체(type)·
 * 설정(config)·표시 라벨(label)을 이 페이로드에 싣는다. graph-warning-rules
 * 매핑은 이 중 평가 입력(type/config/label)만 읽는다.
 */
type EditorNodeData = {
  type?: string;
  config?: Record<string, unknown>;
  label?: string;
};

/**
 * ReactFlow 의 store node/edge 모델을 `@workflow/graph-warning-rules` 가 받는
 * 순수 graph shape 으로 매핑한다.
 *
 * - 노드: type/config/label 은 ReactFlow `node.data` 페이로드에 들어 있다
 *   (`data.type` / `data.config` / `data.label`). 평가 규칙(예: parallel)은
 *   `node.type === 'parallel'` 과 `config.maxConcurrency` / `config.branchCount`
 *   을 본다.
 * - 엣지: ReactFlow 의 `source/sourceHandle/target/targetHandle` 명명이 그대로
 *   GraphRuleEdge 와 일치한다. parallel 규칙은 `sourceHandle` 이 `branch_N`
 *   인지로 분기 body 를 BFS 한다.
 */
function mapToRuleGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: GraphRuleNode[]; edges: GraphRuleEdge[] } {
  const ruleNodes: GraphRuleNode[] = nodes.map((n) => {
    // 스토어 노드의 `data` 페이로드(`EditorNodeData`)에서 평가 입력만 추출.
    const data = n.data as EditorNodeData;
    return {
      id: n.id,
      type: data?.type ?? "",
      config: data?.config,
      label: data?.label,
    };
  });
  const ruleEdges: GraphRuleEdge[] = edges.map((e) => ({
    source: e.source,
    sourceHandle: e.sourceHandle ?? null,
    target: e.target,
    targetHandle: e.targetHandle ?? null,
  }));
  return { nodes: ruleNodes, edges: ruleEdges };
}

/**
 * §3.3 — 노드/엣지 묶음을 신규 id·위치 오프셋·유니크 라벨로 복제한다 (copy/paste·
 * duplicate 공용 순수 함수). edge 는 remap 된 신규 id 로 source/target 을 다시 잇고,
 * containerId 는 null 로 초기화한 뒤 caller 가 `deriveContainerAssignments` 로 엣지
 * 기반 재도출한다 (§11.2.1 "엣지가 멤버십의 단일 진실"). 복제본은 selected=true 로
 * 표시해 붙여넣기 직후 새 선택이 되게 한다.
 */
function cloneNodesWithOffset(
  sourceNodes: Node[],
  sourceEdges: Edge[],
  existingLabels: string[],
  offset: { x: number; y: number },
): { nodes: Node[]; edges: Edge[] } {
  const idRemap = new Map<string, string>();
  for (const n of sourceNodes) idRemap.set(n.id, crypto.randomUUID());

  // 라벨 풀에 새로 부여한 라벨을 누적해, 같은 라벨 노드를 여럿 복제해도 충돌 없이
  // 각각 유니크한 라벨을 받게 한다.
  const labelPool = new Set(existingLabels);
  const nodes = sourceNodes.map((n) => {
    const data = (n.data as Record<string, unknown>) ?? {};
    const oldLabel = typeof data.label === "string" ? data.label : "";
    const label = generateUniqueLabel(oldLabel, [...labelPool]);
    labelPool.add(label);
    return {
      ...n,
      id: idRemap.get(n.id)!,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
      selected: true,
      data: { ...data, label, containerId: null },
    };
  });

  // 양끝이 모두 복제 대상인 엣지만 재연결한다 (copySelection/duplicate 진입부에서
  // 이미 내부 엣지로 필터링되지만, remap 안전을 위해 방어적으로 확인).
  const edges = sourceEdges
    .filter((e) => idRemap.has(e.source) && idRemap.has(e.target))
    .map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      source: idRemap.get(e.source)!,
      target: idRemap.get(e.target)!,
    }));

  return { nodes, edges };
}

/**
 * §4.1 — 노드 배열의 각 타입을 최근 사용으로 기록한다. `addNode`(단일 choke point)를
 * 우회하는 배치 경로(paste/duplicate)에서 사용한다. set 업데이터 밖에서 호출해 순수성을
 * 지킨다.
 */
function recordRecentNodeTypesFrom(nodes: Node[]): void {
  const recent = useRecentNodesStore.getState();
  for (const n of nodes) {
    const type = (n.data as { type?: string } | undefined)?.type;
    if (type) recent.recordRecentNodeType(type);
  }
}

/**
 * §2.2/§1.3 — 연결(신규 onConnect / 재연결 onReconnect)의 유효성을 단일 규칙으로 판정한다.
 * 반환은 판별 유니온: `{ ok: true }`=유효(진행), `{ ok: false }`=거부(자기연결은 조용히,
 * `message` 있으면 toast 로 표시 — 중복·컨테이너 충돌). 문자열 sentinel 대신 유니온을 써서
 * 호출부의 truthy 단축(`if (rejection)`) 실수로 자기연결이 "유효" 로 새는 것을 컴파일 타임에
 * 막는다. 중복 검사 대상 `edges` 는 호출자가 넘긴다 — 재연결은 자기 자신을 제외한 목록을
 * 전달해 "제자리 재연결" 오탐을 막는다.
 */
function evaluateConnection(
  nodes: Node[],
  edges: Edge[],
  connection: Connection,
): { ok: true } | { ok: false; message?: string } {
  if (isSelfConnection(connection)) return { ok: false };
  if (isDuplicateConnection(edges, connection)) {
    return { ok: false, message: "These nodes are already connected." };
  }
  const conflict = detectContainerConflict(nodes, connection);
  if (conflict) return { ok: false, message: conflict };
  return { ok: true };
}

/** 연결의 sourceHandle·source 노드 타입으로 엣지 포트색 data 를 파생한다(onConnect/onReconnect 공용). */
function buildEdgeDataForConnection(
  nodes: Node[],
  connection: Connection,
): Record<string, unknown> {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const sourceNodeType = (sourceNode?.data as { type?: string })?.type ?? "";
  return buildEdgeData(connection.sourceHandle, sourceNodeType);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  isDirty: false,
  isSaving: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  editorClipboard: null,
  pendingContainerDelete: null,
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

  onConnect: (connection, opts) => {
    // §2.2 — 자기연결/중복/컨테이너 충돌을 단일 규칙(evaluateConnection)으로 차단.
    // 자기연결은 조용히 무시(isValidConnection 이 드래그 중 커서로도 차단), 중복·충돌은 toast.
    // 영문 SoT 문자열을 쓴다(표시 계층 로컬라이즈; i18n Principle 1 하드코딩 한국어 ratchet 회피).
    const result = evaluateConnection(get().nodes, get().edges, connection);
    if (!result.ok) {
      if (result.message) toast.error(result.message);
      return;
    }
    if (!opts?.skipUndo) get().pushUndo();
    set((state) => {
      const edgeData = buildEdgeDataForConnection(state.nodes, connection);
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

  onReconnect: (oldEdge, newConnection) => {
    // §1.3 — 재연결도 onConnect 과 동일 규칙(evaluateConnection). 단 중복 검사는
    // 재연결 중인 엣지 자신을 제외한다 — 같은 자리로 되돌리거나 한쪽 끝만 옮기는 경우가
    // "이미 연결됨" 으로 오판되지 않게 한다.
    const result = evaluateConnection(
      get().nodes,
      get().edges.filter((e) => e.id !== oldEdge.id),
      newConnection,
    );
    if (!result.ok) {
      if (result.message) toast.error(result.message);
      return;
    }
    get().pushUndo();
    set((state) => {
      // shouldReplaceId:false 로 엣지 id 를 보존한다 — 선택 상태·엣지 참조가 깨지지 않게.
      const reconnected = reconnectEdge(oldEdge, newConnection, state.edges, {
        shouldReplaceId: false,
      });
      // reconnectEdge 는 source/target/handle 만 갱신하므로, sourceHandle 이 바뀌면 포트색
      // data 가 stale 하다. 재연결된 엣지(id 보존)의 data 를 다시 build 한다.
      const edgeData = buildEdgeDataForConnection(state.nodes, newConnection);
      const nextEdges = reconnected.map((e) =>
        e.id === oldEdge.id
          ? { ...e, data: { ...((e.data as Record<string, unknown>) ?? {}), ...edgeData } }
          : e,
      );
      // source/target 이 바뀌었으므로 컨테이너 소속을 전면 재도출한다(엣지 삭제 경로와 동일).
      const nextNodes = deriveContainerAssignments(state.nodes, nextEdges);
      return {
        edges: nextEdges,
        nodes: nextNodes,
        isDirty: true,
      };
    });
  },

  removeEdge: (edgeId, opts) => {
    if (!opts?.skipUndo) get().pushUndo();
    set((state) => {
      const nextEdges = state.edges.filter((e) => e.id !== edgeId);
      // 엣지 제거는 노드의 containerId 근거를 없앨 수 있어 재도출한다(onEdgesChange remove 와 동일).
      const nextNodes = deriveContainerAssignments(state.nodes, nextEdges);
      return {
        edges: nextEdges,
        nodes: nextNodes,
        isDirty: true,
      };
    });
  },

  isValidConnection: (connection) => {
    // §2.2 — 자기연결만 하드 차단(드래그 중 커서 🚫). 중복은 onConnect 가 토스트로,
    // 사이클은 graph warning 배지로 처리하므로 여기서 막지 않는다(warn-not-block).
    return !isSelfConnection(connection);
  },

  addNode: (node) => {
    get().pushUndo();
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
    // §4.1 — 노드 추가의 주 choke point (드롭·팔레트 클릭·빠른추가·assistant add_node·
    // 우클릭 복제). 최근 사용 노드 타입을 기록한다. 단, addNode 를 우회하는 배치 경로
    // (Ctrl+V paste·Ctrl+D duplicateSelection)는 각자 recordRecentNodeTypesFrom 로 기록한다.
    const type = (node.data as { type?: string } | undefined)?.type;
    if (type) useRecentNodesStore.getState().recordRecentNodeType(type);
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

  copySelection: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const ids = new Set(selected.map((n) => n.id));
    // 양끝이 모두 선택에 포함된 엣지만 클립보드에 담는다 (§3.3 "선택된 노드+연결된 엣지").
    const internalEdges = edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    );
    // deep-ish clone + selected 플래그 제거 (붙여넣기 시점에 새로 selected 부여).
    const clonedNodes = selected.map((n) => ({
      ...n,
      selected: false,
      data: { ...(n.data as Record<string, unknown>) },
    }));
    const clonedEdges = internalEdges.map((e) => ({ ...e }));
    set({ editorClipboard: { nodes: clonedNodes, edges: clonedEdges } });
  },

  pasteClipboard: (anchor) => {
    const clip = get().editorClipboard;
    if (!clip || clip.nodes.length === 0) return;
    get().pushUndo();
    set((state) => {
      // anchor 지정 시 복사 묶음의 좌상단이 anchor 로 오도록 오프셋 계산, 아니면 기본 오프셋.
      let offset: { x: number; y: number } = PASTE_DUPLICATE_OFFSET;
      if (anchor) {
        const minX = Math.min(...clip.nodes.map((n) => n.position.x));
        const minY = Math.min(...clip.nodes.map((n) => n.position.y));
        offset = { x: anchor.x - minX, y: anchor.y - minY };
      }
      const existingLabels = state.nodes
        .map((n) => (n.data as { label?: string })?.label)
        .filter((l): l is string => typeof l === "string");
      const cloned = cloneNodesWithOffset(
        clip.nodes,
        clip.edges,
        existingLabels,
        offset,
      );
      // 기존 선택을 해제하고 붙여넣은 노드를 새 선택으로 만든다.
      const deselectedExisting = state.nodes.map((n) =>
        n.selected ? { ...n, selected: false } : n,
      );
      const allNodes = [...deselectedExisting, ...cloned.nodes];
      const allEdges = [...state.edges, ...cloned.edges];
      return {
        nodes: deriveContainerAssignments(allNodes, allEdges),
        edges: allEdges,
        isDirty: true,
      };
    });
    // §4.1 — paste 는 addNode(recent choke point)를 우회하므로 붙여넣은 타입을 여기서
    // 기록한다 (set 업데이터는 순수하게 유지). clone 은 원본 타입을 그대로 보유한다.
    recordRecentNodeTypesFrom(clip.nodes);
  },

  duplicateSelection: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    get().pushUndo();
    set((state) => {
      const ids = new Set(selected.map((n) => n.id));
      const internalEdges = edges.filter(
        (e) => ids.has(e.source) && ids.has(e.target),
      );
      const existingLabels = state.nodes
        .map((n) => (n.data as { label?: string })?.label)
        .filter((l): l is string => typeof l === "string");
      const cloned = cloneNodesWithOffset(
        selected,
        internalEdges,
        existingLabels,
        PASTE_DUPLICATE_OFFSET,
      );
      const deselectedExisting = state.nodes.map((n) =>
        n.selected ? { ...n, selected: false } : n,
      );
      const allNodes = [...deselectedExisting, ...cloned.nodes];
      const allEdges = [...state.edges, ...cloned.edges];
      return {
        nodes: deriveContainerAssignments(allNodes, allEdges),
        edges: allEdges,
        isDirty: true,
      };
    });
    // §4.1 — duplicate 도 addNode 를 우회하므로 복제한 타입을 recent 로 기록.
    recordRecentNodeTypesFrom(selected);
  },

  selectAll: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.selected ? n : { ...n, selected: true })),
    }));
  },

  deselectAll: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      selectedNodeId: null,
    }));
  },

  needsContainerDeleteConfirm: (id) => {
    const { nodes } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node || !isContainerNode(node)) return false;
    return nodes.some((n) => getContainerId(n) === id);
  },

  openContainerDeleteConfirm: (id) => {
    const { nodes } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const label = (node.data as { label?: string })?.label ?? id;
    const childCount = nodes.filter((n) => getContainerId(n) === id).length;
    set({ pendingContainerDelete: { id, label, childCount } });
  },

  requestNodeDelete: (id) => {
    if (get().needsContainerDeleteConfirm(id)) {
      get().openContainerDeleteConfirm(id);
      return;
    }
    // 일반 노드 또는 빈 컨테이너 (§11.3.3) — 확인 없이 즉시 삭제.
    get().removeNode(id);
  },

  confirmContainerDelete: (mode) => {
    const pending = get().pendingContainerDelete;
    if (!pending) return;
    const id = pending.id;
    if (mode === "ungroup") {
      // 기존 removeNode 가 곧 Ungroup — 컨테이너만 제거하고 body 엣지 소멸로 자식이
      // top-level 로 승격된다 (§11.3.2 Ungroup).
      get().removeNode(id);
      set({ pendingContainerDelete: null });
      return;
    }
    // deleteAll — 컨테이너 + containerId 가 이를 가리키는 직접 자식 cascade 삭제
    // (§11.3.2). 중첩 손자(자식 컨테이너의 자식)는 자식 컨테이너 제거로 stranded
    // 되며 deriveContainerAssignments 가 top-level 로 승격시킨다(비파괴적).
    get().pushUndo();
    set((state) => {
      const toRemove = new Set<string>([id]);
      for (const n of state.nodes) {
        if (getContainerId(n) === id) toRemove.add(n.id);
      }
      const remainingNodes = state.nodes.filter((n) => !toRemove.has(n.id));
      const remainingEdges = state.edges.filter(
        (e) => !toRemove.has(e.source) && !toRemove.has(e.target),
      );
      return {
        nodes: deriveContainerAssignments(remainingNodes, remainingEdges),
        edges: remainingEdges,
        selectedNodeId:
          state.selectedNodeId && toRemove.has(state.selectedNodeId)
            ? null
            : state.selectedNodeId,
        isDirty: true,
        pendingContainerDelete: null,
      };
    });
  },

  cancelContainerDelete: () => set({ pendingContainerDelete: null }),

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

    // Optimistically clear isDirty at save START (the payload below is a snapshot
    // of the current canvas). Any edit made DURING the in-flight save re-sets
    // isDirty:true through its own mutator, so those edits stay correctly
    // unsaved-dirty — no lost change, O(1), no full-state serialization compare.
    set({ isSaving: true, isDirty: false });
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
      // Do NOT touch isDirty here: it was cleared at save start, and any edit
      // made during the in-flight save already re-set it via that edit's mutator.
      set((state) => ({ saveCount: state.saveCount + 1 }));
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      // Snapshot was not persisted — restore the dirty flag so the user keeps
      // the unsaved-changes signal (harmless if an in-flight edit already set it).
      set({ isDirty: true });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  // 순수 로컬 평가 — `workflowId` 나 네트워크 호출이 필요 없다 (그래프 snapshot 만
  // 입력). 따라서 과거 async fetch 시절의 `_graphWarningsAbortController` 도 제거됨;
  // 평가가 다시 async(서버 round-trip)로 돌아가면 race 방지를 위해 AbortController
  // 패턴을 복원해야 한다.
  evaluateGraphWarningsLocal: () => {
    const { nodes, edges } = get();
    try {
      const graph = mapToRuleGraph(nodes, edges);
      const results = [
        ...evaluateGraphWarningRulesForGraph(
          graph,
          (type) => GRAPH_WARNING_RULES_BY_TYPE[type],
        ),
        // §2.2/§2.3 warn-not-block — 분기 노드 없는 순환(탈출 불가 무한루프) 경고.
        // per-type 규칙과 달리 그래프 전체 1회 평가라 별도 함수.
        ...evaluateGraphCycleWarnings(graph),
      ];
      const hasError = results.some((r) => r.severity === "error");
      const hasWarning = results.some((r) => r.severity === "warning");
      // GraphWarningRuleResult 는 store 의 graphWarnings.results shape 과 동일.
      set({ graphWarnings: { results: [...results], hasError, hasWarning } });
    } catch (error) {
      // 평가 실패는 경고만 — 저장 차단까지 가지 않음 (backend 단의 reject 가
      // 안전망). 새 그래프 상태에 대한 평가가 실패한 경우 기존 결과 유지.
      console.warn("evaluateGraphWarningsLocal failed", error);
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
