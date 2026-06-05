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
import { RoleGate } from "@/components/auth/role-gate";
import { useT } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils/date";
import { toast } from "sonner";
import {
  BrainCircuit,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

const PAGE_SIZE = 20;
const KIND_OPTIONS: MemoryKind[] = ["fact", "preference", "entity"];

function kindBadgeClass(kind: string): string {
  switch (kind) {
    case "fact":
      return "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]";
    case "preference":
      return "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]";
    case "entity":
      return "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
    default:
      return "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
  }
}

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
    onSuccess: (_data, scopeKey) => {
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success(t("agentMemory.clearScope.success"));
      if (selectedScope === scopeKey) setSelectedScope(null);
      setClearScopeTarget(null);
    },
    onError: () => toast.error(t("agentMemory.clearScope.failed")),
  });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(searchInput.trim());
  }

  function kindLabel(kind: string): string {
    switch (kind) {
      case "fact":
        return t("agentMemory.kind.fact");
      case "preference":
        return t("agentMemory.kind.preference");
      case "entity":
        return t("agentMemory.kind.entity");
      default:
        return kind;
    }
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
        {/* Scope list */}
        <section className="rounded-lg border border-[hsl(var(--border))]">
          <div className="border-b border-[hsl(var(--border))] p-3">
            <h2 className="mb-2 text-sm font-semibold">
              {t("agentMemory.scopes.title")}
            </h2>
            <form onSubmit={submitSearch} className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("agentMemory.scopes.searchPlaceholder")}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]"
              />
            </form>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {scopesQuery.isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            {scopesQuery.isError && (
              <p className="p-4 text-sm text-[hsl(var(--destructive))]">
                {t("agentMemory.scopes.loadFailed")}
              </p>
            )}
            {!scopesQuery.isLoading &&
              !scopesQuery.isError &&
              scopes.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-[hsl(var(--muted-foreground))]">
                  <BrainCircuit className="h-8 w-8" />
                  <p className="text-sm font-medium">
                    {t("agentMemory.scopes.empty")}
                  </p>
                  <p className="text-xs">
                    {t("agentMemory.scopes.emptyHint")}
                  </p>
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
                    onClick={() => setSelectedScope(scope.scopeKey)}
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
                      onClick={() => setClearScopeTarget(scope)}
                      aria-label={t("agentMemory.scopes.delete")}
                      title={t("agentMemory.scopes.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </RoleGate>
                </div>
              );
            })}
            {scopesQuery.hasNextPage && (
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={scopesQuery.isFetchingNextPage}
                  onClick={() => scopesQuery.fetchNextPage()}
                >
                  {scopesQuery.isFetchingNextPage && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("agentMemory.loadMore")}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Memory list */}
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
                      setKindFilter(e.target.value as "all" | MemoryKind)
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
                  {t("agentMemory.scopes.count", { count: memoryTotal })}
                </span>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {memoriesQuery.isLoading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                )}
                {memoriesQuery.isError && (
                  <p className="p-4 text-sm text-[hsl(var(--destructive))]">
                    {t("agentMemory.memories.loadFailed")}
                  </p>
                )}
                {!memoriesQuery.isLoading &&
                  !memoriesQuery.isError &&
                  memories.length === 0 && (
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
                        onClick={() => setDeleteMemoryTarget(memory.id)}
                        aria-label={t("agentMemory.memories.delete")}
                        title={t("agentMemory.memories.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </RoleGate>
                  </div>
                ))}
                {memoriesQuery.hasNextPage && (
                  <div className="p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={memoriesQuery.isFetchingNextPage}
                      onClick={() => memoriesQuery.fetchNextPage()}
                    >
                      {memoriesQuery.isFetchingNextPage && (
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
      </div>

      <ConfirmModal
        open={deleteMemoryTarget !== null}
        title={t("agentMemory.deleteMemory.title")}
        message={t("agentMemory.deleteMemory.message")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteMemoryTarget(null)}
        onConfirm={() =>
          deleteMemoryTarget &&
          deleteMemoryMutation.mutate(deleteMemoryTarget)
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
