"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  /** Pages shown on each side of the current page. Default 1. */
  siblingCount?: number;
  className?: string;
}

type Token = number | "ellipsis-left" | "ellipsis-right";

function buildTokens(page: number, totalPages: number, siblingCount: number): Token[] {
  const visible = new Set<number>([1, totalPages]);
  const lo = Math.max(1, page - siblingCount);
  const hi = Math.min(totalPages, page + siblingCount);
  for (let p = lo; p <= hi; p++) visible.add(p);

  const sorted = [...visible].sort((a, b) => a - b);
  const tokens: Token[] = [];
  for (let i = 0; i < sorted.length; i++) {
    tokens.push(sorted[i]);
    if (i === sorted.length - 1) continue;
    const gap = sorted[i + 1] - sorted[i];
    // Fill small gaps inline rather than collapse to ellipsis when only 1–2
    // pages would be hidden — the ellipsis saves no space in that case.
    if (gap === 2) {
      tokens.push(sorted[i] + 1);
    } else if (gap === 3) {
      tokens.push(sorted[i] + 1);
      tokens.push(sorted[i] + 2);
    } else if (gap > 3) {
      tokens.push(sorted[i] < page ? "ellipsis-left" : "ellipsis-right");
    }
  }
  return tokens;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  const t = useT();

  if (totalPages <= 1) return null;

  const tokens = buildTokens(page, totalPages, siblingCount);

  return (
    <nav
      aria-label={t("common.pagination")}
      className={
        className ??
        "flex flex-wrap items-center justify-center gap-2"
      }
    >
      <Button
        variant="outline"
        size="sm"
        aria-label={t("common.previousPage")}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {tokens.map((token, idx) => {
        if (token === "ellipsis-left" || token === "ellipsis-right") {
          return (
            <span
              key={token + idx}
              aria-hidden="true"
              className="px-2 text-sm text-[hsl(var(--muted-foreground))]"
            >
              …
            </span>
          );
        }
        const isCurrent = token === page;
        return (
          <Button
            key={token}
            variant={isCurrent ? "default" : "outline"}
            size="sm"
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => {
              if (!isCurrent) onPageChange(token);
            }}
          >
            {token}
          </Button>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        aria-label={t("common.nextPage")}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
