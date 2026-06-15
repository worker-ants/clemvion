"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, History, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT, useLocale } from "@/lib/i18n";
import { executionsApi } from "@/lib/api/executions";
import { loadHistoricalExecution } from "@/lib/websocket/apply-execution-snapshot";
import { TriggerCell } from "@/components/executions/trigger-cell";
import {
  STATUS_ICON,
  getStatusLabel,
  formatDuration,
} from "@/lib/utils/execution-status";
import { timeAgo } from "@/lib/utils/date";

/**
 * §7 인-에디터 실행 히스토리 패널 (spec/3-workflow-editor/3-execution.md §7).
 *
 * 에디터 더보기(⋮) 메뉴의 "실행 히스토리"(§7.1)로 열리며, 워크플로의 최근 실행
 * 목록(`GET /executions/workflow/:id`, §7.2)을 보여준다. 항목 클릭 시 그 실행의
 * 상세(`GET /executions/:id`)를 받아 `loadHistoricalExecution` 으로 Run Results
 * 드로어 + 캔버스 오버레이에 적재하고(§7.3 / §10.10) 패널을 닫는다 — 재실행은
 * 드로어 헤더의 Re-run(§10.14 = §7.3 "이 입력으로 다시 실행")이 담당한다.
 *
 * 전용 실행 내역 페이지(2-navigation/14-execution-history.md)와 중복 신설하지
 * 않고, 더 깊은 탐색은 헤더의 "전체 실행" 링크로 위임한다.
 */
export function ExecutionHistoryPanel({
  workflowId,
  open,
  onClose,
}: {
  workflowId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["editor-execution-history", workflowId],
    queryFn: () =>
      executionsApi.getByWorkflow(workflowId, {
        limit: 20,
        sort: "started_at",
        order: "desc",
      }),
    enabled: open && !!workflowId,
  });

  const handleSelect = useCallback(
    async (id: string) => {
      setLoadingId(id);
      try {
        // 목록 응답은 노드 본문을 제외하므로(§5 R-1) 상세를 별도 조회해 적재한다.
        const detail = await executionsApi.getById(id);
        loadHistoricalExecution(detail);
        onClose();
      } catch (error) {
        console.error("Load execution history failed:", error);
        toast.error(t("editor.executionHistoryLoadFailed"));
      } finally {
        setLoadingId(null);
      }
    },
    [onClose, t],
  );

  if (!open) return null;

  const executions = historyQuery.data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.executionHistory")}
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--card-foreground))]">
            <History size={15} />
            {t("editor.executionHistory")}
          </h3>
          <div className="flex items-center gap-1">
            <a
              href={`/workflows/${workflowId}/executions`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {t("editor.allExecutions")}
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <X size={15} />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 size={14} className="animate-spin" />
              {t("common.loading")}
            </div>
          ) : historyQuery.isError ? (
            <div className="p-6 text-center text-xs text-[hsl(var(--destructive))]">
              {t("editor.executionHistoryListFailed")}
            </div>
          ) : executions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              {t("editor.executionHistoryEmpty")}
            </div>
          ) : (
            <ul>
              {executions.map((ex) => {
                const completed = ex.completedNodeCount ?? 0;
                const total = ex.totalNodeCount ?? 0;
                const failed = ex.failedNodeCount ?? 0;
                return (
                  <li key={ex.id}>
                    <button
                      className="flex w-full items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-2.5 text-left text-xs last:border-b-0 hover:bg-[hsl(var(--accent))] disabled:opacity-60"
                      disabled={loadingId != null}
                      onClick={() => void handleSelect(ex.id)}
                    >
                      <span
                        className="shrink-0"
                        aria-hidden="true"
                        title={getStatusLabel(ex.status, locale)}
                      >
                        {STATUS_ICON[ex.status] ?? "•"}
                      </span>
                      <span className="w-32 shrink-0 truncate">
                        <TriggerCell
                          source={ex.triggerSource}
                          label={ex.triggerLabel}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-[hsl(var(--muted-foreground))]">
                        {formatDuration(ex.durationMs, locale)}
                      </span>
                      <span className="w-24 shrink-0 text-[hsl(var(--muted-foreground))]">
                        {completed}/{total}
                        {failed > 0
                          ? ` ${t("executions.failedCount", { count: failed })}`
                          : ""}
                      </span>
                      <span className="flex-1 truncate text-right text-[hsl(var(--muted-foreground))]">
                        {loadingId === ex.id ? (
                          <Loader2
                            size={12}
                            className="ml-auto animate-spin"
                          />
                        ) : (
                          timeAgo(ex.startedAt, locale)
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
