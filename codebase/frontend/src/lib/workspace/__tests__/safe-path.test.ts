import { describe, it, expect } from "vitest";
import { toSafeInternalPath, isSafeInternalPath } from "../safe-path";

describe("toSafeInternalPath", () => {
  it.each([
    ["already safe", "/dashboard", "/dashboard"],
    ["nested + query", "/integrations/abc?x=1", "/integrations/abc?x=1"],
    ["missing leading slash", "workflows", "/workflows"],
    ["protocol-relative //", "//evil.com/x", "/evil.com/x"],
    ["double backslash", "\\\\evil.com/x", "/evil.com/x"],
    ["slash + backslash", "/\\evil.com", "/evil.com"],
    ["embedded tab", "/\t/evil.com", "/evil.com"],
    ["embedded CR", "/\r/evil.com", "/evil.com"],
    ["embedded LF", "/\n/evil.com", "/evil.com"],
  ])("normalizes %s", (_label, input, expected) => {
    expect(toSafeInternalPath(input)).toBe(expected);
  });
});

describe("isSafeInternalPath", () => {
  it.each([
    ["same-origin absolute", "/dashboard", true],
    ["nested with query", "/w/team-a/workflows?x=1", true],
    ["protocol-relative", "//evil.com", false],
    ["backslash bypass", "/\\evil.com", false],
    ["control-char bypass", "/\t/evil.com", false],
    ["bare (no leading slash)", "workflows", false],
    ["empty string", "", false],
    ["null", null, false],
  ])("%s → %s", (_label, input, expected) => {
    expect(isSafeInternalPath(input as string | null)).toBe(expected);
  });
});
