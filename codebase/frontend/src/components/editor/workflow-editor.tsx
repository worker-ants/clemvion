"use client";

import { useEffect, useCallback, useRef } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useExecutionEvents } from "@/lib/websocket/use-execution-events";
import { getWsClient } from "@/lib/websocket/ws-client";
import { getAccessToken } from "@/lib/api/client";
import { useAssistantStore } from "@/lib/stores/assistant-store";
import {
  computeNodeTopologyKey,
  computeEdgeTopologyKey,
} from "@/lib/utils/topology-key";
import { EditorToolbar } from "./toolbar/editor-toolbar";
import { NodePalette } from "./palette/node-palette";
import { WorkflowCanvas } from "./canvas/workflow-canvas";
import { NodeSettingsPanel } from "./settings-panel/node-settings-panel";
import { RunResultsDrawer } from "./run-results/run-results-drawer";
import { VersionHistoryPanel } from "./version-history/version-history-panel";
import { AssistantPanel } from "./assistant-panel/assistant-panel";

// `isEditableTarget` 은 canvas 의 줌 단축키 핸들러와 공유하기 위해 shared util 로
// 이동했다 (workflow-editor ↔ workflow-canvas 순환 import 회피). 기존 import 경로
// 호환을 위해 여기서 re-export 한다.
export { isEditableTarget } from "@/lib/utils/is-editable-target";
import { isEditableTarget } from "@/lib/utils/is-editable-target";

export function WorkflowEditor() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const copySelection = useEditorStore((s) => s.copySelection);
  const pasteClipboard = useEditorStore((s) => s.pasteClipboard);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const selectAll = useEditorStore((s) => s.selectAll);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const saveWorkflow = useEditorStore((s) => s.saveWorkflow);
  const evaluateGraphWarningsLocal = useEditorStore(
    (s) => s.evaluateGraphWarningsLocal,
  );
  const workflowId = useEditorStore((s) => s.workflowId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const executionId = useExecutionStore((s) => s.executionId);
  const toggleDrawerExpanded = useExecutionStore((s) => s.toggleDrawerExpanded);
  const toggleAssistant = useAssistantStore((s) => s.toggle);
  const queryClient = useQueryClient();

  // §10.12 Escape — 드로어 포커스에서 복귀할 캔버스 컨테이너 (tabIndex=-1 로
  // 프로그램적 포커스만 허용, 탭 순서에는 끼지 않는다).
  const canvasFocusRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+S can rename the workflow via saveCanvas (editor-store.ts), so
  // we mirror the toolbar's save path and invalidate the cached workflow
  // list on success.
  const saveAndInvalidate = useCallback(async () => {
    const ok = await saveWorkflow();
    if (ok) queryClient.invalidateQueries({ queryKey: ["workflows"] });
  }, [saveWorkflow, queryClient]);

  // Pre-connect WebSocket on editor mount for warm connection
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      getWsClient().connect(token);
    }
  }, []);

  // parallel-p2 결정 D + E + I (2026-05-30) — cross-node graphWarningRules
  // 사전 평가. graph 변경 시점에 debounced 으로 `@workflow/graph-warning-rules`
  // 를 **로컬 평가** (네트워크 round-trip 없음), 결과를 store 에 저장. toolbar
  // 의 save 버튼이 hasError 시 disable. 500ms debounce — 빠른 연속 편집 (drag
  // 중 multiple onChange) 부담 완화 + 대형 그래프 평가 비용 분산.
  //
  // node config (예: parallel maxConcurrency/branchCount) 도 평가 입력이므로
  // topology key 외에 config 변경도 debounce 트리거에 포함한다. drag(위치
  // 변경)·선택 변경은 graph rule 평가와 무관하므로 제외. key 계산은
  // `@/lib/utils/topology-key` 의 공유 함수로 위임 — debounce 테스트가 동일
  // 함수를 import 해 프로덕션 동작과 SSOT 를 유지한다.
  const nodeTopologyKey = computeNodeTopologyKey(nodes);
  const edgeTopologyKey = computeEdgeTopologyKey(edges);
  useEffect(() => {
    if (!workflowId) return;
    const handle = setTimeout(() => {
      evaluateGraphWarningsLocal();
    }, 500);
    return () => clearTimeout(handle);
     
  }, [workflowId, nodeTopologyKey, edgeTopologyKey, evaluateGraphWarningsLocal]);

  // Subscribe to WebSocket execution events
  useExecutionEvents({ executionId });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      // §3.2/§3.3 — 입력류 요소 포커스 여부. 텍스트 필드 안에서는 복사/붙여넣기/
      // 전체선택/선택해제 단축키를 가로채지 않는다 (기존 Ctrl+S/Z/Y 는 전역 유지).
      const active = document.activeElement as HTMLElement | null;
      const typing = !!active && isEditableTarget(active);

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      if (isMod && e.key === "s") {
        e.preventDefault();
        void saveAndInvalidate();
      }

      if (isMod && e.key === "/") {
        e.preventDefault();
        toggleAssistant();
      }

      // §3.3 — Ctrl/Cmd+C: 선택 노드(+내부 엣지) 복사. (편집 필드에서는 양보.)
      if (isMod && !typing && e.key === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      // §3.3 — Ctrl/Cmd+V: 클립보드 붙여넣기.
      if (isMod && !typing && e.key === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      // §3.3 — Ctrl/Cmd+D: 선택 노드 즉시 복제 (브라우저 북마크 기본동작 차단).
      if (isMod && !typing && e.key === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      // §3.2 — Ctrl/Cmd+A: 전체 선택.
      if (isMod && !typing && e.key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      // §10.12 — Ctrl/Cmd+Shift+R: Run Results 드로어 펼침/접힘 토글. 브라우저
      // 하드 리로드(기본 동작)를 막는다 (spec 이 의도적으로 택한 키 조합).
      if (isMod && e.shiftKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        toggleDrawerExpanded();
        return;
      }

      // Escape — 우선순위 분기 (§3.2/§10, §10.12). ① Run Results 드로어에 포커스가
      // 있고 편집 필드가 아니면 캔버스로 포커스 복귀(§10.12) 후 early-return. ②
      // 그 외 편집 필드가 아니면 노드 선택 해제(§3.2). 편집 필드에서는 그 요소가
      // Escape 를 처리하도록 양보한다.
      if (e.key === "Escape") {
        if (
          active &&
          active.closest("[data-run-results-drawer]") &&
          !typing
        ) {
          e.preventDefault();
          canvasFocusRef.current?.focus();
          return;
        }
        if (!typing) {
          deselectAll();
        }
      }
    },
    [
      undo,
      redo,
      copySelection,
      pasteClipboard,
      duplicateSelection,
      selectAll,
      deselectAll,
      saveAndInvalidate,
      toggleAssistant,
      toggleDrawerExpanded,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col bg-[hsl(var(--background))]">
        {/* Toolbar */}
        <EditorToolbar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Left palette */}
            <NodePalette />

            {/* Center canvas */}
            <div ref={canvasFocusRef} tabIndex={-1} className="flex-1 outline-none">
              <WorkflowCanvas />
            </div>

            {/* Right settings panel (conditional) */}
            <NodeSettingsPanel />

            {/* AI Assistant panel (conditional). Mutually exclusive with
                NodeSettingsPanel — AssistantPanel clears `selectedNodeId` on
                open, and selecting a node closes the assistant. */}
            <AssistantPanel />

            {/* Version history side panel (conditional) */}
            <VersionHistoryPanel />
          </div>

          {/* Run results drawer (bottom) */}
          <RunResultsDrawer />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
