import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeAgo, formatDate, formatDuration } from "../date";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("timeAgo", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("returns 'just now' for future dates", () => {
    expect(timeAgo("2026-01-15T12:01:00Z", "en")).toBe("just now");
  });

  it("returns seconds ago for less than a minute", () => {
    expect(timeAgo("2026-01-15T11:59:30Z", "en")).toBe("30s ago");
  });

  it("returns minutes ago for less than an hour", () => {
    expect(timeAgo("2026-01-15T11:45:00Z", "en")).toBe("15m ago");
  });

  it("returns hours ago for less than a day", () => {
    expect(timeAgo("2026-01-15T06:00:00Z", "en")).toBe("6h ago");
  });

  it("returns days ago for less than a week", () => {
    expect(timeAgo("2026-01-12T12:00:00Z", "en")).toBe("3d ago");
  });

  it("returns weeks ago for less than a month", () => {
    expect(timeAgo("2026-01-01T12:00:00Z", "en")).toBe("2w ago");
  });

  it("returns months ago for less than a year", () => {
    expect(timeAgo("2025-10-15T12:00:00Z", "en")).toBe("3mo ago");
  });

  it("returns years ago for dates over a year", () => {
    expect(timeAgo("2025-01-14T12:00:00Z", "en")).toBe("1y ago");
  });

  it("accepts Date objects", () => {
    expect(timeAgo(new Date("2026-01-15T11:59:30Z"), "en")).toBe("30s ago");
  });

  it("respects Korean locale", () => {
    expect(timeAgo("2026-01-15T11:59:30Z", "ko")).toBe("30초 전");
    expect(timeAgo("2026-01-12T12:00:00Z", "ko")).toBe("3일 전");
  });
});

describe("formatDuration", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  it("formats sub-second durations in ms", () => {
    expect(formatDuration(500, "en")).toBe("500ms");
    expect(formatDuration(500, "ko")).toBe("500ms");
    expect(formatDuration(0, "en")).toBe("0ms");
  });

  it("formats durations under a minute in seconds", () => {
    expect(formatDuration(5_000, "en")).toBe("5s");
    expect(formatDuration(5_000, "ko")).toBe("5초");
  });

  it("formats multi-minute durations with minutes and seconds", () => {
    expect(formatDuration(75_000, "en")).toBe("1m 15s");
    expect(formatDuration(75_000, "ko")).toBe("1분 15초");
  });

  it("uses locale defaults from the store when no locale is passed", () => {
    // Store default is "ko" in tests — the function should pick it up.
    expect(formatDuration(5_000)).toBe("5초");
  });
});

describe("formatDate", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  it("formats with default format (date)", () => {
    const result = formatDate("2026-01-15T12:00:00Z", undefined, "en");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
    expect(result).toContain("15");
  });

  it("formats with iso format", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "iso");
    expect(result).toBe("2026-01-15T12:00:00.000Z");
  });

  it("formats with date format", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "date", "en");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("formats with datetime format (date + time, client TZ)", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "datetime", "en");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
    // datetime must include hour:minute, otherwise it's indistinguishable
    // from the bare "date" format.
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts Date objects", () => {
    const result = formatDate(new Date("2026-06-20T00:00:00Z"), "iso");
    expect(result).toBe("2026-06-20T00:00:00.000Z");
  });

  it("formats with time format (hour:minute, client TZ)", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "time", "en");
    // Output is hour:minute in client local TZ (no exact value asserted because
    // the test runner's TZ is environment-dependent), but it must look like a
    // short time stamp and not include any date components.
    expect(result).toMatch(/^\d{1,2}:\d{2}(\s?[AP]M)?$/i);
  });

  it("formats with month-year (no day component)", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "month-year", "en");
    expect(result).toContain("January");
    expect(result).toContain("2026");
    expect(result).not.toMatch(/15/);
  });

  it("returns a placeholder for unparseable input instead of leaking 'Invalid Date'", () => {
    expect(formatDate("not-a-date", "datetime", "en")).toBe("—");
    expect(formatDate("", "date", "en")).toBe("—");
  });

  it("falls back to the locale store when no locale argument is passed", () => {
    useLocaleStore.setState({ locale: "ko" });
    const result = formatDate("2026-01-15T12:00:00Z", "date");
    // ko-KR formatting includes a year suffix character; en-US would output
    // "Jan 15, 2026". The presence of "2026" alone is locale-agnostic, but the
    // Korean year suffix or the dotted date pattern is the discriminator.
    expect(result).toMatch(/2026/);
    expect(result).not.toMatch(/^Jan/);
  });
});
