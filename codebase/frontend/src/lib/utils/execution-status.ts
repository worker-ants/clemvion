"use client";

import { translate } from "@/lib/i18n/core";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/stores/locale-store";

// Snapshot read. Callers in effects / non-React code get whatever locale is
// active at invocation — re-invoke after `setLocale` to pick up changes.
// For React re-rendering, prefer `useT()` + `useLocale()` at the component.
function currentLocale(): Locale {
  return useLocaleStore.getState().locale;
}

export const STATUS_ICON: Record<string, string> = {
  completed: "\u2705",
  failed: "\u274C",
  running: "\u23F3",
  pending: "\u23F3",
  cancelled: "\u26D4",
  waiting_for_input: "\u270B",
};

export const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "outline"
> = {
  completed: "success",
  failed: "destructive",
  running: "warning",
  pending: "outline",
  cancelled: "outline",
  waiting_for_input: "warning",
};

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  completed: "executions.status.completed",
  failed: "executions.status.failed",
  running: "executions.status.running",
  pending: "executions.status.pending",
  cancelled: "executions.status.cancelled",
  waiting_for_input: "executions.status.waiting",
};

export function getStatusLabel(status: string, locale?: Locale): string {
  const loc = locale ?? currentLocale();
  const key = STATUS_LABEL_KEYS[status];
  if (!key) return status;
  return translate(loc, key);
}

/**
 * Execution-page duration formatter. Uses decimal seconds (e.g. `1.5s`) so
 * short runs are still distinguishable, and falls back to whole-minute
 * grouping at the 60-second boundary. For the dashboard-style integer
 * duration, see `formatDuration` in `@/lib/utils/date`.
 */
export function formatDuration(ms: number | null, locale?: Locale): string {
  if (ms == null) return "\u2014";
  const loc = locale ?? currentLocale();
  if (ms < 1000) return translate(loc, "time.ms", { value: Math.round(ms) });
  const seconds = ms / 1000;
  if (seconds < 60) {
    // Preserve one decimal to keep 1.5s distinguishable from 1s / 2s — the
    // execution list uses this for actual latency values, not coarse stats.
    return translate(loc, "time.seconds", {
      value: Number(seconds.toFixed(1)),
    });
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return translate(loc, "time.minutesSeconds", { minutes, seconds: remainingSeconds });
}
