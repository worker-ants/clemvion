"use client";

import {
  type AgentMemoryData,
  type MemoryKind,
} from "@/lib/api/agent-memories";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { useT, type TranslationKey } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils/date";
import { BrainCircuit, Loader2, Trash2 } from "lucide-react";

export const KIND_OPTIONS: MemoryKind[] = ["fact", "preference", "entity"];

// kind 별 배지 라벨(i18n 키)·색상을 한 곳에서 관리한다 (badge/label 이중 switch 통합).
const KIND_META: Record<
  MemoryKind,
  { labelKey: TranslationKey; className: string }
> = {
  fact: {
    labelKey: "agentMemory.kind.fact",
    className: "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]",
  },
  preference: {
    labelKey: "agentMemory.kind.preference",
    className: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  },
  entity: {
    labelKey: "agentMemory.kind.entity",
    className: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  },
};

const FALLBACK_KIND_CLASS =
  "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";

function kindBadgeClass(kind: string): string {
  return KIND_META[kind as MemoryKind]?.className ?? FALLBACK_KIND_CLASS;
}

/**
 * Agent Memory 어드민 우측 패널 — 선택된 scope 의 메모리 행(kind 필터·load
 * more·단건 삭제). scope 미선택 시 placeholder. 데이터/쿼리 상태·콜백은
 * 부모(AgentMemoryPage)가 소유한다 (page.tsx 모놀리식 분해 — A1 backlog).
 */
export interface MemoryListPanelProps {
  selectedScope: string | null;
  memories: AgentMemoryData[];
  memoryTotal: number;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  kindFilter: "all" | MemoryKind;
  onKindFilterChange: (value: "all" | MemoryKind) => void;
  onRequestDeleteMemory: (id: string) => void;
  onLoadMore: () => void;
}

export function MemoryListPanel({
  selectedScope,
  memories,
  memoryTotal,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  kindFilter,
  onKindFilterChange,
  onRequestDeleteMemory,
  onLoadMore,
}: MemoryListPanelProps) {
  const t = useT();

  function kindLabel(kind: string): string {
    const meta = KIND_META[kind as MemoryKind];
    return meta ? t(meta.labelKey) : kind;
  }

  return (
    <section className="rounded-lg border border-[hsl(var(--border))]">
      {selectedScope === null ? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-center text-[hsl(var(--muted-foreground))]">
          <BrainCircuit className="h-8 w-8" />
          <p className="text-sm">{t("agentMemory.memories.selectScope")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="kind-filter"
                className="text-sm text-[hsl(var(--muted-foreground))]"
              >
                {t("agentMemory.kind.filterLabel")}
              </label>
              <select
                id="kind-filter"
                value={kindFilter}
                onChange={(e) =>
                  onKindFilterChange(e.target.value as "all" | MemoryKind)
                }
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm outline-none focus:border-[hsl(var(--primary))]"
              >
                <option value="all">{t("agentMemory.kind.all")}</option>
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </div>
            <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {t("agentMemory.memories.count", { count: memoryTotal })}
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            {isError && (
              <p className="p-4 text-sm text-[hsl(var(--destructive))]">
                {t("agentMemory.memories.loadFailed")}
              </p>
            )}
            {!isLoading && !isError && memories.length === 0 && (
              <p className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {t("agentMemory.memories.empty")}
              </p>
            )}
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="group flex items-start gap-3 border-b border-[hsl(var(--border))] p-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {memory.content}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kindBadgeClass(
                        memory.kind,
                      )}`}
                    >
                      {kindLabel(memory.kind)}
                    </span>
                    <span>
                      {t("agentMemory.memories.updatedAt")}{" "}
                      {timeAgo(memory.updatedAt)}
                    </span>
                    {memory.expiresAt && (
                      <span className="text-[hsl(var(--destructive))]">
                        {t("agentMemory.memories.expiresAt")}{" "}
                        {timeAgo(memory.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
                <RoleGate minRole="editor">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-[hsl(var(--destructive))]"
                    onClick={() => onRequestDeleteMemory(memory.id)}
                    aria-label={t("agentMemory.memories.delete")}
                    title={t("agentMemory.memories.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </RoleGate>
              </div>
            ))}
            {hasNextPage && (
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isFetchingNextPage}
                  onClick={onLoadMore}
                >
                  {isFetchingNextPage && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("agentMemory.loadMore")}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
