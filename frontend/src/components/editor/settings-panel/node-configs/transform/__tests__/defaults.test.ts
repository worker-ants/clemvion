import { describe, it, expect } from "vitest";
import { defaultForType } from "../defaults";

describe("defaultForType", () => {
  it("preserves field path across type changes", () => {
    const next = defaultForType("remove_field", {
      type: "set_field",
      field: "user.profile.name",
      value: "x",
    });
    expect(next).toEqual({ type: "remove_field", field: "user.profile.name" });
  });

  it("uses empty field when no preserve", () => {
    const next = defaultForType("set_field");
    expect(next).toEqual({ type: "set_field", field: "", value: "" });
  });

  it("maps rename_field preserved field to `from`", () => {
    const next = defaultForType("rename_field", {
      type: "set_field",
      field: "a.b",
      value: 1,
    });
    expect(next).toEqual({ type: "rename_field", from: "a.b", to: "" });
  });

  it("returns object_pick with undefined root field", () => {
    const next = defaultForType("object_pick");
    expect(next).toEqual({ type: "object_pick", field: undefined, keys: [] });
  });

  it("returns object_omit with preserved nested field", () => {
    const next = defaultForType("object_omit", {
      type: "object_pick",
      field: "user",
      keys: ["a"],
    });
    expect(next).toEqual({
      type: "object_omit",
      field: "user",
      keys: [],
    });
  });

  it("provides sensible defaults for each op type", () => {
    const types = [
      "rename_field",
      "remove_field",
      "set_field",
      "type_convert",
      "string_op",
      "math_op",
      "date_op",
      "array_filter",
      "array_sort",
      "object_pick",
      "object_omit",
    ] as const;
    for (const t of types) {
      const d = defaultForType(t);
      expect(d.type).toBe(t);
    }
  });
});
