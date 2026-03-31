import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("returns empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("merges multiple classes", () => {
    const result = cn("px-4", "py-2", "text-sm");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("text-sm");
  });

  it("handles conditional classes via object syntax", () => {
    const result = cn("base", { "text-red-500": true, "text-blue-500": false });
    expect(result).toContain("base");
    expect(result).toContain("text-red-500");
    expect(result).not.toContain("text-blue-500");
  });

  it("filters out undefined, null, and false values", () => {
    const result = cn("base", undefined, null, false, "extra");
    expect(result).toBe("base extra");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    const result = cn("px-4", "px-8");
    expect(result).toBe("px-8");
  });

  it("handles array inputs", () => {
    const result = cn(["px-4", "py-2"]);
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });
});
