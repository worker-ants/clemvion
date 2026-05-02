"use client";

import { useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type KnowledgeBaseData,
  type DocumentData,
  type KbGraphStats,
} from "@/lib/api/knowledge-bases";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
import { RoleGate } from "@/components/auth/role-gate";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Trash2,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  X,
} from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; labelKey: TranslationKey; variant: "success" | "warning" | "destructive" | "outline" }
> = {
  completed: {
    icon: <CheckCircle className="h-3 w-3" />,
    labelKey: "knowledgeBases.statusReady",
    variant: "success",
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    labelKey: "knowledgeBases.statusProcessing",
    variant: "warning",
  },
  pending: {
    icon: <Clock className="h-3 w-3" />,
    labelKey: "knowledgeBases.statusPending",
    variant: "outline",
  },
  error: {
    icon: <XCircle className="h-3 w-3" />,
    labelKey: "knowledgeBases.statusError",
    variant: "destructive",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKbReEmbedConfirm, setShowKbReEmbedConfirm] = useState(false);
  const [showKbReExtractConfirm, setShowKbReExtractConfirm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmbeddingModel, setFormEmbeddingModel] = useState("");
  const [formChunkSize, setFormChunkSize] = useState("1000");
  const [formChunkOverlap, setFormChunkOverlap] = useState("200");

  const { data: kb, isLoading: kbLoading } = useQuery<KnowledgeBaseData>({
    queryKey: ["knowledge-base", id],
    queryFn: async () => {
      const res = await knowledgeBasesApi.getById(id);
      return res.data ?? res;
    },
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["kb-documents", id],
    queryFn: () => knowledgeBasesApi.getDocuments(id),
  });
  const documents: DocumentData[] = docsData?.data ?? docsData ?? [];

  // graph 모드 KB 의 추출 진행 상태 / 통계. 5초 polling 으로 추출 진행을 따라간다.
  // 추출이 끝나면 reextractStatus 가 idle 로 떨어지므로 사용자 액션 시점 외 polling 필요 없음.
  const isGraphMode = kb?.ragMode === "graph";
  const { data: graphStats } = useQuery<KbGraphStats>({
    queryKey: ["kb-graph-stats", id],
    queryFn: () => knowledgeBasesApi.getGraphStats(id),
    enabled: isGraphMode,
    refetchInterval: (query) => {
      const data = query.state.data as KbGraphStats | undefined;
      if (!data) return 5_000;
      // 추출 진행 중이거나 일부 문서가 아직 처리 중이면 짧은 간격, 아니면 1분.
      const stillProcessing =
        data.reextractStatus === "in_progress" ||
        data.extractedDocumentCount < data.totalDocumentCount;
      return stillProcessing ? 5_000 : 60_000;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeBasesApi.uploadDocument(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", id] });
      // The KB list shows `documentCount` per collection — keep it fresh.
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success(t("knowledgeBases.documentUploaded"));
    },
    onError: () => toast.error(t("knowledgeBases.uploadFailedShort")),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => knowledgeBasesApi.removeDocument(id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success(t("knowledgeBases.documentDeleted"));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("knowledgeBases.documentDeleteFailed")),
  });

  const reEmbedMutation = useMutation({
    mutationFn: (docId: string) => knowledgeBasesApi.reEmbed(id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents", id] });
      toast.success(t("knowledgeBases.reembedStarted"));
    },
    onError: () => toast.error(t("knowledgeBases.reembedFailed")),
  });

  type KbUpdatePayload = {
    name?: string;
    description?: string;
    embeddingModel?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  };
  const updateMutation = useMutation({
    mutationFn: (payload: KbUpdatePayload) =>
      knowledgeBasesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success(t("knowledgeBases.updated"));
      setShowSettings(false);
    },
    onError: () => toast.error(t("knowledgeBases.updateFailed")),
  });

  const kbReEmbedMutation = useMutation({
    mutationFn: () => knowledgeBasesApi.reEmbedAll(id),
    onSuccess: ({ documentCount }) => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", id] });
      toast.success(
        t("knowledgeBases.kbReembedStarted", { count: documentCount }),
      );
      setShowKbReEmbedConfirm(false);
    },
    onError: () => toast.error(t("knowledgeBases.kbReembedFailed")),
  });

  const kbReExtractMutation = useMutation({
    mutationFn: () => knowledgeBasesApi.reExtractAll(id),
    onSuccess: ({ documentCount }) => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents", id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", id] });
      queryClient.invalidateQueries({ queryKey: ["kb-graph-stats", id] });
      toast.success(
        t("knowledgeBases.kbReExtractStarted", { count: documentCount }),
      );
      setShowKbReExtractConfirm(false);
    },
    onError: () => toast.error(t("knowledgeBases.kbReExtractFailed")),
  });

  function openSettings() {
    if (!kb) return;
    setFormName(kb.name);
    setFormDescription(kb.description ?? "");
    setFormEmbeddingModel(kb.embeddingModel);
    setFormChunkSize(String(kb.chunkSize));
    setFormChunkOverlap(String(kb.chunkOverlap));
    setShowSettings(true);
  }

  function handleSaveSettings() {
    if (!kb) return;
    if (!formName.trim()) {
      toast.error(t("knowledgeBases.nameRequired"));
      return;
    }
    const cs = parseInt(formChunkSize, 10);
    if (Number.isNaN(cs) || cs < 100 || cs > 8000) {
      toast.error(t("knowledgeBases.chunkSizeInvalid"));
      return;
    }
    const co = parseInt(formChunkOverlap, 10);
    if (Number.isNaN(co) || co < 0 || co > 2000) {
      toast.error(t("knowledgeBases.chunkOverlapInvalid"));
      return;
    }
    const payload: KbUpdatePayload = {};
    if (formName !== kb.name) payload.name = formName;
    if ((formDescription ?? "") !== (kb.description ?? "")) {
      payload.description = formDescription;
    }
    if (formEmbeddingModel !== kb.embeddingModel) {
      payload.embeddingModel = formEmbeddingModel;
    }
    if (cs !== kb.chunkSize) payload.chunkSize = cs;
    if (co !== kb.chunkOverlap) payload.chunkOverlap = co;
    if (Object.keys(payload).length === 0) {
      setShowSettings(false);
      return;
    }
    updateMutation.mutate(payload);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      uploadMutation.mutate(files[i]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  if (kbLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/knowledge-bases")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{kb?.name}</h1>
            {kb?.description && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {kb.description}
              </p>
            )}
          </div>
        </div>
        <RoleGate minRole="editor">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKbReEmbedConfirm(true)}
              disabled={kbReEmbedMutation.isPending}
            >
              {kbReEmbedMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("knowledgeBases.kbReembedAll")}
            </Button>
            {isGraphMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKbReExtractConfirm(true)}
                disabled={kbReExtractMutation.isPending}
              >
                {kbReExtractMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("knowledgeBases.kbReExtractAll")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openSettings}>
              <Settings className="mr-2 h-4 w-4" />
              {t("knowledgeBases.settingsTitle")}
            </Button>
          </div>
        </RoleGate>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs ${
            isGraphMode
              ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          }`}
        >
          {isGraphMode
            ? t("knowledgeBases.graphBadge")
            : t("knowledgeBases.vectorBadge")}
        </span>
        <span>
          {t("knowledgeBases.model")}: <code className="font-mono">{kb?.embeddingModel}</code>
        </span>
        {kb?.embeddingDimension != null && (
          <span>
            {t("knowledgeBases.embeddingDimension")}: {kb.embeddingDimension}
          </span>
        )}
        <span>{t("knowledgeBases.chunk")}: {kb?.chunkSize} / {t("knowledgeBases.overlap")}: {kb?.chunkOverlap}</span>
        <span>{t("knowledgeBases.documentsCount", { count: kb?.documentCount ?? 0 })}</span>
      </div>

      {isGraphMode && graphStats && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4">
          <div className="mb-2 text-sm font-medium">
            {t("knowledgeBases.graphBuildStatus")}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              {graphStats.extractedDocumentCount ===
              graphStats.totalDocumentCount ? (
                <CheckCircle className="h-4 w-4 text-[hsl(var(--success,142_71%_45%))]" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
              )}
              {t("knowledgeBases.graphExtractedDocs", {
                count: graphStats.extractedDocumentCount,
              })}{" "}
              / {graphStats.totalDocumentCount}
            </span>
            <span className="font-mono">
              {graphStats.entityCount} {t("knowledgeBases.graphEntities")} ·{" "}
              {graphStats.relationCount} {t("knowledgeBases.graphRelations")}
            </span>
            {graphStats.reextractStatus === "in_progress" && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("knowledgeBases.statusProcessing")}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
            : "border-[hsl(var(--border))]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="mb-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.dragDropHere")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("knowledgeBases.browseFiles")}
        </Button>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.supportedTypes")}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.csv"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {showSettings && kb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("knowledgeBases.settingsTitle")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>{t("knowledgeBases.name")}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("common.description")}</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("knowledgeBases.embeddingModel")}</Label>
                <EmbeddingModelCombobox
                  value={formEmbeddingModel}
                  onChange={setFormEmbeddingModel}
                  placeholder="text-embedding-3-small"
                />
                {formEmbeddingModel !== kb.embeddingModel && (
                  <p className="mt-1 text-xs text-[hsl(var(--warning,38_92%_50%))]">
                    {t("knowledgeBases.modelChangedNeedsReembed")}
                  </p>
                )}
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
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("knowledgeBases.settingsSave")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showKbReEmbedConfirm}
        title={t("knowledgeBases.kbReembedConfirmTitle")}
        message={t("knowledgeBases.kbReembedConfirmMessage")}
        confirmLabel={t("knowledgeBases.kbReembedAll")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setShowKbReEmbedConfirm(false)}
        onConfirm={() => kbReEmbedMutation.mutate()}
        pending={kbReEmbedMutation.isPending}
      />

      <ConfirmModal
        open={showKbReExtractConfirm}
        title={t("knowledgeBases.kbReExtractConfirmTitle")}
        message={t("knowledgeBases.kbReExtractConfirmMessage")}
        confirmLabel={t("knowledgeBases.kbReExtractAll")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setShowKbReExtractConfirm(false)}
        onConfirm={() => kbReExtractMutation.mutate()}
        pending={kbReExtractMutation.isPending}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title={t("knowledgeBases.documentDeleteTitle")}
        message={t("knowledgeBases.documentDeleteMessageFull")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget)
        }
        pending={deleteMutation.isPending}
        destructive
      />

      {docsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {!docsLoading && documents.length === 0 && (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.noDocumentsHint")}
        </p>
      )}

      {!docsLoading && documents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("knowledgeBases.columnSize")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("knowledgeBases.columnChunks")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {documents.map((doc) => {
                const status = STATUS_CONFIG[doc.embeddingStatus] ?? STATUS_CONFIG.pending;
                return (
                  <tr key={doc.id}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        {doc.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 uppercase text-xs font-mono">
                      {doc.fileType}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>
                        <span className="mr-1">{status.icon}</span>
                        {t(status.labelKey)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{doc.chunkCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={t("knowledgeBases.reembedTooltip")}
                          disabled={reEmbedMutation.isPending}
                          onClick={() => reEmbedMutation.mutate(doc.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[hsl(var(--destructive))]"
                          onClick={() => setDeleteTarget(doc.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
