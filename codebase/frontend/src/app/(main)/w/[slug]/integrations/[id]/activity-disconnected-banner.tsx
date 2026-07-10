"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { IntegrationDto } from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";

/**
 * §4.6 — 활동 탭 "연결 안 됨" Inline Alert (spec/0-overview.md §3.4).
 *
 * 통합 `status` 가 `connected` 가 아니면 (`error` / `expired` / `pending_install`)
 * AI Agent 는 MCP bridge 가 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고,
 * 직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패한다 — 즉 **새 활동이 기록되지
 * 않는다**. 이를 단순 "활동 없음"(빈 상태)과 구분해 원인을 알리고, 상태 확인·재연결로
 * 유도하는 [개요 탭] 이동 버튼을 제공한다. `connected`(곧 만료 expires-soon 포함)면 `null`.
 *
 * 톤: §3.4 Inline Alert 톤 매핑(info/warning/error) + status→tone escalation 원칙에
 * 맞춰 `error` 는 red, 그 외 미연결(`expired`/`pending_install`)은 warning(amber) 으로
 * 표시해 같은 페이지 헤더 `StatusBadge`(error=red) 와 신호를 일치시킨다.
 */
export function ActivityDisconnectedBanner({
  status,
  onGoToOverview,
  t,
}: {
  status: IntegrationDto["status"];
  onGoToOverview: () => void;
  t: TFunction;
}) {
  if (status === "connected") return null;
  const isError = status === "error";
  const tone = isError
    ? {
        box: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
        title: "text-red-900 dark:text-red-200",
        hint: "text-red-800 dark:text-red-300",
      }
    : {
        box: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950",
        title: "text-amber-900 dark:text-amber-200",
        hint: "text-amber-800 dark:text-amber-300",
      };
  return (
    <div role="status" className={cn("rounded-lg border p-4", tone.box)}>
      <p className={cn("text-sm font-medium", tone.title)}>
        {t("integrations.activityDisconnectedTitle")}
      </p>
      <p className={cn("mt-1 text-xs", tone.hint)}>
        {t("integrations.activityDisconnectedHint")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={onGoToOverview}
      >
        {t("integrations.activityDisconnectedAction")}
      </Button>
    </div>
  );
}
