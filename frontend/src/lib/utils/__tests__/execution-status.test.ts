import { describe, it, expect } from "vitest";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
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

describe("STATUS_LABEL", () => {
  it("has labels for all statuses", () => {
    expect(STATUS_LABEL.completed).toBe("Completed");
    expect(STATUS_LABEL.failed).toBe("Failed");
    expect(STATUS_LABEL.waiting_for_input).toBe("Waiting");
  });
});

describe("formatDuration", () => {
  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("\u2014");
  });

  it("formats milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(2500)).toBe("2.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats minutes", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});
