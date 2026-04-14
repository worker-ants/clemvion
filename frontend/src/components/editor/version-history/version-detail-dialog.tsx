"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import type { WorkflowVersionDetail } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";

interface Props {
  workflowId: string;
  versionId: string;
  onClose: () => void;
}

export function VersionDetailDialog({ workflowId, versionId, onClose }: Props) {
  const query = useQuery({
    queryKey: ["workflow-version", workflowId, versionId],
    queryFn: async () => {
      const res = await workflowsApi.getVersion(workflowId, versionId);
      return res.data.data as WorkflowVersionDetail;
    },
  });

  return (
    <div
      role="dialog"
      aria-label="Version detail"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h3 className="text-sm font-semibold">
            {query.data ? `v${query.data.version}` : "Version detail"}
            {query.data?.changeSummary && (
              <span className="ml-2 font-normal text-[hsl(var(--muted-foreground))]">
                — {query.data.changeSummary}
              </span>
            )}
          </h3>
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

        <div className="flex-1 overflow-y-auto p-4 text-xs">
          {query.isLoading && <div>Loading…</div>}
          {query.isError && (
            <div className="text-[hsl(var(--destructive))]">
              Failed to load version
            </div>
          )}
          {query.data && (
            <div className="space-y-4">
              <section>
                <h4 className="mb-1 font-semibold">Workflow</h4>
                <div>Name: {query.data.snapshot.name}</div>
                {query.data.snapshot.description && (
                  <div>Description: {query.data.snapshot.description}</div>
                )}
              </section>
              <section>
                <h4 className="mb-1 font-semibold">
                  Nodes ({query.data.snapshot.nodes.length})
                </h4>
                <ul className="space-y-1">
                  {query.data.snapshot.nodes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded border border-[hsl(var(--border))] p-2"
                    >
                      <div className="font-medium">{n.label}</div>
                      <div className="text-[hsl(var(--muted-foreground))]">
                        {n.type} · ({n.positionX}, {n.positionY})
                        {n.isDisabled ? " · disabled" : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="mb-1 font-semibold">
                  Edges ({query.data.snapshot.edges.length})
                </h4>
                <ul className="space-y-1">
                  {query.data.snapshot.edges.map((e) => (
                    <li
                      key={e.id}
                      className="rounded border border-[hsl(var(--border))] p-2"
                    >
                      {e.sourceNodeId}:{e.sourcePort} → {e.targetNodeId}:
                      {e.targetPort}
                      <span className="ml-1 text-[hsl(var(--muted-foreground))]">
                        ({e.type})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
