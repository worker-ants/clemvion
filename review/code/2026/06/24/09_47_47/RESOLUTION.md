# RESOLUTION — 라이브 미리보기 동봉 위젯 서빙 버그픽스 (09_47_47)

대상 SUMMARY: `review/code/2026/06/24/09_47_47/SUMMARY.md` (Critical 0, WARNING 4, INFO 16, 위험도 LOW).

## 조치 항목

| # | 발견 | 처분 |
|---|------|------|
| W-1 | `/_widget` prefix 광범위 인증 예외 + 이중방어 dead-code | **dismiss(의도된 설계)** — `/_widget/**` 하위는 전부 `public/_widget/...` 동봉 정적 번들이고 동적 Next 라우트가 없다. prefix 전체 예외가 정확(버전별 `web-chat/v1`·`v2` 모두 포함). `/web-chat/` 으로 좁히면 향후 버전 경로 누락. matcher(1차)+함수 startsWith(2차)는 **의도된 defense-in-depth** — matcher 정규식 회귀 시 함수가 인증 redirect 를 막는 2차 방어 |
| W-2 | matcher+함수 이중방어 silent 불일치 가능 | **dismiss(의도된 이중방어)** — 위와 동일. 주석 보강(코드변경)은 가드 동결 위해 후속(INFO 12 JSDoc 과 함께) |
| W-3 | rewrite(404→200) 자동화 테스트 없음 | **defer** — dev 서버 curl 실측(`…/app/` 308→200 위젯 index.html, 보호경로 307 /login)으로 핵심 검증 + `proxy.test.ts` 6/6(인증 예외·보호경로 회귀). e2e rewrite smoke(`/_widget/.../app/` 200)는 위젯 번들(`public/_widget`) 동봉 의존이라 별도 후속 |
| W-4 | SPEC-DRIFT — auth-flow §7.1 proxy 제외 목록에 `/_widget` 미반영 | **fix(spec)** — `spec/2-navigation/10-auth-flow.md §7.1` 제외 목록에 `/_widget`(동봉 위젯 번들, 0-architecture §4.1 링크) 추가 |
| INFO 1~16 | has_session hint·redirect 검증·캐시·JSDoc·상수화·경계 테스트 등 | **대부분 defer/현행수용** — I-1(has_session hint-only)은 auth-flow §7.1 에 이미 명시(dismiss). I-8(no-store 위젯자산 캐시)·I-9(쿠키명 상수화)·I-12(JSDoc)·I-13~14(경계 테스트)는 비차단 백로그 |

## 코드 동결로 defer 한 코드 항목 (후속 턴/PR)
- `proxy.ts` JSDoc + 이중방어 의도 주석(W-1·W-2·INFO12), `SESSION_COOKIE_NAME` 상수화(INFO9)
- rewrite smoke e2e(W-3), publicPaths/prefix-overlap 경계 테스트(INFO13·14)
- `/_widget/**` headers() no-store 제외 → 불변 자산 장기 캐시(INFO8)

## TEST 결과

- **코드 무변경** — 본 라운드 산출물은 spec(auth-flow §7.1) + review 산출물뿐. proxy.ts/next.config.ts 는 33ad66b6 그대로 동결.
- 직전 검증 유지: `proxy.test.ts` 6/6 · frontend vitest 4676 pass · frontend lint 0 err · `next build`(Proxy middleware + rewrite 컴파일) PASS.
- **실측(dev curl)**: `/_widget/web-chat/v1/app/?…` → 308 → 200(위젯 index.html, 에셋 경로 `/_widget/web-chat/v1/app/_next/...` 정확), `/_widget/.../loader.js` 200, 보호경로 `/web-chat` 307 `/login` 유지.
