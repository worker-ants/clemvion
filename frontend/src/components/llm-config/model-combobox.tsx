"use client";

import { useId, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const datalistId = useId();

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

  const isEmpty = !errorMessage && isSuccess && chatModels.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          list={datalistId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-autocomplete="list"
        />
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
      <datalist id={datalistId}>
        {chatModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name && m.name !== m.id ? m.name : undefined}
          </option>
        ))}
      </datalist>
      {errorMessage ? (
        <p className="text-xs text-[hsl(var(--destructive))]">{errorMessage}</p>
      ) : isEmpty ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.noModelsFound")}
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.loadModelsHint")}
        </p>
      )}
    </div>
  );
}
