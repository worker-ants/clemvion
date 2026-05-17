"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import type { WorkflowVersionSummary } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface Props {
  workflowId: string;
  version: WorkflowVersionSummary;
  onClose: () => void;
}

export function RestoreConfirmDialog({ workflowId, version, onClose }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      workflowsApi.restoreVersion(workflowId, version.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workflow-versions", workflowId],
      });
      window.location.reload();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : t("editor.restoreFailedDefault"));
    },
  });

  return (
    <div
      role="dialog"
      aria-label={t("editor.restoreDialogLabel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {t("editor.restoreDialogTitle", { version: version.version })}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label={t("editor.restoreDialogClose")}
          >
            <X size={14} />
          </Button>
        </header>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          {t("editor.restoreDialogMessage", { version: version.version })}
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
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            <RotateCcw size={12} className="mr-1.5" />
            {mutation.isPending ? t("editor.restoring") : t("editor.restoreBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
