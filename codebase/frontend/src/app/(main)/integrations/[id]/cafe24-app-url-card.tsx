"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type TFunction } from "@/lib/i18n";

/**
 * Cafe24 Private 통합 한정의 App URL / Redirect URI 노출 카드. Cafe24
 * Developers Console 의 "앱 URL" 갱신용 — HMAC 검증 실패 에러 페이지가
 * 안내하는 비교 대상이 본 카드다. Redirect URI 는 App URL 의 path 끝
 * `install/<token>` 을 `callback` 으로 치환한 값으로, 백엔드의
 * `buildOauthCallbackUrl(appBaseUrl, 'cafe24')` 와 동일 결과를 보장한다.
 * spec/2-navigation/4-integration.md §4.2 + Rationale "Cafe24 App URL
 * 상세 페이지 표시".
 */
export function Cafe24AppUrlCard({
  appUrl,
  t,
}: {
  appUrl: string;
  t: TFunction;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const redirectUri = appUrl.replace(/\/install\/[^/]+$/, "/callback");

  const copy = (value: string, field: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <section className="rounded-lg border border-[hsl(var(--border))] p-6">
      <h3 className="text-sm font-semibold">
        {t("integrations.cafe24DetailAppUrlTitle")}
      </h3>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        {t("integrations.cafe24DetailAppUrlDesc")}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.cafe24AppUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code
              data-testid="cafe24-app-url-value"
              className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs"
            >
              {appUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(appUrl, "appUrl")}
              className="shrink-0"
              data-testid="cafe24-app-url-copy"
              aria-label={t("integrations.cafe24AppUrlLabel")}
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "appUrl"
                ? t("integrations.copied")
                : t("common.copy")}
            </Button>
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.cafe24CallbackUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code
              data-testid="cafe24-redirect-uri-value"
              className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs"
            >
              {redirectUri}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(redirectUri, "redirectUri")}
              className="shrink-0"
              data-testid="cafe24-redirect-uri-copy"
              aria-label={t("integrations.cafe24CallbackUrlLabel")}
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "redirectUri"
                ? t("integrations.copied")
                : t("common.copy")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
