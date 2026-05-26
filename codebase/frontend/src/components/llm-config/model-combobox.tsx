"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { useModelLoader } from "./use-model-loader";
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
}: ModelComboboxProps) {
  const t = useT();

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
  });

  const chatModels = useMemo(
    () => models.filter((m) => m.type === "chat"),
    [models],
  );

  return (
    <ModelSelectField
      value={value}
      onChange={onChange}
      models={chatModels}
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
