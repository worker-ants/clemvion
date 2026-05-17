import { describe, it, expect } from "vitest";
import { extractBackgroundRunId } from "../result-detail";

describe("extractBackgroundRunId (W-19)", () => {
  it("returns null when output is null", () => {
    expect(extractBackgroundRunId(null)).toBeNull();
  });

  it("returns null when output is undefined", () => {
    expect(extractBackgroundRunId(undefined)).toBeNull();
  });

  it("returns null when output is a primitive (string/number/boolean)", () => {
    expect(extractBackgroundRunId("string")).toBeNull();
    expect(extractBackgroundRunId(42)).toBeNull();
    expect(extractBackgroundRunId(true)).toBeNull();
  });

  it("returns null when output lacks `meta`", () => {
    expect(extractBackgroundRunId({ port: "main" })).toBeNull();
  });

  it("returns null when `meta` is not an object", () => {
    expect(extractBackgroundRunId({ meta: "ignore" })).toBeNull();
    expect(extractBackgroundRunId({ meta: null })).toBeNull();
  });

  it("returns null when `meta.backgroundRunId` is missing", () => {
    expect(
      extractBackgroundRunId({ meta: { forkedAt: "2026-05-15T00:00:00Z" } }),
    ).toBeNull();
  });

  it("returns null when `meta.backgroundRunId` is not a string", () => {
    expect(extractBackgroundRunId({ meta: { backgroundRunId: 123 } })).toBeNull();
    expect(
      extractBackgroundRunId({ meta: { backgroundRunId: null } }),
    ).toBeNull();
    expect(
      extractBackgroundRunId({ meta: { backgroundRunId: ["a"] } }),
    ).toBeNull();
  });

  it("returns null when `meta.backgroundRunId` is an empty string", () => {
    expect(extractBackgroundRunId({ meta: { backgroundRunId: "" } })).toBeNull();
  });

  it("returns the UUID string when valid", () => {
    expect(
      extractBackgroundRunId({
        meta: { backgroundRunId: "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234" },
      }),
    ).toBe("8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234");
  });
});
