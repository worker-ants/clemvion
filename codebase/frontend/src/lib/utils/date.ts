"use client";

import { translate } from "@/lib/i18n/core";
import type { Locale } from "@/lib/i18n/types";
import { useLocaleStore } from "@/lib/stores/locale-store";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000;
const YEAR = 31536000;

// Snapshot read — not reactive. Components that should re-render on locale
// change already do so via `useT()` / `useLocale()`; these utilities are only
// called inline during render, so reading the store at call time is fine.
function currentLocale(): Locale {
  return useLocaleStore.getState().locale;
}

export function timeAgo(date: string | Date, locale?: Locale): string {
  const loc = locale ?? currentLocale();
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 0) return translate(loc, "time.justNow");
  if (seconds < MINUTE) return translate(loc, "time.secondsAgo", { seconds });
  if (seconds < HOUR)
    return translate(loc, "time.minutesAgo", { minutes: Math.floor(seconds / MINUTE) });
  if (seconds < DAY)
    return translate(loc, "time.hoursAgo", { hours: Math.floor(seconds / HOUR) });
  if (seconds < WEEK)
    return translate(loc, "time.daysAgo", { days: Math.floor(seconds / DAY) });
  if (seconds < MONTH)
    return translate(loc, "time.weeksAgo", { weeks: Math.floor(seconds / WEEK) });
  if (seconds < YEAR)
    return translate(loc, "time.monthsAgo", { months: Math.floor(seconds / MONTH) });
  return translate(loc, "time.yearsAgo", { years: Math.floor(seconds / YEAR) });
}

/**
 * Coarse duration formatter for dashboards and summary tiles: rounds sub-minute
 * values to whole seconds ("5s") so at-a-glance metrics stay compact. Uses
 * `time.minutesSeconds` for multi-minute runs. Prefer
 * `@/lib/utils/execution-status.formatDuration` when you need 0.1s precision.
 */
export function formatDuration(ms: number, locale?: Locale): string {
  const loc = locale ?? currentLocale();
  if (ms < 1000) return translate(loc, "time.ms", { value: ms });
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return translate(loc, "time.seconds", { value: totalSeconds });
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return translate(loc, "time.minutesSeconds", { minutes, seconds });
}

export type DateFormat =
  | "iso"
  | "date"
  | "datetime"
  | "datetime-tz"
  | "time"
  | "month-year";

/**
 * Format a date with the user's locale. `format` accepts:
 *   - `"iso"` — ISO 8601 string (locale-agnostic, UTC).
 *   - `"datetime"` — short month + year + hour:minute (client TZ).
 *   - `"datetime-tz"` — `"datetime"` plus the client's timezone short name
 *     (e.g. `"KST"`, `"GMT+9"`, `"PST"`). Use when the timestamp must be
 *     unambiguous across timezones (notifications, audit rows, etc.).
 *   - `"time"` — hour:minute only (client TZ).
 *   - `"date"` / undefined — short month + year (default, client TZ).
 *
 * For non-`"iso"` formats the value is rendered in the **client's local
 * timezone** because `toLocaleString` / `toLocaleTimeString` are called
 * without an explicit `timeZone` option.
 *
 * Returns `"—"` when the input is missing or unparseable, so screens never
 * surface raw `"Invalid Date"` text.
 */
export function formatDate(date: string | Date, format?: DateFormat, locale?: Locale): string {
  const loc = locale ?? currentLocale();
  const intlLocale = loc === "ko" ? "ko-KR" : "en-US";
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "—";

  if (format === "iso") {
    return d.toISOString();
  }

  if (format === "datetime") {
    // `toLocaleString` (not `toLocaleDateString`) so the time components are
    // always present — some engines drop the time part when only date options
    // are given to the date-only API.
    return d.toLocaleString(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (format === "datetime-tz") {
    return d.toLocaleString(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  if (format === "time") {
    return d.toLocaleTimeString(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (format === "month-year") {
    return d.toLocaleDateString(intlLocale, {
      month: "long",
      year: "numeric",
    });
  }

  // `format === "date"` and undefined share the default branch intentionally.
  return d.toLocaleDateString(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
