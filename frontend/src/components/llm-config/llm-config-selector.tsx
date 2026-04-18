"use client";

import { useQuery } from "@tanstack/react-query";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
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
  const { data } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
  });
  const configs: LlmConfigData[] = data?.data ?? data ?? [];

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
        <option value="">{t("nodeConfigs.llmConfigSelector.defaultOption")}</option>
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.defaultModel}){c.isDefault ? " *" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
