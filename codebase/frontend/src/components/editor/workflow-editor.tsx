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
// 호환을 위해 아래에서 재노출한다.
import { isEditableTarget } from "@/lib/utils/is-editable-target";
import { resolveEditorShortcut } from "@/lib/utils/editor-keyboard";

export { isEditableTarget };

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
      // §3.2/§3.3 — 입력류 요소 포커스 여부. 텍스트 필드 안에서는 복사/붙여넣기/
      // 전체선택/선택해제 단축키를 가로채지 않는다 (기존 Ctrl+S/Z/Y 는 전역 유지).
      const active = document.activeElement as HTMLElement | null;
      const typing = !!active && isEditableTarget(active);

      // 키 조합 → 액션 매핑은 순수 함수(resolveEditorShortcut)로 분리해 단위 테스트한다.
      const action = resolveEditorShortcut(e, typing);
      if (!action) return;

      switch (action) {
        case "undo":
          e.preventDefault();
          undo();
          break;
        case "redo":
          e.preventDefault();
          redo();
          break;
        case "save":
          e.preventDefault();
          void saveAndInvalidate();
          break;
        case "toggle-assistant":
          e.preventDefault();
          toggleAssistant();
          break;
        case "copy":
          e.preventDefault();
          copySelection();
          break;
        case "paste":
          e.preventDefault();
          pasteClipboard();
          break;
        case "duplicate":
          // 브라우저 북마크(Ctrl+D) 기본동작 차단.
          e.preventDefault();
          duplicateSelection();
          break;
        case "select-all":
          e.preventDefault();
          selectAll();
          break;
        case "toggle-drawer":
          // 브라우저 하드 리로드(Ctrl+Shift+R) 기본동작 차단 (§10.12).
          e.preventDefault();
          toggleDrawerExpanded();
          break;
        case "escape":
          // 우선순위 분기 (§3.2/§10.12). ① Run Results 드로어 포커스(편집 필드 제외)
          // → 캔버스 복귀. ② 그 외 편집 필드가 아니면 선택 해제. 편집 필드에서는 양보.
          if (active && active.closest("[data-run-results-drawer]") && !typing) {
            e.preventDefault();
            canvasFocusRef.current?.focus();
          } else if (!typing) {
            deselectAll();
          }
          break;
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
