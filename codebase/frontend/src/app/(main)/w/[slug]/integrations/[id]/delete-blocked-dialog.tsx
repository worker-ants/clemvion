"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UsageWorkflow } from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";
import { UsageNodeList } from "./usage-node-list";

/**
 * 통합 삭제 차단 다이얼로그 (§7.2).
 *
 * 삭제하려는 통합을 참조하는 워크플로우/노드가 1건 이상이면 삭제 대신 본
 * 다이얼로그를 띄워 사용처 목록(각 노드의 `usageKind` 배지 포함) 과 "먼저
 * 노드를 교체/제거하세요" 안내를 보여준다. 각 워크플로우로 이동하는
 * "워크플로우 열기" 링크를 함께 노출한다.
 *
 * 사용처는 (a) 삭제 클릭 시 사전 `GET /usages` 조회 결과, 또는 (b) 사전
 * 조회와 실제 DELETE 사이 race 로 서버가 409 `INTEGRATION_IN_USE` 와 함께
 * 돌려준 `usages` 둘 중 하나로 채워진다.
 *
 * SoT: spec/2-navigation/4-integration.md §4.7 / §7.2.
 */
export function DeleteBlockedDialog({
  open,
  onOpenChange,
  integrationName,
  usages,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationName: string;
  usages: UsageWorkflow[];
  t: TFunction;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("integrations.deleteBlockedTitle", { name: integrationName })}
          </DialogTitle>
          <DialogDescription>
            {t("integrations.deleteBlockedDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto">
          <UsageNodeList usages={usages} t={t} variant="dialog" />
        </div>

        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("integrations.deleteBlockedHint")}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("integrations.deleteBlockedClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
