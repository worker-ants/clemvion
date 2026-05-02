"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type GraphEntity,
  type EntityType,
} from "@/lib/api/knowledge-bases";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Loader2, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

const ENTITY_TYPES: EntityType[] = [
  "person",
  "organization",
  "concept",
  "location",
  "event",
  "other",
];

interface EntityListProps {
  kbId: string;
}

export function EntityList({ kbId }: EntityListProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "">("");
  const [deleteTarget, setDeleteTarget] = useState<GraphEntity | null>(null);
  const [previewTarget, setPreviewTarget] = useState<GraphEntity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kb-entities", kbId, page, search, typeFilter],
    queryFn: async () => {
      const body = await knowledgeBasesApi.getEntities(kbId, {
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        type: typeFilter || undefined,
      });
      return normalizePagedResponse<GraphEntity>(body, page);
    },
    placeholderData: (prev) => prev,
  });
  const entities = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (entityId: string) =>
      knowledgeBasesApi.deleteEntity(kbId, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-entities", kbId] });
      queryClient.invalidateQueries({ queryKey: ["kb-graph-stats", kbId] });
      queryClient.invalidateQueries({ queryKey: ["kb-relations", kbId] });
      toast.success(t("knowledgeBases.entityDeleted"));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("knowledgeBases.entityDeleteFailed")),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["kb-entity-detail", kbId, previewTarget?.id],
    queryFn: () =>
      previewTarget
        ? knowledgeBasesApi.getEntityDetail(kbId, previewTarget.id)
        : Promise.resolve(null),
    enabled: !!previewTarget,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("knowledgeBases.entitySearchPlaceholder")}
            className="pl-8"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as EntityType | "");
            setPage(1);
          }}
          className="h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">{t("knowledgeBases.entityAllTypes")}</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : entities.length === 0 ? (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.entityEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t("knowledgeBases.entityName")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("knowledgeBases.entityType")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("knowledgeBases.entityMentions")}
                </th>
                <th className="w-24 px-4 py-3 text-right font-medium">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {entities.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer hover:bg-[hsl(var(--muted)/0.4)]"
                  onClick={() => setPreviewTarget(e)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.displayName}</div>
                    <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {e.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-mono">
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {e.mentionCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[hsl(var(--destructive))]"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setDeleteTarget(e);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ConfirmModal
        open={deleteTarget !== null}
        title={t("knowledgeBases.entityDeleteTitle")}
        message={t("knowledgeBases.entityDeleteMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        pending={deleteMutation.isPending}
        destructive
      />

      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {previewTarget.displayName}
                </div>
                <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                  {previewTarget.name} · {previewTarget.type} ·{" "}
                  {previewTarget.mentionCount} mentions
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewTarget(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {detailLoading ? (
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
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
