"use client";

import { useT } from "@/lib/i18n";

/**
 * Rendered above MDX body content when the requested locale has no translated
 * sibling file and we are falling back to the canonical Korean body. Once the
 * page has a translation, the server passes `fellBackToKorean={false}` and the
 * banner disappears.
 */
export function DocBodyNotice({
  fellBackToKorean,
}: {
  fellBackToKorean: boolean;
}) {
  const t = useT();
  if (!fellBackToKorean) return null;
  return (
    <div className="mb-6 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
      {t("docs.bodyKoreanNotice")}
    </div>
  );
}
