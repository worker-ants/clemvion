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
}

// 워크스페이스의 default LLM Config 에서 임베딩 타입 모델 목록을 받아 datalist
// 자동완성을 제공한다. Provider 가 embedding 모델을 노출하지 못하거나(예: 일부
// custom provider) 응답 실패 시에는 일반 텍스트 입력으로 graceful degrade.
export function EmbeddingModelCombobox({
  value,
  onChange,
  placeholder,
  disabled,
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

  const { data: models = [] } = useQuery({
    queryKey: ["llm-config-embedding-models", defaultConfigId],
    queryFn: () =>
      llmConfigsApi.listModels(defaultConfigId as string, {
        type: "embedding",
      }),
    enabled: Boolean(defaultConfigId),
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
