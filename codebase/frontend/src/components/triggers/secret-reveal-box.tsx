"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { Copy, Eye, EyeOff } from "lucide-react";

/** 1회성 시크릿 노출 박스가 평문을 유지하는 시간 (ms). */
export const SECRET_AUTO_HIDE_MS = 60_000;

/**
 * 1회성 시크릿(secret / token) 노출 박스.
 *
 * 보안(ai-review W): 평문을 DOM 에 상시 렌더하지 않는다 — 기본 마스킹하고
 * "표시" 클릭 시에만 평문 노출, 그리고 60초 후 부모 state 를 비워 자동으로
 * 사라지게 한다(`onDismiss`). 복사 버튼은 마스킹 상태에서도 실제 값을 복사한다.
 */
export function SecretRevealBox({
  title,
  secret,
  onDismiss,
}: {
  title: string;
  secret: string;
  onDismiss: () => void;
}) {
  const t = useT();
  const copyToClipboard = useCopyToClipboard();
  const [revealed, setRevealed] = useState(false);

  // 부모가 매 렌더 새 함수를 넘겨도 타이머가 재시작되지 않도록 ref 로 고정.
  // ref 갱신은 render 중이 아니라 effect 안에서 한다 (react-hooks/refs).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), SECRET_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [secret]);

  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs space-y-2">
      <div className="font-medium">{title}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono break-all">
          {/* 마스킹 시 실제 길이를 노출하지 않도록 고정 폭(12) bullet. */}
          {revealed ? secret : "•".repeat(12)}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRevealed((v) => !v)}
          aria-label={
            revealed
              ? t("triggers.externalInteraction.secretHide")
              : t("triggers.externalInteraction.secretReveal")
          }
        >
          {revealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void copyToClipboard(secret, {
              success: t("triggers.externalInteraction.copied"),
              error: t("triggers.copyFailed"),
            })
          }
          aria-label={t("triggers.externalInteraction.copy")}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-[hsl(var(--muted-foreground))]">
        {t("triggers.externalInteraction.secretAutoHideNote")}
      </p>
      <Button size="sm" variant="outline" onClick={onDismiss}>
        {t("triggers.externalInteraction.cancel")}
      </Button>
    </div>
  );
}
