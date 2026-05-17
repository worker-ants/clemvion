import { describe, it, expect } from "vitest";
import { applyOperation, applyOperations } from "./apply-operation";
import type { TransformOperation } from "@/types/transform";

describe("applyOperation", () => {
  it("renames a field", () => {
    const result = applyOperation(
      { old: 1 },
      { type: "rename_field", from: "old", to: "fresh" },
    );
    expect(result).toEqual({ fresh: 1 });
  });

  it("supports nested dot paths", () => {
    const result = applyOperation(
      { user: { profile: { name: "a" } } },
      { type: "set_field", field: "user.profile.age", value: 10 },
    );
    expect(result).toEqual({
      user: { profile: { name: "a", age: 10 } },
    });
  });

  it("supports bracket notation on arrays", () => {
    const result = applyOperation(
      { items: [{ v: 1 }, { v: 2 }] },
      { type: "set_field", field: "items[0].v", value: 99 },
    );
    expect(result).toEqual({ items: [{ v: 99 }, { v: 2 }] });
  });

  it("filters array by condition", () => {
    const result = applyOperation(
      { items: [{ v: 1 }, { v: 5 }, { v: 10 }] },
      {
        type: "array_filter",
        field: "items",
        condition: { field: "v", operator: "gt", value: 3 },
      },
    );
    expect(result).toEqual({ items: [{ v: 5 }, { v: 10 }] });
  });

  it("sorts descending by key", () => {
    const result = applyOperation(
      { xs: [{ v: 2 }, { v: 3 }, { v: 1 }] },
      { type: "array_sort", field: "xs", sortBy: "v", order: "desc" },
    );
    expect(result).toEqual({ xs: [{ v: 3 }, { v: 2 }, { v: 1 }] });
  });

  it("picks root keys", () => {
    const result = applyOperation(
      { a: 1, b: 2, c: 3 },
      { type: "object_pick", keys: ["a", "c"] },
    );
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it("omits nested keys", () => {
    const result = applyOperation(
      { user: { name: "k", password: "x" } },
      { type: "object_omit", field: "user", keys: ["password"] },
    );
    expect(result).toEqual({ user: { name: "k" } });
  });

  it("formats dates", () => {
    const result = applyOperation(
      { d: "2024-01-15T10:30:00Z" },
      {
        type: "date_op",
        field: "d",
        operation: "format",
        args: { pattern: "YYYY-MM-DD" },
      },
    );
    expect(result).toEqual({ d: "2024-01-15" });
  });

  it("string_op split produces array", () => {
    const result = applyOperation(
      { csv: "a,b,c" },
      {
        type: "string_op",
        field: "csv",
        operation: "split",
        args: { separator: "," },
      },
    );
    expect(result).toEqual({ csv: ["a", "b", "c"] });
  });

  it("math_op ceil/floor", () => {
    expect(
      applyOperation(
        { v: 3.2 },
        { type: "math_op", field: "v", operation: "ceil" },
      ),
    ).toEqual({ v: 4 });
    expect(
      applyOperation(
        { v: 3.8 },
        { type: "math_op", field: "v", operation: "floor" },
      ),
    ).toEqual({ v: 3 });
  });

  it("type_convert array via JSON parse", () => {
    const result = applyOperation(
      { raw: "[1,2]" },
      { type: "type_convert", field: "raw", targetType: "array" },
    );
    expect(result).toEqual({ raw: [1, 2] });
  });

  it("leaves original input unmodified", () => {
    const input = { a: 1 };
    applyOperation(input, { type: "remove_field", field: "a" });
    expect(input).toEqual({ a: 1 });
  });
});

describe("applyOperation — additional coverage", () => {
  it("does not divide by zero", () => {
    const result = applyOperation(
      { v: 10 },
      { type: "math_op", field: "v", operation: "divide", operand: 0 },
    );
    expect(result).toEqual({ v: 10 });
  });

  it("string_op uppercase/lowercase", () => {
    expect(
      applyOperation(
        { s: "aB" },
        { type: "string_op", field: "s", operation: "uppercase" },
      ),
    ).toEqual({ s: "AB" });
    expect(
      applyOperation(
        { s: "aB" },
        { type: "string_op", field: "s", operation: "lowercase" },
      ),
    ).toEqual({ s: "ab" });
  });

  it("string_op replace with all=false", () => {
    const result = applyOperation(
      { s: "a-a-a" },
      {
        type: "string_op",
        field: "s",
        operation: "replace",
        args: { search: "a", replacement: "Z", all: false },
      },
    );
    expect(result).toEqual({ s: "Z-a-a" });
  });

  it("string_op join", () => {
    const result = applyOperation(
      { parts: ["x", "y"] },
      {
        type: "string_op",
        field: "parts",
        operation: "join",
        args: { separator: "-" },
      },
    );
    expect(result).toEqual({ parts: "x-y" });
  });

  it("date_op add/subtract", () => {
    const added = applyOperation(
      { d: "2024-01-15T00:00:00.000Z" },
      {
        type: "date_op",
        field: "d",
        operation: "add",
        args: { amount: 1, unit: "days" },
      },
    );
    expect(added.d).toBe("2024-01-16T00:00:00.000Z");
    const sub = applyOperation(
      { d: "2024-01-15T05:00:00.000Z" },
      {
        type: "date_op",
        field: "d",
        operation: "subtract",
        args: { amount: 2, unit: "hours" },
      },
    );
    expect(sub.d).toBe("2024-01-15T03:00:00.000Z");
  });

  it("date_op diff", () => {
    const result = applyOperation(
      { start: "2024-01-20", end: "2024-01-15" },
      {
        type: "date_op",
        field: "start",
        operation: "diff",
        args: { compareField: "end", unit: "days" },
      },
    );
    expect(result.start).toBe(5);
  });

  it("array_filter supports various operators", () => {
    const eq = applyOperation(
      { xs: [{ a: 1 }, { a: 2 }] },
      {
        type: "array_filter",
        field: "xs",
        condition: { field: "a", operator: "eq", value: 2 },
      },
    );
    expect(eq.xs).toEqual([{ a: 2 }]);

    const contains = applyOperation(
      { xs: [{ name: "Kim" }, { name: "Lee" }] },
      {
        type: "array_filter",
        field: "xs",
        condition: { field: "name", operator: "contains", value: "im" },
      },
    );
    expect(contains.xs).toEqual([{ name: "Kim" }]);
  });

  it("array_filter skips when target is not an array", () => {
    const result = applyOperation(
      { xs: "nope" },
      {
        type: "array_filter",
        field: "xs",
        condition: { field: "a", operator: "eq", value: 1 },
      },
    );
    expect(result).toEqual({ xs: "nope" });
  });

  it("rename_field skips when source does not exist", () => {
    const input = { a: 1 };
    const result = applyOperation(input, {
      type: "rename_field",
      from: "b",
      to: "c",
    });
    expect(result).toEqual({ a: 1 });
  });

  it("blocks prototype pollution via set_field", () => {
    const result = applyOperation(
      {},
      { type: "set_field", field: "__proto__.polluted", value: true },
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((result as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("blocks prototype pollution via object_omit root", () => {
    const input: Record<string, unknown> = { a: 1 };
    const result = applyOperation(input, {
      type: "object_omit",
      keys: ["__proto__", "constructor", "a"],
    });
    expect(result).toEqual({});
    expect(Object.prototype.toString).toBeDefined();
  });

  it("rejects overly long regex patterns (ReDoS guard)", () => {
    const longPattern = "a".repeat(201);
    const result = applyOperation(
      { xs: [{ v: "aaaa" }] },
      {
        type: "array_filter",
        field: "xs",
        condition: { field: "v", operator: "regex", value: longPattern },
      },
    );
    expect(result.xs).toEqual([]);
  });
});

describe("applyOperations chain", () => {
  it("returns empty steps for empty ops", () => {
    expect(applyOperations({ a: 1 }, [])).toEqual([]);
  });

  it("applies steps sequentially and records intermediate results", () => {
    const ops: TransformOperation[] = [
      { type: "string_op", field: "name", operation: "trim" },
      { type: "type_convert", field: "age", targetType: "number" },
      { type: "math_op", field: "age", operation: "add", operand: 1 },
    ];
    const steps = applyOperations({ name: "  Kim  ", age: "25" }, ops);
    expect(steps).toHaveLength(3);
    expect(steps[0].result).toEqual({ name: "Kim", age: "25" });
    expect(steps[1].result).toEqual({ name: "Kim", age: 25 });
    expect(steps[2].result).toEqual({ name: "Kim", age: 26 });
  });
});
