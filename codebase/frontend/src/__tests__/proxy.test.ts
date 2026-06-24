import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

/**
 * proxy(미들웨어) 인증 게이트 — `/_widget/**` 동봉 위젯 번들 회귀 가드.
 *
 * 라이브 미리보기 iframe·설치 스니펫이 위젯 SPA 를 `/_widget/web-chat/v1/app/`(디렉토리, 점 없음)로
 * 여는데, 과거엔 `pathname.includes(".")` 정적 예외를 못 타 인증 redirect(/login) 대상이 되어
 * iframe 이 로그인 페이지로 튕기고 위젯이 로드되지 않았다. `/_widget` prefix 예외로 해소.
 */
function req(path: string, opts: { session?: boolean } = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: opts.session ? { cookie: "has_session=1" } : {},
  });
}

/** redirect 여부 — NextResponse.next() 는 location 헤더가 없고, redirect 는 location 을 둔다. */
function redirectLocation(res: ReturnType<typeof proxy>): string | null {
  return res.headers.get("location");
}

describe("proxy — /_widget 동봉 위젯 번들", () => {
  it("위젯 앱 디렉토리 경로(점 없음)도 인증 redirect 없이 통과", () => {
    const res = proxy(req("/_widget/web-chat/v1/app/"));
    expect(redirectLocation(res)).toBeNull();
  });

  it("위젯 앱(슬래시 없는 형태)도 통과", () => {
    expect(redirectLocation(proxy(req("/_widget/web-chat/v1/app")))).toBeNull();
  });

  it("loader.js·정적 에셋도 통과", () => {
    expect(redirectLocation(proxy(req("/_widget/web-chat/v1/loader.js")))).toBeNull();
    expect(
      redirectLocation(proxy(req("/_widget/web-chat/v1/app/_next/static/x.js"))),
    ).toBeNull();
  });
});

describe("proxy — 인증 보호 회귀(여전히 동작)", () => {
  it("보호 경로는 세션 없으면 /login 으로 redirect", () => {
    const loc = redirectLocation(proxy(req("/web-chat")));
    expect(loc).toContain("/login");
    expect(loc).toContain("redirect=%2Fweb-chat");
  });

  it("보호 경로도 세션 있으면 통과", () => {
    expect(redirectLocation(proxy(req("/web-chat", { session: true })))).toBeNull();
  });

  it("public 경로(/login)는 세션 없이도 통과", () => {
    expect(redirectLocation(proxy(req("/login")))).toBeNull();
  });
});
