"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { useModelLoader, type ModelLoaderApi } from "./use-model-loader";
import { buildLoaderErrorMessages } from "./loader-error-messages";
import { ModelSelectField } from "./model-select-field";

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  provider: string;
  /**
   * Plain API key from the form. Empty in edit mode when the user keeps
   * the existing saved key; the loader then falls back to the saved-config
   * `:id/models` endpoint instead of the preview endpoint.
   */
  apiKey: string;
  baseUrl?: string;
  /**
   * Present in edit mode. Enables fetching via the saved config when
   * apiKey is empty. Unused when apiKey is re-entered.
   */
  configId?: string;
  /**
   * `value === ""` 일 때 select 의 disabled option 으로 노출되는 텍스트.
   */
  placeholder?: string;
  disabled?: boolean;
  /** 모델 조회 API (default llmConfigsApi). /models 통합 페이지는 modelConfigsApi 주입. */
  api?: ModelLoaderApi;
  /** 필터할 모델 타입. chat(default) / embedding. /models 임베딩 탭은 "embedding" 전달. */
  modelType?: "chat" | "embedding";
}

export function ModelCombobox({
  value,
  onChange,
  provider,
  apiKey,
  baseUrl,
  configId,
  placeholder,
  disabled,
  api,
  modelType = "chat",
}: ModelComboboxProps) {
  const t = useT();

  const errorMessagesByCode = useMemo(() => buildLoaderErrorMessages(t), [t]);

  const {
    models,
    errorMessage,
    isPending,
    hasAttemptedLoad,
    canLoad,
    load,
  } = useModelLoader({
    provider,
    apiKey,
    baseUrl,
    configId,
    fallbackErrorMessage: t("llmConfigs.loadModelsFailed"),
    errorMessagesByCode,
    api,
  });

  const filteredModels = useMemo(
    () => models.filter((m) => m.type === modelType),
    [models, modelType],
  );

  return (
    <ModelSelectField
      value={value}
      onChange={onChange}
      models={filteredModels}
      errorMessage={errorMessage}
      isPending={isPending}
      canLoad={canLoad}
      hasAttemptedLoad={hasAttemptedLoad}
      load={load}
      formatSavedFallback={(model) =>
        t("llmConfigs.modelSavedFallback", { model })
      }
      loadRequiredHint={t("llmConfigs.modelLoadRequired")}
      loadedHint={t("llmConfigs.loadModelsHint")}
      placeholder={placeholder}
      disabled={disabled}
      testIdPrefix="model-combobox"
    />
  );
}
