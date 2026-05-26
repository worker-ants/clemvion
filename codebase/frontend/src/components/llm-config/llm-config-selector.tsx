"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  llmConfigsApi,
  LLM_CONFIGS_QUERY_KEY,
} from "@/lib/api/llm-configs";
import { useT } from "@/lib/i18n";

interface LlmConfigSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function LlmConfigSelector({
  value,
  onChange,
  label,
}: LlmConfigSelectorProps) {
  const t = useT();
  const { data: configs = [], isLoading, isPending } = useQuery({
    queryKey: LLM_CONFIGS_QUERY_KEY,
    queryFn: () => llmConfigsApi.list(),
    staleTime: 30_000,
  });
  const defaultConfig = useMemo(
    () => configs.find((c) => c.isDefault),
    [configs],
  );

  // value="" 가 선택되었을 때(=동적 "기본 제공자") 어떤 LLM 으로 resolve 될지를
  // 옵션 라벨에 노출해 UI 와 실행 결과의 신뢰 깨짐을 방지한다.
  // ko/en dict 에서 `defaultOptionWithResolved` 는 `{{name}}` interpolation 을
  // 받는다 — interpolation: { name: string }.
  const defaultOptionLabel = defaultConfig
    ? t("nodeConfigs.llmConfigSelector.defaultOptionWithResolved", {
        name: defaultConfig.name,
      })
    : t("nodeConfigs.llmConfigSelector.defaultOption");

  // 로딩 중에는 configs 가 빈 배열이라 "기본 LLM 미설정" 힌트가 잠시 노출되는
  // 플리커가 발생할 수 있다. 쿼리가 아직 끝나지 않았다면 힌트를 감춘다.
  const showNoDefaultHint =
    !isLoading && !isPending && !defaultConfig && value === "";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {label ?? t("nodeConfigs.llmConfigSelector.label")}
      </label>
      <select
        className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{defaultOptionLabel}</option>
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.defaultModel}){c.isDefault ? " *" : ""}
          </option>
        ))}
      </select>
      {showNoDefaultHint ? (
        <p className="text-[11px] text-[hsl(var(--destructive))]">
          {t("nodeConfigs.llmConfigSelector.noDefaultHint")}
        </p>
      ) : null}
    </div>
  );
}
