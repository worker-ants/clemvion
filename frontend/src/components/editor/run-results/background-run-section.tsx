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
  const { data, isLoading, isError } = useBackgroundRun(
    executionId,
    backgroundRunId,
  );

  if (!backgroundRunId) return null;

  if (isLoading) {
    return (
      <SectionShell>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>Background 본문 실행 정보를 불러오고 있어요.</span>
        </div>
      </SectionShell>
    );
  }

  if (isError || !data) {
    return (
      <SectionShell>
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          <span>본문 실행 정보를 가져오지 못했어요.</span>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <Header
        status={data.status}
        startedAt={data.startedAt}
        completedAt={data.completedAt}
        durationMs={data.durationMs}
        backgroundRunId={data.backgroundRunId}
      />
      <NodeExecutionsList nodes={data.nodeExecutions.data} hasMore={data.nodeExecutions.hasMore} />
      <Notifications notifications={data.notifications} />
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-md border border-gray-200 bg-gray-50/60 p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
        Background body run
      </h4>
      {children}
    </section>
  );
}

function Header({
  status,
  startedAt,
  completedAt,
  durationMs,
  backgroundRunId,
}: {
  status: BackgroundRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  backgroundRunId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <RunStatusBadge status={status} />
        {durationMs != null && (
          <span className="text-gray-600">{formatDuration(durationMs)}</span>
        )}
      </div>
      <div className="text-[11px] text-gray-500 flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>Started {formatDate(startedAt, "datetime")}</span>
        {completedAt && <span> · Ended {formatDate(completedAt, "datetime")}</span>}
      </div>
      <div className="text-[11px] text-gray-400 font-mono">
        Run ID: {backgroundRunId}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: BackgroundRunStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300"
        >
          <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" aria-hidden="true" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-green-700 border-green-300"
        >
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-red-700 border-red-300"
        >
          <XCircle className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
          Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-gray-700 border-gray-300"
        >
          Cancelled
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-gray-600 border-gray-300"
        >
          Pending
        </Badge>
      );
  }
}

function NodeExecutionsList({
  nodes,
  hasMore,
}: {
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
        본문 노드가 아직 실행되지 않았어요.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-gray-600 font-medium">
        Body nodes ({sorted.length}
        {hasMore ? "+" : ""})
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
          본문 노드가 더 있어요. 첫 50개만 표시.
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
  notifications,
}: {
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
        Notifications ({notifications.length})
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
