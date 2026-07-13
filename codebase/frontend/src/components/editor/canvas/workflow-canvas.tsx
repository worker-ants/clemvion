"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import type {
  ReactFlowInstance,
  Node as RFNode,
  Edge as RFEdge,
  OnBeforeDelete,
  OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useQuery } from "@tanstack/react-query";

import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition, useNodeDefinitionsStore } from "@/lib/node-definitions";
import { generateUniqueLabel } from "@/lib/utils/generate-unique-label";
import { buildNodeInitialConfig } from "@/lib/utils/build-node-initial-config";
import {
  connectionDragSource,
  pointerClientPosition,
  buildAutoConnectConnection,
} from "@/lib/utils/edge-utils";
import {
  modelConfigsApi,
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
} from "@/lib/api/model-configs";
import {
  Maximize,
  Trash2,
  Settings,
  Copy,
  ClipboardPaste,
  EyeOff,
  Eye,
  Plus,
  Crosshair,
  Search,
  Play,
} from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useCanvasHoverStore } from "@/lib/stores/canvas-hover-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { workflowsApi } from "@/lib/api/workflows";
import { CustomNode } from "./custom-node";
import { HasDefaultLlmConfigProvider } from "./has-default-llm-config-context";
import {
  IntegrationListProvider,
  deriveIntegrationIds,
  INTEGRATIONS_LIST_QUERY_KEY,
} from "./integration-list-context";
import { integrationsApi } from "@/lib/api/integrations";
import { CustomEdge, EdgeMarkerDefs } from "./custom-edge";
import { useEdgeHighlighting } from "./use-edge-highlighting";
import { useEdgeReconnect } from "./use-edge-reconnect";
import { useEdgeExecutionState } from "./use-edge-execution-state";
import { CanvasEmptyState } from "./canvas-empty-state";
import { ZoomControls, MIN_ZOOM, MAX_ZOOM, FIT_VIEW_OPTIONS } from "./zoom-controls";
import { CanvasMinimap } from "./canvas-minimap";
import { ContainerDeleteDialog } from "./container-delete-dialog";
import { isWorkflowEmpty, isNodeDeletable } from "@/lib/node-definitions/is-trigger";
import { isEditableTarget } from "@/lib/utils/is-editable-target";
import { resolveZoomShortcut } from "@/lib/utils/editor-keyboard";
import { registerPaletteCanvasBridge } from "@/lib/stores/palette-canvas-bridge";
import { nextHighlightedIndex, clampHighlightedIndex } from "./quick-add-nav";
import { cn } from "@/lib/utils/cn";
import { useT, useLocale } from "@/lib/i18n";
import {
  translateNodeCategory,
  translateNodeLabel,
} from "@/lib/i18n/backend-labels";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

// §4.2 팔레트 클릭 노드 배치 지터 — 반복 클릭 시 노드가 정확히 겹치지 않도록 뷰포트
// 중앙에서 소량 어긋나게 둔다. JITTER_CYCLE 회마다 0 으로 되돌아간다(계단식 오프셋).
const PALETTE_ADD_JITTER_CYCLE = 5;
const PALETTE_ADD_JITTER_STEP_PX = 24;

function getExistingLabels(nodes: RFNode[]): string[] {
  return nodes.map(
    (n) => (n.data as Record<string, unknown>).label as string,
  );
}

interface NodeContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

interface CanvasContextMenuState {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
}

interface NodeSearchPopupState {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
  // §1.2 — 출력 포트 드래그를 빈 영역에 드롭해 팝업이 열렸을 때의 연결원(드래그 시작 포트).
  // 선택한 노드를 이 포트의 첫 입력 포트로 자동 연결한다. 더블클릭/우클릭 메뉴로 열린
  // 경우엔 undefined. (Connection.source 문자열과 구분하려고 dragSource 로 명명.)
  dragSource?: { nodeId: string; handleId: string | null };
}

