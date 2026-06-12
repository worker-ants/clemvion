# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `extractClientIp` (client-ip.ts) — `shouldTrustCfConnectingIp()` 를 인자 없이 호출해 `process.env` 전역에 묵시적으로 의존
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` — `extractClientIp` 내부 `shouldTrustCfConnectingIp()` 호출
- 상세: `shouldTrustCfConnectingIp(env)` 는 `env` 매개변수를 받아 순수 함수처럼 설계됐으나, `extractClientIp` 는 `req: Request` 만 받고 `shouldTrustCfConnectingIp()` 를 인자 없이 호출한다. 결과적으로 `extractClientIp` 는 외부에서 주입 불가능한 `process.env` 전역에 암묵적으로 의존한다. 현재 테스트(`client-ip.spec.ts`)가 `process.env.TRUST_CF_CONNECTING_IP` 를 직접 수정·복원해야 하는 것도 이 부작용의 직접적 결과다.
- 제안: `extractClientIp(req, env = process.env)` 로 서명을 확장하거나, 내부 호출을 `shouldTrustCfConnectingIp(process.env)` 로 명시화해 암묵적 전역 의존을 드러낸다. 현재 설계를 유지한다면 주석으로라도 `process.env` 의존을 문서화한다.

### [WARNING] `safe-html.ts` — DOMPurify 전략 전환(`USE_PROFILES.html` → `ALLOWED_TAGS` 화이트리스트)으로 기존 HTML 콘텐츠에 무음 태그 제거 발생
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `DOMPurify.sanitize` 옵션 변경
- 상세: 기존 `USE_PROFILES: { html: true }` + `FORBID_TAGS` 블랙리스트 방식에서 `ALLOWED_TAGS`/`ALLOWED_ATTR` 화이트리스트 방식으로 전환됐다. `USE_PROFILES.html:true` 는 DOMPurify 기본 허용 태그(수백 개)를 허용하는 반면, 신규 `ALLOWED_TAGS` 는 30여 개만 허용한다. 이미 렌더된 HTML 콘텐츠 또는 기존 템플릿에 `<details>`, `<summary>`, `<abbr>`, `<figure>`, `<figcaption>`, `<caption>`, `<cite>`, `<q>` 등이 포함된 경우 이 변경으로 해당 태그가 무음 제거된다. 의도된 보안 강화이나 기존 콘텐츠에 부작용을 초래한다.
- 제안: 변경 의도가 RESOLUTION.md 에 "의도된 하드닝" 으로 이미 기록됐다. 추가로 기존 HTML 콘텐츠를 표시하는 컴포넌트에 대해 스냅샷 테스트를 두어 태그 제거 부작용을 미리 탐지하는 안전망을 갖추는 것을 권장한다.

### [INFO] `COOKIE_PATH` 전역 상수 변경(`'/'` → `'/api/auth'`) — 기존 쿠키 clear 미적용
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` — `const COOKIE_PATH = '/api/auth'`
- 상세: 쿠키의 `path` 속성은 브라우저가 `clearCookie` 시 제거 대상 쿠키를 식별하는 키로도 작동한다. 이 배포 이전에 `path=/` 로 발급된 `refreshToken` 쿠키가 브라우저에 남아 있는 경우, 새 코드의 `clearRefreshTokenCookie`(`path='/api/auth'` 사용)로는 해당 기존 쿠키를 제거할 수 없다. 배포 직후 과도기적으로 두 경로의 쿠키가 브라우저에 공존할 수 있으며, `path=/` 쿠키는 logout 후에도 만료 시까지 잔존한다. 실질적 세션 하이재킹 위험은 낮으나(서버 측 refresh token 무효화로 보완), 혼란스러운 브라우저 상태가 만들어진다.
- 제안: 배포 노트에 "이전 `path=/` 쿠키는 만료(7일/30일) 시까지 브라우저에 잔존하며 서버 측 토큰 무효화로 보완된다" 를 명시하거나, `clearRefreshTokenCookie` 에서 `path='/'` 도 함께 clear 하는 전환 기간 처리를 추가한다.

