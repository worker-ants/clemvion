"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  knowledgeBasesApi,
  type RagMode,
  type RerankMode,
} from "@/lib/api/knowledge-bases";
import { llmConfigsApi } from "@/lib/api/llm-configs";
import { modelConfigsApi } from "@/lib/api/model-configs";
import { rerankConfigsApi } from "@/lib/api/rerank-configs";
import { useDefaultEmbeddingModelConfigId } from "@/components/llm-config/use-default-embedding-model-config-id";
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
  // 임베딩 1급 config 선택값. `null` = 사용자가 아직 손대지 않음 → ws default config 를
  // preselect 로 표시. `""` = 사용자가 명시적으로 "워크스페이스 기본값"을 고름. setState-in-effect
  // 없이 render 시점 파생값(effectiveEmbeddingModelConfigId)으로 default 를 반영한다.
  const defaultEmbeddingConfigId = useDefaultEmbeddingModelConfigId();
  const [embeddingModelConfigIdOverride, setEmbeddingModelConfigIdOverride] =
    useState<string | null>(null);
  const effectiveEmbeddingModelConfigId =
    embeddingModelConfigIdOverride ?? defaultEmbeddingConfigId ?? "";
  const [formChunkSize, setFormChunkSize] = useState("1000");
  const [formChunkOverlap, setFormChunkOverlap] = useState("200");
  const [formRagMode, setFormRagMode] = useState<RagMode>("vector");
  const [formExtractionLlmConfigId, setFormExtractionLlmConfigId] =
    useState("");
  const [formMaxHops, setFormMaxHops] = useState("1");
  const [formVectorSeedTopK, setFormVectorSeedTopK] = useState("5");
  const [formExpandedChunkLimit, setFormExpandedChunkLimit] = useState("15");
  const [formRerankMode, setFormRerankMode] = useState<RerankMode>("off");
  const [formRerankConfigId, setFormRerankConfigId] = useState("");
  const [formRerankCandidateK, setFormRerankCandidateK] = useState("50");
  const [formRerankScoreThreshold, setFormRerankScoreThreshold] = useState("");
  const [formRerankLlmConfigId, setFormRerankLlmConfigId] = useState("");

  // 임베딩 LLMConfig select 가 vector 모드에서도 보여야 하므로 dialog 가 열려 있는 동안
  // 항상 fetch. graph 모드의 extraction LLM select 도 같은 데이터를 공유한다.
  const { data: llmConfigs = [] } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.list(),
    staleTime: 30_000,
    enabled: open,
  });

  // 리랭킹 섹션의 리랭커 select 용. dialog 가 열려 있는 동안 fetch.
  const { data: rerankConfigs = [] } = useQuery({
    queryKey: ["rerank-configs"],
    queryFn: () => rerankConfigsApi.list(),
    staleTime: 30_000,
    enabled: open,
  });

  // 임베딩 1급 select 용 kind=embedding ModelConfig 목록. dialog 가 열려 있는 동안 fetch.
  // useDefaultEmbeddingModelConfigId 와 동일 query key 를 공유해 1회만 fetch.
  const { data: embeddingModelConfigs = [] } = useQuery({
    queryKey: ["model-configs", "embedding", "list"],
    queryFn: () => modelConfigsApi.list("embedding"),
    staleTime: 30_000,
    enabled: open,
  });

  function resetForm() {
    setActiveTab("basic");
    setFormName("");
    setFormDescription("");
    setEmbeddingModelConfigIdOverride(null);
    setFormChunkSize("1000");
    setFormChunkOverlap("200");
    setFormRagMode("vector");
    setFormExtractionLlmConfigId("");
    setFormMaxHops("1");
    setFormVectorSeedTopK("5");
    setFormExpandedChunkLimit("15");
    setFormRerankMode("off");
    setFormRerankConfigId("");
    setFormRerankCandidateK("50");
    setFormRerankScoreThreshold("");
    setFormRerankLlmConfigId("");
  }

  const createMutation = useMutation({
    mutationFn: () => {
      // 1급 경로: config 선택 시 그 config 의 defaultModel 을 embeddingModel 로 함께
      // 보내 KB-card 표시값을 일치시킨다. 미선택("") 시 임베딩 필드를 모두 생략해
      // 백엔드 ws-default 폴백에 맡긴다.
      const selectedEmbeddingConfig = effectiveEmbeddingModelConfigId
        ? embeddingModelConfigs.find(
            (c) => c.id === effectiveEmbeddingModelConfigId,
          )
        : undefined;
      return knowledgeBasesApi.create({
        name: formName,
        description: formDescription || undefined,
        ...(effectiveEmbeddingModelConfigId
          ? {
              embeddingModelConfigId: effectiveEmbeddingModelConfigId,
              ...(selectedEmbeddingConfig
                ? { embeddingModel: selectedEmbeddingConfig.defaultModel }
                : {}),
            }
          : {}),
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
        rerankMode: formRerankMode,
        ...(formRerankMode !== "off"
          ? {
              rerankConfigId: formRerankConfigId || undefined,
              rerankCandidateK: parseInt(formRerankCandidateK) || 50,
              ...(formRerankScoreThreshold.trim()
                ? { rerankScoreThreshold: parseFloat(formRerankScoreThreshold) }
                : {}),
              ...(formRerankMode === "cross_encoder_llm" &&
              formRerankLlmConfigId
                ? { rerankLlmConfigId: formRerankLlmConfigId }
                : {}),
            }
          : {}),
      });
    },
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
    if (formRerankMode !== "off") {
      const ck = parseInt(formRerankCandidateK, 10);
      if (Number.isNaN(ck) || ck < 1 || ck > 200) {
        setActiveTab("rerank");
        toast.error(t("knowledgeBases.rerankCandidateKInvalid"));
        return;
      }
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
          formEmbeddingModelConfigId={effectiveEmbeddingModelConfigId}
          setFormEmbeddingModelConfigId={setEmbeddingModelConfigIdOverride}
          embeddingModelConfigs={embeddingModelConfigs}
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
          formRerankMode={formRerankMode}
          setFormRerankMode={setFormRerankMode}
          formRerankConfigId={formRerankConfigId}
          setFormRerankConfigId={setFormRerankConfigId}
          formRerankCandidateK={formRerankCandidateK}
          setFormRerankCandidateK={setFormRerankCandidateK}
          formRerankScoreThreshold={formRerankScoreThreshold}
          setFormRerankScoreThreshold={setFormRerankScoreThreshold}
          formRerankLlmConfigId={formRerankLlmConfigId}
          setFormRerankLlmConfigId={setFormRerankLlmConfigId}
          rerankConfigs={rerankConfigs}
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
