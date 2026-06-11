"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  modelConfigsApi,
  type ModelConfigData,
  type ModelConfigKind,
} from "@/lib/api/model-configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModelCombobox } from "@/components/llm-config/model-combobox";
import { useT } from "@/lib/i18n";
import { useModelConfigForm } from "./use-model-config-form";
import { needsBaseUrl } from "./validate-model-config-form";

const PROVIDERS_BY_KIND: Record<
  ModelConfigKind,
  { value: string; label: string }[]
> = {
  chat: [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google AI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "local", label: "Local (Ollama/vLLM)" },
  ],
  embedding: [
    { value: "openai", label: "OpenAI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "google", label: "Google AI" },
    { value: "local", label: "Local (Ollama/vLLM/TEI)" },
  ],
  rerank: [
    { value: "tei", label: "TEI (self-hosted)" },
    { value: "cohere", label: "Cohere" },
  ],
};

interface ModelConfigFormDialogProps {
  kind: ModelConfigKind;
  /** 편집 대상 config (null = 신규 생성). */
  editConfig: ModelConfigData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ModelConfig 생성/편집 폼을 focus-trap 되는 shadcn Dialog 안에서 렌더한다.
 * 폼 상태·mutation 은 useModelConfigForm 이 소유. 성공 시 onOpenChange(false).
 */
export function ModelConfigFormDialog({
  kind,
  editConfig,
  open,
  onOpenChange,
}: ModelConfigFormDialogProps) {
  const t = useT();
  const form = useModelConfigForm({
    kind,
    editConfig,
    onClose: () => onOpenChange(false),
  });

  const { openFor } = form;
  // dialog 가 열릴 때 editConfig 기준으로 폼을 시드한다 (신규: 빈 폼).
  useEffect(() => {
    if (open) openFor(editConfig);
    // openFor 는 stable closure 가 아니므로 deps 에서 제외 — open/editConfig 전이로만 시드.
  }, [open, editConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const showParams = kind === "chat";
  const showDimension = kind === "embedding";
  // rerank: API Key 는 cohere 만 필수. tei(self-hosted) 는 불필요.
  const showApiKey = kind !== "rerank" || form.provider === "cohere";
  const freeInputModel = kind === "rerank";
  const providers = PROVIDERS_BY_KIND[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {form.editId ? t("models.editModel") : t("models.addModel")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("models.provider")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              value={form.provider}
              onChange={(e) => form.setProvider(e.target.value)}
            >
              <option value="">{t("models.selectProvider")}</option>
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("common.name")}</Label>
            <Input
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder={t("models.namePlaceholder")}
            />
          </div>
          {showApiKey && (
            <div>
              <Label>{t("models.apiKey")}</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => form.setApiKey(e.target.value)}
                placeholder={
                  form.editId
                    ? t("models.apiKeyPlaceholderEdit")
                    : t("models.apiKeyPlaceholderNew")
                }
              />
            </div>
          )}
          {needsBaseUrl(form.provider) && (
            <div>
              <Label>{t("models.baseUrl")}</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => form.setBaseUrl(e.target.value)}
                placeholder={t("models.baseUrlPlaceholder")}
              />
            </div>
          )}
          <div>
            <Label>{t("models.defaultModel")}</Label>
            {freeInputModel ? (
              <Input
                value={form.model}
                onChange={(e) => form.setModel(e.target.value)}
                placeholder={t("models.rerankModelPlaceholder")}
              />
            ) : (
              <ModelCombobox
                value={form.model}
                onChange={form.setModel}
                provider={form.provider}
                apiKey={form.apiKey}
                baseUrl={form.baseUrl}
                configId={form.editId ?? undefined}
                api={modelConfigsApi}
                modelType={kind === "embedding" ? "embedding" : "chat"}
                placeholder={t("models.modelPlaceholder")}
              />
            )}
          </div>
          {showDimension && (
            <div>
              <Label>{t("models.dimension")}</Label>
              <Input
                type="number"
                min="1"
                value={form.dimension}
                onChange={(e) => form.setDimension(e.target.value)}
                placeholder={t("models.dimensionPlaceholder")}
              />
            </div>
          )}
          {showParams && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("models.temperature")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={form.temperature}
                  onChange={(e) => form.setTemperature(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("models.maxTokens")}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxTokens}
                  onChange={(e) => form.setMaxTokens(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={form.handleSave} disabled={form.isPending}>
            {form.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.editId ? t("models.updateBtn") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
