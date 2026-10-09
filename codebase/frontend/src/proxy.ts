import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/callback",
];

/**
 * 초대 메일의 옛 링크. 가입 화면은 `(auth)` route group 이라 실제 경로가 `/register` 인데
 * 메일이 `/auth/register?invitationToken=…` 으로 나간 적이 있다. 이미 발송된 메일이 `/login` 으로
 * 튕기지 않도록 쿼리를 보존해 `/register` 로 보낸다(CLE-ACCT-WS 초대 메일 링크).
 */
const LEGACY_INVITE_REGISTER_PATHS = new Set(["/auth/register", "/auth/register/"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (LEGACY_INVITE_REGISTER_PATHS.has(pathname)) {
    // nextUrl.clone() 은 원래 경로의 끝 슬래시를 다시 붙이므로 새 URL 로 만든다.
    const registerUrl = new URL("/register", request.url);
    registerUrl.search = request.nextUrl.search;
    return NextResponse.redirect(registerUrl);
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static assets and API routes.
  // `/_widget/**` 는 동봉(co-deploy) 웹채팅 위젯 정적 번들(`public/_widget/...`). 위젯 앱 진입은
  // `/_widget/web-chat/v1/app/`(디렉토리, 점 없음)라 `includes(".")` 정적 예외를 못 타 인증 redirect
  // 대상이 됐었다 → iframe 미리보기/설치 스니펫이 /login 으로 튕김. 명시 prefix 로 제외한다.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_widget") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for session hint cookie (set by frontend JS on login, works cross-domain)
  const hasSession = request.cookies.get("has_session");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|_widget).*)"],
};
