"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  knowledgeBasesApi,
  type RagMode,
} from "@/lib/api/knowledge-bases";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KbFormBody,
  type KbFormTab,
} from "@/components/knowledge-base/kb-form-body";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

interface CreateKbFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKbFormDialog({
  open,
  onOpenChange,
}: CreateKbFormDialogProps) {
  const t = useT();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<KbFormTab>("basic");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmbeddingModel, setFormEmbeddingModel] = useState(
    "text-embedding-3-small",
  );
  const [formEmbeddingLlmConfigId, setFormEmbeddingLlmConfigId] = useState("");
  const [formChunkSize, setFormChunkSize] = useState("1000");
  const [formChunkOverlap, setFormChunkOverlap] = useState("200");
  const [formRagMode, setFormRagMode] = useState<RagMode>("vector");
  const [formExtractionLlmConfigId, setFormExtractionLlmConfigId] =
    useState("");
  const [formMaxHops, setFormMaxHops] = useState("1");
  const [formVectorSeedTopK, setFormVectorSeedTopK] = useState("5");
  const [formExpandedChunkLimit, setFormExpandedChunkLimit] = useState("15");

  // 임베딩 LLMConfig select 가 vector 모드에서도 보여야 하므로 dialog 가 열려 있는 동안
  // 항상 fetch. graph 모드의 extraction LLM select 도 같은 데이터를 공유한다.
  const { data: llmConfigsRes } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
    enabled: open,
  });
  const llmConfigs: LlmConfigData[] = (() => {
    const raw = (llmConfigsRes as { data?: LlmConfigData[] } | undefined)?.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(llmConfigsRes)
      ? (llmConfigsRes as LlmConfigData[])
      : [];
  })();

  function resetForm() {
    setActiveTab("basic");
    setFormName("");
    setFormDescription("");
    setFormEmbeddingModel("text-embedding-3-small");
    setFormEmbeddingLlmConfigId("");
    setFormChunkSize("1000");
    setFormChunkOverlap("200");
    setFormRagMode("vector");
    setFormExtractionLlmConfigId("");
    setFormMaxHops("1");
    setFormVectorSeedTopK("5");
    setFormExpandedChunkLimit("15");
  }

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeBasesApi.create({
        name: formName,
        description: formDescription || undefined,
        embeddingModel: formEmbeddingModel,
        embeddingLlmConfigId: formEmbeddingLlmConfigId || undefined,
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
      onOpenChange(false);
    },
    onError: () => toast.error(t("knowledgeBases.collectionCreateFailed")),
  });

  function handleCreate() {
    if (!formName.trim()) {
      setActiveTab("basic");
      toast.error(t("knowledgeBases.nameRequired"));
      return;
    }
    createMutation.mutate();
  }

  function handleRagModeChange(next: RagMode) {
    setFormRagMode(next);
    // graph → vector 로 바꾸면 그래프 탭이 사라지므로 활성 탭이 graph 였을 경우 basic 으로 폴백.
    if (next !== "graph" && activeTab === "graph") setActiveTab("basic");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("knowledgeBases.newCollection")}</DialogTitle>
        </DialogHeader>
        <KbFormBody
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          ragMode={formRagMode}
          onRagModeChange={handleRagModeChange}
          formName={formName}
          setFormName={setFormName}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formEmbeddingLlmConfigId={formEmbeddingLlmConfigId}
          setFormEmbeddingLlmConfigId={setFormEmbeddingLlmConfigId}
          formEmbeddingModel={formEmbeddingModel}
          setFormEmbeddingModel={setFormEmbeddingModel}
          formChunkSize={formChunkSize}
          setFormChunkSize={setFormChunkSize}
          formChunkOverlap={formChunkOverlap}
          setFormChunkOverlap={setFormChunkOverlap}
          formExtractionLlmConfigId={formExtractionLlmConfigId}
          setFormExtractionLlmConfigId={setFormExtractionLlmConfigId}
          formMaxHops={formMaxHops}
          setFormMaxHops={setFormMaxHops}
          formVectorSeedTopK={formVectorSeedTopK}
          setFormVectorSeedTopK={setFormVectorSeedTopK}
          formExpandedChunkLimit={formExpandedChunkLimit}
          setFormExpandedChunkLimit={setFormExpandedChunkLimit}
          llmConfigs={llmConfigs}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
