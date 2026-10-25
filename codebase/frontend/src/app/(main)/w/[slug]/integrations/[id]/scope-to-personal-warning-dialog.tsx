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
 * 조직 통합을 개인으로 바꾸기 전 확인 다이얼로그(REQ-INTMGMT-057).
 *
 * 통합 소유자가 아닌 사람이 작성한 워크플로우가 이 통합을 쓰면 그 목록과 함께 전환 뒤 실행이 실패한다고 알린다. 전환은 막지
 * 않고 관리자가 확인하면 바꾼다. 그런 워크플로우가 없으면 이 다이얼로그를 띄우지 않는다.
 */
export function ScopeToPersonalWarningDialog({
  open,
  onOpenChange,
  usages,
  onConfirm,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 워크플로우 작성자가 통합 소유자가 아닌 사용처만 넘긴다. */
  usages: UsageWorkflow[];
  onConfirm: () => void;
  t: TFunction;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("integrations.scopeToPersonalWarningTitle")}</DialogTitle>
          <DialogDescription>
            {t("integrations.scopeToPersonalWarningDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto">
          <UsageNodeList usages={usages} t={t} variant="dialog" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("integrations.cancelBtn")}
          </Button>
          <Button onClick={onConfirm}>
            {t("integrations.scopeToPersonalWarningConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
