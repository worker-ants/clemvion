"use client";

import { useId, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
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

// 지정된 LLMConfig (또는 워크스페이스 default) 의 임베딩 타입 모델 목록을 받아 datalist
// 자동완성을 제공한다. Provider 가 embedding 모델을 노출하지 못하거나(예: 일부 custom
// provider) 응답 실패 시에는 일반 텍스트 입력으로 graceful degrade.
export function EmbeddingModelCombobox({
  value,
  onChange,
  placeholder,
  disabled,
  llmConfigId,
}: EmbeddingModelComboboxProps) {
  const t = useT();
  const datalistId = useId();

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
  // 호출자가 지정한 llmConfigId 가 있으면 그걸로, 없으면 default 로 폴백.
  const effectiveConfigId = llmConfigId ?? defaultConfigId;

  const { data: models = [] } = useQuery({
    queryKey: ["llm-config-embedding-models", effectiveConfigId],
    queryFn: () =>
      llmConfigsApi.listModels(effectiveConfigId as string, {
        type: "embedding",
      }),
    enabled: Boolean(effectiveConfigId),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-1">
      <Input
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-autocomplete="list"
      />
      <datalist id={datalistId}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name && m.name !== m.id ? m.name : undefined}
          </option>
        ))}
      </datalist>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("knowledgeBases.embeddingModelHint")}
      </p>
    </div>
  );
}
