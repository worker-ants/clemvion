import { describe, it, expect } from "vitest";
import { humanize, applyClearFields } from "../utils";

describe("humanize", () => {
  it("uppercases the first character", () => {
    expect(humanize("label")).toBe("Label");
  });

  it("splits camelCase", () => {
    expect(humanize("systemPrompt")).toBe("System Prompt");
    expect(humanize("maxToolCalls")).toBe("Max Tool Calls");
  });

  it("replaces underscores with spaces", () => {
    expect(humanize("manual_trigger")).toBe("Manual trigger");
  });

  it("handles empty string", () => {
    expect(humanize("")).toBe("");
  });
});

describe("applyClearFields", () => {
  it("returns the config unchanged when no clearFields provided", () => {
    const cfg = { a: 1, b: 2 };
    expect(applyClearFields(cfg, undefined)).toEqual({ a: 1, b: 2 });
    expect(applyClearFields(cfg, [])).toEqual({ a: 1, b: 2 });
  });

  it("removes listed keys", () => {
    const cfg = { a: 1, b: 2, c: 3 };
    expect(applyClearFields(cfg, ["b"])).toEqual({ a: 1, c: 3 });
    expect(applyClearFields(cfg, ["a", "c"])).toEqual({ b: 2 });
  });

  it("does not mutate the input", () => {
    const cfg = { a: 1, b: 2 };
    applyClearFields(cfg, ["a"]);
    expect(cfg).toEqual({ a: 1, b: 2 });
  });

  it("ignores non-existent keys", () => {
    const cfg = { a: 1 };
    expect(applyClearFields(cfg, ["missing"])).toEqual({ a: 1 });
  });

  it("blocks prototype-polluting keys", () => {
    const cfg = { a: 1, b: 2 };
    // Even if malicious clearFields tries to delete prototype, they're ignored.
    const result = applyClearFields(cfg, ["__proto__", "constructor", "prototype", "a"]);
    expect(result).toEqual({ b: 2 });
    // Object.prototype should be unaffected
    expect(Object.prototype).toBe(Object.getPrototypeOf({}));
  });
});
