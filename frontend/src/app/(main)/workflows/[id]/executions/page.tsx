"use client";

import { useState, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Activity,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import {
  executionsApi,
  type ExecutionData,
  type ExecutionStatus,
  type ExecutionListParams,
} from "@/lib/api/executions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils/date";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDuration,
} from "@/lib/utils/execution-status";

const PAGE_SIZE = 20;

type SortField = "started_at" | "duration_ms" | "status";

function SortIcon({
  field,
  currentField,
  currentOrder,
}: {
  field: SortField;
  currentField: SortField;
  currentOrder: "asc" | "desc";
}) {
  if (currentField !== field)
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-[hsl(var(--muted-foreground))]" />;
  return currentOrder === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded bg-[hsl(var(--muted))]"
        />
      ))}
    </div>
  );
}

type FilterValue = "all" | ExecutionStatus;

const FILTER_BUTTONS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Running", value: "running" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Waiting", value: "waiting_for_input" },
];

export default function ExecutionListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workflowId } = use(params);
  const router = useRouter();

  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("started_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleFilterChange = (newFilter: FilterValue) => {
    setFilter(newFilter);
    setPage(1);
  };

  const workflowQuery = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      const { data } = await workflowsApi.get(workflowId);
      return data.data ?? data;
    },
  });

  const executionsQuery = useQuery<{
    items: ExecutionData[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["executions", workflowId, filter, page, sortField, sortOrder],
    queryFn: async () => {
      const params: ExecutionListParams = {
        page,
        limit: PAGE_SIZE,
        sort: sortField,
        order: sortOrder,
      };
      if (filter !== "all") {
        params.status = filter;
      }
      const responseData = await executionsApi.getByWorkflow(workflowId, params);
      return {
        items: responseData.data ?? [],
        total: responseData.pagination?.totalItems ?? 0,
        totalPages: responseData.pagination?.totalPages ?? 1,
      };
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const executions = executionsQuery.data?.items ?? [];
  const totalPages = executionsQuery.data?.totalPages ?? 1;
  const workflowName = workflowQuery.data?.name ?? "Workflow";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {workflowName}
              <span className="text-[hsl(var(--muted-foreground))] font-normal">
                {" "}&mdash; Executions
              </span>
            </h1>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/workflows/${workflowId}`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Editor
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {FILTER_BUTTONS.map((fb) => (
          <Button
            key={fb.value}
            variant={filter === fb.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(fb.value)}
          >
            {fb.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      {executionsQuery.isLoading ? (
        <TableSkeleton />
      ) : !executions.length ? (
        <EmptyState
          icon={Activity}
          title="No executions yet"
          description="Run this workflow to see execution history here."
          action={
            <Button
              variant="outline"
              onClick={() => router.push(`/workflows/${workflowId}`)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Editor
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-[hsl(var(--foreground))]"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <SortIcon field="status" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-[hsl(var(--foreground))]"
                      onClick={() => handleSort("started_at")}
                    >
                      Started At
                      <SortIcon field="started_at" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-[hsl(var(--foreground))]"
                      onClick={() => handleSort("duration_ms")}
                    >
                      Duration
                      <SortIcon field="duration_ms" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Nodes
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => {
                  const completedNodes = execution.nodeExecutions?.filter(
                    (ne) => ne.status === "completed",
                  ).length ?? 0;
                  const totalNodes = execution.nodeExecutions?.length ?? 0;
                  const failedNodes = execution.nodeExecutions?.filter(
                    (ne) => ne.status === "failed",
                  ).length ?? 0;

                  return (
                    <tr
                      key={execution.id}
                      className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))/0.5] cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/workflows/${workflowId}/executions/${execution.id}`,
                        )
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {STATUS_ICON[execution.status] ?? "\u2753"}
                          </span>
                          <Badge
                            variant={STATUS_BADGE_VARIANT[execution.status] ?? "outline"}
                          >
                            {STATUS_LABEL[execution.status] ?? execution.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {formatDate(execution.startedAt, "datetime")}
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {formatDuration(execution.durationMs)}
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {totalNodes > 0 ? (
                          <span>
                            {completedNodes}/{totalNodes}
                            {failedNodes > 0 && (
                              <span className="text-[hsl(var(--destructive))]">
                                {" "}({failedNodes} failed)
                              </span>
                            )}
                          </span>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
