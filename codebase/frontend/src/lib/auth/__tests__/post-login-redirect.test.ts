import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_POST_LOGIN_PATH,
  buildLoginHref,
  consumeOauthRedirect,
  invitationAcceptPath,
  isInvitationAcceptPath,
  rememberOauthRedirect,
  resolvePostLoginRedirect,
} from "../post-login-redirect";

/**
 * 로그인 뒤 복귀 경로(REQ-SESSION-038). 같은 출처의 상대 경로만 받고 나머지는 `/dashboard` 로
 * 보낸다. 쿼리는 그대로 둔다(초대 수락 페이지의 `?token=` 이 대표 사례).
 */
describe("resolvePostLoginRedirect", () => {
  it.each([
    ["상대 경로", "/workflows", "/workflows"],
    ["슬러그 경로 + 쿼리", "/w/team-a/workflows/abc?tab=runs", "/w/team-a/workflows/abc?tab=runs"],
    ["초대 수락 + 토큰", "/invitations/accept?token=abc123", "/invitations/accept?token=abc123"],
    ["해시 보존", "/docs/intro#setup", "/docs/intro#setup"],
  ])("%s 는 그대로 쓴다", (_label, input, expected) => {
    expect(resolvePostLoginRedirect(input)).toBe(expected);
  });

  it.each([
    ["값 없음(undefined)", undefined],
    ["값 없음(null)", null],
    ["빈 문자열", ""],
    ["외부 URL", "https://evil.example.com/x"],
    ["javascript 스킴", "javascript:alert(1)"],
    ["protocol-relative //", "//evil.example.com"],
    ["슬래시 + 백슬래시", "/\\evil.example.com"],
    ["백슬래시 둘", "\\\\evil.example.com"],
    ["탭 끼운 우회", "/\t/evil.example.com"],
    ["줄바꿈 끼운 우회", "/\n/evil.example.com"],
    ["앞에 공백", " /workflows"],
    ["슬래시 없는 상대 경로", "workflows"],
  ])("%s 는 /dashboard 로 보낸다", (_label, input) => {
    expect(resolvePostLoginRedirect(input as string | null | undefined)).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
  });

  it("기본 경로는 /dashboard 다", () => {
    expect(DEFAULT_POST_LOGIN_PATH).toBe("/dashboard");
  });
});

describe("buildLoginHref", () => {
  it("경로와 쿼리를 한 값으로 인코딩해 redirect 에 담는다", () => {
    const href = buildLoginHref("/invitations/accept?token=a+b/c");
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/invitations/accept?token=a+b/c");
    // 쿼리 안의 쿼리가 /login 의 파라미터로 새지 않는다.
    expect(url.searchParams.get("token")).toBeNull();
  });
});

describe("invitationAcceptPath · isInvitationAcceptPath", () => {
  it("토큰을 URL 인코딩해 수락 페이지 경로를 만든다", () => {
    expect(invitationAcceptPath("ab+/=c")).toBe("/invitations/accept?token=ab%2B%2F%3Dc");
  });

  it.each([
    ["/invitations/accept?token=x", true],
    ["/invitations/accept", true],
    ["/w/team-a/invitations/accept?token=x", true],
    ["/invitations/acceptance", false],
    ["/w/team-a/workflows", false],
    ["/dashboard", false],
  ])("%s → %s", (path, expected) => {
    expect(isInvitationAcceptPath(path)).toBe(expected);
  });
});

/**
 * OAuth 로그인은 백엔드 · 프로바이더를 거쳐 `/callback` 으로 돌아온다. 그 사이 `redirect` 를 들고 갈
 * 쿼리가 없으므로 같은 탭의 sessionStorage 에 두고 콜백에서 한 번 꺼낸다.
 */
describe("rememberOauthRedirect · consumeOauthRedirect", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("저장한 안전한 경로를 한 번 돌려주고 지운다", () => {
    rememberOauthRedirect("/invitations/accept?token=abc");
    expect(consumeOauthRedirect()).toBe("/invitations/accept?token=abc");
    expect(consumeOauthRedirect()).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("저장한 값이 없으면 /dashboard", () => {
    expect(consumeOauthRedirect()).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("null 을 넘기면 이전 값을 지운다", () => {
    rememberOauthRedirect("/workflows");
    rememberOauthRedirect(null);
    expect(consumeOauthRedirect()).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("안전하지 않은 값은 저장하지 않고, 저장소가 오염돼도 꺼낼 때 다시 검사한다", () => {
    rememberOauthRedirect("//evil.example.com");
    expect(consumeOauthRedirect()).toBe(DEFAULT_POST_LOGIN_PATH);

    window.sessionStorage.setItem("clemvion.postLoginRedirect", "https://evil.example.com");
    expect(consumeOauthRedirect()).toBe(DEFAULT_POST_LOGIN_PATH);
  });
});
