"use client";

import { ArrowRight, MousePointer2, Plug2, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DOCS } from "@/lib/docs/links";
import { useT, type TranslationKey } from "@/lib/i18n";

const STEPS: Array<{
  icon: typeof MousePointer2;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  href: string;
}> = [
  {
    icon: MousePointer2,
    titleKey: "editor.emptyStep1Title",
    descriptionKey: "editor.emptyStep1Desc",
    href: DOCS.nodes.overview,
  },
  {
    icon: Plug2,
    titleKey: "editor.emptyStep2Title",
    descriptionKey: "editor.emptyStep2Desc",
    href: DOCS.gettingStarted.uiTour,
  },
  {
    icon: Play,
    titleKey: "editor.emptyStep3Title",
    descriptionKey: "editor.emptyStep3Desc",
    href: DOCS.runAndDebug.runningAWorkflow,
  },
];

interface Props {
  visible: boolean;
}

export function CanvasEmptyState({ visible }: Props) {
  const t = useT();
  return (
    <section
      role="region"
      aria-label={t("editor.emptyStateRegion")}
      aria-hidden={!visible}
      data-visible={visible ? "true" : "false"}
      className={cn(
        "w-[340px] max-w-[90vw] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg transition-opacity duration-300",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
        {t("editor.emptyStateTitle")}
      </h2>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        {t("editor.emptyStateSubtitle")}
      </p>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <li
              key={step.titleKey}
              className="flex items-start gap-3 text-sm"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-semibold text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Icon
                    size={14}
                    className="text-[hsl(var(--muted-foreground))]"
                    aria-hidden="true"
                  />
                  {t(step.titleKey)}
                </div>
                <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {t(step.descriptionKey)}{" "}
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={visible ? 0 : -1}
                    className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                  >
                    {t("editor.emptyLearnMore")}
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center justify-end">
        <a
          href={DOCS.gettingStarted.firstWorkflow}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={visible ? 0 : -1}
          className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          {t("editor.emptyOpenGuide")}
          <ArrowRight size={12} />
        </a>
      </div>
    </section>
  );
}
