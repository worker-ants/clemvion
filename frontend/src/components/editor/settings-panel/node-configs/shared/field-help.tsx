"use client";

import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";

export interface FieldHelpProps {
  summary: React.ReactNode;
  docsHref?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function FieldHelp({
  summary,
  docsHref,
  side = "right",
  className,
}: FieldHelpProps) {
  const t = useT();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("editor.fieldHelpAriaLabel")}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
          className,
        )}
      >
        <HelpCircle size={12} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={6}
        className="w-64 p-3 text-xs leading-relaxed"
      >
        <div className="space-y-2 text-[hsl(var(--popover-foreground))]">
          <div>{summary}</div>
          {docsHref && (
            <a
              href={docsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[hsl(var(--primary))] underline-offset-2 hover:underline"
            >
              {t("editor.fieldHelpLearnMore")}
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface LabelWithHelpProps {
  text: string;
  help: Omit<FieldHelpProps, "side" | "className">;
}

export function LabelWithHelp({ text, help }: LabelWithHelpProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{text}</span>
      <FieldHelp {...help} />
    </span>
  );
}
