import { describe, it, expect } from "vitest";
import { isDryRunOutput } from "../result-detail";

describe("isDryRunOutput (spec §7.4)", () => {
  it("returns false when output is null/undefined", () => {
    expect(isDryRunOutput(null)).toBe(false);
    expect(isDryRunOutput(undefined)).toBe(false);
  });

  it("returns false when output is a primitive", () => {
    expect(isDryRunOutput("dry")).toBe(false);
    expect(isDryRunOutput(42)).toBe(false);
    expect(isDryRunOutput(true)).toBe(false);
  });

  it("returns true when the flat output carries `_dryRun: true`", () => {
    expect(isDryRunOutput({ _dryRun: true })).toBe(true);
    expect(isDryRunOutput({ _dryRun: true, status: "ok" })).toBe(true);
  });

  it("returns true when the enveloped output carries `_dryRun: true`", () => {
    expect(isDryRunOutput({ output: { _dryRun: true } })).toBe(true);
  });

  it("returns false when `_dryRun` is absent", () => {
    expect(isDryRunOutput({ status: "ok" })).toBe(false);
    expect(isDryRunOutput({ output: { status: "ok" } })).toBe(false);
  });

  it("returns false when `_dryRun` is a non-`true` value", () => {
    expect(isDryRunOutput({ _dryRun: false })).toBe(false);
    expect(isDryRunOutput({ _dryRun: "true" })).toBe(false);
    expect(isDryRunOutput({ _dryRun: 1 })).toBe(false);
    expect(isDryRunOutput({ output: { _dryRun: false } })).toBe(false);
  });

  it("returns false when the envelope `output` is not an object", () => {
    expect(isDryRunOutput({ output: "x" })).toBe(false);
    expect(isDryRunOutput({ output: null })).toBe(false);
  });
});
