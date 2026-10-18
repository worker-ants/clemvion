import { describe, it, expect } from "vitest";
import { buildLoginHref } from "@/lib/auth/post-login-redirect";
import {
  buildInvitationLoginHref,
  invitationAcceptPath,
  isInvitationAcceptPath,
} from "../accept-path";

/**
 * 초대 수락 페이지로 돌아오는 경로(CLE-ACCT-WS 「초대 가입 화면」). 가입 화면 · 수락 페이지 · 로그인 화면이
 * 같은 규칙을 쓴다.
 */
describe("buildInvitationLoginHref", () => {
  it("토큰이 있으면 초대 수락 페이지로 돌아오는 로그인 경로를 만든다", () => {
    const href = buildInvitationLoginHref("ab+/=c");
    expect(href).toBe(buildLoginHref(invitationAcceptPath("ab+/=c")));
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/invitations/accept?token=ab%2B%2F%3Dc");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["빈 문자열", ""],
  ])("토큰이 %s 이면 돌아올 곳 없이 /login 이다", (_label, token) => {
    expect(buildInvitationLoginHref(token)).toBe("/login");
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
