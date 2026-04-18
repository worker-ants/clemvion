"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import type { WorkflowVersionDetail } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { diffSnapshots } from "./diff-utils";
import { useT } from "@/lib/i18n";

interface Props {
  workflowId: string;
  aId: string;
  bId: string;
  onClose: () => void;
}

export function VersionDiffDialog({ workflowId, aId, bId, onClose }: Props) {
  const t = useT();
  const a = useQuery({
    queryKey: ["workflow-version", workflowId, aId],
    queryFn: async () =>
      (await workflowsApi.getVersion(workflowId, aId)).data
        .data as WorkflowVersionDetail,
  });
  const b = useQuery({
    queryKey: ["workflow-version", workflowId, bId],
    queryFn: async () =>
      (await workflowsApi.getVersion(workflowId, bId)).data
        .data as WorkflowVersionDetail,
  });

  const ready = a.data && b.data;
  // Order: lower version is "before"
  const [before, after] = ready
    ? a.data!.version <= b.data!.version
      ? [a.data!, b.data!]
      : [b.data!, a.data!]
    : [null, null];

  const diff =
    before && after ? diffSnapshots(before.snapshot, after.snapshot) : null;

  return (
    <div
      role="dialog"
      aria-label={t("editor.diffDialogLabel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h3 className="text-sm font-semibold">
            {ready
              ? t("editor.diffTitleHeader", {
                  before: before!.version,
                  after: after!.version,
                })
              : t("editor.diffFallback")}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label={t("editor.closeBtn")}
          >
            <X size={14} />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 text-xs">
          {(a.isLoading || b.isLoading) && <div>{t("editor.loadingShort")}</div>}
          {(a.isError || b.isError) && (
            <div className="text-[hsl(var(--destructive))]">
              {t("editor.diffLoadVersionsFailed")}
            </div>
          )}
          {diff && (
            <div className="space-y-4" data-testid="diff-content">
              {diff.nameChanged && (
                <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-2">
                  {t("editor.diffNameLabel")}: <s>{diff.nameChanged.before}</s> →{" "}
                  <strong>{diff.nameChanged.after}</strong>
                </div>
              )}

              <DiffSection title={t("editor.diffAddedNodes")} tone="add">
                {diff.nodes.added.map((n) => (
                  <li key={n.id}>
                    + {n.label} ({n.type})
                  </li>
                ))}
              </DiffSection>
              <DiffSection title={t("editor.diffRemovedNodes")} tone="remove">
                {diff.nodes.removed.map((n) => (
                  <li key={n.id}>
                    − {n.label} ({n.type})
                  </li>
                ))}
              </DiffSection>
              <DiffSection title={t("editor.diffModifiedNodes")} tone="modify">
                {diff.nodes.modified.map((m) => (
                  <li key={m.after.id}>
                    ~ {m.after.label} ({m.after.type}) — {m.fields.join(", ")}
                  </li>
                ))}
              </DiffSection>

              <DiffSection title={t("editor.diffAddedEdges")} tone="add">
                {diff.edges.added.map((e, i) => (
                  <li key={`${e.id}-${i}`}>
                    + {e.sourceNodeId}:{e.sourcePort} → {e.targetNodeId}:
                    {e.targetPort}
                  </li>
                ))}
              </DiffSection>
              <DiffSection title={t("editor.diffRemovedEdges")} tone="remove">
                {diff.edges.removed.map((e, i) => (
                  <li key={`${e.id}-${i}`}>
                    − {e.sourceNodeId}:{e.sourcePort} → {e.targetNodeId}:
                    {e.targetPort}
                  </li>
                ))}
              </DiffSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "add" | "remove" | "modify";
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  if (items.length === 0) return null;
  // Filter out null/false children to detect empty sections
  const realItems = items.filter(Boolean);
  if (realItems.length === 0) return null;

  const toneClass =
    tone === "add"
      ? "border-green-500/50 bg-green-500/10"
      : tone === "remove"
        ? "border-red-500/50 bg-red-500/10"
        : "border-blue-500/50 bg-blue-500/10";

  return (
    <section className={`rounded border p-2 ${toneClass}`}>
      <h4 className="mb-1 font-semibold">{title}</h4>
      <ul className="space-y-0.5">{realItems}</ul>
    </section>
  );
}
