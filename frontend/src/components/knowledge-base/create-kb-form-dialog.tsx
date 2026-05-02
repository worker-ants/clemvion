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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
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

  const { data: llmConfigsRes } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
    enabled: open && formRagMode === "graph",
  });
  const llmConfigs: LlmConfigData[] = (() => {
    const raw = (llmConfigsRes as { data?: LlmConfigData[] } | undefined)?.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(llmConfigsRes)
      ? (llmConfigsRes as LlmConfigData[])
      : [];
  })();

  function resetForm() {
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
      onOpenChange(false);
    },
    onError: () => toast.error(t("knowledgeBases.collectionCreateFailed")),
  });

  function handleCreate() {
    if (!formName.trim()) {
      toast.error(t("knowledgeBases.nameRequired"));
      return;
    }
    createMutation.mutate();
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
            <NativeSelect
              value={formRagMode}
              onChange={(e) => setFormRagMode(e.target.value as RagMode)}
            >
              <option value="vector">
                {t("knowledgeBases.ragModeVector")}
              </option>
              <option value="graph">
                {t("knowledgeBases.ragModeGraph")}
              </option>
            </NativeSelect>
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
                <NativeSelect
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
                </NativeSelect>
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
                      onChange={(e) => setFormVectorSeedTopK(e.target.value)}
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
        </div>
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
