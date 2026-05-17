import { describe, it, expect } from "vitest";
import { resolveResultField } from "../resolve-result-field";

describe("resolveResultField", () => {
  it("prefers output.result.<key>", () => {
    const out = { result: { response: "new" }, response: "legacy" };
    expect(resolveResultField<string>(out, "response")).toBe("new");
  });

  it("falls back to top-level output.<key> for pre-migration payloads", () => {
    const out = { response: "legacy" };
    expect(resolveResultField<string>(out, "response")).toBe("legacy");
  });

  it("returns undefined when neither path exists", () => {
    expect(resolveResultField(undefined, "x")).toBeUndefined();
    expect(resolveResultField(null, "x")).toBeUndefined();
    expect(resolveResultField({}, "x")).toBeUndefined();
    expect(resolveResultField({ other: 1 }, "x")).toBeUndefined();
  });

  it("does not treat array.result as a result bag", () => {
    const out = { result: ["a", "b"], response: "legacy" };
    // arrays fail the `typeof === 'object' && !Array.isArray` guard
    expect(resolveResultField(out, "response")).toBe("legacy");
  });

  it("handles non-object output (primitives) safely", () => {
    expect(resolveResultField("string" as unknown, "x")).toBeUndefined();
    expect(resolveResultField(42 as unknown, "x")).toBeUndefined();
  });

  it("preserves undefined value when explicitly set on result", () => {
    const out = { result: { response: undefined }, response: "fallback" };
    // `'response' in result` is true even when the value is undefined — we
    // return that explicit undefined rather than silently falling back so
    // the caller can distinguish "not present" from "present but unset".
    expect(resolveResultField(out, "response")).toBeUndefined();
  });
});
