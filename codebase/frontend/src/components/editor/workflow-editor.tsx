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

/**
 * §10.12 Escape 핸들러 보조 — 드로어 내부에 포커스가 있어도 입력 필드면
 * 그 요소가 Escape 를 처리하도록 양보한다 (필드 클리어/닫기 등). 입력류가
 * 아닌 곳(타임라인 항목·버튼 등)에 포커스가 있을 때만 캔버스로 복귀시킨다.
 */
export function isEditableTarget(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // `isContentEditable` 은 jsdom 에 미구현이라 attribute 로도 한 번 더 확인한다.
  const attr = el.getAttribute("contenteditable");
  return attr === "" || attr === "true";
}

export function WorkflowEditor() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
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

      // §10.12 — Ctrl/Cmd+Shift+R: Run Results 드로어 펼침/접힘 토글. 브라우저
      // 하드 리로드(기본 동작)를 막는다 (spec 이 의도적으로 택한 키 조합).
      if (isMod && e.shiftKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        toggleDrawerExpanded();
        return;
      }

      // §10.12 — Escape (드로어 포커스 시): 캔버스로 포커스 복귀. 드로어 내부의
      // 편집 가능한 필드에서는 그 요소가 Escape 를 처리하도록 양보한다.
      if (e.key === "Escape") {
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          active.closest("[data-run-results-drawer]") &&
          !isEditableTarget(active)
        ) {
          e.preventDefault();
          canvasFocusRef.current?.focus();
        }
      }
    },
    [undo, redo, saveAndInvalidate, toggleAssistant, toggleDrawerExpanded],
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
