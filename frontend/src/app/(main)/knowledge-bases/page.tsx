"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type KnowledgeBaseData,
  type RagMode,
} from "@/lib/api/knowledge-bases";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  BookOpen,
  FileText,
} from "lucide-react";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

export default function KnowledgeBasesPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { page, setPage } = usePageParam();

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmbeddingModel, setFormEmbeddingModel] = useState(
    "text-embedding-3-small",
  );
  const [formChunkSize, setFormChunkSize] = useState("1000");
  const [formChunkOverlap, setFormChunkOverlap] = useState("200");
  const [formRagMode, setFormRagMode] = useState<RagMode>("vector");
  const [formExtractionLlmConfigId, setFormExtractionLlmConfigId] =
    useState("");
  const [formMaxHops, setFormMaxHops] = useState("1");
  const [formVectorSeedTopK, setFormVectorSeedTopK] = useState("5");
  const [formExpandedChunkLimit, setFormExpandedChunkLimit] = useState("15");

  // graph 모드 일 때 추출 LLMConfig 셀렉트용. 평소에는 가져오지 않다가 폼 열릴 때 캐시.
  const { data: llmConfigsRes } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
    enabled: showDialog && formRagMode === "graph",
  });
  const llmConfigs: LlmConfigData[] = (() => {
    const raw = (llmConfigsRes as { data?: LlmConfigData[] } | undefined)?.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(llmConfigsRes)
      ? (llmConfigsRes as LlmConfigData[])
      : [];
  })();

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

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeBasesApi.create({
        name: formName,
        description: formDescription || undefined,
        embeddingModel: formEmbeddingModel,
        chunkSize: parseInt(formChunkSize) || 1000,
        chunkOverlap: parseInt(formChunkOverlap) || 200,
        ragMode: formRagMode,
        ...(formRagMode === "graph"
          ? {
              extractionLlmConfigId: formExtractionLlmConfigId || undefined,
              maxHops: parseInt(formMaxHops) || 1,
              vectorSeedTopK: parseInt(formVectorSeedTopK) || 5,
              expandedChunkLimit: parseInt(formExpandedChunkLimit) || 15,
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success(t("knowledgeBases.collectionCreated"));
      resetForm();
    },
    onError: () => toast.error(t("knowledgeBases.collectionCreateFailed")),
  });

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

  function resetForm() {
    setShowDialog(false);
    setFormName("");
    setFormDescription("");
    setFormEmbeddingModel("text-embedding-3-small");
    setFormChunkSize("1000");
    setFormChunkOverlap("200");
    setFormRagMode("vector");
    setFormExtractionLlmConfigId("");
    setFormMaxHops("1");
    setFormVectorSeedTopK("5");
    setFormExpandedChunkLimit("15");
  }

  function handleCreate() {
    if (!formName.trim()) {
      toast.error(t("knowledgeBases.nameRequired"));
      return;
    }
    createMutation.mutate();
  }

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

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("knowledgeBases.newCollection")}</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>{t("knowledgeBases.name")}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("knowledgeBases.createPlaceholder")}
                />
              </div>
              <div>
                <Label>{t("common.description")}</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("knowledgeBases.descriptionPlaceholderOptional")}
                />
              </div>
              <div>
                <Label>{t("knowledgeBases.ragMode")}</Label>
                <select
                  className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  value={formRagMode}
                  onChange={(e) =>
                    setFormRagMode(e.target.value as RagMode)
                  }
                >
                  <option value="vector">
                    {t("knowledgeBases.ragModeVector")}
                  </option>
                  <option value="graph">
                    {t("knowledgeBases.ragModeGraph")}
                  </option>
                </select>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("knowledgeBases.ragModeHint")}
                </p>
              </div>
              <div>
                <Label>{t("knowledgeBases.embeddingModel")}</Label>
                <EmbeddingModelCombobox
                  value={formEmbeddingModel}
                  onChange={setFormEmbeddingModel}
                  placeholder="text-embedding-3-small"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("knowledgeBases.chunkSize")}</Label>
                  <Input
                    type="number"
                    min="100"
                    max="8000"
                    value={formChunkSize}
                    onChange={(e) => setFormChunkSize(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("knowledgeBases.chunkOverlap")}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="2000"
                    value={formChunkOverlap}
                    onChange={(e) => setFormChunkOverlap(e.target.value)}
                  />
                </div>
              </div>
              {formRagMode === "graph" && (
                <>
                  <div>
                    <Label>{t("knowledgeBases.extractionLlm")}</Label>
                    <select
                      className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      value={formExtractionLlmConfigId}
                      onChange={(e) =>
                        setFormExtractionLlmConfigId(e.target.value)
                      }
                    >
                      <option value="">
                        {t("nodeConfigs.llmConfigSelector.defaultOption")}
                      </option>
                      {llmConfigs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.defaultModel})
                          {c.isDefault ? " *" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {t("knowledgeBases.extractionLlmHint")}
                    </p>
                  </div>
                  <div>
                    <Label>{t("knowledgeBases.graphSearchParams")}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">
                          {t("knowledgeBases.maxHops")}
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="2"
                          value={formMaxHops}
                          onChange={(e) => setFormMaxHops(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {t("knowledgeBases.vectorSeedTopK")}
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={formVectorSeedTopK}
                          onChange={(e) =>
                            setFormVectorSeedTopK(e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {t("knowledgeBases.expandedChunkLimit")}
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formExpandedChunkLimit}
                          onChange={(e) =>
                            setFormExpandedChunkLimit(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("common.create")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
