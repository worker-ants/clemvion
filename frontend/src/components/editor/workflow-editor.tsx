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
