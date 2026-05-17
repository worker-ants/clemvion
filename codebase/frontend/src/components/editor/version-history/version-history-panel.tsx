"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, History, Eye, RotateCcw, GitCompare } from "lucide-react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { workflowsApi } from "@/lib/api/workflows";
import type { WorkflowVersionSummary } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { VersionDetailDialog } from "./version-detail-dialog";
import { VersionDiffDialog } from "./version-diff-dialog";
import { RestoreConfirmDialog } from "./restore-confirm-dialog";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";

function creatorLabel(v: WorkflowVersionSummary): string {
  return v.creator?.name ?? v.creator?.email ?? v.createdBy;
}

export function VersionHistoryPanel() {
  const t = useT();
  const open = useEditorStore((s) => s.versionHistoryOpen);
  const setOpen = useEditorStore((s) => s.setVersionHistoryOpen);
  const workflowId = useEditorStore((s) => s.workflowId);
  const saveCount = useEditorStore((s) => s.saveCount);
  const queryClient = useQueryClient();

  const [diffMode, setDiffMode] = useState(false);
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);
  const [detailVersionId, setDetailVersionId] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<{
    aId: string;
    bId: string;
  } | null>(null);
  const [restoreTarget, setRestoreTarget] =
    useState<WorkflowVersionSummary | null>(null);

  const query = useQuery({
    queryKey: ["workflow-versions", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      const res = await workflowsApi.listVersions(workflowId);
      return (res.data.data ?? []) as WorkflowVersionSummary[];
    },
    enabled: open && !!workflowId,
  });

  // Refetch the list whenever the editor reports a new successful save so the
  // newly created version shows up without a manual refresh.
  useEffect(() => {
    if (!open || !workflowId || saveCount === 0) return;
    void queryClient.invalidateQueries({
      queryKey: ["workflow-versions", workflowId],
    });
  }, [saveCount, open, workflowId, queryClient]);

  if (!open) return null;

  const versions = query.data ?? [];

  const toggleDiffSelect = (id: string) => {
    setSelectedForDiff((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      const next = [...prev, id];
      if (next.length > 2) next.shift();
      return next;
    });
  };

  const startDiff = () => {
    if (selectedForDiff.length === 2) {
      const [aId, bId] = selectedForDiff;
      setDiffPair({ aId, bId });
    }
  };

  return (
    <>
      <aside
        data-testid="version-history-panel"
        className="flex h-full w-80 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]"
      >
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <History size={14} />
            <h2 className="text-sm font-semibold">{t("editor.versionHistoryTitle")}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
            aria-label={t("editor.closeVersionHistory")}
          >
            <X size={14} />
          </Button>
        </header>

        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={diffMode}
              onChange={(e) => {
                setDiffMode(e.target.checked);
                setSelectedForDiff([]);
              }}
            />
            {t("editor.compareVersions")}
          </label>
          {diffMode && (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={selectedForDiff.length !== 2}
              onClick={startDiff}
            >
              <GitCompare size={12} />
              {t("editor.diffBtn", { count: selectedForDiff.length })}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {query.isLoading && (
            <div
              role="status"
              className="p-3 text-xs text-[hsl(var(--muted-foreground))]"
            >
              {t("editor.loadingVersions")}
            </div>
          )}
          {query.isError && (
            <div
              role="alert"
              className="p-3 text-xs text-[hsl(var(--destructive))]"
            >
              {t("editor.loadVersionsFailed")}
            </div>
          )}
          {!query.isLoading && !query.isError && versions.length === 0 && (
            <div className="p-3 text-xs text-[hsl(var(--muted-foreground))]">
              {t("editor.noVersionsYet")}
            </div>
          )}
          <ul className="divide-y divide-[hsl(var(--border))]">
            {versions.map((v) => {
              const checked = selectedForDiff.includes(v.id);
              return (
                <li key={v.id} className="px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {diffMode && (
                          <input
                            type="checkbox"
                            aria-label={t("editor.selectForDiff", { version: v.version })}
                            checked={checked}
                            onChange={() => toggleDiffSelect(v.id)}
                          />
                        )}
                        <span className="font-semibold">v{v.version}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {creatorLabel(v)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[hsl(var(--muted-foreground))]">
                        {formatDate(v.createdAt, "datetime")}
                      </div>
                      {v.changeSummary && (
                        <div className="mt-1 truncate text-[hsl(var(--foreground))]">
                          {v.changeSummary}
                        </div>
                      )}
                    </div>
                    {!diffMode && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setDetailVersionId(v.id)}
                          aria-label={t("editor.viewVersion", { version: v.version })}
                        >
                          <Eye size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setRestoreTarget(v)}
                          aria-label={t("editor.restoreVersionLabel", { version: v.version })}
                        >
                          <RotateCcw size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {detailVersionId && workflowId && (
        <VersionDetailDialog
          workflowId={workflowId}
          versionId={detailVersionId}
          onClose={() => setDetailVersionId(null)}
        />
      )}
      {diffPair && workflowId && (
        <VersionDiffDialog
          workflowId={workflowId}
          aId={diffPair.aId}
          bId={diffPair.bId}
          onClose={() => setDiffPair(null)}
        />
      )}
      {restoreTarget && workflowId && (
        <RestoreConfirmDialog
          workflowId={workflowId}
          version={restoreTarget}
          onClose={() => setRestoreTarget(null)}
        />
      )}
    </>
  );
}
