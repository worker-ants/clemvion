"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { llmConfigsApi } from "@/lib/api/llm-configs";
import { useT } from "@/lib/i18n";
import { useEmbeddingModelLoader } from "@/components/llm-config/use-embedding-model-loader";
import { ModelSelectField } from "@/components/llm-config/model-select-field";

interface EmbeddingModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * `value === ""` 일 때 select 의 disabled option 으로 노출되는 텍스트.
   */
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

  const { data: configs = [] } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.list(),
    staleTime: 30_000,
  });
  const defaultConfigId = useMemo(
    () => configs.find((c) => c.isDefault)?.id ?? configs[0]?.id,
    [configs],
  );
  const effectiveConfigId = llmConfigId ?? defaultConfigId;

  const {
    models,
    errorMessage,
    isPending,
    hasAttemptedLoad,
    canLoad,
    load,
  } = useEmbeddingModelLoader({
    configId: effectiveConfigId,
    fallbackErrorMessage: t("knowledgeBases.embeddingModelLoadFailed"),
  });

  const embeddingModels = useMemo(
    // API 에 { type: "embedding" } 파라미터를 전달하지만, provider 에 따라 서버가
    // type 파라미터를 무시하고 mixed 응답을 반환할 수 있으므로 클라이언트에서도 필터.
    () => models.filter((m) => m.type === "embedding"),
    [models],
  );

  return (
    <ModelSelectField
      value={value}
      onChange={onChange}
      models={embeddingModels}
      errorMessage={errorMessage}
      isPending={isPending}
      canLoad={canLoad}
      hasAttemptedLoad={hasAttemptedLoad}
      load={load}
      formatSavedFallback={(model) =>
        t("knowledgeBases.embeddingModelSavedFallback", { model })
      }
      loadRequiredHint={t("knowledgeBases.embeddingModelLoadRequired")}
      loadedHint={t("knowledgeBases.embeddingModelHint")}
      placeholder={placeholder}
      disabled={disabled}
      testIdPrefix="embedding-model"
    />
  );
}
