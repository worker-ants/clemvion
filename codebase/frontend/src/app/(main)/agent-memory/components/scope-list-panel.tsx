"use client";

import Link from "next/link";
import { type AgentMemoryScopeData } from "@/lib/api/agent-memories";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { useT } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils/date";
import { BrainCircuit, Loader2, Search, Trash2 } from "lucide-react";

/**
 * Agent Memory 어드민 좌측 패널 — workspace 의 scope 목록(검색·load more·삭제).
 * 데이터/쿼리 상태·콜백은 부모(AgentMemoryPage)가 소유하고 prop 으로 내려준다
 * (page.tsx 모놀리식 분해 — A1 backlog).
 */
export interface ScopeListPanelProps {
  scopes: AgentMemoryScopeData[];
  selectedScope: string | null;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (e: React.FormEvent) => void;
  onSelectScope: (scopeKey: string) => void;
  onRequestClearScope: (scope: AgentMemoryScopeData) => void;
  onLoadMore: () => void;
}

export function ScopeListPanel({
  scopes,
  selectedScope,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  onSelectScope,
  onRequestClearScope,
  onLoadMore,
}: ScopeListPanelProps) {
  const t = useT();

  return (
    <section className="rounded-lg border border-[hsl(var(--border))]">
      <div className="border-b border-[hsl(var(--border))] p-3">
        <h2 className="mb-2 text-sm font-semibold">
          {t("agentMemory.scopes.title")}
        </h2>
        <form onSubmit={onSubmitSearch} className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder={t("agentMemory.scopes.searchPlaceholder")}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]"
          />
        </form>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}
        {isError && (
          <p className="p-4 text-sm text-[hsl(var(--destructive))]">
            {t("agentMemory.scopes.loadFailed")}
          </p>
        )}
        {!isLoading && !isError && scopes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-[hsl(var(--muted-foreground))]">
            <BrainCircuit className="h-8 w-8" />
            <p className="text-sm font-medium">
              {t("agentMemory.scopes.empty")}
            </p>
            <p className="text-xs">{t("agentMemory.scopes.emptyHint")}</p>
            <Link
              href="/docs/06-integrations-and-config/agent-memory"
              className="text-xs font-medium text-[hsl(var(--primary))] underline underline-offset-2"
            >
              {t("agentMemory.scopes.emptyHintLink")}
            </Link>
          </div>
        )}
        {scopes.map((scope) => {
          const isActive = scope.scopeKey === selectedScope;
          return (
            <div
              key={scope.scopeKey}
              className={`group flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2 last:border-b-0 ${
                isActive ? "bg-[hsl(var(--accent))/0.5]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectScope(scope.scopeKey)}
                className="flex min-w-0 flex-1 flex-col text-left"
              >
                <span className="truncate font-mono text-sm">
                  {scope.scopeKey}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("agentMemory.scopes.count", { count: scope.count })}
                  {" · "}
                  {timeAgo(scope.latestUpdatedAt)}
                </span>
              </button>
              <RoleGate minRole="editor">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[hsl(var(--destructive))]"
                  onClick={() => onRequestClearScope(scope)}
                  aria-label={t("agentMemory.scopes.delete")}
                  title={t("agentMemory.scopes.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </RoleGate>
            </div>
          );
        })}
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
    </section>
  );
}
