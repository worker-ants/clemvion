"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Activity,
  Play,
  CheckCircle,
  Plus,
  Workflow,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { workflowsApi } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo, formatDuration } from "@/lib/utils/date";
import { useT, type TranslationKey } from "@/lib/i18n";
import { TriggerCell } from "@/components/executions/trigger-cell";
import type { ExecutionTriggerSource } from "@/lib/api/executions";

interface DashboardSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  runs7d: number;
  runs7dPrevious: number;
  runs7dChangePercent: number | null;
  successRate: number;
  avgExecutionTime: number;
}

interface RecentWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  durationMs: number | null;
  startedAt: string;
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-[hsl(var(--muted))]" />
        <div className="h-5 w-5 animate-pulse rounded bg-[hsl(var(--muted))]" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 animate-pulse rounded bg-[hsl(var(--muted))]" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded bg-[hsl(var(--muted))]"
        />
      ))}
    </div>
  );
}

const statusIcon: Record<string, string> = {
  completed: "\u2705",
  failed: "\u274C",
  running: "\u23F3",
  pending: "\u23F3",
  cancelled: "\u26D4",
  waiting_for_input: "\u270B",
};

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/summary");
      return data.data ?? data;
    },
  });

  const recentWorkflowsQuery = useQuery<RecentWorkflow[]>({
    queryKey: ["dashboard", "recent-workflows"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/recent-workflows");
      return data.data ?? data;
    },
  });

  const recentExecutionsQuery = useQuery<RecentExecution[]>({
    queryKey: ["dashboard", "recent-executions"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/recent-executions");
      return data.data ?? data;
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async () => {
      const { data } = await workflowsApi.create({
        name: t("dashboard.newWorkflowDefault"),
      });
      return data.data ?? data;
    },
    onSuccess: (workflow) => {
      // Invalidate the workflows list + dashboard summary so the new entry
      // shows up when the user returns within React Query's 60s staleTime.
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/workflows/${workflow.id}`);
    },
    onError: () => {
      toast.error(t("workflows.createFailed"));
    },
  });

  const summary = summaryQuery.data;

  const summaryCards: Array<{
    labelKey: TranslationKey;
    value: string | number;
    icon: typeof GitBranch;
    change: number | null;
  }> = [
    {
      labelKey: "dashboard.totalWorkflows",
      value: summary?.totalWorkflows ?? 0,
      icon: GitBranch,
      change: null,
    },
    {
      labelKey: "dashboard.activeWorkflows",
      value: summary?.activeWorkflows ?? 0,
      icon: Activity,
      change: null,
    },
    {
      labelKey: "dashboard.executions7d",
      value: summary?.runs7d ?? 0,
      icon: Play,
      change: summary?.runs7dChangePercent ?? null,
    },
    {
      labelKey: "dashboard.successRate",
      value: summary ? `${Math.round(summary.successRate)}%` : "0%",
      icon: CheckCircle,
      change: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
        <Button
          onClick={() => createWorkflowMutation.mutate()}
          disabled={createWorkflowMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("dashboard.newWorkflow")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <SummaryCardSkeleton key={i} />
            ))
          : summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.labelKey}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t(card.labelKey)}
                    </CardTitle>
                    <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                    {card.change !== null && (
                      <p className={`mt-1 flex items-center text-xs ${card.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {card.change >= 0 ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        )}
                        {card.change >= 0 ? "+" : ""}{card.change}% {t("dashboard.changeVsPrev")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Recent Workflows */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("dashboard.recentWorkflows")}</h2>
        {recentWorkflowsQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : !recentWorkflowsQuery.data?.length ? (
          <EmptyState
            icon={Workflow}
            title={t("dashboard.noWorkflows")}
            description={t("dashboard.noWorkflowsHint")}
            action={
              <Button
                onClick={() => createWorkflowMutation.mutate()}
                disabled={createWorkflowMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.createWorkflow")}
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">{t("common.name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dashboard.status")}</th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("dashboard.lastUpdated")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentWorkflowsQuery.data.slice(0, 5).map((workflow) => (
                  <tr
                    key={workflow.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))/0.5] cursor-pointer"
                    onClick={() => router.push(`/workflows/${workflow.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{workflow.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={workflow.isActive ? "success" : "outline"}
                      >
                        {workflow.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {timeAgo(workflow.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("dashboard.recentExecutions")}</h2>
        {recentExecutionsQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : !recentExecutionsQuery.data?.length ? (
          <EmptyState
            icon={Play}
            title={t("dashboard.noExecutions")}
            description={t("dashboard.noExecutionsHint")}
          />
        ) : (
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">{t("dashboard.status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dashboard.workflow")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("executions.columnTrigger")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dashboard.duration")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dashboard.time")}</th>
                </tr>
              </thead>
              <tbody>
                {/* 백엔드에서 이미 LIMIT 10 으로 잘라 돌려준다 (DASHBOARD_RECENT_EXECUTIONS_LIMIT) */}
                {recentExecutionsQuery.data.map((execution) => (
                  <tr
                    key={execution.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))/0.5] cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/workflows/${execution.workflowId}/executions/${execution.id}`,
                      )
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="text-base">
                        {statusIcon[execution.status] ?? "\u2753"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {execution.workflowName}
                    </td>
                    <td className="px-4 py-3">
                      <TriggerCell
                        source={execution.triggerSource}
                        label={execution.triggerLabel}
                      />
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {execution.durationMs != null ? formatDuration(execution.durationMs) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {timeAgo(execution.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
