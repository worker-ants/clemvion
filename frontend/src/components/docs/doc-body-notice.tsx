"use client";

import { useLocale, useT } from "@/lib/i18n";

/**
 * Rendered above MDX body content when the user's locale is English. The
 * body text itself is still Korean — this banner informs the reader while
 * full translations are rolled out incrementally.
 */
export function DocBodyNotice() {
  const locale = useLocale();
  const t = useT();
  if (locale === "ko") return null;
  return (
    <div className="mb-6 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
      {t("docs.bodyKoreanNotice")}
    </div>
  );
}
