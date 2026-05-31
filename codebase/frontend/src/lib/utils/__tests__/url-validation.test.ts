import { describe, expect, it } from "vitest";

import { isValidNotificationUrl } from "../url-validation";

describe("isValidNotificationUrl", () => {
  it("accepts a well-formed https URL", () => {
    expect(isValidNotificationUrl("https://hooks.example.com/webhook")).toBe(
      true,
    );
  });

  it("treats an empty string as unset (notification is optional)", () => {
    expect(isValidNotificationUrl("")).toBe(true);
  });

  it("treats a whitespace-only string as unset", () => {
    expect(isValidNotificationUrl("   ")).toBe(true);
  });

  it("rejects http:// (EIA-NX-09 https-only)", () => {
    expect(isValidNotificationUrl("http://hooks.example.com/webhook")).toBe(
      false,
    );
  });

  it("rejects a non-URL string", () => {
    expect(isValidNotificationUrl("not a url")).toBe(false);
  });

  it("rejects a bare hostname without scheme", () => {
    expect(isValidNotificationUrl("hooks.example.com")).toBe(false);
  });

  it("rejects other schemes (ftp, javascript)", () => {
    expect(isValidNotificationUrl("ftp://example.com")).toBe(false);
    expect(isValidNotificationUrl("javascript:alert(1)")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidNotificationUrl("  https://example.com  ")).toBe(true);
  });
});
