"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { Loader2, Activity, CheckCircle, XCircle, Clock } from "lucide-react";

interface StatsSummary {
  totalRuns: number;
  successRate: number;
  failureRate: number;
  avgDuration: number;
}

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
};

export default function StatisticsPage() {
  const [period, setPeriod] = useState<Period>("7d");

  const { data: summary, isLoading, isError } = useQuery<StatsSummary>({
    queryKey: ["statistics", period],
    queryFn: async () => {
      const res = await apiClient.get("/statistics/summary", {
        params: { period },
      });
      return res.data.data ?? res.data;
    },
  });

  const cards = [
    {
      title: "Total Runs",
      value: summary?.totalRuns ?? 0,
      format: (v: number) => v.toLocaleString(),
      icon: <Activity className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />,
    },
    {
      title: "Success Rate",
      value: summary?.successRate ?? 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    },
    {
      title: "Failure Rate",
      value: summary?.failureRate ?? 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: <XCircle className="h-5 w-5 text-red-500" />,
    },
    {
      title: "Avg Duration",
      value: summary?.avgDuration ?? 0,
      format: (v: number) => `${v.toFixed(1)}s`,
      icon: <Clock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Statistics</h1>

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

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load statistics.
        </p>
      )}

      {!isLoading && !isError && (
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

          {/* Placeholder Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div
              className={cn(
                "flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))]",
                "text-sm text-[hsl(var(--muted-foreground))]",
              )}
            >
              Chart: Executions Over Time
            </div>
            <div
              className={cn(
                "flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))]",
                "text-sm text-[hsl(var(--muted-foreground))]",
              )}
            >
              Chart: Error Distribution
            </div>
          </div>
          <div
            className={cn(
              "flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))]",
              "text-sm text-[hsl(var(--muted-foreground))]",
            )}
          >
            Chart: Top Workflows
          </div>
        </>
      )}
    </div>
  );
}
