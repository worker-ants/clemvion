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
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Loader2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { EntityDetailDialog } from "@/components/knowledge-base/entity-detail-dialog";

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
        <NativeSelect
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as EntityType | "");
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">{t("knowledgeBases.entityAllTypes")}</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </NativeSelect>
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

      <EntityDetailDialog
        kbId={kbId}
        entity={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
}
