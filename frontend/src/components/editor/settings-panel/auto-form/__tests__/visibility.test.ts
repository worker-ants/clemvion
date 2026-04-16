import { describe, it, expect } from "vitest";
import { isFieldVisible } from "../visibility";

describe("isFieldVisible", () => {
  it("returns true when no visibleWhen rule is set", () => {
    expect(isFieldVisible(undefined, {})).toBe(true);
    expect(isFieldVisible({}, { mode: "static" })).toBe(true);
  });

  it("applies the `equals` rule", () => {
    const ui = { visibleWhen: { field: "mode", equals: "static" } } as const;
    expect(isFieldVisible(ui, { mode: "static" })).toBe(true);
    expect(isFieldVisible(ui, { mode: "dynamic" })).toBe(false);
    expect(isFieldVisible(ui, {})).toBe(false);
  });

  it("applies the `notEquals` rule", () => {
    const ui = { visibleWhen: { field: "mode", notEquals: "multi_turn" } } as const;
    expect(isFieldVisible(ui, { mode: "single_turn" })).toBe(true);
    expect(isFieldVisible(ui, { mode: "multi_turn" })).toBe(false);
    // missing key → undefined !== "multi_turn" → visible
    expect(isFieldVisible(ui, {})).toBe(true);
  });

  it("applies the `oneOf` rule", () => {
    const ui = {
      visibleWhen: { field: "status", oneOf: ["pending", "running"] },
    } as const;
    expect(isFieldVisible(ui, { status: "pending" })).toBe(true);
    expect(isFieldVisible(ui, { status: "running" })).toBe(true);
    expect(isFieldVisible(ui, { status: "done" })).toBe(false);
    expect(isFieldVisible(ui, {})).toBe(false);
  });

  it("treats non-array oneOf as always false (malformed rule)", () => {
    const ui = {
      visibleWhen: { field: "status", oneOf: "pending" as unknown as unknown[] },
    };
    expect(isFieldVisible(ui, { status: "pending" })).toBe(false);
  });

  it("handles equality against unusual types", () => {
    const ui = { visibleWhen: { field: "enabled", equals: true } } as const;
    expect(isFieldVisible(ui, { enabled: true })).toBe(true);
    expect(isFieldVisible(ui, { enabled: false })).toBe(false);

    const numUi = { visibleWhen: { field: "count", equals: 0 } } as const;
    expect(isFieldVisible(numUi, { count: 0 })).toBe(true);
    expect(isFieldVisible(numUi, { count: 1 })).toBe(false);
  });
});
