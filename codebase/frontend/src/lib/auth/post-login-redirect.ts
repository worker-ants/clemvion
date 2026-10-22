import { isSafeInternalPath } from "@/lib/workspace/safe-path";

// 근거:
//   - [세션과 토큰 「공개 경로와 가드」](CLE-ACCT-SESSION#공개-경로와-가드) REQ-SESSION-035 · 036
//   - [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION#로그인-뒤-이동) REQ-SESSION-038
//   - [세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION#소셜-로그인의-복귀-경로) REQ-SESSION-045
//   - [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS#초대-가입-화면)

/** 로그인 뒤 돌아갈 곳이 없거나 안전하지 않을 때 가는 경로. */
export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

/**
 * `?redirect=` 값을 로그인 뒤 이동할 경로로 바꾼다. `/` 하나로 시작하는 같은 출처 경로(쿼리 · 해시 포함)만
 * 그대로 쓴다. 외부 URL, 앞머리에 `/` · `\` 가 겹친 값(`//host`, `/\host`), 탭 · 개행이 든 값은
 * `/dashboard` 로 보낸다. 판정은 open-redirect 방어 정규화의 단일 진실(`isSafeInternalPath`)을 쓴다.
 */
export function resolvePostLoginRedirect(
  raw: string | null | undefined,
): string {
  return typeof raw === "string" && isSafeInternalPath(raw)
    ? raw
    : DEFAULT_POST_LOGIN_PATH;
}

/** 로그인 화면 경로. `target` 은 경로와 쿼리를 합친 값이고 통째로 인코딩한다. */
export function buildLoginHref(target: string): string {
  return `/login?redirect=${encodeURIComponent(target)}`;
}

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

const INVITATION_ACCEPT_PATH_RE = /^(?:\/w\/[^/?#]+)?\/invitations\/accept(?:[?#]|$)/;

/** 로그인 뒤 갈 곳이 초대 수락 페이지인지. 로그인 화면이 초대 안내 문구를 고를 때 쓴다. */
export function isInvitationAcceptPath(path: string): boolean {
  return INVITATION_ACCEPT_PATH_RE.test(path);
}

/** sessionStorage 키. OAuth 왕복 동안만 쓰고 콜백이 꺼내며 지운다. 앱 전역 키라 `clemvion.` 접두를 쓴다. */
const OAUTH_REDIRECT_KEY = "clemvion.postLoginRedirect";

/**
 * OAuth 로그인을 시작하기 전에 돌아갈 경로를 같은 탭의 sessionStorage 에 둔다. OAuth 는 백엔드와
 * 프로바이더를 거쳐 `/callback` 으로 돌아오므로 `?redirect=` 를 들고 갈 수 없다. `null` 이나
 * 안전하지 않은 값이면 남아 있던 값을 지운다. 저장소를 쓸 수 없으면(사생활 보호 모드 등) 조용히
 * 넘어가고 콜백은 `/dashboard` 로 간다.
 */
export function rememberOauthRedirect(target: string | null): void {
  try {
    if (target !== null && isSafeInternalPath(target)) {
      window.sessionStorage.setItem(OAUTH_REDIRECT_KEY, target);
    } else {
      window.sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
    }
  } catch {
    // 저장소 접근 실패는 기본 경로로 대신한다.
  }
}

/**
 * OAuth 콜백에서 저장한 경로를 한 번 꺼내 지운다. 꺼낸 값도 다시 검사한다. 두 번째 호출은 `/dashboard` 를
 * 돌려주므로 콜백 한 번에 한 번만 부른다.
 */
export function consumeOauthRedirect(): string {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(OAUTH_REDIRECT_KEY);
    window.sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
  } catch {
    // 저장소 접근 실패는 기본 경로로 대신한다.
  }
  return resolvePostLoginRedirect(raw);
}
