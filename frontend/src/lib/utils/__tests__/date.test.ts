import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeAgo, formatDate } from "../date";

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for future dates", () => {
    expect(timeAgo("2026-01-15T12:01:00Z")).toBe("just now");
  });

  it("returns seconds ago for less than a minute", () => {
    expect(timeAgo("2026-01-15T11:59:30Z")).toBe("30s ago");
  });

  it("returns minutes ago for less than an hour", () => {
    expect(timeAgo("2026-01-15T11:45:00Z")).toBe("15m ago");
  });

  it("returns hours ago for less than a day", () => {
    expect(timeAgo("2026-01-15T06:00:00Z")).toBe("6h ago");
  });

  it("returns days ago for less than a week", () => {
    expect(timeAgo("2026-01-12T12:00:00Z")).toBe("3d ago");
  });

  it("returns weeks ago for less than a month", () => {
    expect(timeAgo("2026-01-01T12:00:00Z")).toBe("2w ago");
  });

  it("returns months ago for less than a year", () => {
    // ~92 days = ~3 months (92 days / 30 = 3)
    expect(timeAgo("2025-10-15T12:00:00Z")).toBe("3mo ago");
  });

  it("returns years ago for dates over a year", () => {
    // exactly 365+ days ago
    expect(timeAgo("2025-01-14T12:00:00Z")).toBe("1y ago");
  });

  it("accepts Date objects", () => {
    expect(timeAgo(new Date("2026-01-15T11:59:30Z"))).toBe("30s ago");
  });
});

describe("formatDate", () => {
  it("formats with default format (date)", () => {
    const result = formatDate("2026-01-15T12:00:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
    expect(result).toContain("15");
  });

  it("formats with iso format", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "iso");
    expect(result).toBe("2026-01-15T12:00:00.000Z");
  });

  it("formats with date format", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "date");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("formats with datetime format", () => {
    const result = formatDate("2026-01-15T12:00:00Z", "datetime");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });

  it("accepts Date objects", () => {
    const result = formatDate(new Date("2026-06-20T00:00:00Z"), "iso");
    expect(result).toBe("2026-06-20T00:00:00.000Z");
  });
});
