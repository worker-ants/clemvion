"use client";

import { useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { EditorToolbar } from "./toolbar/editor-toolbar";
import { NodePalette } from "./palette/node-palette";
import { WorkflowCanvas } from "./canvas/workflow-canvas";
import { NodeSettingsPanel } from "./settings-panel/node-settings-panel";

export function WorkflowEditor() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

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
        // Save placeholder - will be connected to API later
      }
    },
    [undo, redo],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-[hsl(var(--background))]">
        {/* Toolbar */}
        <EditorToolbar />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left palette */}
          <NodePalette />

          {/* Center canvas */}
          <div className="flex-1">
            <WorkflowCanvas />
          </div>

          {/* Right settings panel (conditional) */}
          <NodeSettingsPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
