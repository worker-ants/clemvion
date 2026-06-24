"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggersApi } from "@/lib/api/triggers";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TriggerDeleteTarget {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  workflowName?: string;
  webhookUrl?: string;
  cronExpression?: string;
  nextRunAt?: string;
}

interface Props {
  trigger: TriggerDeleteTarget | null;
  open: boolean;
  onClose: () => void;
  /**
   * 삭제 성공(또는 404 동시삭제) 직후 호출 — 호출자 전용 후처리.
   * 이 컴포넌트는 항상 `["triggers"]` 캐시를 무효화하지만, 웹채팅 콘솔처럼 별도 캐시 키
   * (`["web-chat-instances"]`)·선택 상태를 가진 화면은 이 콜백에서 추가 무효화·리셋한다.
   * 미전달 시(triggers 목록 단독 사용처) 기존 동작 그대로.
   */
  onDeleted?: () => void;
}

function isAxiosLikeStatus(err: unknown, status: number): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = (err as { response?: { status?: number } }).response;
  return candidate?.status === status;
}

/**
 * Spec `spec/2-navigation/2-trigger-list.md §4` — 트리거 삭제 확인 다이얼로그.
 *
 * 트리거 type 에 따라 본문 텍스트가 분기되고 (webhook/schedule/manual),
 * 사용자가 트리거 이름을 정확히 입력해야만 삭제 버튼이 활성화된다.
 *
 * 외부에서 `trigger` 가 바뀌면 key 가 변하면서 내부 state (confirm input) 가 초기화된다.
 *
 * **캐시 무효화 책임**: 이 컴포넌트는 삭제 성공/404 동시 삭제 시 `queryClient.invalidateQueries(["triggers"])`
 * 를 직접 호출한다. 별도 캐시 키·선택 상태를 가진 화면(웹채팅 콘솔: `["web-chat-instances"]`)은
 * `onDeleted` 콜백에서 추가 무효화·리셋을 수행한다 — 이 컴포넌트의 `["triggers"]` 무효화는
 * 그대로 유지되므로 콜백은 "추가" 책임만 진다.
 */
export function TriggerDeleteDialog(props: Props) {
  return <DialogInner key={props.trigger?.id ?? "__none__"} {...props} />;
}

function DialogInner({ trigger, open, onClose, onDeleted }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await triggersApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      onDeleted?.();
      toast.success(t("triggers.deleted"));
      onClose();
    },
    onError: (err) => {
      // 동시 삭제 시 404 — 결과적으로는 이미 사라졌으므로 silent invalidate + 안내 1회.
      if (isAxiosLikeStatus(err, 404)) {
        queryClient.invalidateQueries({ queryKey: ["triggers"] });
        onDeleted?.();
        toast.message(t("triggers.notFoundOnDelete"));
        onClose();
        return;
      }
      toast.error(t("triggers.deleteFailed"));
    },
  });

  if (!trigger) return null;

  const confirmBody =
    trigger.type === "webhook"
      ? t("triggers.delete.confirm.webhook", {
          url: trigger.webhookUrl ?? "(unknown URL)",
        })
      : trigger.type === "schedule"
        ? t("triggers.delete.confirm.schedule", {
            cron: trigger.cronExpression ?? "—",
            nextRunAt: trigger.nextRunAt
              ? formatDate(trigger.nextRunAt, "datetime")
              : "—",
          })
        : t("triggers.delete.confirm.manual", {
            workflowName: trigger.workflowName ?? "—",
          });

  const isConfirmMatch = confirmText.trim() === trigger.name.trim();
  const disabled = !isConfirmMatch || deleteMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("triggers.delete.title")}</DialogTitle>
          <DialogDescription>{confirmBody}</DialogDescription>
        </DialogHeader>

        {trigger.type === "schedule" && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[hsl(var(--destructive))/0.4] bg-[hsl(var(--destructive))/0.08] px-3 py-2 text-xs text-[hsl(var(--destructive))]"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{t("triggers.delete.cascadeWarning")}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="trigger-delete-confirm">
            {t("triggers.delete.typeNameToConfirm", { name: trigger.name })}
          </Label>
          <Input
            id="trigger-delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled}
            onClick={() => deleteMutation.mutate(trigger.id)}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("triggers.delete.button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
