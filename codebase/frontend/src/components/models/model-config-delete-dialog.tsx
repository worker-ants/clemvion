"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useT } from "@/lib/i18n";

interface ModelConfigDeleteDialogProps {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** ModelConfig 삭제 확인 다이얼로그. 공용 ConfirmModal 위 thin wrapper. */
export function ModelConfigDeleteDialog({
  open,
  pending,
  onConfirm,
  onCancel,
}: ModelConfigDeleteDialogProps) {
  const t = useT();
  return (
    <ConfirmModal
      open={open}
      title={t("models.deleteTitle")}
      message={t("models.deleteMessage")}
      confirmLabel={t("common.delete")}
      cancelLabel={t("common.cancel")}
      onConfirm={onConfirm}
      onCancel={onCancel}
      pending={pending}
      destructive
    />
  );
}
