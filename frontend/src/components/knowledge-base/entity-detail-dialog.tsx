"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  knowledgeBasesApi,
  type GraphEntity,
} from "@/lib/api/knowledge-bases";
import { useT } from "@/lib/i18n";

interface EntityDetailDialogProps {
  kbId: string;
  entity: GraphEntity | null;
  onClose: () => void;
}

export function EntityDetailDialog({
  kbId,
  entity,
  onClose,
}: EntityDetailDialogProps) {
  const t = useT();

  const { data: detail, isLoading } = useQuery({
    queryKey: ["kb-entity-detail", kbId, entity?.id],
    queryFn: () =>
      entity
        ? knowledgeBasesApi.getEntityDetail(kbId, entity.id)
        : Promise.resolve(null),
    enabled: !!entity,
  });

  return (
    <Dialog
      open={entity !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entity?.displayName ?? ""}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {entity
              ? `${entity.name} · ${entity.type} · ${entity.mentionCount} mentions`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : detail ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {detail.description && (
              <p className="rounded bg-[hsl(var(--muted)/0.3)] p-3 text-sm">
                {detail.description}
              </p>
            )}
            <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t("knowledgeBases.entityMentionedInChunks", {
                count: detail.mentionedInChunks.length,
              })}
            </div>
            {detail.mentionedInChunks.map((c) => (
              <div
                key={c.chunkId}
                className="rounded border border-[hsl(var(--border))] p-2 text-sm"
              >
                <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  {c.documentName}
                </div>
                <div className="mt-1 text-xs">{c.contentPreview}…</div>
              </div>
            ))}
            {detail.truncated && (
              <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                {t("knowledgeBases.entityChunksTruncated")}
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
