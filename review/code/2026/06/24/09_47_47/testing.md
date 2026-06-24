# Testing 리뷰

## 발견사항

### [INFO] next.config.ts rewrites — 유닛/통합 테스트 없음 (허용 가능 트레이드오프)
- 위치: `codebase/frontend/next.config.ts` — `rewrites()` 추가 블록
- 상세: `/_widget/:segment*/app` → `index.html` rewrite 규칙은 Next.js 런타임이 처리하는 설정이므로 순수 유닛 테스트로 검증하기 어렵다. 현재 커밋 메시지에 "dev curl 로 …/app/ 308→200(위젯 index.html) 실측 확인"이 기록되어 있어 수동 통합 테스트를 수행한 것은 확인된다. 그러나 다음 케이스에 대한 자동화된 e2e/통합 커버리지가 없다:
  - `/_widget/web-chat/v1/app` (슬래시 없음) → 200 + index.html 바디
  - `/_widget/web-chat/v1/app/` (슬래시 있음) → 200 + index.html 바디
  - `/_widget/web-chat/v1/app/static/chunk.js` 같은 SPA 하위 자산 경로가 rewrite 에 걸리지 않는지 확인 (`:segment*` 범위 경계)
- 제안: Next.js 자체 서버를 띄우는 e2e 환경(`playwright` + `next start`)이 있다면 위젯 index.html 서빙 케이스를 smoke test로 추가하는 것이 이상적이다. 단 Next config rewrite 는 유닛 테스트 대상이 아니라 통합/e2e 레벨이므로 즉각 CRITICAL 이슈는 아니다.

### [INFO] proxy.test.ts — `/_widget` 접두사 없이 비슷한 경로 경계값 테스트 미비
- 위치: `codebase/frontend/src/__tests__/proxy.test.ts`
- 상세: `/_widget` 예외의 경계를 검증하는 케이스가 부분적이다. 현재 테스트는 `/_widget/web-chat/v1/app/`, `/_widget/web-chat/v1/app`, `/_widget/web-chat/v1/loader.js`, `/_widget/web-chat/v1/app/_next/static/x.js` 를 검증한다. 누락된 경계 케이스:
  1. **matcher 수준에서 이미 제외되는 경로**: config의 matcher 정규식이 `_widget`를 제외하므로, `/_widget`로 시작하는 요청은 미들웨어 자체에 도달하지 않을 수 있다. 그런데 `proxy()` 함수는 `pathname.startsWith("/_widget")` 체크도 추가한다 — 이 이중 방어가 의도적인지 테스트가 명확히 설명하지 않는다.
  2. `/_widgetfake` 같은 prefix 오버랩 경로 — `startsWith("/_widget")` 는 이를 통과시킨다. 의도한 동작인지 확인 필요.
- 제안: `/_widgetfake`(prefix 혼동) 케이스를 보호 경로 테스트로 추가하거나, JSDoc에서 prefix 범위를 명시한다.

### [INFO] proxy.test.ts — 나머지 publicPaths 회귀 테스트 미포함
- 위치: `codebase/frontend/src/__tests__/proxy.test.ts`, 비교: `proxy.ts` `publicPaths` 배열
- 상세: 현재 테스트는 `/login`만 공개 경로로 검증한다. `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/callback` 은 테스트 없음. 변경 범위 외 경로이지만 회귀 가드 역할로 추가할 수 있다.
- 제안: 기존 publicPaths 전체에 대해 세션 없이 통과하는 파라미터화 테스트(`it.each`)를 추가 권장(WARNING 수준 아님, 선택적 개선).

### [INFO] proxy.test.ts — `has_session` 쿠키 값 검증 방식 단순성
- 위치: `codebase/frontend/src/__tests__/proxy.test.ts` — `req()` 헬퍼, `proxy.ts` 세션 체크 로직
- 상세: `proxy.ts`는 `request.cookies.get("has_session")` 존재 여부만 확인한다(값 무관). 테스트 헬퍼 `req()` 는 `cookie: "has_session=1"` 을 설정한다. 쿠키 파싱이 Next.js 내장 `cookies` API에 위임되므로 실제 동작과 괴리는 없다. 다만 `has_session=` (빈값) 케이스는 테스트에 없다.
- 제안: `has_session=` (빈 값 존재) 케이스 추가 — truthy/falsy 혼동 방지 문서화 차원.

### [WARNING] next.config.ts — rewrite 규칙에 대한 테스트 레이어가 전무함 (gap)
- 위치: `codebase/frontend/next.config.ts` `rewrites()`, 연관 `e2e/` 디렉토리
- 상세: 기존 e2e 테스트 파일들(`e2e/auth/`, `e2e/web-chat/console.spec.ts` 등)은 Next 서버 기반 통합 환경으로 보인다. rewrite 404→200 수정이 실제 서버에서 동작한다는 것을 커밋 메시지의 수동 curl 확인 외에 CI에서 자동으로 잡을 수단이 없다. 회귀 발생 시(예: next.config.ts 오타, rewrites 순서 변경) 자동 감지 불가.
- 제안: `e2e/web-chat/` 파일 또는 신규 `e2e/widget-serve.spec.ts`에 다음을 추가:
  ```ts
  // /_widget/web-chat/v1/app/ 가 200 + HTML 바디를 반환하는지
  const res = await page.request.get('/_widget/web-chat/v1/app/');
  expect(res.status()).toBe(200);
  ```
  단, Next dev 서버에서는 rewrites 동작이 `next start`(production)과 다를 수 있어 환경 구성을 고려해야 한다.

## 요약

`proxy.ts` 변경에 대한 테스트(`proxy.test.ts`)는 핵심 버그 시나리오(위젯 디렉토리 경로 → 인증 redirect 없이 통과, 보호 경로 redirect 유지)를 잘 커버하며, 테스트 코드는 목적을 명확히 설명하는 JSDoc과 헬퍼 함수로 가독성이 높다. 테스트 격리도 외부 의존 없이 `proxy()` 함수를 직접 호출하므로 양호하다. 가장 큰 갭은 `next.config.ts` `rewrites()` 규칙이다 — proxy 수준은 유닛 테스트로 검증했지만, rewrite 수준의 404→200 변환은 자동화된 테스트가 전무하여 향후 설정 회귀 시 CI에서 감지되지 않는다. `/_widgetfake` prefix 오버랩 같은 경계값은 낮은 위험이나 명시적 테스트로 의도를 문서화할 수 있다.

## 위험도

LOW
