"use client";

import { useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  agentMemoriesApi,
  type AgentMemoryData,
  type AgentMemoryScopeData,
  type MemoryKind,
} from "@/lib/api/agent-memories";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ScopeListPanel } from "./components/scope-list-panel";
import { MemoryListPanel } from "./components/memory-list-panel";

const PAGE_SIZE = 20;

/**
 * Agent Memory 어드민 페이지 — workspace 의 persistent 메모리 scope/행 조회·삭제.
 * 좌(scope)·우(memory) 패널은 `ScopeListPanel` / `MemoryListPanel` 로 분해하고,
 * 본 컴포넌트는 쿼리·뮤테이션·모달·상태를 소유하는 오케스트레이터다 (A1 backlog —
 * 426줄 모놀리식 분해).
 */
export default function AgentMemoryPage() {
  const t = useT();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | MemoryKind>("all");
  const [deleteMemoryTarget, setDeleteMemoryTarget] = useState<string | null>(
    null,
  );
  const [clearScopeTarget, setClearScopeTarget] =
    useState<AgentMemoryScopeData | null>(null);

  // Scope list (offset-accumulating "load more")
  const scopesQuery = useInfiniteQuery({
    queryKey: ["agent-memories", "scopes", q],
    queryFn: ({ pageParam }) =>
      agentMemoriesApi.listScopes({ limit: PAGE_SIZE, offset: pageParam, q }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.totalItems ? loaded : undefined;
    },
  });
  const scopes: AgentMemoryScopeData[] = useMemo(
    () => scopesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [scopesQuery.data],
  );

  // Memory list for the selected scope
  const memoriesQuery = useInfiniteQuery({
    queryKey: ["agent-memories", "list", selectedScope, kindFilter],
    queryFn: ({ pageParam }) =>
      agentMemoriesApi.listMemories({
        scopeKey: selectedScope as string,
        kind: kindFilter === "all" ? undefined : kindFilter,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.totalItems ? loaded : undefined;
    },
    enabled: selectedScope !== null,
  });
  const memories: AgentMemoryData[] = useMemo(
    () => memoriesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [memoriesQuery.data],
  );
  const memoryTotal = memoriesQuery.data?.pages[0]?.totalItems ?? 0;

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => agentMemoriesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success(t("agentMemory.deleteMemory.success"));
      setDeleteMemoryTarget(null);
    },
    onError: () => toast.error(t("agentMemory.deleteMemory.failed")),
  });

  const clearScopeMutation = useMutation({
    mutationFn: (scopeKey: string) => agentMemoriesApi.clearScope(scopeKey),
    // clearScope 는 X-Deleted-Count(삭제 행 수)를 반환한다 (AGM-13 멱등 삭제 UX).
    // 0 건이면 success 가 아닌 중립 토스트로 — "삭제했다" 는 오해를 막는다.
    onSuccess: (deleted, scopeKey) => {
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      if (deleted === 0) {
        toast.info(t("agentMemory.clearScope.empty"));
      } else {
        toast.success(t("agentMemory.clearScope.success"));
      }
      if (selectedScope === scopeKey) setSelectedScope(null);
      setClearScopeTarget(null);
    },
    onError: () => toast.error(t("agentMemory.clearScope.failed")),
  });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("agentMemory.title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("agentMemory.description")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["agent-memories"] })
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("agentMemory.refresh")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ScopeListPanel
          scopes={scopes}
          selectedScope={selectedScope}
          isLoading={scopesQuery.isLoading}
          isError={scopesQuery.isError}
          hasNextPage={scopesQuery.hasNextPage}
          isFetchingNextPage={scopesQuery.isFetchingNextPage}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSubmitSearch={submitSearch}
          onSelectScope={setSelectedScope}
          onRequestClearScope={setClearScopeTarget}
          onLoadMore={() => scopesQuery.fetchNextPage()}
        />

        <MemoryListPanel
          selectedScope={selectedScope}
          memories={memories}
          memoryTotal={memoryTotal}
          isLoading={memoriesQuery.isLoading}
          isError={memoriesQuery.isError}
          hasNextPage={memoriesQuery.hasNextPage}
          isFetchingNextPage={memoriesQuery.isFetchingNextPage}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
          onRequestDeleteMemory={setDeleteMemoryTarget}
          onLoadMore={() => memoriesQuery.fetchNextPage()}
        />
      </div>

      <ConfirmModal
        open={deleteMemoryTarget !== null}
        title={t("agentMemory.deleteMemory.title")}
        message={t("agentMemory.deleteMemory.message")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteMemoryTarget(null)}
        onConfirm={() =>
          deleteMemoryTarget && deleteMemoryMutation.mutate(deleteMemoryTarget)
        }
        pending={deleteMemoryMutation.isPending}
        destructive
      />

      <ConfirmModal
        open={clearScopeTarget !== null}
        title={t("agentMemory.clearScope.title")}
        message={t("agentMemory.clearScope.message", {
          scopeKey: clearScopeTarget?.scopeKey ?? "",
          count: clearScopeTarget?.count ?? 0,
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setClearScopeTarget(null)}
        onConfirm={() =>
          clearScopeTarget &&
          clearScopeMutation.mutate(clearScopeTarget.scopeKey)
        }
        pending={clearScopeMutation.isPending}
        destructive
      />
    </div>
  );
}
