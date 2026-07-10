"use client";

import { Button } from "@/components/ui/button";
import type { IntegrationDto } from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";

/**
 * §4.6 — 활동 탭 "연결 안 됨" 배너.
 *
 * 통합 `status` 가 `connected` 가 아니면 (`error` / `expired` / `pending_install`)
 * AI Agent 는 MCP bridge 가 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고,
 * 직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패한다 — 즉 **새 활동이 기록되지
 * 않는다**. 이를 단순 "활동 없음"(빈 상태)과 구분해 원인을 알리고, 상태 확인·재연결로
 * 유도하는 [개요 탭] 이동 버튼을 제공한다. `connected`(곧 만료 포함)면 `null`.
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
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {t("integrations.activityDisconnectedTitle")}
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
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
