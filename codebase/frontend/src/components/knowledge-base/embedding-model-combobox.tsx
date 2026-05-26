"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  llmConfigsApi,
  type LlmConfigData,
  type ModelInfo,
} from "@/lib/api/llm-configs";
import { useT } from "@/lib/i18n";

interface EmbeddingModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * 모델 목록을 가져올 LLMConfig 의 id. 미지정 시 워크스페이스 default LLMConfig 로 폴백.
   * KB 가 default 와 다른 LLMConfig 를 임베딩에 쓰고 있을 때 그 config 의 임베딩 모델 후보를
   * 보여주기 위함.
   */
  llmConfigId?: string;
}

// 지정된 LLMConfig (또는 워크스페이스 default) 의 임베딩 모델을 "모델 불러오기" 버튼 클릭
// 시점에만 조회해 NativeSelect 로 선택하게 한다. 자유 입력 fallback 은 제공하지 않는다 —
// 잘못된 모델 ID 가 저장되어 KB 임베딩이 손상되는 사례 차단 (spec/2-navigation/5-knowledge-base.md §Rationale R-1).
export function EmbeddingModelCombobox({
  value,
  onChange,
  placeholder,
  disabled,
  llmConfigId,
}: EmbeddingModelComboboxProps) {
  const t = useT();

  const { data: configsRes } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
  });
  const configs: LlmConfigData[] = useMemo(() => {
    const raw = (configsRes as { data?: LlmConfigData[] } | undefined)?.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(configsRes) ? (configsRes as LlmConfigData[]) : [];
  }, [configsRes]);
  const defaultConfigId = useMemo(
    () => configs.find((c) => c.isDefault)?.id ?? configs[0]?.id,
    [configs],
  );
  const effectiveConfigId = llmConfigId ?? defaultConfigId;

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // llmConfigId 변경 시 이전 config 의 모델 목록은 더 이상 유효하지 않으므로 reset.
  // React 권장 "reset state on prop change" 패턴.
  const [prevResetKey, setPrevResetKey] = useState(effectiveConfigId ?? "");
  const resetKey = effectiveConfigId ?? "";
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setModels([]);
    setErrorMessage(null);
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveConfigId) {
        throw new Error("missing-config-id");
      }
      const snapshot = effectiveConfigId;
      const data = await llmConfigsApi.listModels(snapshot, {
        type: "embedding",
      });
      return { data, snapshot };
    },
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: ({ data, snapshot }) => {
      // Stale closure 가드 — 응답 도착 시점에 effectiveConfigId 가 바뀌었으면 무시.
      if (snapshot !== effectiveConfigId) return;
      setModels(data);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as
          | { message?: string | string[] }
          | undefined;
        const raw = body?.message;
        const msg = Array.isArray(raw) ? raw.join(", ") : raw;
        setErrorMessage(msg || t("knowledgeBases.embeddingModelLoadFailed"));
        return;
      }
      setErrorMessage(t("knowledgeBases.embeddingModelLoadFailed"));
    },
  });

  const embeddingModels = useMemo(
    () => models.filter((m) => m.type === "embedding"),
    [models],
  );
  const hasLoadedModels = embeddingModels.length > 0;
  const isEmpty =
    !errorMessage && loadMutation.isSuccess && embeddingModels.length === 0;
  const savedValueMissingFromLoaded =
    value !== "" && !embeddingModels.some((m) => m.id === value);
  const canLoad = Boolean(effectiveConfigId);
  const selectDisabled = disabled || !hasLoadedModels;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <NativeSelect
          data-testid="embedding-model-select"
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
              {t("knowledgeBases.embeddingModelSavedFallback", {
                model: value,
              })}
            </option>
          )}
          {embeddingModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          onClick={() => loadMutation.mutate()}
          disabled={disabled || !canLoad || loadMutation.isPending}
          aria-label={t("llmConfigs.loadModels")}
          data-testid="embedding-model-load"
        >
          {loadMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">
            {loadMutation.isPending
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
          {t("knowledgeBases.embeddingModelLoadRequired")}
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.embeddingModelHint")}
        </p>
      )}
    </div>
  );
}
