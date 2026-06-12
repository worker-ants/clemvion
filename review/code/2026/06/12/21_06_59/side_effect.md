# 부작용(Side Effect) 리뷰 — refactor-04-security (2차 라운드)

## 발견사항

### [WARNING] `extractClientIp` — `shouldTrustCfConnectingIp()` 를 인자 없이 호출, `process.env` 전역에 암묵적 의존

- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` — `extractClientIp` 내 `shouldTrustCfConnectingIp()` 호출
- 상세: `shouldTrustCfConnectingIp(env)` 는 `env` 파라미터를 주입받아 순수 함수처럼 설계됐으나, `extractClientIp` 는 `req: Request` 만 받고 `shouldTrustCfConnectingIp()` 를 인수 없이 호출한다. 결과적으로 `extractClientIp` 는 외부에서 주입 불가능한 `process.env` 전역 상태에 암묵적으로 의존한다. 동일한 패턴이 `hooks.service.ts` 와 `public-webhook-throttle.guard.ts` 의 내부 `extractClientIp` 에도 반복된다. 테스트가 `process.env.TRUST_CF_CONNECTING_IP` 를 직접 수정·복원해야 하는 것은 이 부작용의 직접적 결과다. 런타임 동작에는 문제가 없으나, 테스트 격리 복잡도와 미래 리팩터링 시 숨은 전역 의존을 놓칠 위험이 있다.
- 제안: `extractClientIp(req, env = process.env)` 로 시그니처를 확장하거나, 내부 호출을 `shouldTrustCfConnectingIp(process.env)` 로 명시화해 암묵적 전역 의존을 드러낸다. 현재 설계를 유지한다면 함수 JSDoc 에 `process.env.TRUST_CF_CONNECTING_IP` 의존을 명기한다.

---

### [WARNING] `safe-html.ts` — DOMPurify 전략 전환으로 기존 HTML 콘텐츠에 무음 태그 제거 발생

- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `DOMPurify.sanitize` 옵션 변경
- 상세: 기존 `USE_PROFILES: { html: true }` + `FORBID_TAGS`/`FORBID_ATTR` 블랙리스트에서 `ALLOWED_TAGS`(30여 개)/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` 화이트리스트로 전환됐다. `USE_PROFILES.html:true` 는 DOMPurify 기본 허용 태그 수백 개를 허용했으나 신규 `ALLOWED_TAGS` 는 그 부분집합만 허용한다. 이미 저장된 메시지 HTML 또는 기존 템플릿에 `<details>`, `<summary>`, `<abbr>`, `<figure>`, `<figcaption>`, `<caption>`, `<cite>`, `<q>`, `<dfn>`, `<ruby>`, `<rp>`, `<rt>` 등이 포함된 경우 해당 태그가 무음으로 제거된다. 보안 강화 목적의 의도된 변경이나, 기존 렌더 동작과의 비호환성이 발생한다.
- 제안: 의도된 하드닝으로 롤백 필요 없음. 추가로 기존 HTML 콘텐츠를 표시하는 채팅 컴포넌트에 대해 스냅샷 테스트를 두어 태그 제거 부작용을 사전 탐지하는 안전망을 갖추는 것을 권장한다.

---

### [INFO] `COOKIE_PATH` 변경(`'/'` → `'/api/auth'`) — 배포 전 발급된 `path=/` 쿠키 clear 미적용

- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` — `const COOKIE_PATH = '/api/auth'`
- 상세: 브라우저는 쿠키의 `path` 속성을 식별 키의 일부로 취급한다. 이 배포 이전에 `path=/` 로 발급된 `refreshToken` 쿠키가 브라우저에 남아 있을 경우, 새 `clearRefreshTokenCookie` (`path='/api/auth'` 사용)로는 해당 기존 쿠키를 제거할 수 없다. 배포 직후 과도기적으로 두 경로의 쿠키가 브라우저에 공존하며, `path=/` 쿠키는 logout 후에도 만료 시까지 잔존한다. 서버 측 refresh token 무효화로 실질적 세션 하이재킹 위험은 낮으나, 혼란스러운 브라우저 상태가 만들어진다. `set` 과 `clear` 양쪽이 동일 path 를 사용하므로 신규 발급 쿠키의 clear 는 정상 동작한다.
- 제안: 배포 노트에 "이전 `path=/` 쿠키는 만료(7일/30일) 시까지 브라우저에 잔존하며 서버 측 토큰 무효화로 보완된다"를 명시한다. 전환 기간 동안 `clearRefreshTokenCookie` 에서 `path='/'` 도 함께 clear 하는 구현을 추가하면 브라우저 상태를 깔끔하게 정리할 수 있다.

---

### [INFO] `getRefreshCookieSameSite()` — 매 쿠키 발급 시 `process.env.COOKIE_SAMESITE` 재읽기

- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` — `setRefreshTokenCookie` 내 `sameSite: getRefreshCookieSameSite()`
- 상세: 기존 `sameSite: 'none'` 하드코딩에서 `COOKIE_SAMESITE` env 동적 읽기로 변경됐다. 미설정 시 기본 `'none'` 을 반환해 기존 동작은 변경 없다. 그러나 env 를 매 쿠키 발급마다 재읽는 부작용이 추가된다. 런타임 중 env 변경이 즉시 반영될 수 있으나 이를 의도하는지 명시되지 않았다. 성능 영향은 무시할 수준이다.
- 제안: 동작상 문제 없음. 설정을 부팅 시 1회 읽어 캐싱하는 패턴으로 개선할 수 있으나, 현재 규모에서는 불필요하다.

