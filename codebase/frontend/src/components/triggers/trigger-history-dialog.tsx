"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** API 호출 시 가져올 최대 이력 건수. 테스트와 단일 진실 유지를 위해 상수로 추출. */
const HISTORY_LIMIT = 10;

interface TriggerHistoryEntry {
  id: string;
  startedAt: string;
  status: string;
}

interface Props {
  /** 조회할 트리거 ID. null 이면 dialog 가 닫혀 있어야 한다 (query disabled). */
  triggerId: string | null;
  /** 다이얼로그 타이틀에 표시할 트리거 이름. 빈 문자열 fallback. */
  triggerName?: string;
  /** true 이면 Dialog 를 마운트·표시한다. false 이면 쿼리도 비활성화된다 (enabled: !!triggerId && open). */
  open: boolean;
  /** Dialog 닫기 요청 시 부모가 historyTarget 을 null 로 되돌리는 핸들러. */
  onClose: () => void;
  /**
   * "전체 상세 보기" 버튼 — 부모(page.tsx)가 dialog 를 닫고 detail drawer 를 여는
   * 트랜지션을 수행. prop 미전달 시 버튼 자체가 노출되지 않는다.
   */
  onOpenFullDetail?: () => void;
}

/**
 * Spec `spec/2-navigation/2-trigger-list.md §2.1` + Rationale R-6 —
 * ⋮ 메뉴의 "호출 이력" 진입 전용 modal.
 *
 * detail drawer 와 달리 메타·인증·EIA·Schedule 카드는 노출되지 않고
 * Recent Calls 만 표시한다 ("이 트리거가 최근에 잘 호출되고 있는가" 만 빠르게
 * 확인하는 시나리오). 풀 상세 보기로 승격하려면 푸터의 `onOpenFullDetail`
 * 버튼 사용.
 */
export function TriggerHistoryDialog({
  triggerId,
  triggerName,
  open,
  onClose,
  onOpenFullDetail,
}: Props) {
  const t = useT();
  const {
    data: history = [],
    isLoading,
    isError,
  } = useQuery<TriggerHistoryEntry[]>({
    queryKey: ["trigger-history-dialog", triggerId],
    queryFn: async () => {
      const res = await apiClient.get(`/triggers/${triggerId}/history`, {
        params: { limit: HISTORY_LIMIT },
      });
      const data = res.data.data ?? res.data;
      return Array.isArray(data) ? data : (data.items ?? []);
    },
    enabled: !!triggerId && open,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("triggers.history.title", { name: triggerName ?? "" })}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--destructive))]">
              {t("triggers.history.loadFailed")}
            </p>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("triggers.history.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
                >
                  <span className="text-[hsl(var(--muted-foreground))]">
                    {formatDate(entry.startedAt, "datetime")}
                  </span>
                  <Badge
                    variant={
                      entry.status === "success"
                        ? "success"
                        : entry.status === "error" || entry.status === "failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {entry.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("triggers.history.close")}
          </Button>
          {onOpenFullDetail && (
            <Button type="button" onClick={onOpenFullDetail}>
              {t("triggers.history.viewFullDetail")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