### [INFO] `refresh` 핸들러 — 기존에 성공하던 allowlist 외 Origin 요청이 403 으로 변경
- 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — `refresh` 메서드 상단 CSRF 가드
- 상세: 기존 `refresh` 는 Origin 검사를 하지 않았다. 변경 후 `isOriginAllowed(origin)` 이 false 인 Origin 은 `ForbiddenException(403)` 을 받는다. `CORS_ORIGINS`/`FRONTEND_URL` 이 모두 미설정인 dev/test 환경에서는 `getAllowedOrigins()` 가 `WILDCARD('*')` 를 반환해 `isOriginAllowed` 가 항상 true 를 반환하므로 기존 동작을 유지한다. allowlist 가 설정된 환경에서만 차단이 활성화된다.
- 제안: 의도된 보안 강화다. 기존 통합 테스트나 e2e 테스트 중 Origin 헤더를 명시하지 않은 `refresh` 호출이 있다면 `origin === undefined → !origin → true` 경로로 통과함을 확인한다.

### [INFO] `getRefreshCookieSameSite()` — 매 쿠키 발급 시 `process.env.COOKIE_SAMESITE` 재읽기
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` — `setRefreshTokenCookie` 내 `sameSite: getRefreshCookieSameSite()`
- 상세: 기존 코드는 `sameSite: 'none'` 으로 하드코딩됐다. 변경 후 `COOKIE_SAMESITE` 환경변수를 읽어 동적으로 결정한다. 미설정 시 기존과 동일하게 `'none'` 을 반환하므로 기본 동작은 변경 없다. 그러나 환경변수를 매 쿠키 발급 시 재읽는 부작용이 추가된다. 런타임 중 변경이 즉시 반영될 수 있으나 이를 의도하는지는 명시되지 않았다.
- 제안: 동작상 문제 없음. 필요하다면 설정을 부팅 시 1회 읽어 캐싱하는 패턴으로 개선할 수 있으나, 현재 규모에서는 불필요하다.

### [INFO] `compileUserRegex` — unsafe 판정 전 `new RegExp` 컴파일이 먼저 실행됨
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `compileUserRegex` 내 `try { regex = new RegExp(source, flags) } catch ...` 이후 `safeRegex(source)` 호출
- 상세: 설계상 문법 검사를 safe-regex 보다 먼저 수행한다(JSDoc 에 의도 명시). 결과적으로 `(a+)+$` 같은 unsafe 패턴도 컴파일(`new RegExp`) 은 완료된다(단, 반환하지 않음). ReDoS 는 실행(`exec`/`test`) 시에만 발생하므로 컴파일 자체는 안전하다. V8 엔진 내부 정규식 캐시에 unsafe 패턴 엔트리가 남을 수 있으나 실질적 위험은 없다.
- 제안: 현행 유지. 의도된 설계이며 위험 없음.

### [INFO] `isOriginAllowed` — `'null'` origin 명시 거부가 `getAllowedOrigins()` 내 WILDCARD 경로보다 먼저 평가됨
- 위치: `codebase/backend/src/common/utils/cors-origins.ts` — `if (origin === 'null') return false` 추가
- 상세: `null` 문자열 origin 거부가 `const list = getAllowedOrigins()` 조회 전에 실행되므로, wildcard 모드에서도 `'null'` origin 은 차단된다. 이는 의도된 동작(04 M-5 null-origin CSRF 방어)이며, 기존에 WILDCARD 모드에서 `'null'` origin 이 통과하던 부작용을 수정한 것이다. 단, 기존 동작에 의존하는 코드(WILDCARD 모드에서 sandbox iframe 을 사용하는 경우)는 이 변경으로 차단된다.
- 제안: 의도된 보안 강화다. 현행 유지.

---

## 요약

이번 변경(refactor-04-security)은 보안 하드닝 목적으로 전반적으로 의도된 동작 변경을 포함한다. 비의도적 전역 상태 오염, 파일시스템·네트워크 부작용은 발견되지 않았다. 실질적으로 주의가 필요한 부작용은 두 가지다: (1) `COOKIE_PATH` 변경(`'/'` → `'/api/auth'`)으로 기존 `path=/` 쿠키가 logout 후에도 브라우저에 잔존하는 과도기 문제 — 서버 측 토큰 무효화로 보완되나 배포 노트에 명시를 권장한다. (2) `safe-html.ts` 의 DOMPurify 전략 전환으로 기존 HTML 콘텐츠의 일부 태그(`<details>`, `<summary>`, `<abbr>` 등)가 무음 제거 — 의도된 하드닝이나 기존 콘텐츠 렌더에 영향을 준다. `extractClientIp` 의 `process.env` 암묵적 의존은 테스트 격리를 복잡하게 만드는 경미한 부작용이다. `refresh` 핸들러의 Origin 차단은 의도된 CSRF 방어다.

## 위험도

LOW
