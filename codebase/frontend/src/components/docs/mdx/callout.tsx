import { cn } from "@/lib/utils/cn";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { readLocaleCookie } from "@/lib/i18n/server-locale";
import { translate, type TranslationKey } from "@/lib/i18n/core";

type CalloutType = "note" | "tip" | "warn";

// Container는 배경·테두리만 담당하고, 라벨만 강조 색을 써요. 본문은 페이지 기본 전경색을 유지해
// 가독성을 확보해요.
const STYLES: Record<
  CalloutType,
  { container: string; labelKey: TranslationKey; accent: string }
> = {
  note: {
    container: "border-blue-500/40 bg-blue-500/5",
    accent: "text-blue-700 dark:text-blue-300",
    labelKey: "docs.callout.note",
  },
  tip: {
    container: "border-emerald-500/40 bg-emerald-500/5",
    accent: "text-emerald-700 dark:text-emerald-300",
    labelKey: "docs.callout.tip",
  },
  warn: {
    container: "border-amber-500/50 bg-amber-500/10",
    accent: "text-amber-700 dark:text-amber-300",
    labelKey: "docs.callout.warn",
  },
};

export async function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const style = STYLES[type];
  const locale = (await readLocaleCookie()) ?? DEFAULT_LOCALE;
  return (
    <aside
      role="note"
      className={cn(
        "my-4 rounded-md border px-4 py-3 text-sm text-[hsl(var(--foreground))]",
        style.container,
      )}
    >
      <p
        className={cn(
          "mb-1 text-xs font-semibold uppercase tracking-wider",
          style.accent,
        )}
      >
        {title ?? translate(locale, style.labelKey)}
      </p>
      <div className="space-y-2">{children}</div>
    </aside>
  );
}
