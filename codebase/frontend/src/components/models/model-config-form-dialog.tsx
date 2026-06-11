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
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import { useModelConfigForm } from "./use-model-config-form";
import { needsBaseUrl } from "./validate-model-config-form";
import { PROVIDERS_BY_KIND } from "./provider-registry";

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
  // 차원은 연결 테스트(probe embed)로 자동 감지·저장된다. 저장된 설정에 차원이
  // 이미 있으면(=감지 완료) read-only 로 표시하고, 아직 감지 전(신규 생성이거나
  // 차원 미저장)일 때만 수동 입력 폴백을 허용한다. live form 값이 아니라 저장된
  // editConfig 기준으로 판정해야 생성 모드에서 첫 입력에 필드가 잠기지 않는다.
  const dimensionAutoDetected =
    showDimension && editConfig?.dimension != null;
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
            <NativeSelect
              value={form.provider}
              onChange={(e) => form.setProvider(e.target.value)}
            >
              <option value="">{t("models.selectProvider")}</option>
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
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
                readOnly={dimensionAutoDetected}
                aria-readonly={dimensionAutoDetected}
                className={
                  dimensionAutoDetected
                    ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    : undefined
                }
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {dimensionAutoDetected
                  ? t("models.dimensionAutoHint")
                  : t("models.dimensionManualHint")}
              </p>
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
          <Button
            onClick={form.handleSave}
            disabled={form.isPending || !form.model.trim()}
          >
            {form.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.editId ? t("models.updateBtn") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
