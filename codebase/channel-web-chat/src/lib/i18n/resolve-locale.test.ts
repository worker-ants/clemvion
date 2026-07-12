import { describe, it, expect } from "vitest";
import { resolveLocale } from "./resolve-locale";

// spec 1-widget-app §4: 명시 locale → navigator.language(auto-detect) → ko fallback.
describe("resolveLocale", () => {
  it("명시 locale 이 최우선 (navigator 무시)", () => {
    expect(resolveLocale("en", "ko-KR")).toBe("en");
    expect(resolveLocale("ko", "en-US")).toBe("ko");
  });

  it("명시 없음 → navigator.language auto-detect (en 계열 → en)", () => {
    expect(resolveLocale(undefined, "en")).toBe("en");
    expect(resolveLocale(undefined, "en-US")).toBe("en");
    expect(resolveLocale(undefined, "en_GB")).toBe("en");
    expect(resolveLocale(undefined, "EN-us")).toBe("en"); // 대소문자 무시
  });

  it("en 계열이 아니면 ko fallback", () => {
    expect(resolveLocale(undefined, "ko-KR")).toBe("ko");
    expect(resolveLocale(undefined, "de-DE")).toBe("ko");
    expect(resolveLocale(undefined, "english")).toBe("ko"); // 'en' 접두 단어경계 아님
    expect(resolveLocale(undefined, undefined)).toBe("ko");
    expect(resolveLocale(null, null)).toBe("ko");
  });

  it("지원하지 않는 명시값은 무시하고 auto-detect/fallback", () => {
    expect(resolveLocale("fr", "en-US")).toBe("en");
    expect(resolveLocale("fr", "ko-KR")).toBe("ko");
  });
});
