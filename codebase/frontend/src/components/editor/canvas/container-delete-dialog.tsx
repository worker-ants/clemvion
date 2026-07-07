"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export type ContainerDeleteMode = "deleteAll" | "ungroup";

interface Props {
  /** 컨테이너 사용자 레이블 (메시지에 표시). */
  containerLabel: string;
  /** 자식 노드 수 (메시지에 표시). */
  childCount: number;
  onConfirm: (mode: ContainerDeleteMode) => void;
  onCancel: () => void;
}

/**
 * §11.3 컨테이너 삭제 확인 다이얼로그. 자식이 있는 컨테이너를 삭제할 때
 * "컨테이너+자식 전체 삭제" vs "그룹 해제(자식 유지)" 를 라디오로 선택한다.
 * 기본 선택은 비파괴적인 **Ungroup** (§11.3.2). 빈 컨테이너는 이 다이얼로그
 * 없이 즉시 삭제되므로(§11.3.3) 여기 도달하지 않는다.
 *
 * `ConfirmModal` 은 확인/취소 2버튼만 지원해 라디오 UX 에 맞지 않아 별도 컴포넌트로 둔다.
 */
export function ContainerDeleteDialog({
  containerLabel,
  childCount,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [mode, setMode] = useState<ContainerDeleteMode>("ungroup");

  return (
    <div
      role="dialog"
      aria-label={t("editor.containerDelete.title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg">
        <h3 className="mb-2 text-sm font-semibold">
          {t("editor.containerDelete.title")}
        </h3>
        <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
          {t("editor.containerDelete.message", {
            label: containerLabel,
            count: childCount,
          })}
        </p>

        <div className="mb-4 flex flex-col gap-2">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              name="container-delete-mode"
              className="mt-0.5"
              checked={mode === "deleteAll"}
              onChange={() => setMode("deleteAll")}
            />
            <span>{t("editor.containerDelete.deleteAllOption")}</span>
          </label>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              name="container-delete-mode"
              className="mt-0.5"
              checked={mode === "ungroup"}
              onChange={() => setMode("ungroup")}
            />
            <span>{t("editor.containerDelete.ungroupOption")}</span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-testid="container-delete-cancel-btn"
          >
            {t("editor.containerDelete.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(mode)}
            data-testid="container-delete-confirm-btn"
          >
            <Trash2 size={12} className="mr-1.5" />
            {t("editor.containerDelete.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
