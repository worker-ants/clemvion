import { describe, it, expect } from "vitest";
import { groupEntries, countGroupValues } from "../schema-form";

type Entry = {
  key: string;
  schema: Record<string, unknown>;
  ui: { group?: string; collapsible?: boolean; hidden?: boolean; visibleWhen?: unknown } | undefined;
  order: number;
};

function entry(key: string, ui?: Entry["ui"], order = 0): Entry {
  return { key, schema: { type: "string" }, ui, order };
}

describe("groupEntries", () => {
  it("returns a single ungrouped group for entries without `group`", () => {
    const groups = groupEntries([entry("a"), entry("b")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBeNull();
    expect(groups[0].entries.map((e) => e.key)).toEqual(["a", "b"]);
  });

  it("groups consecutive entries with the same `group`", () => {
    const groups = groupEntries([
      entry("a", { group: "X" }),
      entry("b", { group: "X" }),
      entry("c", { group: "Y" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ name: "X" });
    expect(groups[0].entries.map((e) => e.key)).toEqual(["a", "b"]);
    expect(groups[1]).toMatchObject({ name: "Y" });
    expect(groups[1].entries.map((e) => e.key)).toEqual(["c"]);
  });

  it("re-opens a group when interrupted by another", () => {
    const groups = groupEntries([
      entry("a", { group: "X" }),
      entry("b", { group: "Y" }),
      entry("c", { group: "X" }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.name)).toEqual(["X", "Y", "X"]);
  });

  it("propagates `collapsible` to the group when any entry requests it", () => {
    const groups = groupEntries([
      entry("a", { group: "Buttons" }),
      entry("b", { group: "Buttons", collapsible: true }),
    ]);
    expect(groups[0].collapsible).toBe(true);
  });

  it("preserves entry order within each group", () => {
    const groups = groupEntries([
      entry("a", { group: "G" }, 5),
      entry("b", { group: "G" }, 1),
      entry("c", { group: "G" }, 3),
    ]);
    expect(groups[0].entries.map((e) => e.key)).toEqual(["a", "b", "c"]);
  });
});

describe("countGroupValues", () => {
  it("counts non-empty visible values", () => {
    const entries = [entry("a"), entry("b"), entry("c")];
    expect(countGroupValues(entries, { a: "x", b: 1, c: true })).toBe(3);
  });

  it("excludes falsy / empty values", () => {
    const entries = [entry("a"), entry("b"), entry("c"), entry("d")];
    expect(
      countGroupValues(entries, { a: "", b: null, c: false, d: [] }),
    ).toBe(0);
  });

  it("excludes hidden fields", () => {
    const entries = [entry("a", { hidden: true }), entry("b")];
    expect(countGroupValues(entries, { a: "x", b: "y" })).toBe(1);
  });

  it("excludes invisible fields via visibleWhen", () => {
    const entries = [
      entry("mode"),
      entry("items", { visibleWhen: { field: "mode", equals: "static" } }),
    ];
    // items is hidden when mode !== "static"; should not count even if populated
    expect(countGroupValues(entries, { mode: "dynamic", items: ["a"] })).toBe(
      // only `mode` counts
      1,
    );
    expect(countGroupValues(entries, { mode: "static", items: ["a"] })).toBe(
      2,
    );
  });

  it("counts arrays with at least one element", () => {
    const entries = [entry("list")];
    expect(countGroupValues(entries, { list: [1, 2] })).toBe(1);
    expect(countGroupValues(entries, { list: [] })).toBe(0);
  });
});
