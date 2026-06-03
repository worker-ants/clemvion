"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  ToggleLeft,
  Trash2,
  Workflow,
  Download,
  Upload,
  History,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { workflowsApi, type WorkflowData } from "@/lib/api/workflows";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { timeAgo } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { useT, type TranslationKey } from "@/lib/i18n";

type FilterStatus = "all" | "active" | "inactive";
type Ownership = "all" | "mine" | "shared";

const PAGE_SIZE = 10;

export default function WorkflowsPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  // spec/2-navigation/1-workflow-list.md §2.3 — 팀 워크스페이스에서만 의미가 있는
  // 소유 필터. `mine` / `shared` / `all` 3 옵션을 그대로 `?ownership=` 으로 매핑.
  const [ownership, setOwnership] = useState<Ownership>("all");
  const { page, setPage } = usePageParam();
  // spec/2-navigation/1-workflow-list.md §2.1 + Rationale §1 — 팀 워크스페이스에 속한
  // 모든 워크플로우는 "Shared" 로 본다. 개인 워크스페이스에서는 배지를 표시하지 않는다.
  const currentWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.currentWorkspaceId),
  );
  const isTeamWorkspace = currentWorkspace?.type === "team";

  // 워크스페이스를 전환하면 ownership 을 'all' 로 리셋한다. effect 내 setState 룰
  // (react-hooks/set-state-in-effect) 를 피하려고 store subscribe 콜백으로 처리 —
  // 변경 알림은 React render 가 아닌 외부 store 의 이벤트라 패턴상 정당하다.
  useEffect(() => {
    return useWorkspaceStore.subscribe((next, prev) => {
      if (next.currentWorkspaceId !== prev.currentWorkspaceId) {
        setOwnership("all");
      }
    });
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search. `setPage` from usePageParam changes identity whenever
  // searchParams changes, so we keep it out of this effect's deps and route
  // through a ref — otherwise setPage(1) → URL change → setPage identity flip
  // → effect re-fires → cascading 300 ms debounces.
  const setPageRef = useRef(setPage);
  useEffect(() => {
    setPageRef.current = setPage;
  }, [setPage]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPageRef.current(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const workflowsQuery = useQuery<{
    items: WorkflowData[];
    total: number;
  }>({
    queryKey: ["workflows", debouncedSearch, filter, ownership, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filter === "active") params.status = "active";
      if (filter === "inactive") params.status = "inactive";
      // 개인 워크스페이스에서는 ownership 자체가 UI 비노출이라 `all` 로 묶인다.
      // 명시적으로 `all` 인 경우 파라미터를 보내지 않아 backend 가 기본값(전체)로 처리.
      if (isTeamWorkspace && ownership !== "all") {
        params.ownership = ownership;
      }

      const { data } = await workflowsApi.list(params);
      const { items, totalItems } = normalizePagedResponse<WorkflowData>(
        data,
        page,
      );
      return { items, total: totalItems };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await workflowsApi.create({
        name: t("dashboard.newWorkflowDefault"),
      });
      return data.data ?? data;
    },
    onSuccess: (workflow) => {
      // Default staleTime is 60s (providers.tsx) — without this invalidate,
      // returning to the list within that window shows stale cache.
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      router.push(`/workflows/${workflow.id}`);
    },
    onError: () => {
      toast.error(t("workflows.createFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      toast.success(t("workflows.deleted"));
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setDeleteTarget(null);
      // If we just removed the last item on a non-first page, the user would
      // otherwise see an empty page. Step back so the next refetch lands on
      // a page that still has rows.
      if (workflows.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: () => {
      toast.error(t("workflows.deleteFailed"));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.duplicate(id),
    onSuccess: () => {
      toast.success(t("workflows.duplicated"));
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      toast.error(t("workflows.duplicateFailed"));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => workflowsApi.update(id, { isActive: !isActive }),
    onSuccess: () => {
      toast.success(t("workflows.activated"));
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      toast.error(t("workflows.activateFailed"));
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const json = JSON.parse(text);
      return workflowsApi.importWorkflow(json);
    },
    onSuccess: () => {
      toast.success(t("workflows.imported"));
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      toast.error(t("workflows.importFailed"));
    },
  });

  const handleExport = useCallback(async (workflow: WorkflowData) => {
    try {
      const { data } = await workflowsApi.exportWorkflow(workflow.id);
      const exportData = data.data ?? data;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workflow.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("workflows.exported"));
    } catch {
      toast.error(t("workflows.exportFailed"));
    }
  }, [t]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        importMutation.mutate(file);
      }
      e.target.value = "";
    },
    [importMutation],
  );

  const handleMenuAction = useCallback(
    (action: string, workflow: WorkflowData) => {
      setOpenMenuId(null);
      switch (action) {
        case "edit":
          router.push(`/workflows/${workflow.id}`);
          break;
        case "executions":
          router.push(`/workflows/${workflow.id}/executions`);
          break;
        case "duplicate":
          duplicateMutation.mutate(workflow.id);
          break;
        case "toggle":
          toggleActiveMutation.mutate({
            id: workflow.id,
            isActive: workflow.isActive,
          });
          break;
        case "export":
          handleExport(workflow);
          break;
        case "delete":
          setDeleteTarget(workflow.id);
          break;
      }
    },
    [router, duplicateMutation, toggleActiveMutation, handleExport],
  );

  const workflows = workflowsQuery.data?.items ?? [];
  const total = workflowsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterButtons: { labelKey: TranslationKey; value: FilterStatus }[] = [
    { labelKey: "workflows.filter.all", value: "all" },
    { labelKey: "workflows.filter.active", value: "active" },
    { labelKey: "workflows.filter.inactive", value: "inactive" },
  ];

  const ownershipButtons: { labelKey: TranslationKey; value: Ownership }[] = [
    { labelKey: "workflows.ownership.all", value: "all" },
    { labelKey: "workflows.ownership.mine", value: "mine" },
    { labelKey: "workflows.ownership.shared", value: "shared" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("workflows.title")}</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <RoleGate minRole="editor">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("workflows.importWorkflow")}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("workflows.new")}
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder={t("workflows.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {filterButtons.map((fb) => (
            <Button
              key={fb.value}
              variant={filter === fb.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter(fb.value);
                setPage(1);
              }}
            >
              {t(fb.labelKey)}
            </Button>
          ))}
        </div>
        {isTeamWorkspace && (
          <div
            className="flex gap-1"
            role="group"
            aria-label={t("workflows.ownership.aria")}
          >
            {ownershipButtons.map((ob) => (
              <Button
                key={ob.value}
                variant={ownership === ob.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setOwnership(ob.value);
                  setPage(1);
                }}
              >
                {t(ob.labelKey)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Workflow List */}
      {workflowsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded bg-[hsl(var(--muted))]"
            />
          ))}
        </div>
      ) : !workflows.length ? (
        <EmptyState
          icon={Workflow}
          title={t("workflows.noneFound")}
          description={
            debouncedSearch ||
            filter !== "all" ||
            (isTeamWorkspace && ownership !== "all")
              ? t("workflows.adjustFiltersHint")
              : t("workflows.firstWorkflowHint")
          }
          action={
            !debouncedSearch &&
            filter === "all" &&
            !(isTeamWorkspace && ownership !== "all") ? (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("workflows.createWorkflow")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">{t("common.status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("common.name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("workflows.tags")}</th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("workflows.lastUpdated")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr
                    key={workflow.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))/0.5]"
                  >
                    <td className="px-4 py-3">
                      <button
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          workflow.isActive ? "bg-emerald-500" : "bg-gray-300",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActiveMutation.mutate({ id: workflow.id, isActive: workflow.isActive });
                        }}
                        title={workflow.isActive ? t("workflows.actions.deactivate") : t("workflows.actions.activate")}
                      >
                        <span
                          className={cn(
                            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                            workflow.isActive ? "translate-x-[18px]" : "translate-x-[3px]",
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="font-medium hover:underline text-left"
                          onClick={() =>
                            router.push(`/workflows/${workflow.id}`)
                          }
                        >
                          {workflow.name}
                        </button>
                        {isTeamWorkspace && (
                          <Badge
                            variant="outline"
                            className="gap-1"
                            aria-label={t("workflows.teamBadgeAria")}
                          >
                            <Users className="h-3 w-3" aria-hidden />
                            {t("workflows.teamBadge")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {workflow.tags?.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {timeAgo(
                        (workflow as WorkflowData & { updatedAt?: string })
                          .updatedAt ?? new Date().toISOString(),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block" ref={openMenuId === workflow.id ? menuRef : undefined}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === workflow.id
                                ? null
                                : workflow.id,
                            )
                          }
                          aria-label={t("common.aria.moreOptions")}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === workflow.id}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {openMenuId === workflow.id && (
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg">
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("edit", workflow)
                              }
                            >
                              <Pencil className="h-4 w-4" /> {t("common.edit")}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("executions", workflow)
                              }
                            >
                              <History className="h-4 w-4" /> {t("workflows.executionHistory")}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("duplicate", workflow)
                              }
                            >
                              <Copy className="h-4 w-4" /> {t("workflows.actions.duplicate")}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("export", workflow)
                              }
                            >
                              <Download className="h-4 w-4" /> {t("workflows.actions.export")}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("toggle", workflow)
                              }
                            >
                              <ToggleLeft className="h-4 w-4" />
                              {workflow.isActive ? t("workflows.actions.deactivate") : t("workflows.actions.activate")}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("delete", workflow)
                              }
                            >
                              <Trash2 className="h-4 w-4" /> {t("common.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[hsl(var(--background))] p-6 shadow-lg border border-[hsl(var(--border))]">
            <h3 className="text-lg font-semibold mb-2">{t("workflows.deleteDialog.title")}</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              {t("workflows.deleteDialog.message")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t("workflows.deleting") : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