export function WorkflowCanvas() {
  const t = useT();
  const locale = useLocale();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [nodeContextMenu, setNodeContextMenu] =
    useState<NodeContextMenuState | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] =
    useState<CanvasContextMenuState | null>(null);
  const [nodeSearchPopup, setNodeSearchPopup] =
    useState<NodeSearchPopupState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // §4.3 빠른 노드 추가 팝업의 키보드 하이라이트 인덱스 (ArrowUp/Down 이동, Enter 선택).
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const lastClickTime = useRef(0);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  // 셀렉터명은 인접 `onConnect` 와 다르게 지었다 — store `onReconnect` 를 그대로 쓰면
  // 아래 canvas 콜백 `handleReconnect` 와 헷갈리므로 store 액션임을 이름으로 구분한다.
  const reconnectEdgeInStore = useEditorStore((s) => s.onReconnect);
  const removeEdge = useEditorStore((s) => s.removeEdge);
  const isValidConnection = useEditorStore((s) => s.isValidConnection);
  const addNode = useEditorStore((s) => s.addNode);
  const requestNodeDelete = useEditorStore((s) => s.requestNodeDelete);
  const pasteClipboard = useEditorStore((s) => s.pasteClipboard);
  const editorClipboard = useEditorStore((s) => s.editorClipboard);
  const pendingContainerDelete = useEditorStore((s) => s.pendingContainerDelete);
  const confirmContainerDelete = useEditorStore(
    (s) => s.confirmContainerDelete,
  );
  const cancelContainerDelete = useEditorStore((s) => s.cancelContainerDelete);
  const selectNode = useEditorStore((s) => s.selectNode);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);
  const workflowId = useEditorStore((s) => s.workflowId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveWorkflow = useEditorStore((s) => s.saveWorkflow);
  const startExecution = useExecutionStore((s) => s.startExecution);
  const setHoveredNode = useCanvasHoverStore((s) => s.setHoveredNode);
  const setHoveredEdge = useCanvasHoverStore((s) => s.setHoveredEdge);

  // §3.2 실행 상태 스타일(비활성 점선 / 데이터 흐름 애니메이션 / 완료 flash)을 먼저 입힌 뒤,
  // 그 위에 §3.3 hover/선택 하이라이팅을 얹는다. 실행 상태는 `edge.className`(flowing/completed)
  // 과 `edge.data.edgeInactive` 로, 하이라이팅은 className Set 병합(edge-highlighted)으로 합성된다.
  const executionEdges = useEdgeExecutionState(edges, nodes);
  const { enhancedEdges, isFocusActive, hoveredEdgeNodes } =
    useEdgeHighlighting(executionEdges);

  // AI 노드(`ai_agent` / `text_classifier` / `information_extractor`) 가 추가될
  // 때, 워크스페이스의 isDefault=true LLM Config 가 있으면 그 ID 를 노드의
  // llmConfigId 에 미리 채운다 — 이렇게 해야 셀렉터가 "기본 제공자(공백)" 가
  // 아니라 실제 LLM 이름으로 표시되어 사용자 인지와 실행 결과가 일치한다.
  // 다른 컴포넌트(custom-node, llm-config-selector)도 MODEL_CONFIGS_CHAT_LIST_QUERY_KEY 로
  // 같은 쿼리 캐시를 공유한다.
  const { data: llmConfigs = [] } = useQuery({
    queryKey: MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("chat"),
    staleTime: 30_000,
  });
  const defaultLlmConfigId = useMemo<string | null>(
    () => llmConfigs.find((c) => c.isDefault)?.id ?? null,
    [llmConfigs],
  );
  // Provided to every CustomNode via context so AI nodes can render their
  // config summary without each subscribing to the llm-configs query.
  const hasDefaultLlmConfig = defaultLlmConfigId !== null;

  // §5 ⚠ Missing integration 배지용 — 워크스페이스 integration 목록을 canvas 에서
  // 한 번만 조회해 Context 로 내려준다. per-node useQuery 구독(N개 노드 = N개
  // 구독)을 피하는 llmConfig 패턴과 동일. custom-node 렌더러가 자기
  // config.integrationId 실재를 이 집합과 대조한다.
  const { data: integrationListData, isLoading: integrationListLoading } =
    useQuery({
      queryKey: INTEGRATIONS_LIST_QUERY_KEY,
      queryFn: () => integrationsApi.list({ limit: 100 }),
      staleTime: 5 * 60 * 1000,
    });
  const integrationIds = useMemo(
    () => deriveIntegrationIds(integrationListData, integrationListLoading),
    [integrationListData, integrationListLoading],
  );
  const integrationListValue = useMemo(
    () => ({ integrationIds }),
    [integrationIds],
  );

  const buildInitialConfig = useCallback(
    (nodeType: string, defaultConfig: Record<string, unknown> | undefined) =>
      buildNodeInitialConfig(nodeType, defaultConfig, defaultLlmConfigId),
    [defaultLlmConfigId],
  );

  // Apply glow className to source/target nodes when an edge is hovered
  const glowNodes = useMemo(() => {
    if (!hoveredEdgeNodes) return nodes;
    const glowIds = new Set([hoveredEdgeNodes.sourceId, hoveredEdgeNodes.targetId]);
    return nodes.map((node) => {
      if (glowIds.has(node.id)) {
        const existing = node.className ?? "";
        if (existing.includes("node-edge-glow")) return node;
        return { ...node, className: `${existing} node-edge-glow`.trim() };
      }
      if (node.className?.includes("node-edge-glow")) {
        const cleaned = node.className.replace("node-edge-glow", "").trim();
        return { ...node, className: cleaned || undefined };
      }
      return node;
    });
  }, [nodes, hoveredEdgeNodes]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      setHoveredNode(node.id);
    },
    [setHoveredNode],
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const onEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: RFEdge) => {
      setHoveredEdge(edge.id);
    },
    [setHoveredEdge],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, [setHoveredEdge]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      if (selectedNodes.length === 1) {
        selectNode(selectedNodes[0].id);
      } else if (selectedNodes.length === 0) {
        selectNode(null);
      }
    },
    [selectNode],
  );

  const canDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return isNodeDeletable((node?.data as { type?: string })?.type);
    },
    [nodes],
  );

  const onNodesDelete = useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  // Node right-click
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      event.preventDefault();
      setCanvasContextMenu(null);
      setNodeSearchPopup(null);
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
      selectNode(node.id);
    },
    [selectNode],
  );

  // Canvas right-click
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setNodeContextMenu(null);
      setNodeSearchPopup(null);
      const flowPos = reactFlowInstance.current?.screenToFlowPosition({
        x: (event as React.MouseEvent).clientX,
        y: (event as React.MouseEvent).clientY,
      }) ?? { x: 0, y: 0 };
      setCanvasContextMenu({
        x: (event as React.MouseEvent).clientX,
        y: (event as React.MouseEvent).clientY,
        flowPosition: flowPos,
      });
    },
    [],
  );

  // 노드 추가 검색 팝업을 여는 공용 로직 — 열린 컨텍스트 메뉴를 닫고 지정 화면 좌표에
  // 팝업을 띄운다. 더블클릭(§4.3)·우클릭 메뉴(add-node)·출력 포트 드래그 드롭(§1.2)이
  // 공유한다. dragSource 가 주어지면 팝업에서 노드 선택 시 그 연결원으로 자동 연결한다.
  const openNodeSearchPopupAt = useCallback(
    (
      clientX: number,
      clientY: number,
      flowPosition: { x: number; y: number },
      dragSource?: { nodeId: string; handleId: string | null },
    ) => {
      setNodeContextMenu(null);
      setCanvasContextMenu(null);
      setNodeSearchPopup({ x: clientX, y: clientY, flowPosition, dragSource });
      setSearchQuery("");
    },
    [],
  );

  // Double-click on empty canvas
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        // Double click
        const flowPos = reactFlowInstance.current?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }) ?? { x: 0, y: 0 };
        openNodeSearchPopupAt(event.clientX, event.clientY, flowPos);
      }
      lastClickTime.current = now;
    },
    [openNodeSearchPopupAt],
  );

  // §1.2 — 출력 포트에서 드래그를 시작해 유효한 target 없이 빈 영역(pane)에 드롭하면, 그
  // 드롭 위치에 노드 추가 검색 팝업을 열고 선택한 노드를 연결원의 첫 입력 포트로 자동
  // 연결한다(`NodeSearchPopupState.dragSource` 에 연결원 기록 → handleAddNodeFromSearch 가
  // 소비). React Flow v12 는 connectionState.fromNode/fromHandle 로 연결원을, isValid 로 드롭
  // 유효성을 제공한다. 입력 포트(target 타입) 시작 역방향 드래그는 §1.3 소관이라 여기선 제외.
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      // 빈 영역 드롭 + 출력 포트 시작이 아니면(유효 연결·입력 포트 역방향 §1.3) 무시.
      const dragSource = connectionDragSource(connectionState);
      if (!dragSource) return;
      const pos = pointerClientPosition(event);
      if (!pos) return;
      const flowPos = reactFlowInstance.current?.screenToFlowPosition({
        x: pos.clientX,
        y: pos.clientY,
      }) ?? { x: 0, y: 0 };
      openNodeSearchPopupAt(pos.clientX, pos.clientY, flowPos, dragSource);
    },
    [openNodeSearchPopupAt],
  );

  // §1.3 — 엣지 끝점 재연결 + detach(빈 영역 드롭 시 삭제) 콜백. 판정 로직은 useEdgeReconnect
  // 훅으로 분리해 renderHook 단위 테스트한다. React Flow 가 reconnectable 엣지의 앵커를 자동
  // 렌더하므로 custom-edge 는 손대지 않고 onReconnect/onReconnectEnd 두 콜백만 배선한다.
  const { onReconnect: handleReconnect, onReconnectEnd } = useEdgeReconnect(
    reconnectEdgeInStore,
    removeEdge,
  );

  // 단일 노드 실행 (§1.3) — 대상 노드 1개만 실행. dirty 캔버스를 먼저 저장해 엔진이
  // 최신 노드 설정을 실행하게 하고, 직전 실행(executionId)을 previousExecutionId 로
  // 전달해 상류 노드 출력을 입력으로 자동 주입한다. 결과는 일반 실행과 동일하게
  // Run Results 드로어로 surface 된다.
  const handleRunThisNode = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return;
      // `getState()` 로 실행 상태/직전 실행 id 를 클릭 시점에 1회 읽는다(stale
      // closure 아님 — 항상 live 스냅샷). 자주 바뀌는 execution status 를 캔버스가
      // 구독하지 않게 해 불필요한 re-render 를 피하려는 의도다.
      const execState = useExecutionStore.getState();
      if (execState.status === "running") return;
      if (isDirty) {
        const saved = await saveWorkflow();
        if (!saved) return;
        // 저장 await 동안 다른 경로로 실행이 시작됐을 수 있어 status 를 재확인한다(TOCTOU).
        if (useExecutionStore.getState().status === "running") return;
      }
      try {
        const response = await workflowsApi.executeNode(workflowId, nodeId, {
          previousExecutionId: execState.executionId ?? undefined,
        });
        const { executionId } = (
          response.data as { data: { executionId: string } }
        ).data;
        startExecution(executionId);
      } catch (error) {
        // v1 — 실패는 콘솔 로깅만(기존 handleRun 패턴과 동일). 사용자 가시 토스트
        // 피드백은 후속(run 진입점 전반의 에러 UX 통일 시) 과제.
        console.error("Single-node execution failed:", error);
      }
    },
    [workflowId, isDirty, saveWorkflow, startExecution],
  );

  // Node context menu actions
  const handleNodeMenuAction = useCallback(
    (action: string) => {
      if (!nodeContextMenu) return;
      const nodeId = nodeContextMenu.nodeId;
      const node = nodes.find((n) => n.id === nodeId);

      switch (action) {
        case "settings":
          selectNode(nodeId);
          break;
        case "run":
          void handleRunThisNode(nodeId);
          break;
        case "duplicate": {
          if (!node) break;
          pushUndo();
          const definition = getNodeDefinition(
            node.data?.type as string,
          );
          if (!definition) break;
          const existingLabels = getExistingLabels(nodes);
          const currentLabel =
            (node.data as Record<string, unknown>).label as string ??
            definition.label;
          const newNode = {
            id: crypto.randomUUID(),
            type: "custom",
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
            data: {
              ...node.data,
              label: generateUniqueLabel(currentLabel, existingLabels),
            },
          };
          addNode(newNode);
          break;
        }
        case "disable": {
          if (!node) break;
          pushUndo();
          updateNodeConfig(nodeId, {
            ...((node.data?.config as Record<string, unknown>) ?? {}),
          });
          // Toggle isDisabled in the node data
          onNodesChange([
            {
              type: "replace" as const,
              id: nodeId,
              item: {
                ...node,
                data: {
                  ...node.data,
                  isDisabled: !node.data?.isDisabled,
                },
              },
            },
          ]);
          break;
        }
        case "delete":
          if (canDeleteNode(nodeId)) {
            // §11.3 — 자식 있는 컨테이너면 확인 다이얼로그, 그 외 즉시 삭제.
            requestNodeDelete(nodeId);
          }
          break;
      }
      setNodeContextMenu(null);
    },
    [
      nodeContextMenu,
      nodes,
      selectNode,
      pushUndo,
      addNode,
      requestNodeDelete,
      canDeleteNode,
      updateNodeConfig,
      onNodesChange,
      handleRunThisNode,
    ],
  );

  // Canvas context menu actions
  const handleCanvasMenuAction = useCallback(
    (action: string) => {
      if (!canvasContextMenu) return;
      switch (action) {
        case "add-node":
          openNodeSearchPopupAt(
            canvasContextMenu.x,
            canvasContextMenu.y,
            canvasContextMenu.flowPosition,
          );
          break;
        case "paste":
          // §3.3 — 클립보드를 우클릭 위치에 붙여넣는다 (묶음 좌상단이 클릭 지점).
          pasteClipboard(canvasContextMenu.flowPosition);
          break;
        case "select-all":
          onNodesChange(
            nodes.map((n) => ({ type: "select" as const, id: n.id, selected: true })),
          );
          break;
        case "fit-view":
          reactFlowInstance.current?.fitView(FIT_VIEW_OPTIONS);
          break;
      }
      setCanvasContextMenu(null);
    },
    [canvasContextMenu, nodes, onNodesChange, pasteClipboard, openNodeSearchPopupAt],
  );

  // §11.3 — Delete/Backspace 삭제 시 자식 있는 컨테이너는 즉시 삭제하지 않고 확인
  // 다이얼로그를 띄운다. 다중 선택에 확인 대상 컨테이너와 일반 노드가 섞여 있으면,
  // 확인 대상(및 그에 연결된 엣지)만 이번 삭제에서 제외(부분 취소)하고 나머지는 정상
  // 삭제한다 — ReactFlow 의 `{nodes, edges}` 부분 반환. 확인 대상 중 첫 번째에 대해
  // 다이얼로그를 열고, 확정 시 deleteAll/ungroup 이 실제 삭제를 수행한다.
  const onBeforeDelete = useCallback<OnBeforeDelete>(
    async ({ nodes: deleting, edges: deletingEdges }) => {
      const store = useEditorStore.getState();
      const confirmNodes = deleting.filter((n) =>
        store.needsContainerDeleteConfirm(n.id),
      );
      if (confirmNodes.length === 0) return true;
      store.openContainerDeleteConfirm(confirmNodes[0].id);
      const confirmIds = new Set(confirmNodes.map((n) => n.id));
      const allowedNodes = deleting.filter((n) => !confirmIds.has(n.id));
      // 확인 대상 컨테이너에 연결된 엣지는 그대로 두고(다이얼로그가 처리), 나머지만 삭제.
      const allowedEdges = deletingEdges.filter(
        (e) => !confirmIds.has(e.source) && !confirmIds.has(e.target),
      );
      return { nodes: allowedNodes, edges: allowedEdges };
    },
    [],
  );

  // §10 — 캔버스 스코프 줌 단축키 (Ctrl/Cmd + +/-/0/1). 전역 핸들러(workflow-editor)는
  // ReactFlow 인스턴스에 접근할 수 없어 인스턴스를 쥔 본 컴포넌트에서 처리한다. 키 매핑·
  // 입력 필드 가드는 순수 함수(resolveZoomShortcut)로 분리해 단위 테스트한다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const typing = !!active && isEditableTarget(active);
      const action = resolveZoomShortcut(e, typing);
      if (!action) return;
      const instance = reactFlowInstance.current;
      if (!instance) return;
      e.preventDefault();
      switch (action) {
        case "zoom-in":
          void instance.zoomIn();
          break;
        case "zoom-out":
          void instance.zoomOut();
          break;
        case "zoom-reset":
          void instance.zoomTo(1);
          break;
        case "fit-view":
          void instance.fitView(FIT_VIEW_OPTIONS);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 노드 타입 + flow 좌표로 노드를 생성·추가하는 공용 빌더. 빠른추가 팝업(§4.3)과
  // 팔레트 클릭(§4.2)이 공유한다. manual_trigger 단일 인스턴스 가드 포함(§9.2).
  // 생성된 노드 id 를 반환한다(§1.2 자동 엣지 연결이 target 으로 사용). 노드를 만들지
  // 못하면(정의 부재·트리거 중복) undefined.
  const buildAndAddNode = useCallback(
    (
      nodeType: string,
      flowPosition: { x: number; y: number },
    ): string | undefined => {
      const definition = getNodeDefinition(nodeType);
      if (!definition) return undefined;
      if (nodeType === "manual_trigger") {
        const hasTrigger = nodes.some((n) => n.data?.type === "manual_trigger");
        if (hasTrigger) return undefined;
      }
      pushUndo();
      const existingLabels = nodes.map(
        (n) => (n.data as Record<string, unknown>).label as string,
      );
      const baseLabel =
        translateNodeLabel(definition.label, locale) ?? definition.label;
      const newId = crypto.randomUUID();
      addNode({
        id: newId,
        type: "custom",
        position: flowPosition,
        data: {
          type: nodeType,
          label: generateUniqueLabel(baseLabel, existingLabels),
          config: buildInitialConfig(nodeType, definition.defaultConfig),
          category: definition.category,
          isDisabled: false,
        },
      });
      return newId;
    },
    [nodes, pushUndo, addNode, buildInitialConfig, locale],
  );

  // Add node from search popup (§4.3, §1.2)
  const handleAddNodeFromSearch = useCallback(
    (nodeType: string) => {
      if (!nodeSearchPopup) return;
      const dragSource = nodeSearchPopup.dragSource;
      const newId = buildAndAddNode(nodeType, nodeSearchPopup.flowPosition);
      // §1.2 — 출력 포트 드래그로 열린 팝업이면 생성된 노드의 첫 입력 포트로 자동 연결한다.
      // onConnect 에 skipUndo 를 주어 엣지 추가가 "노드는 있고 엣지는 없는" 중간 상태를 별도
      // undo 스냅샷으로 남기지 않게 한다 → Ctrl+Z 1회로 노드와 엣지가 함께 취소된다(노드 없던
      // 상태로 복원). skipUndo 없이는 onConnect 가 노드-only 상태를 스냅샷해 Ctrl+Z 가 엣지만
      // 되돌리고 고아 노드를 남긴다. 대상에 입력 포트가 없으면 connection 이 null → 연결 생략.
      if (newId && dragSource) {
        const connection = buildAutoConnectConnection(
          dragSource,
          newId,
          getNodeDefinition(nodeType),
        );
        if (connection) onConnect(connection, { skipUndo: true });
      }
      setNodeSearchPopup(null);
    },
    [nodeSearchPopup, buildAndAddNode, onConnect],
  );

  // §4.2 — 팔레트 아이템 클릭으로 노드 추가. 현재 뷰포트 중앙에 배치하되, 반복 클릭
  // 시 정확히 겹치지 않도록 소량 지터를 준다. palette-canvas-bridge 로 팔레트에서 호출.
  const handleAddNodeAtCenter = useCallback(
    (nodeType: string) => {
      const instance = reactFlowInstance.current;
      const wrapper = reactFlowWrapper.current;
      let flowPosition = { x: 0, y: 0 };
      if (instance && wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const center = instance.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        const jitter =
          (nodes.length % PALETTE_ADD_JITTER_CYCLE) * PALETTE_ADD_JITTER_STEP_PX;
        flowPosition = { x: center.x + jitter, y: center.y + jitter };
      }
      buildAndAddNode(nodeType, flowPosition);
    },
    [nodes, buildAndAddNode],
  );

  // 팔레트가 이 캔버스의 노드 추가 핸들러를 브리지로 호출할 수 있게 등록/해제.
  useEffect(() => {
    registerPaletteCanvasBridge(handleAddNodeAtCenter);
    return () => registerPaletteCanvasBridge(null);
  }, [handleAddNodeAtCenter]);

  const closeAllMenus = useCallback(() => {
    setNodeContextMenu(null);
    setCanvasContextMenu(null);
    setNodeSearchPopup(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/reactflow-type");
      if (!nodeType || !reactFlowInstance.current) return;
      // 드롭 위치를 flow 좌표로 변환해 공용 빌더로 위임 (§4.2 클릭·§4.3 빠른추가와 동일 경로).
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      buildAndAddNode(nodeType, position);
    },
    [buildAndAddNode],
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    instance.fitView(FIT_VIEW_OPTIONS);
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "custom" as const,
      interactionWidth: 20,
    }),
    [],
  );

  // Filtered node definitions for search popup
  const definitionsMap = useNodeDefinitionsStore((s) => s.definitions);
  const definitionsOrder = useNodeDefinitionsStore((s) => s.order);
  const filteredNodes = useMemo(() => {
    const all = definitionsOrder.map((t) => definitionsMap[t]).filter(Boolean);
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q),
    );
  }, [searchQuery, definitionsMap, definitionsOrder]);

  // §4.3 — 검색어가 바뀌면(팝업 열림 시 ""로 리셋 포함) 하이라이트를 첫 항목으로.
  // effect 대신 렌더 중 이전 값 비교로 조정한다 (React "adjust state on change" 패턴 —
  // effect 내 setState 로 인한 cascading render 회피).
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setHighlightedIndex(0);
  }

  // §4.3 빠른 노드 추가 팝업 키보드 핸들러. ArrowUp/Down 이동, Enter 선택, Escape 닫기.
  // `stopPropagation` 으로 전역 keydown(§3.2 선택 해제·§10.12 드로어 복귀)보다 팝업이
  // 우선하도록 한다 — 팝업이 열려 있으면 Escape 는 팝업 닫기가 최우선.
  const handleSearchPopupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          nextHighlightedIndex(i, "down", filteredNodes.length),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          nextHighlightedIndex(i, "up", filteredNodes.length),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = clampHighlightedIndex(highlightedIndex, filteredNodes.length);
        const def = filteredNodes[idx];
        if (def) handleAddNodeFromSearch(def.type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setNodeSearchPopup(null);
      }
    },
    [filteredNodes, highlightedIndex, handleAddNodeFromSearch],
  );

  return (
    <TooltipProvider delayDuration={300}>
    <HasDefaultLlmConfigProvider value={hasDefaultLlmConfig}>
    <IntegrationListProvider value={integrationListValue}>
    <div
      ref={reactFlowWrapper}
      className="h-full w-full"
      data-edge-focus-active={isFocusActive || undefined}
      onClick={closeAllMenus}
    >
      <EdgeMarkerDefs />
      <ReactFlow
        nodes={glowNodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onReconnect={handleReconnect}
        onReconnectEnd={onReconnectEnd}
        isValidConnection={isValidConnection}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onNodeContextMenu={onNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onBeforeDelete={onBeforeDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        deleteKeyCode={["Delete", "Backspace"]}
        panActivationKeyCode="Space"
        className="bg-[hsl(var(--background))]"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <ZoomControls />
        <CanvasMinimap />
        <Panel position="top-right" className="pointer-events-none mr-6 mt-6">
          <CanvasEmptyState visible={isWorkflowEmpty(nodes)} />
        </Panel>
      </ReactFlow>

      {/* Node context menu */}
      {nodeContextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleNodeMenuAction("settings")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Settings className="h-4 w-4" />
            {t("editor.openSettings")}
          </button>
          <button
            type="button"
            onClick={() => handleNodeMenuAction("run")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Play className="h-4 w-4" />
            {t("editor.runThisNode")}
          </button>
          <button
            type="button"
            onClick={() => handleNodeMenuAction("duplicate")}
            disabled={
              nodes.find((n) => n.id === nodeContextMenu.nodeId)?.data
                ?.type === "manual_trigger"
            }
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            {t("editor.duplicateBtn")}
          </button>
          <button
            type="button"
            onClick={() => handleNodeMenuAction("disable")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            {nodes.find((n) => n.id === nodeContextMenu.nodeId)?.data
              ?.isDisabled ? (
              <>
                <Eye className="h-4 w-4" />
                {t("editor.enableBtn")}
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                {t("editor.disableBtn")}
              </>
            )}
          </button>
          <div className="my-1 border-t border-[hsl(var(--border))]" />
          <button
            type="button"
            onClick={() => handleNodeMenuAction("delete")}
            disabled={!canDeleteNode(nodeContextMenu.nodeId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t("editor.deleteNodeMenu")}
          </button>
        </div>
      )}

      {/* Canvas context menu */}
      {canvasContextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("add-node")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Plus className="h-4 w-4" />
            {t("editor.addNodeMenu")}
          </button>
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("paste")}
            disabled={!editorClipboard}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardPaste className="h-4 w-4" />
            {t("editor.pasteMenu")}
          </button>
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("select-all")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Crosshair className="h-4 w-4" />
            {t("editor.selectAll")}
          </button>
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("fit-view")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Maximize className="h-4 w-4" />
            {t("editor.fitToView")}
          </button>
        </div>
      )}

      {/* Node search popup (double-click add) */}
      {nodeSearchPopup && (
        <div
          className="fixed z-50 w-[260px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
          style={{ left: nodeSearchPopup.x, top: nodeSearchPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder={t("editor.searchNodesPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchPopupKeyDown}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filteredNodes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                {t("editor.noNodesFound")}
              </div>
            ) : (
              filteredNodes.map((def, idx) => {
                const label =
                  translateNodeLabel(def.label, locale) ?? def.label;
                const category =
                  translateNodeCategory(def.category, locale) ?? def.category;
                const isHighlighted =
                  idx ===
                  clampHighlightedIndex(highlightedIndex, filteredNodes.length);
                return (
                  <button
                    key={def.type}
                    type="button"
                    onClick={() => handleAddNodeFromSearch(def.type)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    aria-selected={isHighlighted}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))]",
                      isHighlighted && "bg-[hsl(var(--accent))]",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: def.color }}
                    />
                    <span>{label}</span>
                    <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                      {category}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* §11.3 컨테이너 삭제 확인 다이얼로그 (자식 있는 컨테이너 삭제 시) */}
      {pendingContainerDelete && (
        <ContainerDeleteDialog
          containerLabel={pendingContainerDelete.label}
          childCount={pendingContainerDelete.childCount}
          onConfirm={confirmContainerDelete}
          onCancel={cancelContainerDelete}
        />
      )}
    </div>
    </IntegrationListProvider>
    </HasDefaultLlmConfigProvider>
    </TooltipProvider>
  );
}
