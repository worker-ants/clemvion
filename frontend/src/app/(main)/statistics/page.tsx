"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import {
  Loader2,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  ChevronDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ---------- types ---------- */

interface StatsSummary {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
}

interface ExecutionDataPoint {
  date: string;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface ErrorEntry {
  workflowId: string;
  workflowName: string;
  errorCount: number;
  lastErrorAt: string;
}

interface TopWorkflow {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
}

interface NodeStat {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  executionCount: number;
  avgDurationMs: number;
  errorRate: number;
}

interface LlmUsageByModel {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

interface LlmUsageSummaryResponse {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  topProvider: string | null;
  byModel: LlmUsageByModel[];
}

interface Workflow {
  id: string;
  name: string;
}

/* ---------- constants ---------- */

const PERIODS = ["1d", "7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
};

const PIE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

/* ---------- helpers ---------- */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function extractData<T>(res: { data: { data?: T } | T }): T {
  const d = res.data as { data?: T };
  return (d.data ?? d) as T;
}

/* ---------- Dropdown component ---------- */

function Dropdown({
  trigger,
  children,
  align = "right",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[160px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] text-left"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ---------- custom tooltip ---------- */

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-md text-sm">
      <p className="mb-1 font-medium text-[hsl(var(--foreground))]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[hsl(var(--muted-foreground))]">
            {entry.name}:
          </span>
          <span className="font-medium text-[hsl(var(--foreground))]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- main page ---------- */

export default function StatisticsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

  const workflowParam = selectedWorkflowId || undefined;

  /* --- queries --- */

  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ["workflows-list"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows", {
        params: { limit: 200 },
      });
      const d = extractData<{ items?: Workflow[] } | Workflow[]>(res);
      return Array.isArray(d) ? d : (d as { items?: Workflow[] }).items ?? [];
    },
    staleTime: 60_000,
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<StatsSummary>({
    queryKey: ["statistics-summary", period, selectedWorkflowId],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/summary", {
        params: { period, workflowId: workflowParam },
      });
      return extractData<StatsSummary>(res);
    },
  });

  const { data: executions, isLoading: executionsLoading } = useQuery<
    ExecutionDataPoint[]
  >({
    queryKey: ["statistics-executions", period, selectedWorkflowId],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/executions", {
        params: { period, workflowId: workflowParam },
      });
      return extractData<ExecutionDataPoint[]>(res);
    },
  });

  const { data: errors, isLoading: errorsLoading } = useQuery<ErrorEntry[]>({
    queryKey: ["statistics-errors", period, selectedWorkflowId],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/errors", {
        params: { period, workflowId: workflowParam },
      });
      return extractData<ErrorEntry[]>(res);
    },
  });

  const { data: topWorkflows, isLoading: topLoading } = useQuery<
    TopWorkflow[]
  >({
    queryKey: ["statistics-top-workflows", period],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/top-workflows", {
        params: { period },
      });
      return extractData<TopWorkflow[]>(res);
    },
    enabled: !selectedWorkflowId,
  });

  const { data: nodeStats, isLoading: nodeStatsLoading } = useQuery<
    NodeStat[]
  >({
    queryKey: ["statistics-node-stats", period, selectedWorkflowId],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/node-stats", {
        params: { period, workflowId: selectedWorkflowId },
      });
      return extractData<NodeStat[]>(res);
    },
    enabled: !!selectedWorkflowId,
  });

  const { data: llmUsage, isLoading: llmUsageLoading } =
    useQuery<LlmUsageSummaryResponse>({
      queryKey: ["statistics-llm-usage", period, selectedWorkflowId],
      queryFn: async () => {
        const res = await apiClient.get("/statistics/llm-usage/summary", {
          params: { period, workflowId: workflowParam },
        });
        return extractData<LlmUsageSummaryResponse>(res);
      },
    });

  /* --- derived --- */

  const failureRate = useMemo(() => {
    if (!summary || summary.totalExecutions === 0) return 0;
    return (
      ((summary.failedCount + summary.cancelledCount) /
        summary.totalExecutions) *
      100
    );
  }, [summary]);

  const cards = useMemo(
    () => [
      {
        title: "Total Runs",
        value: summary?.totalExecutions ?? 0,
        format: (v: number) => v.toLocaleString(),
        icon: (
          <Activity className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        ),
      },
      {
        title: "Success Rate",
        value: summary?.successRate ?? 0,
        format: (v: number) => `${v.toFixed(1)}%`,
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      },
      {
        title: "Failure Rate",
        value: failureRate,
        format: (v: number) => `${v.toFixed(1)}%`,
        icon: <XCircle className="h-5 w-5 text-red-500" />,
      },
      {
        title: "Avg Duration",
        value: summary?.avgDurationMs ?? 0,
        format: (v: number) => formatDuration(v),
        icon: (
          <Clock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        ),
      },
    ],
    [summary, failureRate],
  );

  /* --- export handler --- */

  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      try {
        const res = await apiClient.get("/statistics/export", {
          params: { period, format },
          responseType: "blob",
        });
        const blob = new Blob([res.data as BlobPart]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `statistics-${period}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        // silently fail — could add toast in the future
      }
    },
    [period],
  );

  /* --- bottleneck detection for node stats --- */

  const bottleneckNodeId = useMemo(() => {
    if (!nodeStats?.length) return null;
    let maxDuration = -1;
    let id = "";
    for (const ns of nodeStats) {
      if (ns.avgDurationMs > maxDuration) {
        maxDuration = ns.avgDurationMs;
        id = ns.nodeId;
      }
    }
    return id;
  }, [nodeStats]);

  /* --- top workflows data for horizontal bar --- */

  const topWorkflowsChartData = useMemo(() => {
    if (!topWorkflows?.length) return [];
    return [...topWorkflows]
      .sort((a, b) => a.executionCount - b.executionCount)
      .slice(0, 10);
  }, [topWorkflows]);

  /* --- loading state --- */

  const isInitialLoading = summaryLoading;

  /* --- selected workflow name --- */

  const selectedWorkflowName = useMemo(() => {
    if (!selectedWorkflowId) return "All Workflows";
    return (
      workflows?.find((w) => w.id === selectedWorkflowId)?.name ??
      "Unknown Workflow"
    );
  }, [selectedWorkflowId, workflows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Statistics</h1>
        <Dropdown
          trigger={
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
              <ChevronDown className="ml-2 h-3 w-3" />
            </Button>
          }
        >
          <DropdownItem onClick={() => handleExport("csv")}>
            Export as CSV
          </DropdownItem>
          <DropdownItem onClick={() => handleExport("json")}>
            Export as JSON
          </DropdownItem>
        </Dropdown>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Period Selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Workflow Filter */}
        <div className="relative">
          <Dropdown
            trigger={
              <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
                <span className="truncate">{selectedWorkflowName}</span>
                <ChevronDown className="ml-2 h-3 w-3 shrink-0" />
              </Button>
            }
            align="left"
          >
            <DropdownItem onClick={() => setSelectedWorkflowId("")}>
              All Workflows
            </DropdownItem>
            {workflows?.map((wf) => (
              <DropdownItem
                key={wf.id}
                onClick={() => setSelectedWorkflowId(wf.id)}
              >
                {wf.name}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Loading */}
      {isInitialLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {/* Error */}
      {summaryError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load statistics.
        </p>
      )}

      {!isInitialLoading && !summaryError && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  {card.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {card.format(card.value)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Executions Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Executions Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executionsLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : !executions?.length ? (
                  <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    No execution data available
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={executions}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <Tooltip
                          content={<ChartTooltipContent />}
                          cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12 }}
                          iconType="circle"
                          iconSize={8}
                        />
                        <Bar
                          dataKey="completed"
                          stackId="a"
                          fill="#22c55e"
                          name="Completed"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="failed"
                          stackId="a"
                          fill="#ef4444"
                          name="Failed"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="cancelled"
                          stackId="a"
                          fill="#94a3b8"
                          name="Cancelled"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Error Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : !errors?.length ? (
                  <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    No errors recorded
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={errors}
                          dataKey="errorCount"
                          nameKey="workflowName"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={2}
                          label={(props) => {
                            const name = String(
                              (props as unknown as Record<string, unknown>).workflowName ?? "",
                            );
                            const pct = Number(props.percent ?? 0);
                            return `${name} (${(pct * 100).toFixed(0)}%)`;
                          }}
                          labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                        >
                          {errors.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            `${value} errors`,
                          ]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 6,
                            fontSize: 13,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Workflows */}
          {!selectedWorkflowId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Top Workflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topLoading ? (
                  <div className="flex h-72 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : !topWorkflowsChartData.length ? (
                  <div className="flex h-72 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    No workflow data available
                  </div>
                ) : (
                  <div
                    style={{
                      height: Math.max(
                        200,
                        topWorkflowsChartData.length * 40 + 40,
                      ),
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topWorkflowsChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="workflowName"
                          width={160}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <Tooltip
                          formatter={(value) => [
                            Number(value).toLocaleString(),
                            "Executions",
                          ]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 6,
                            fontSize: 13,
                          }}
                          cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }}
                        />
                        <Bar
                          dataKey="executionCount"
                          fill="#3b82f6"
                          name="Executions"
                          radius={[0, 4, 4, 0]}
                          barSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* LLM Token Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                LLM Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {llmUsageLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : !llmUsage || llmUsage.totalTokens === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                  No LLM usage recorded for this period
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border border-[hsl(var(--border))] p-3">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Total Tokens</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums">
                        {llmUsage.totalTokens.toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        prompt {llmUsage.totalPromptTokens.toLocaleString()} ·
                        completion {llmUsage.totalCompletionTokens.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-md border border-[hsl(var(--border))] p-3">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Estimated Cost</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums">
                        {llmUsage.totalCostUsd === null
                          ? "—"
                          : `$${llmUsage.totalCostUsd.toFixed(4)}`}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        알려진 모델 합계 · 미등록 모델 제외
                      </div>
                    </div>
                    <div className="rounded-md border border-[hsl(var(--border))] p-3">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Top Provider</div>
                      <div className="mt-1 text-xl font-semibold">
                        {llmUsage.topProvider ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(var(--border))]">
                          <th className="py-2.5 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">Provider</th>
                          <th className="py-2.5 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">Model</th>
                          <th className="py-2.5 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">Prompt</th>
                          <th className="py-2.5 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">Completion</th>
                          <th className="py-2.5 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">Total</th>
                          <th className="py-2.5 text-right font-medium text-[hsl(var(--muted-foreground))]">Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {llmUsage.byModel.map((row) => (
                          <tr
                            key={`${row.provider}:${row.model}`}
                            className="border-b border-[hsl(var(--border))] last:border-b-0"
                          >
                            <td className="py-2.5 pr-4">
                              <Badge variant="outline">{row.provider}</Badge>
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs">{row.model}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{row.promptTokens.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{row.completionTokens.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{row.totalTokens.toLocaleString()}</td>
                            <td className="py-2.5 text-right tabular-nums">
                              {row.costUsd === null ? "—" : `$${row.costUsd.toFixed(4)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Node Stats Table (only when a specific workflow is selected) */}
          {selectedWorkflowId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Node Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nodeStatsLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : !nodeStats?.length ? (
                  <div className="flex h-32 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    No node statistics available
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(var(--border))]">
                          <th className="py-2.5 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">
                            Node
                          </th>
                          <th className="py-2.5 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">
                            Type
                          </th>
                          <th className="py-2.5 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">
                            Executions
                          </th>
                          <th className="py-2.5 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">
                            Avg Duration
                          </th>
                          <th className="py-2.5 text-right font-medium text-[hsl(var(--muted-foreground))]">
                            Error Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {nodeStats.map((node) => {
                          const isBottleneck =
                            node.nodeId === bottleneckNodeId;
                          return (
                            <tr
                              key={node.nodeId}
                              className={cn(
                                "border-b border-[hsl(var(--border))] last:border-b-0",
                                isBottleneck &&
                                  "bg-amber-50 dark:bg-amber-950/30",
                              )}
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                <span className="flex items-center gap-2">
                                  {node.nodeLabel}
                                  {isBottleneck && (
                                    <Badge variant="warning">Bottleneck</Badge>
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4">
                                <Badge variant="outline">{node.nodeType}</Badge>
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums">
                                {node.executionCount.toLocaleString()}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 pr-4 text-right tabular-nums",
                                  isBottleneck &&
                                    "font-semibold text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {formatDuration(node.avgDurationMs)}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 text-right tabular-nums",
                                  node.errorRate > 10 &&
                                    "font-semibold text-red-600 dark:text-red-400",
                                )}
                              >
                                {node.errorRate.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
