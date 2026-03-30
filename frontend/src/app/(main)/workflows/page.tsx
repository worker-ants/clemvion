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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { workflowsApi, type WorkflowData } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

type FilterStatus = "all" | "active" | "inactive";

const PAGE_SIZE = 10;

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
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
    queryKey: ["workflows", debouncedSearch, filter, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filter === "active") params.isActive = "true";
      if (filter === "inactive") params.isActive = "false";

      const { data } = await workflowsApi.list(params);
      const responseData = data.data ?? data;
      return {
        items: responseData.items ?? responseData,
        total: responseData.total ?? responseData.length ?? 0,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await workflowsApi.create({
        name: "Untitled Workflow",
      });
      return data.data ?? data;
    },
    onSuccess: (workflow) => {
      router.push(`/workflows/${workflow.id}`);
    },
    onError: () => {
      toast.error("Failed to create workflow");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      toast.success("Workflow deleted");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete workflow");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.duplicate(id),
    onSuccess: () => {
      toast.success("Workflow duplicated");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      toast.error("Failed to duplicate workflow");
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
      toast.success("Workflow updated");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      toast.error("Failed to update workflow");
    },
  });

  const handleMenuAction = useCallback(
    (action: string, workflow: WorkflowData) => {
      setOpenMenuId(null);
      switch (action) {
        case "edit":
          router.push(`/workflows/${workflow.id}`);
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
        case "delete":
          setDeleteTarget(workflow.id);
          break;
      }
    },
    [router, duplicateMutation, toggleActiveMutation],
  );

  const workflows = workflowsQuery.data?.items ?? [];
  const total = workflowsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Workflows</h1>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search workflows..."
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
              {fb.label}
            </Button>
          ))}
        </div>
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
          title="No workflows found"
          description={
            debouncedSearch || filter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first workflow to get started."
          }
          action={
            !debouncedSearch && filter === "all" ? (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
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
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Tags</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr
                    key={workflow.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))/0.5]"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          workflow.isActive
                            ? "bg-emerald-500"
                            : "bg-gray-400",
                        )}
                        title={workflow.isActive ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="font-medium hover:underline text-left"
                        onClick={() =>
                          router.push(`/workflows/${workflow.id}`)
                        }
                      >
                        {workflow.name}
                      </button>
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
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {openMenuId === workflow.id && (
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg">
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("edit", workflow)
                              }
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("duplicate", workflow)
                              }
                            >
                              <Copy className="h-4 w-4" /> Duplicate
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("toggle", workflow)
                              }
                            >
                              <ToggleLeft className="h-4 w-4" />
                              {workflow.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))]"
                              onClick={() =>
                                handleMenuAction("delete", workflow)
                              }
                            >
                              <Trash2 className="h-4 w-4" /> Delete
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i + 1}
                  variant={page === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[hsl(var(--background))] p-6 shadow-lg border border-[hsl(var(--border))]">
            <h3 className="text-lg font-semibold mb-2">Delete Workflow</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              Are you sure you want to delete this workflow? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
