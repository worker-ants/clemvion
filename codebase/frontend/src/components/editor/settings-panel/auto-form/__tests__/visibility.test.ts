import { describe, it, expect } from "vitest";
import { isFieldRequired, isFieldVisible } from "../visibility";

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

describe("isFieldRequired", () => {
  it("returns false when no hints or schema.required are provided", () => {
    expect(isFieldRequired(undefined, "foo", undefined, {})).toBe(false);
    expect(isFieldRequired({}, "foo", [], {})).toBe(false);
  });

  it("returns true when schema.required includes the key", () => {
    expect(isFieldRequired(undefined, "name", ["name"], {})).toBe(true);
  });

  it("returns true when ui.required is set explicitly", () => {
    expect(isFieldRequired({ required: true }, "title", [], {})).toBe(true);
  });

  it("applies requiredWhen equals (single value)", () => {
    const ui = { requiredWhen: { field: "mode", equals: "dynamic" } } as const;
    expect(isFieldRequired(ui, "titleField", [], { mode: "dynamic" })).toBe(true);
    expect(isFieldRequired(ui, "titleField", [], { mode: "static" })).toBe(false);
  });

  // oneOf shape is deprecated → use equals: [array] whitelist instead.
  it("applies requiredWhen equals (whitelist array)", () => {
    const ui = {
      requiredWhen: { field: "status", equals: ["a", "b"] },
    } as const;
    expect(isFieldRequired(ui, "f", [], { status: "a" })).toBe(true);
    expect(isFieldRequired(ui, "f", [], { status: "b" })).toBe(true);
    expect(isFieldRequired(ui, "f", [], { status: "c" })).toBe(false);
  });

  it("equals whitelist with empty array never makes the field required", () => {
    const ui = {
      requiredWhen: { field: "mode", equals: [] as readonly string[] },
    } as const;
    expect(isFieldRequired(ui, "f", [], { mode: "anything" })).toBe(false);
  });

  it("requiredWhen returns false when the referenced field is missing from config", () => {
    // 신규 노드의 비어 있는 config 가 평가될 때 잘못된 required 표시가 나오지
    // 않도록 보장 — config[field] === undefined 는 equals (단일 값/배열 모두)
    // 매칭에서 빠진다.
    const single = { requiredWhen: { field: "mode", equals: "dynamic" } } as const;
    const whitelist = { requiredWhen: { field: "mode", equals: ["a", "b"] } } as const;
    expect(isFieldRequired(single, "f", [], {})).toBe(false);
    expect(isFieldRequired(whitelist, "f", [], {})).toBe(false);
  });

  it("prefers explicit ui.required over requiredWhen mismatch", () => {
    const ui = {
      required: true,
      requiredWhen: { field: "mode", equals: "dynamic" },
    } as const;
    expect(isFieldRequired(ui, "f", [], { mode: "static" })).toBe(true);
  });
});
