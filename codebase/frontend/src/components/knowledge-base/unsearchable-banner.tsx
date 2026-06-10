"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { useT } from "@/lib/i18n";

interface Props {
  /** `embeddingDimension == null` KB 의 재임베딩 상태. 호출부가 게이트(null 일 때만 렌더)를 책임진다. */
  reembedStatus: "idle" | "in_progress";
  /** [지금 재임베딩] CTA 클릭 핸들러 — 호출부가 기존 KB 전체 재임베딩 ConfirmModal 을 연다. */
  onReembed: () => void;
  /** 재임베딩 mutation 진행 여부 (CTA 비활성화). */
  pending?: boolean;
}

/**
 * KB 상세 상단 "검색 불가" 배너. `embeddingDimension == null` 인 KB 가 RAG 검색에서
 * 제외된 상태를 노출하고, idle 일 때는 발견 지점에서 바로 재임베딩하도록 CTA 를 붙인다.
 *
 * - 수동 닫기(X) 없는 **상태 기반 auto-dismiss** alert — 재임베딩이 완료돼 dimension 이
 *   다시 채워지면 호출부의 게이트가 false 가 되어 자연히 사라진다 (spec 2-navigation/5-knowledge-base §2.4.1·R-3).
 * - CTA 는 쓰기·비용 동작이라 RoleGate(editor) 로 제한하되, 검색 불가 *상태* 자체는
 *   read 권한자도 알아야 하므로 텍스트는 항상 노출한다.
 * - `in_progress` 에서는 `POST /re-embed` 가 409 로 거부되므로 CTA 를 숨기고 진행 표시만 둔다.
 */
export function UnsearchableBanner({ reembedStatus, onReembed, pending }: Props) {
  const t = useT();
  const inProgress = reembedStatus === "in_progress";

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm ${
        inProgress
          ? "border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
          : "border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]"
      }`}
    >
      {inProgress ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1">
        <div className="font-medium">
          {inProgress
            ? t("knowledgeBases.reembeddingInProgress")
            : t("knowledgeBases.reembeddingRequired")}
        </div>
        <p className="text-[hsl(var(--muted-foreground))]">
          {inProgress
            ? t("knowledgeBases.unsearchableBannerInProgressDesc")
            : t("knowledgeBases.unsearchableBannerIdleDesc")}
        </p>
      </div>
      {!inProgress && (
        <RoleGate minRole="editor">
          <Button
            size="sm"
            variant="outline"
            onClick={onReembed}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("knowledgeBases.reembedNow")}
          </Button>
        </RoleGate>
      )}
    </div>
  );
}
