"use client";

import { useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import { useModelLoader } from "./use-model-loader";

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

  const { models, errorMessage, isPending, isSuccess, canLoad, load } =
    useModelLoader({
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

  const hasLoadedModels = chatModels.length > 0;
  const isEmpty = !errorMessage && isSuccess && chatModels.length === 0;
  // 편집 흐름: 저장된 모델 ID 가 새로 불러온 목록에 없을 때 placeholder option 으로 유지.
  // 사용자가 명시적으로 다른 option 을 고르기 전까지는 저장값이 변경되지 않도록 보존.
  const savedValueMissingFromLoaded =
    value !== "" && !chatModels.some((m) => m.id === value);
  const selectDisabled = disabled || !hasLoadedModels;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <NativeSelect
          data-testid="model-combobox-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={selectDisabled}
        >
          {!value && (
            <option value="" disabled>
              {placeholder ?? t("llmConfigs.modelPlaceholder")}
            </option>
          )}
          {savedValueMissingFromLoaded && (
            <option value={value}>
              {t("llmConfigs.modelSavedFallback", { model: value })}
            </option>
          )}
          {chatModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          onClick={load}
          disabled={disabled || !canLoad || isPending}
          aria-label={t("llmConfigs.loadModels")}
          data-testid="model-combobox-load"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">
            {isPending
              ? t("llmConfigs.loadingModels")
              : t("llmConfigs.loadModels")}
          </span>
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-xs text-[hsl(var(--destructive))]">{errorMessage}</p>
      ) : isEmpty ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.noModelsFound")}
        </p>
      ) : !hasLoadedModels ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.modelLoadRequired")}
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.loadModelsHint")}
        </p>
      )}
    </div>
  );
}
