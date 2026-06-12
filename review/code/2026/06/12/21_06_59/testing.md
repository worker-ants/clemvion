# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `websocket.gateway.spec.ts` — 소켓 타입 캐스팅 불일치로 테스트 신뢰성 저하
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L158-L732
  - 상세: 파일 전체에서 소켓 타입 캐스팅이 세 가지 형태로 혼재한다. (a) `(socket as Socket & { workspaceId?: string })` — workspaceId 단독, (b) `(socket as Socket & { workspaceId?: string; userId?: string })` — 양쪽, (c) 두 줄 분리 캐스팅(`(socket as Socket & { userId?: string; workspaceId?: string }).userId = ...` / `(socket as Socket & { workspaceId?: string }).workspaceId = ...`). notifications: 채널 테스트 두 케이스는 (b) 패턴으로 올바르게 양 필드를 설정하나, L599~L732 인증 재검사 블록은 (c) 두 줄 분리 형태를 사용한다. 작성자가 두 번째 캐스팅 라인을 누락하면 workspaceId 또는 userId 가 설정되지 않아 authorizer 가 조용히 거부하여 테스트가 엉뚱한 이유로 통과/실패할 수 있다.
  - 제안: 파일 상단에 `type EnrichedSocket = Socket & { workspaceId?: string; userId?: string }` 타입 별칭을 선언하고 모든 캐스팅을 `(socket as EnrichedSocket).workspaceId = ...` 단일 표현으로 통일. L599~L732 블록의 두 줄 분리 캐스팅을 하나로 통합.

- **[WARNING]** `auth.controller.spec.ts` — `'null'` origin CSRF 차단 케이스 미존재
  - 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts`
  - 상세: `cors-origins.spec.ts` 는 `isOriginAllowed('null') === false` (wildcard 포함)를 올바르게 검증한다. 그러나 `auth.controller.spec.ts` 의 CSRF 테스트는 명시적 비허용 origin(`'https://evil.example'`)과 허용 origin(`'https://app.example.com'`) 두 케이스만 다루며, sandbox iframe / data: / file: 벡터인 `'null'` origin 문자열에 대한 케이스가 없다. 컨트롤러 수준에서 null-origin 거부가 고정되지 않아 `isOriginAllowed` 구현 변경 시 회귀가 탐지되지 않는다.
  - 제안: `it('rejects refresh from null origin (sandbox iframe CSRF)', ...)` 추가. `headers: { origin: 'null' }` 로 요청 시 `ForbiddenException` 을 throw 하고 `authService.refresh` 가 호출되지 않음을 검증. CORS_ORIGINS 를 설정해 wildcard 모드를 비활성화한 상태와 wildcard 모드 양쪽 모두 검증.

- **[WARNING]** `refresh-cookie.spec.ts` — `clearRefreshTokenCookie` 의 domain 포함 케이스 미존재
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.spec.ts` L102-112
  - 상세: `clearRefreshTokenCookie` 테스트는 `cookieDomain: ''` (도메인 없음) 케이스만 검증한다. `setRefreshTokenCookie` 는 `cookieDomain: '.example.com'` 케이스를 별도 검증하지만 대응하는 `clearRefreshTokenCookie` 의 `domain` 포함 케이스가 없다. 쿠키 set/clear 의 `domain` 불일치는 브라우저에서 쿠키 삭제 실패를 유발하는 silent 버그인데, clear 의 domain 경로가 테스트로 고정되지 않아 향후 코드 변경 시 회귀가 탐지되지 않는다.
  - 제안: `describe('clearRefreshTokenCookie')` 블록에 `it('includes domain option when cookieDomain is set', ...)` 추가. `cookieDomain: '.example.com'` 로 호출 시 `res.clearCookie` 가 `{ path: '/api/auth', domain: '.example.com' }` 로 호출됨을 검증.

- **[INFO]** `websocket.gateway.spec.ts` — `notifications:` 채널 `userId` 미설정(undefined) 거부 케이스 미존재
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L356-392
  - 상세: `notifications:` authorizer 는 `!!userId && targetUserId === userId` 조건(gateway.ts L159)이라 `userId` 가 `undefined` 이면 거부한다. 현재 테스트는 "일치 → 허용", "불일치 → 거부" 케이스만 있고, `userId` 가 소켓에 설정되지 않은 상태(인증 미완료 또는 레거시 소켓)는 없다. 소켓 인증 미들웨어 버그로 `userId` 미설정 시 알림 채널에 접근이 허용되는 회귀를 탐지하지 못한다.
  - 제안: `it('rejects notifications channel when socket has no userId', ...)` 추가. `enriched.userId = undefined` 상태에서 `notifications:user-1` 구독 시 `success: false` 반환을 검증.

