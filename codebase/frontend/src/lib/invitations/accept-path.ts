import { buildLoginHref } from "@/lib/auth/post-login-redirect";

// 근거: [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS#초대-가입-화면)
// 초대 id 모드: [워크스페이스와 멤버 「이미 가입한 사용자의 수락 경로」](CLE-ACCT-WS#이미-가입한-사용자의-수락-경로)
//
// 초대 수락 페이지 경로와 초대 흐름의 로그인 경로. 초대 모듈이 `lib/auth` 의 `buildLoginHref` 를 가져다 쓰고
// 반대 방향 의존은 두지 않는다.

/** 초대 수락 페이지 경로. 슬러그 없는 경로라 옛 경로 흡수 라우트가 현재 워크스페이스로 넘긴다. */
export function invitationAcceptPath(token: string): string {
  return `/invitations/accept?token=${encodeURIComponent(token)}`;
}

/**
 * 초대 id 모드의 수락 페이지 경로. 초대 알림(`team_invite`)이 연다. 수락 페이지는 로그인 사용자의 이메일로 온
 * 초대만 찾는다([워크스페이스 초대 「이미 가입한 사용자의 수락 경로」](CLE-ACCT-WS-INVITE#이미-가입한-사용자의-수락-경로)).
 */
export function invitationAcceptByIdPath(invitationId: string): string {
  return `/invitations/accept?invitationId=${encodeURIComponent(invitationId)}`;
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

const INVITATION_ACCEPT_PATH_RE =
  /^(?:\/w\/[^/?#]+)?\/invitations\/accept(?:[?#]|$)/;

/** 로그인 뒤 갈 곳이 초대 수락 페이지인지. 로그인 화면이 초대 안내 문구를 고를 때 쓴다. */
export function isInvitationAcceptPath(path: string): boolean {
  return INVITATION_ACCEPT_PATH_RE.test(path);
}
