"use client";

import { useState, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Clock,
  Webhook,
  GitBranch,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { workflowsApi } from "@/lib/api/workflows";
import {
  executionsApi,
  type ExecutionData,
  type ExecutionStatus,
  type ExecutionListParams,
  type ExecutionTriggerSource,
} from "@/lib/api/executions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils/date";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  getStatusLabel,
  formatDuration,
} from "@/lib/utils/execution-status";
import { useT, type TranslationKey } from "@/lib/i18n";

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

const FILTER_BUTTONS: { labelKey: TranslationKey; value: FilterValue }[] = [
  { labelKey: "executions.filterAll", value: "all" },
  { labelKey: "executions.filterCompleted", value: "completed" },
  { labelKey: "executions.filterFailed", value: "failed" },
  { labelKey: "executions.filterRunning", value: "running" },
  { labelKey: "executions.filterCancelled", value: "cancelled" },
  { labelKey: "executions.filterWaiting", value: "waiting_for_input" },
];

const TRIGGER_ICON: Record<ExecutionTriggerSource, LucideIcon> = {
  manual: User,
  schedule: Clock,
  webhook: Webhook,
  subworkflow: GitBranch,
  unknown: HelpCircle,
};

const TRIGGER_LABEL_KEY: Record<ExecutionTriggerSource, TranslationKey> = {
  manual: "executions.triggerSource.manual",
  schedule: "executions.triggerSource.schedule",
  webhook: "executions.triggerSource.webhook",
  subworkflow: "executions.triggerSource.subworkflow",
  unknown: "executions.triggerSource.unknown",
};

export default function ExecutionListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
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
  const workflowName = workflowQuery.data?.name ?? t("executions.defaultName");

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
              {t("executions.listHeader", { name: workflowName })}
            </h1>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/workflows/${workflowId}`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t("executions.openInEditor")}
        </Button>
      </div>

      <div className="flex gap-1">
        {FILTER_BUTTONS.map((fb) => (
          <Button
            key={fb.value}
            variant={filter === fb.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(fb.value)}
          >
            {t(fb.labelKey)}
          </Button>
        ))}
      </div>

      {/* Table */}
      {executionsQuery.isLoading ? (
        <TableSkeleton />
      ) : !executions.length ? (
        <EmptyState
          icon={Activity}
          title={t("executions.empty")}
          description={t("executions.noExecutionsHint")}
          action={
            <Button
              variant="outline"
              onClick={() => router.push(`/workflows/${workflowId}`)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("executions.openInEditor")}
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
                      {t("common.status")}
                      <SortIcon field="status" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("executions.columnTrigger")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-[hsl(var(--foreground))]"
                      onClick={() => handleSort("started_at")}
                    >
                      {t("executions.columnStartedAt")}
                      <SortIcon field="started_at" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-[hsl(var(--foreground))]"
                      onClick={() => handleSort("duration_ms")}
                    >
                      {t("executions.columnDuration")}
                      <SortIcon field="duration_ms" currentField={sortField} currentOrder={sortOrder} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("executions.columnNodes")}
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
                            {getStatusLabel(execution.status)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const source: ExecutionTriggerSource =
                            execution.triggerSource ?? "unknown";
                          const Icon = TRIGGER_ICON[source];
                          return (
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                              <div className="min-w-0">
                                <div className="truncate">
                                  {t(TRIGGER_LABEL_KEY[source])}
                                </div>
                                {execution.triggerLabel ? (
                                  <div
                                    className="truncate text-xs text-[hsl(var(--muted-foreground))]"
                                    title={execution.triggerLabel}
                                  >
                                    {execution.triggerLabel}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })()}
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
                                {" "}{t("executions.failedCount", { count: failedNodes })}
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

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
