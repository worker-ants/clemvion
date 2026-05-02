"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type GraphRelation,
} from "@/lib/api/knowledge-bases";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Loader2, Trash2, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

interface RelationListProps {
  kbId: string;
}

export function RelationList({ kbId }: RelationListProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GraphRelation | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kb-relations", kbId, page, search],
    queryFn: async () => {
      const body = await knowledgeBasesApi.getRelations(kbId, {
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
      });
      return normalizePagedResponse<GraphRelation>(body, page);
    },
    placeholderData: (prev) => prev,
  });
  const relations = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (relationId: string) =>
      knowledgeBasesApi.deleteRelation(kbId, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-relations", kbId] });
      queryClient.invalidateQueries({ queryKey: ["kb-graph-stats", kbId] });
      toast.success(t("knowledgeBases.relationDeleted"));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("knowledgeBases.relationDeleteFailed")),
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("knowledgeBases.relationSearchPlaceholder")}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : relations.length === 0 ? (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.relationEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t("knowledgeBases.relationHead")}
                </th>
                <th className="px-4 py-3 text-center font-medium">
                  {t("knowledgeBases.relationPredicate")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("knowledgeBases.relationTail")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("knowledgeBases.relationWeight")}
                </th>
                <th className="w-24 px-4 py-3 text-right font-medium">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {relations.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.headEntity?.displayName ?? "—"}
                    </div>
                    <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {r.headEntity?.type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 font-mono text-xs text-[hsl(var(--primary))]">
                      <ArrowRight className="h-3 w-3" />
                      {r.predicate}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.tailEntity?.displayName ?? "—"}
                    </div>
                    <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {r.tailEntity?.type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.weight}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[hsl(var(--destructive))]"
                      onClick={() => setDeleteTarget(r)}
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
        title={t("knowledgeBases.relationDeleteTitle")}
        message={t("knowledgeBases.relationDeleteMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        pending={deleteMutation.isPending}
        destructive
      />
    </div>
  );
}
