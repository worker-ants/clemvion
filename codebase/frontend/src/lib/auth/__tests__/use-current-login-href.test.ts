import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCurrentLoginHref } from "../use-current-login-href";
import { buildLoginHref } from "../post-login-redirect";

let mockPathname: string | null = "/workflows/abc";
let mockSearch = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

beforeEach(() => {
  mockPathname = "/workflows/abc";
  mockSearch = "";
});

/**
 * 지금 화면으로 돌아오는 로그인 화면 경로. 세션 만료 오류 화면 두 곳이 쓴다
 * ([오류 화면과 빈 상태 「감지 규칙」](CLE-UI-ERRORS#감지-규칙),
 * [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION#로그인-뒤-이동)).
 */
describe("useCurrentLoginHref", () => {
  it("쿼리가 없으면 경로만 복귀 경로로 담는다", () => {
    const { result } = renderHook(() => useCurrentLoginHref());
    expect(result.current).toBe(buildLoginHref("/workflows/abc"));
  });

  it("경로와 쿼리를 함께 복귀 경로로 담는다", () => {
    mockPathname = "/invitations/accept";
    mockSearch = "token=abc%2B1&x=1";
    const { result } = renderHook(() => useCurrentLoginHref());
    expect(result.current).toBe(
      buildLoginHref("/invitations/accept?token=abc%2B1&x=1"),
    );
    // 로그인 화면이 받는 값은 원래 경로와 쿼리 그대로다.
    const redirect = new URL(result.current, "http://localhost").searchParams.get(
      "redirect",
    );
    expect(redirect).toBe("/invitations/accept?token=abc%2B1&x=1");
  });

  it.each([
    ["protocol-relative 경로", "//evil.com"],
    ["백슬래시가 겹친 경로", "/\\evil.com"],
  ])("%s 면 /dashboard 를 담는다", (_label, pathname) => {
    mockPathname = pathname;
    mockSearch = "q=1";
    const { result } = renderHook(() => useCurrentLoginHref());
    expect(result.current).toBe(buildLoginHref("/dashboard"));
  });

  it("경로를 알 수 없으면(null) /dashboard 를 담는다", () => {
    mockPathname = null;
    mockSearch = "q=1";
    const { result } = renderHook(() => useCurrentLoginHref());
    expect(result.current).toBe(buildLoginHref("/dashboard"));
  });
});
