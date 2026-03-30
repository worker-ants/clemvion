"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Play,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export function EditorToolbar() {
  const workflowName = useEditorStore((s) => s.workflowName);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);

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
        >
          <Save size={14} />
          Save
        </Button>

        {/* Run */}
        <Button size="sm" className="h-8 gap-1.5 text-xs">
          <Play size={14} />
          Run
        </Button>
      </div>
    </div>
  );
}
