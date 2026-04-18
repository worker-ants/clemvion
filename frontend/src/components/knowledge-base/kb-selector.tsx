"use client";

import { useQuery } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type KnowledgeBaseData,
} from "@/lib/api/knowledge-bases";
import { useT } from "@/lib/i18n";

interface KbSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function KbSelector({ value, onChange }: KbSelectorProps) {
  const t = useT();
  const { data } = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => knowledgeBasesApi.getAll(),
    staleTime: 30_000,
  });
  const collections: KnowledgeBaseData[] = data?.data ?? data ?? [];

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.kbSelector.label")}
        </label>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.kbSelector.noCollections")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.kbSelector.label")}
      </label>
      <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-[hsl(var(--input))] p-1.5">
        {collections.map((kb) => (
          <label
            key={kb.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[hsl(var(--accent))]"
          >
            <input
              type="checkbox"
              checked={value.includes(kb.id)}
              onChange={() => toggle(kb.id)}
              className="h-3 w-3 rounded"
            />
            <span className="truncate">{kb.name}</span>
            <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.kbSelector.docsCount", { count: kb.documentCount })}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
