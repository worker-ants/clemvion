"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Activity,
  Play,
  CheckCircle,
  Plus,
  Workflow,
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
import { timeAgo } from "@/lib/utils/date";

interface DashboardSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  runs7d: number;
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function DashboardPage() {
  const router = useRouter();

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

  const summary = summaryQuery.data;

  const summaryCards = [
    {
      label: "Total Workflows",
      value: summary?.totalWorkflows ?? 0,
      icon: GitBranch,
    },
    {
      label: "Active Workflows",
      value: summary?.activeWorkflows ?? 0,
      icon: Activity,
    },
    {
      label: "Executions (7d)",
      value: summary?.runs7d ?? 0,
      icon: Play,
    },
    {
      label: "Success Rate",
      value: summary ? `${Math.round(summary.successRate)}%` : "0%",
      icon: CheckCircle,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button
          onClick={() => createWorkflowMutation.mutate()}
          disabled={createWorkflowMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
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
                <Card key={card.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {card.label}
                    </CardTitle>
                    <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Recent Workflows */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Workflows</h2>
        {recentWorkflowsQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : !recentWorkflowsQuery.data?.length ? (
          <EmptyState
            icon={Workflow}
            title="No workflows yet"
            description="Create your first workflow to get started."
            action={
              <Button
                onClick={() => createWorkflowMutation.mutate()}
                disabled={createWorkflowMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Last Updated
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
                        {workflow.isActive ? "Active" : "Inactive"}
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
        <h2 className="text-xl font-semibold mb-4">Recent Executions</h2>
        {recentExecutionsQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : !recentExecutionsQuery.data?.length ? (
          <EmptyState
            icon={Play}
            title="No executions yet"
            description="Run a workflow to see execution history here."
          />
        ) : (
          <div className="rounded-md border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Workflow</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentExecutionsQuery.data.slice(0, 10).map((execution) => (
                  <tr
                    key={execution.id}
                    className="border-b border-[hsl(var(--border))] last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <span className="text-base">
                        {statusIcon[execution.status] ?? "\u2753"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {execution.workflowName}
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
