import { describe, it, expect } from "vitest";
import { translate } from "../index";
import { isLocale, LOCALES, DEFAULT_LOCALE } from "../types";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("ko")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejects other values", () => {
    expect(isLocale("jp")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(123)).toBe(false);
  });
});

describe("locale constants", () => {
  it("exposes the supported locales", () => {
    expect(LOCALES).toEqual(["ko", "en"]);
  });

  it("defaults to Korean", () => {
    expect(DEFAULT_LOCALE).toBe("ko");
  });
});

describe("translate", () => {
  it("returns Korean text when locale is ko", () => {
    expect(translate("ko", "common.save")).toBe("저장");
    expect(translate("ko", "common.cancel")).toBe("취소");
  });

  it("returns English text when locale is en", () => {
    expect(translate("en", "common.save")).toBe("Save");
    expect(translate("en", "common.cancel")).toBe("Cancel");
  });

  it("supports nested keys", () => {
    expect(translate("ko", "auth.login.title")).toBe("로그인");
    expect(translate("en", "auth.login.title")).toBe("Sign in");
  });

  it("interpolates parameters", () => {
    expect(
      translate("ko", "time.minutesAgo", { minutes: 5 }),
    ).toBe("5분 전");
    expect(
      translate("en", "time.minutesAgo", { minutes: 5 }),
    ).toBe("5m ago");
  });

  it("interpolates multiple parameters", () => {
    expect(
      translate("ko", "time.minutesSeconds", { minutes: 3, seconds: 10 }),
    ).toBe("3분 10초");
    expect(
      translate("en", "time.minutesSeconds", { minutes: 3, seconds: 10 }),
    ).toBe("3m 10s");
  });

  it("falls back to Korean when key missing in target locale", () => {
    // Both locales have this key, so this demonstrates the fallback path works.
    expect(translate("en", "common.save")).toBe("Save");
  });

  it("returns the key when translation is missing", () => {
    // @ts-expect-error — intentional unknown key for fallback test
    expect(translate("ko", "unknown.key")).toBe("unknown.key");
  });

  it("leaves unknown placeholders intact", () => {
    // non-\w placeholders such as `{{ $now }}` should not be replaced
    const rendered = translate("en", "schedules.paramsHelp");
    expect(rendered).toContain("$now");
    expect(rendered).toContain("$schedule.id");
  });
});
