import { describe, it, expect } from "vitest";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  getStatusLabel,
  formatDuration,
} from "../execution-status";

describe("STATUS_ICON", () => {
  it("has icons for all statuses", () => {
    expect(STATUS_ICON.completed).toBe("\u2705");
    expect(STATUS_ICON.failed).toBe("\u274C");
    expect(STATUS_ICON.running).toBe("\u23F3");
    expect(STATUS_ICON.cancelled).toBe("\u26D4");
    expect(STATUS_ICON.waiting_for_input).toBe("\u270B");
  });
});

describe("STATUS_BADGE_VARIANT", () => {
  it("maps statuses to badge variants", () => {
    expect(STATUS_BADGE_VARIANT.completed).toBe("success");
    expect(STATUS_BADGE_VARIANT.failed).toBe("destructive");
    expect(STATUS_BADGE_VARIANT.running).toBe("warning");
    expect(STATUS_BADGE_VARIANT.cancelled).toBe("outline");
  });
});

describe("getStatusLabel", () => {
  it("returns English labels when locale is en", () => {
    expect(getStatusLabel("completed", "en")).toBe("Completed");
    expect(getStatusLabel("failed", "en")).toBe("Failed");
    expect(getStatusLabel("waiting_for_input", "en")).toBe("Waiting");
  });

  it("returns Korean labels when locale is ko", () => {
    expect(getStatusLabel("completed", "ko")).toBe("완료");
    expect(getStatusLabel("failed", "ko")).toBe("실패");
    expect(getStatusLabel("waiting_for_input", "ko")).toBe("대기");
  });

  it("returns the raw status for unknown keys", () => {
    expect(getStatusLabel("unknown_state", "en")).toBe("unknown_state");
  });
});

describe("formatDuration", () => {
  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("\u2014");
  });

  it("formats milliseconds", () => {
    expect(formatDuration(0, "en")).toBe("0ms");
    expect(formatDuration(500, "en")).toBe("500ms");
    expect(formatDuration(999, "en")).toBe("999ms");
  });

  it("formats seconds with one decimal for short latencies", () => {
    // 1000ms → Number("1.0") collapses to 1 → "1s"
    expect(formatDuration(1000, "en")).toBe("1s");
    // 1500ms preserves the fractional portion so p50/p95 latencies stay distinguishable
    expect(formatDuration(1500, "en")).toBe("1.5s");
    expect(formatDuration(2500, "en")).toBe("2.5s");
    // At exactly 59999ms we're still in the sub-minute branch; toFixed(1)
    // rounds to 60, Number() drops the trailing zero → "60s". Values ≥ 60000
    // fall through to the minutes/seconds branch below.
    expect(formatDuration(59999, "en")).toBe("60s");
  });

  it("formats minutes with seconds", () => {
    expect(formatDuration(60000, "en")).toBe("1m 0s");
    expect(formatDuration(90000, "en")).toBe("1m 30s");
    expect(formatDuration(125000, "en")).toBe("2m 5s");
  });

  it("uses Korean labels for ko locale", () => {
    expect(formatDuration(5000, "ko")).toBe("5초");
    expect(formatDuration(75000, "ko")).toBe("1분 15초");
  });
});