- **[INFO]** 환경변수 원복 패턴 불일치 — `afterEach` vs. `try-finally` 혼재
  - 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` L110-145; `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L163-208
  - 상세: `client-ip.spec.ts` 는 `afterEach` 로 `TRUST_CF_CONNECTING_IP` 를 중앙 원복하는 패턴을 사용한다. 반면 `auth.controller.spec.ts` 와 `public-webhook-throttle.guard.spec.ts` 는 케이스별 `try-finally` 패턴으로 분산 처리한다. 두 방식 혼재 시 `try-finally` 내 추가 `expect` 에서 throw 가 발생해도 `finally` 는 실행되나, 패턴을 혼동한 신규 케이스에서 원복 누락 위험이 있다. 현재 기존 케이스는 정합성이 있다.
  - 제안: `client-ip.spec.ts` 의 `afterEach` 패턴 또는 `withEnv(vars, fn)` 공용 헬퍼를 테스트 유틸로 추출해 일관 적용.

- **[INFO]** `safe-html.test.ts` — `ALLOWED_URI_REGEXP` 의 relative URL / fragment anchor 허용 케이스 미검증
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.test.ts`
  - 상세: `safe-html.ts` 의 `ALLOWED_URI_REGEXP` 세 번째 대안(`[a-z+.-]+(?:[^a-z+.:-]|$)`)은 relative URL 과 fragment anchor 허용을 의도한다. 현재 테스트는 `data:` 거부, `http(s):`·`mailto:` 허용을 검증하지만, relative href(`/path`, `./page`) 와 anchor(`#id`) 허용 케이스, 그리고 `blob:` 등 의도치 않은 scheme 차단 케이스가 없다. 이 경계가 고정되지 않아 regex 수정 시 의도치 않은 scheme 허용 또는 필요한 relative URL 차단 회귀를 탐지하지 못한다.
  - 제안: `it("relative href(./page) 와 anchor(#id) 허용", ...)` 및 `it("blob: scheme 제거", ...)` 케이스 추가로 `ALLOWED_URI_REGEXP` 경계 고정.

- **[INFO]** `transform.handler.spec.ts` — `array_filter` 의 ReDoS-unsafe regex 조건 `invalidRegexPatterns` 메타 커버리지 부재
  - 위치: `codebase/backend/src/nodes/data/transform/transform.handler.spec.ts`
  - 상세: `transform.handler.spec.ts` 는 `replace_regex` 오퍼레이션의 ReDoS-unsafe 패턴 처리(no-match silently)를 커버한다. 그러나 `array_filter` 오퍼레이션 내 `regex` 조건 operator 에 unsafe 패턴이 들어올 때 `filter.handler.spec.ts` L1346-1357 에 대응하는 `invalidRegexPatterns` 메타 가시화 경로는 검증되지 않는다. `compileUserRegex` 가 단일 chokepoint 여서 동작은 보장되나, transform 경로를 통한 인수 테스트가 없어 regression 탐지가 늦을 수 있다.
  - 제안: `array_filter` describe 블록에 ReDoS-unsafe 패턴을 `regex` 조건에 사용할 때 no-match(해당 항목 미매칭) 케이스 추가. 필수는 아니나 신뢰성 향상에 기여.

---

## 요약

테스트 커버리지의 전반적 수준은 높다. 신규 순수 함수(`shouldTrustCfConnectingIp`, `isFlagOn`, `isSwaggerEnabled`, `getRefreshCookieSameSite`, `compileUserRegex`)는 모두 env-injection 직접 단위 테스트를 보유하며 경계값·비표준 truthy·null 처리를 체계적으로 검증한다. WebSocket 채널 authorizer 는 허용·거부·DB-throw·비-UUID 네 케이스를, ReDoS 방어는 condition-evaluator·filter·transform 세 소비자 모두에서 검증된다. 주요 미결 사항은 세 가지다: (1) `auth.controller.spec.ts` 에 `'null'` origin CSRF 차단 케이스가 없어 null-origin 경로의 컨트롤러 수준 회귀 탐지가 불가하다(WARNING). (2) `refresh-cookie.spec.ts` 에 `clearRefreshTokenCookie` 의 domain 포함 케이스가 없어 set/clear domain 불일치 silent 버그 회귀를 잡지 못한다(WARNING). (3) `websocket.gateway.spec.ts` 전체에 소켓 타입 캐스팅이 세 가지 형태로 혼재해 userId/workspaceId 설정 누락 위험이 있으며, `notifications:` 채널의 userId 미설정 케이스 테스트가 없다(WARNING). 환경변수 원복 패턴 불일치(`afterEach` vs. `try-finally`)는 INFO 수준으로 현재 동작에 영향을 주지 않으나 중기 유지보수 시 원복 누락 위험을 내포한다.

## 위험도

MEDIUM
