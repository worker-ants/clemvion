"use client";

import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * 라이브 미리보기.
 *
 * 증분 1: 위젯 동봉(co-deploy) 빌드 파이프라인 전이라 안내 placeholder 를 렌더한다.
 * 증분 2(Phase 3): 동봉된 same-origin 위젯(`getWidgetAppUrl()`)을 실제 `src` iframe 으로
 * 띄워 런처/패널·대화를 렌더한다 (spec 5-admin-console §6, 0-architecture §R8 carve-out).
 */
export function LivePreview() {
  const t = useT();
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("webChat.preview.title")}</h3>
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center">
        <MessageCircle className="mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
          {t("webChat.preview.unavailable")}
        </p>
      </div>
    </section>
  );
}
