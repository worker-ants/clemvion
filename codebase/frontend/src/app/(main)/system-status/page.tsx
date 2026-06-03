"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useT, type TranslationKey } from "@/lib/i18n";
import { Activity, Info, RefreshCw } from "lucide-react";

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
  recentFailed: number;
  recentFailedCapped: boolean;
  concurrency: number;
  utilization: number;
  isPaused: boolean;
  health: QueueHealth;
}

interface SystemStatusOverview {
  generatedAt: string;
  overall: QueueHealth;
  totalFailed: number;
  totalRecentFailed: number;
  recentFailedCapped: boolean;
  failedWindowMinutes: number;
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
      // 에러 상태에서는 폴링 중단 — 401/5xx 연속 발생 시 서버 로그 오염 방지 (I-16).
      refetchInterval: (query) =>
        query.state.status === "error" ? false : 5000,
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

      {isLoading && <SystemStatusSkeleton />}

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
          <OverallHeader
            overall={data.overall}
            totalRecentFailed={data.totalRecentFailed}
            recentFailedCapped={data.recentFailedCapped}
            totalFailed={data.totalFailed}
            failedWindowMinutes={data.failedWindowMinutes}
          />
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

function SystemStatusSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      {/* overall header skeleton */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* queue group skeletons */}
      {[0, 1].map((g) => (
        <div key={g} className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((c) => (
              <div key={c} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1">
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-5 w-6 mx-auto animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function OverallHeader({
  overall,
  totalRecentFailed,
  recentFailedCapped,
  totalFailed,
  failedWindowMinutes,
}: {
  overall: QueueHealth;
  totalRecentFailed: number;
  recentFailedCapped: boolean;
  totalFailed: number;
  failedWindowMinutes: number;
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
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {/* 주 지표: 최근 윈도우 실패 */}
          <span>
            {t("systemStatus.totalRecentFailed", {
              minutes: failedWindowMinutes,
            })}
            :{" "}
            <span
              className={cn(
                "font-semibold",
                totalRecentFailed > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground",
              )}
            >
              {totalRecentFailed}
              {recentFailedCapped ? "+" : ""}
            </span>
          </span>
          {/* 부 지표: 누적 보관 */}
          <span className="text-xs">
            {t("systemStatus.totalRetainedFailed")}:{" "}
            <span className="font-medium text-foreground">{totalFailed}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueCard({ queue }: { queue: QueueStatus }) {
  const t = useT();
  const utilPct = Math.min(Math.round(queue.utilization * 100), 100);
  const isSystemGroup = queue.group === "system";

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
          {/* 주 수치: 최근 윈도우 실패 (recentFailed). 누적 보관은 아래 줄에 부 수치로 병기 */}
          <CountCell
            label={t("systemStatus.counts.recentFailed")}
            value={queue.recentFailed}
            danger={queue.recentFailed > 0}
            capped={queue.recentFailedCapped}
          />
        </dl>
        <p className="text-center text-xs text-muted-foreground">
          {t("systemStatus.counts.retainedFailed")}: {queue.counts.failed}
        </p>

        {isSystemGroup ? (
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
  capped,
}: {
  label: string;
  value: number;
  danger?: boolean;
  /** 값이 스캔 캡 소진으로 하한값이면 "N+" 로 표기 */
  capped?: boolean;
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
        {capped ? "+" : ""}
      </dd>
    </div>
  );
}
