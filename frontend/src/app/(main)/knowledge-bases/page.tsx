"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type KnowledgeBaseData,
} from "@/lib/api/knowledge-bases";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { CreateKbFormDialog } from "@/components/knowledge-base/create-kb-form-dialog";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, BookOpen, FileText } from "lucide-react";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

export default function KnowledgeBasesPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { page, setPage } = usePageParam();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-bases", page],
    queryFn: async () => {
      const body = await knowledgeBasesApi.getAll({ page, limit: PAGE_SIZE });
      return normalizePagedResponse<KnowledgeBaseData>(body, page);
    },
    placeholderData: (prev) => prev,
  });
  const collections: KnowledgeBaseData[] = data?.items ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeBasesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success(t("knowledgeBases.collectionDeleted"));
      setDeleteTarget(null);
      if (collections.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: () => toast.error(t("knowledgeBases.collectionDeleteFailed")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("sidebar.knowledgeBase")}</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("knowledgeBases.newCollection")}
          </Button>
        </RoleGate>
      </div>

      <CreateKbFormDialog open={showDialog} onOpenChange={setShowDialog} />

      <ConfirmModal
        open={deleteTarget !== null}
        title={t("knowledgeBases.deleteTitle")}
        message={t("knowledgeBases.deleteMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget)
        }
        pending={deleteMutation.isPending}
        destructive
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("knowledgeBases.loadFailed")}
        </p>
      )}
      {!isLoading && !isError && collections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("knowledgeBases.noCollections")}</p>
        </div>
      )}
      {!isLoading && !isError && collections.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((kb) => (
              <div
                key={kb.id}
                className="cursor-pointer rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--muted)/0.3)]"
                onClick={() => router.push(`/knowledge-bases/${kb.id}`)}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <h3 className="font-semibold">{kb.name}</h3>
                  </div>
                  <RoleGate minRole="editor">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[hsl(var(--destructive))]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(kb.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </RoleGate>
                </div>
                {kb.description && (
                  <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {kb.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      kb.ragMode === "graph"
                        ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {kb.ragMode === "graph"
                      ? t("knowledgeBases.graphBadge")
                      : t("knowledgeBases.vectorBadge")}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {t("knowledgeBases.docsCount", { count: kb.documentCount })}
                  </span>
                  <span className="font-mono">{kb.embeddingModel}</span>
                  {kb.embeddingDimension != null && (
                    <span className="font-mono">
                      {kb.embeddingDimension}d
                    </span>
                  )}
                  {kb.ragMode === "graph" && (
                    <span className="font-mono">
                      {kb.entityCount}E · {kb.relationCount}R
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
