"use client";

import { useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { useBackgroundRun } from "@/lib/websocket/use-background-run";
import { useT, type TFunction } from "@/lib/i18n";
import type { BackgroundRunStatus } from "@/lib/api/executions";
import { formatDuration } from "./utils";

/**
 * Background 노드의 상세 뷰 안에 펼쳐지는 본문 실행 결과 섹션.
 *
 * spec/3-workflow-editor/3-execution.md §10.15 의 시각/인터랙션 규약을 구현.
 * 본문 NodeExecution 의 개별 이벤트는 기존 `execution:<id>` 채널을 main
 * timeline 측이 처리하므로 본 섹션은 backgroundRun 의 **집계 상태와 본문
 * 노드 목록** 만 책임진다. backgroundRunId 가 부재하면 (옛 NodeExecution)
 * 본 섹션 자체를 렌더링하지 않는다.
 */
export function BackgroundRunSection({
  executionId,
  backgroundRunId,
}: {
  executionId: string;
  backgroundRunId: string | null;
}) {
  const t = useT();
  const { data, isLoading, isError } = useBackgroundRun(
    executionId,
    backgroundRunId,
  );

  if (!backgroundRunId) return null;

  if (isLoading) {
    return (
      <SectionShell t={t}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>{t("executions.backgroundRun.loading")}</span>
        </div>
      </SectionShell>
    );
  }

  if (isError || !data) {
    return (
      <SectionShell t={t}>
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          <span>{t("executions.backgroundRun.loadFailed")}</span>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell t={t}>
      <Header
        t={t}
        status={data.status}
        startedAt={data.startedAt}
        completedAt={data.completedAt}
        durationMs={data.durationMs}
        backgroundRunId={data.backgroundRunId}
      />
      <NodeExecutionsList
        t={t}
        nodes={data.nodeExecutions.data}
        hasMore={data.nodeExecutions.hasMore}
      />
      <Notifications t={t} notifications={data.notifications} />
    </SectionShell>
  );
}

function SectionShell({
  t,
  children,
}: {
  t: TFunction;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 rounded-md border border-gray-200 bg-gray-50/60 p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {t("executions.backgroundRun.sectionTitle")}
      </h4>
      {children}
    </section>
  );
}

function Header({
  t,
  status,
  startedAt,
  completedAt,
  durationMs,
  backgroundRunId,
}: {
  t: TFunction;
  status: BackgroundRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  backgroundRunId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <RunStatusBadge t={t} status={status} />
        {durationMs != null && (
          <span className="text-gray-600">{formatDuration(durationMs)}</span>
        )}
      </div>
      <div className="text-[11px] text-gray-500 flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>
          {t("executions.backgroundRun.startedAt", {
            when: formatDate(startedAt, "datetime"),
          })}
        </span>
        {completedAt && (
          <span>
            {" · "}
            {t("executions.backgroundRun.endedAt", {
              when: formatDate(completedAt, "datetime"),
            })}
          </span>
        )}
      </div>
      <div className="text-[11px] text-gray-400 font-mono">
        {t("executions.backgroundRun.runIdLabel", { id: backgroundRunId })}
      </div>
    </div>
  );
}

function RunStatusBadge({
  t,
  status,
}: {
  t: TFunction;
  status: BackgroundRunStatus;
}) {
  switch (status) {
    case "running":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300"
        >
          <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" aria-hidden="true" />
          {t("executions.backgroundRun.statusRunning")}
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-green-700 border-green-300"
        >
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
          {t("executions.backgroundRun.statusCompleted")}
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-red-700 border-red-300"
        >
          <XCircle className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
          {t("executions.backgroundRun.statusFailed")}
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-gray-600 border-gray-300"
        >
          {t("executions.backgroundRun.statusPending")}
        </Badge>
      );
  }
}

function NodeExecutionsList({
  t,
  nodes,
  hasMore,
}: {
  t: TFunction;
  nodes: Array<{
    id: string;
    nodeId: string;
    status: string;
    durationMs: number | null;
  }>;
  hasMore: boolean;
}) {
  const sorted = useMemo(() => nodes, [nodes]);
  if (sorted.length === 0) {
    return (
      <p className="text-[11px] text-gray-500">
        {t("executions.backgroundRun.bodyNodesEmpty")}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-gray-600 font-medium">
        {t("executions.backgroundRun.bodyNodes", {
          count: sorted.length,
          suffix: hasMore ? "+" : "",
        })}
      </div>
      <ul className="space-y-1">
        {sorted.map((n) => (
          <li
            key={n.id}
            className={cn(
              "flex items-center justify-between text-[11px] rounded border border-gray-200 bg-white px-2 py-1",
              n.status === "failed" && "border-red-200 bg-red-50/30",
            )}
          >
            <span className="font-mono text-gray-600 truncate">
              {n.nodeId}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <NodeStatusTag status={n.status} />
              {n.durationMs != null && (
                <span>{formatDuration(n.durationMs)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <p className="text-[10px] text-gray-400">
          {t("executions.backgroundRun.bodyNodesTruncated")}
        </p>
      )}
    </div>
  );
}

function NodeStatusTag({ status }: { status: string }) {
  const palette: Record<string, string> = {
    completed: "text-green-700",
    failed: "text-red-700",
    running: "text-blue-600",
    skipped: "text-gray-500",
    pending: "text-gray-500",
    waiting_for_input: "text-amber-600",
  };
  return (
    <span className={cn("uppercase tracking-wide", palette[status] ?? "text-gray-600")}>
      {status}
    </span>
  );
}

function Notifications({
  t,
  notifications,
}: {
  t: TFunction;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}) {
  if (notifications.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-gray-600 font-medium">
        {t("executions.backgroundRun.notifications", {
          count: notifications.length,
        })}
      </div>
      <ul className="space-y-1">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="text-[11px] rounded border border-amber-200 bg-amber-50/40 px-2 py-1"
          >
            <div className="font-medium text-amber-900">{n.title}</div>
            <div className="text-amber-800">{n.message}</div>
            <div className="text-[10px] text-amber-700">
              {formatDate(n.createdAt, "datetime")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