---

### [INFO] `authorize` 내부 시그니처 변경 — `workspaceId: string` → `ctx: { workspaceId: string; userId: string }` (내부 인터페이스)

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `channelAuthorizers` 내부 `authorize` 메서드 시그니처
- 상세: `channelAuthorizers` 인터페이스의 `authorize` 가 `(channel, workspaceId: string)` 에서 `(channel, ctx: { workspaceId: string; userId: string })` 로 변경됐다. 이 인터페이스는 파일 내부(`private channelAuthorizers`)에만 사용되며 외부 공개 API 가 아니다. 기존 authorizer 4개 모두 destructuring 패턴으로 교체되어 하위 호환 파괴 없음. 단, 새 authorizer 를 추가하는 기여자가 기존 `workspaceId` 단순 파라미터 패턴을 기대하면 컴파일 에러를 받을 수 있다.
- 제안: 인터페이스 정의 근처 주석에 ctx 구조체 확장 의도 및 `Promise.resolve()` 래핑 필수 규약을 함께 명시할 것을 권장한다(maintainability 이슈와 동일).

---

### [INFO] `isOriginAllowed` — `'null'` origin 거부가 wildcard 경로보다 선행, 기존 동작 변경

- 위치: `codebase/backend/src/common/utils/cors-origins.ts` — `if (origin === 'null') return false` 조기 반환
- 상세: `'null'` origin 거부 로직이 `getAllowedOrigins()` 호출 전에 배치됐다. wildcard 모드에서도 sandbox iframe/`data:`/`file:` 출처 요청이 차단된다. 기존에 wildcard 모드에서 `'null'` origin 이 통과하던 동작이 변경된다. 의도된 null-origin CSRF 방어(04 M-5)다.
- 제안: 의도된 보안 강화. 기존에 sandbox iframe 에서 API 를 직접 호출하는 통합 테스트 또는 클라이언트가 있다면 영향을 확인할 것.

---

### [INFO] `compileUserRegex` — `new RegExp` 컴파일이 `safeRegex` 판정 전 실행됨

- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `compileUserRegex` 내 `new RegExp` 후 `safeRegex(source)` 호출 순서
- 상세: 문법 검사를 `safe-regex` 보다 먼저 수행하도록 의도됐다(JSDoc 에 근거 명시). `(a+)+$` 같은 unsafe 패턴도 `new RegExp` 컴파일은 완료된 후(반환 않음) `safe-regex` 에서 거부된다. ReDoS 는 `exec`/`test` 실행 시에만 발생하므로 컴파일 자체는 안전하다. V8 내부 정규식 캐시에 unsafe 패턴 엔트리가 남을 수 있으나, 이 캐시는 보안 경계 역할을 하지 않는다.
- 제안: 현행 유지. 의도된 설계이며 실질적 위험 없음.

---

### [INFO] `WebsocketModule` — `WorkflowsModule` forwardRef 추가로 DI 초기화 순서 민감도 증가

- 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` — `forwardRef(() => WorkflowsModule)` 추가
- 상세: `WebsocketModule` 의 forwardRef 개수가 4개로 늘었다. 개별 forwardRef 는 의도된 순환 해소이며 런타임 부작용은 없다. forwardRef 누적은 NestJS DI 초기화 순서에 민감한 버그(`OnModuleInit`/`OnApplicationBootstrap` 훅 실행 순서)를 유발할 가능성을 높인다.
- 제안: 현재는 이슈 없음. 중기적으로 `ChannelAuthorizationService` 분리를 통한 의존성 단순화를 별도 plan 으로 추진할 것을 권장한다.

---

## 요약

이번 `refactor-04-security` 변경은 보안 하드닝 목적으로 전반적으로 의도된 동작 변경을 포함한다. 비의도적 전역 상태 오염, 파일시스템 부작용, 네트워크 부작용은 발견되지 않았다. 주요 공개 REST API 시그니처와 HTTP 상태 코드 체계는 유지되며, `/auth/refresh` 의 Origin 검증 추가(allowlist 외 403)는 의도된 CSRF 방어다. 실질적으로 주의가 필요한 부작용은 두 가지다: (1) `COOKIE_PATH` `'/'` → `'/api/auth'` 변경으로 기존 발급 쿠키가 logout 후에도 브라우저에 잔존하는 과도기 문제 — 서버 측 토큰 무효화로 보완되나 배포 노트에 명기를 권장한다. (2) `safe-html.ts` DOMPurify 전략 전환으로 기존 HTML 콘텐츠의 일부 태그(`<details>`, `<summary>`, `<abbr>` 등)가 무음 제거 — 의도된 보안 강화이나 스냅샷 테스트로 렌더 회귀를 방지하는 안전망이 없다. `extractClientIp` 의 `process.env` 암묵적 의존은 테스트 격리를 복잡하게 만드는 경미한 부작용이다.

## 위험도

LOW

STATUS=success ISSUES=2
