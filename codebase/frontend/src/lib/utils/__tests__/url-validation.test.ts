import { describe, expect, it } from "vitest";

import {
  hasNotificationUrlCredentials,
  isValidNotificationUrl,
} from "../url-validation";

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

// 서버는 userinfo 가 있는 알림 URL 을 400 INVALID_NOTIFICATION_URL 로 거부한다(NERV Task CLE-T-RCQGCC).
// 저장 전에 같은 판정으로 전용 안내를 보여 준다.
describe("hasNotificationUrlCredentials", () => {
  it.each([
    "https://user:pass@hooks.example.com/webhook",
    "https://tok@hooks.example.com/webhook",
    "https://:pw@hooks.example.com/webhook",
    "  https://user:@hooks.example.com/webhook  ",
  ])("detects userinfo in %s", (url) => {
    expect(hasNotificationUrlCredentials(url)).toBe(true);
  });

  it.each([
    "https://hooks.example.com/webhook",
    "https://@hooks.example.com/webhook",
    "",
    "not a url",
  ])("returns false for %s", (url) => {
    expect(hasNotificationUrlCredentials(url)).toBe(false);
  });
});
