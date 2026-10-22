import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SESSION_HINT_COOKIE,
  clearSessionHint,
  hasSessionHint,
  setSessionHint,
} from "../session-hint";

/**
 * `has_session` 세션 힌트 쿠키(REQ-SESSION-037). auth-store 가 심고 지우며, proxy 와 가입 화면이
 * 읽는다. 쿠키 문자열은 이 모듈로 옮기기 전과 한 글자도 다르면 안 된다(쿠키 정책을 바꾸지 않는다).
 */
describe("session-hint", () => {
  beforeEach(() => {
    document.cookie = "has_session=; path=/; max-age=0";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "has_session=; path=/; max-age=0";
  });

  it("쿠키 이름은 has_session 이다", () => {
    expect(SESSION_HINT_COOKIE).toBe("has_session");
  });

  it("setSessionHint 는 30일짜리 SameSite=Lax 쿠키를 심는다", () => {
    const setter = vi.spyOn(Document.prototype, "cookie", "set");
    setSessionHint();
    expect(setter).toHaveBeenCalledWith(
      "has_session=1; path=/; max-age=2592000; SameSite=Lax",
    );
    expect(hasSessionHint()).toBe(true);
  });

  it("clearSessionHint 는 max-age=0 으로 쿠키를 지운다", () => {
    setSessionHint();
    const setter = vi.spyOn(Document.prototype, "cookie", "set");
    clearSessionHint();
    expect(setter).toHaveBeenCalledWith("has_session=; path=/; max-age=0");
    expect(hasSessionHint()).toBe(false);
  });

  it.each([
    ["힌트만", "has_session=1", true],
    ["다른 쿠키 뒤", "theme=dark; has_session=1", true],
    ["값이 1 이 아니다", "has_session=0", false],
    ["값이 비었다", "has_session=", false],
    ["이름이 더 길다", "xhas_session=1", false],
    ["쿠키 없음", "", false],
  ])("hasSessionHint(%s) 는 %s", (_label, cookie, expected) => {
    expect(hasSessionHint(cookie as string)).toBe(expected);
  });
});
