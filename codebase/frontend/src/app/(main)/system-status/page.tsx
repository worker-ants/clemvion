"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useT, type TranslationKey } from "@/lib/i18n";
import { Activity, Info, Loader2, RefreshCw } from "lucide-react";

/* ---------- types (mirror of backend SystemStatusOverviewDto) ---------- */

type QueueHealth = "healthy" | "degraded" | "down";
type QueueGroup = "execution" | "knowledge-base" | "integration" | "system";

interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
}

interface QueueStatus {
  name: string;
  group: QueueGroup;
  counts: QueueCounts;
  concurrency: number;
  utilization: number;
  isPaused: boolean;
  health: QueueHealth;
}

interface SystemStatusOverview {
  generatedAt: string;
  overall: QueueHealth;
  totalFailed: number;
  queues: QueueStatus[];
}

const GROUP_ORDER: QueueGroup[] = [
  "execution",
  "knowledge-base",
  "integration",
  "system",
];

/* ---------- helpers ---------- */

function extractData<T>(res: { data: { data?: T } | T }): T {
  const d = res.data as { data?: T };
  return (d.data ?? d) as T;
}

const HEALTH_DOT: Record<QueueHealth, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

const HEALTH_TEXT: Record<QueueHealth, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-amber-600 dark:text-amber-400",
  down: "text-red-600 dark:text-red-400",
};

const GAUGE_FILL: Record<QueueHealth, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

export default function SystemStatusPage() {
  const t = useT();

  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<SystemStatusOverview>({
      queryKey: ["system-status", "overview"],
      queryFn: async () => {
        const res = await apiClient.get("/system-status/overview");
        return extractData<SystemStatusOverview>(res);
      },
      refetchInterval: 5000,
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold">{t("systemStatus.title")}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
            aria-hidden
          />
          {t("systemStatus.refresh")}
        </Button>
      </div>

      {/* system-wide banner */}
      <div
        className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t("systemStatus.systemWideBanner")}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {t("systemStatus.loading")}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-muted-foreground">
            {t("systemStatus.loadFailed")}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("systemStatus.retry")}
          </Button>
        </div>
      )}

      {data && (
        <>
          <OverallHeader overall={data.overall} totalFailed={data.totalFailed} />
          {GROUP_ORDER.map((group) => {
            const queues = data.queues.filter((q) => q.group === group);
            if (queues.length === 0) return null;
            return (
              <section key={group} className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t(`systemStatus.groups.${group}` as TranslationKey)}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {queues.map((q) => (
                    <QueueCard key={q.name} queue={q} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function OverallHeader({
  overall,
  totalFailed,
}: {
  overall: QueueHealth;
  totalFailed: number;
}) {
  const t = useT();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <span
            className={cn("h-3 w-3 rounded-full", HEALTH_DOT[overall])}
            aria-hidden
          />
          <span className={cn("text-lg font-semibold", HEALTH_TEXT[overall])}>
            {t(`systemStatus.overall.${overall}` as TranslationKey)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {t("systemStatus.totalFailed")}:{" "}
          <span
            className={cn(
              "font-semibold",
              totalFailed > 0
                ? "text-red-600 dark:text-red-400"
                : "text-foreground",
            )}
          >
            {totalFailed}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueCard({ queue }: { queue: QueueStatus }) {
  const t = useT();
  const utilPct = Math.min(Math.round(queue.utilization * 100), 100);
  const isCron = queue.group === "system";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium">
          {queue.name}
        </CardTitle>
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={cn("h-2.5 w-2.5 rounded-full", HEALTH_DOT[queue.health])}
            aria-hidden
          />
          <span className={HEALTH_TEXT[queue.health]}>
            {t(`systemStatus.health.${queue.health}` as TranslationKey)}
          </span>
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-4 gap-2 text-center text-xs">
          <CountCell label={t("systemStatus.counts.waiting")} value={queue.counts.waiting} />
          <CountCell label={t("systemStatus.counts.active")} value={queue.counts.active} />
          <CountCell label={t("systemStatus.counts.delayed")} value={queue.counts.delayed} />
          <CountCell
            label={t("systemStatus.counts.failed")}
            value={queue.counts.failed}
            danger={queue.counts.failed > 0}
          />
        </dl>

        {isCron ? (
          <p className="text-xs text-muted-foreground">
            {t("systemStatus.scheduledJob")}
            {queue.isPaused && ` · ${t("systemStatus.paused")}`}
          </p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("systemStatus.utilization")}</span>
              <span>{utilPct}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={utilPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("systemStatus.utilization")}
            >
              <div
                className={cn("h-full rounded-full", GAUGE_FILL[queue.health])}
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountCell({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-base font-semibold",
          danger && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
