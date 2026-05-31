"use client";

import { useEffect, useCallback } from "react";
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
  const toggleAssistant = useAssistantStore((s) => s.toggle);
  const queryClient = useQueryClient();

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
    },
    [undo, redo, saveAndInvalidate, toggleAssistant],
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
            <div className="flex-1">
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
