"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import type { WorkflowVersionSummary } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";

interface Props {
  workflowId: string;
  version: WorkflowVersionSummary;
  onClose: () => void;
}

export function RestoreConfirmDialog({ workflowId, version, onClose }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      workflowsApi.restoreVersion(workflowId, version.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workflow-versions", workflowId],
      });
      // Reload editor state from server (snapshot replaces canvas + creates a
      // new version row, so the in-memory editor state is no longer valid).
      window.location.reload();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : "Restore failed");
    },
  });

  return (
    <div
      role="dialog"
      aria-label="Restore confirmation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Restore v{version.version}?</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </Button>
        </header>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          The current canvas will be replaced with the snapshot from v
          {version.version}. The replacement is itself recorded as a new
          version, so you can always restore back.
        </p>
        {error && (
          <div
            role="alert"
            className="mb-2 text-xs text-[hsl(var(--destructive))]"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            <RotateCcw size={12} className="mr-1.5" />
            {mutation.isPending ? "Restoring…" : "Restore"}
          </Button>
        </div>
      </div>
    </div>
  );
}
