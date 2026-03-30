"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { workflowsApi } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Play,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export function EditorToolbar() {
  const workflowId = useEditorStore((s) => s.workflowId);
  const workflowName = useEditorStore((s) => s.workflowName);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveWorkflow = useEditorStore((s) => s.saveWorkflow);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);

  const executionStatus = useExecutionStore((s) => s.status);
  const startExecution = useExecutionStore((s) => s.startExecution);

  const isRunning = executionStatus === "running";

  const handleRun = useCallback(async () => {
    if (!workflowId || isRunning) return;

    // Save first if there are unsaved changes
    if (isDirty) {
      const saved = await saveWorkflow();
      if (!saved) return;
    }

    try {
      const response = await workflowsApi.execute(workflowId);
      const { executionId } = response.data as { executionId: string };
      startExecution(executionId);
    } catch (error) {
      console.error("Execution failed:", error);
    }
  }, [workflowId, isRunning, isDirty, saveWorkflow, startExecution]);

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
      {/* Left section: back + breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Link href="/workflows">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          Workflows
        </span>
        <ChevronRight
          size={12}
          className="text-[hsl(var(--muted-foreground))]"
        />
      </div>

      {/* Center: editable name */}
      <div className="ml-2 flex flex-1 items-center justify-center">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="h-7 max-w-[240px] border-transparent bg-transparent text-center text-sm font-medium hover:border-[hsl(var(--input))] focus:border-[hsl(var(--input))]"
        />
      </div>

      {/* Right section: actions */}
      <div className="flex items-center gap-1.5">
        {/* Dirty indicator */}
        <span className="mr-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          {isSaving ? "Saving..." : isDirty ? "Unsaved changes" : "Saved"}
        </span>

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </Button>

        {/* Save */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={!isDirty || isSaving}
          onClick={() => void saveWorkflow()}
        >
          <Save size={14} />
          Save
        </Button>

        {/* Run */}
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={isRunning || !workflowId}
          onClick={() => void handleRun()}
        >
          {isRunning ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={14} />
              Run
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
