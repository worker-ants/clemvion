import { buildLoginHref } from "@/lib/auth/post-login-redirect";

// 근거:
//   - [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS#초대-가입-화면)
//   - [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION#로그인-뒤-이동) REQ-SESSION-038

/** 초대 수락 페이지 경로. 슬러그 없는 경로라 옛 경로 흡수 라우트가 현재 워크스페이스로 넘긴다. */
export function invitationAcceptPath(token: string): string {
  return `/invitations/accept?token=${encodeURIComponent(token)}`;
}

/**
 * 초대 수락 페이지로 돌아오는 로그인 화면 경로. 토큰이 없으면(수락 페이지 밖) 돌아올 곳이 없어
 * 그냥 `/login` 이다. 가입 화면의 «로그인» 링크 · 기존 가입자 이동 · 수락 페이지의 «다른 계정으로
 * 로그인» 이 모두 이 규칙을 쓴다.
 */
export function buildInvitationLoginHref(
  token: string | null | undefined,
): string {
  return token ? buildLoginHref(invitationAcceptPath(token)) : "/login";
}

/** `/invitations/accept` 와 슬러그가 붙은 `/w/<slug>/invitations/accept`. 쿼리 · 해시는 있어도 된다. */
const INVITATION_ACCEPT_PATH_RE = /^(?:\/w\/[^/?#]+)?\/invitations\/accept(?:[?#]|$)/;

/** 로그인 뒤 갈 곳이 초대 수락 페이지인지. 로그인 화면이 초대 안내 문구를 고를 때 쓴다. */
export function isInvitationAcceptPath(path: string): boolean {
  return INVITATION_ACCEPT_PATH_RE.test(path);
}
