# 보안(Security) 코드 리뷰

리뷰 대상: refactor-04-security 브랜치 변경사항 (2차 라운드)
리뷰 일시: 2026-06-12 21:06:59

---

## 발견사항

### 인젝션 취약점 / ReDoS

- **[INFO]** `compileUserRegex` — `safeRegex` try/catch 방어 이미 구현됨 (긍정적)
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` L88-93
  - 상세: 이전 라운드(20:32:29) security.md 에서 `safeRegex(source)` 예외 처리 부재를 INFO 로 지적했으나, 실제 코드를 확인한 결과 L88-93에 이미 `try { safe = safeRegex(source); } catch { return { regex: null, reason: 'unsafe' }; }` 로 fail-closed 처리가 구현되어 있다. 코드 주석("safe-regex 내부(regexp-tree) 가 던질 경우 보수적으로 unsafe 처리")도 의도를 명시한다. 이전 라운드 분석이 실제 코드와 달리 누락 상태로 잘못 기록된 것을 정정한다.
  - 제안: 없음. 현상 유지.

- **[INFO]** `clearRefreshTokenCookie` — 경로 일치 경고 JSDoc 이미 구현됨 (긍정적)
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` L52-55
  - 상세: 이전 라운드에서 WARNING으로 지적된 "clearRefreshTokenCookie 경로 일치 제약 경고 주석 부재"가 실제 코드에는 이미 JSDoc 으로 구현되어 있다("IMPORTANT: `path` 는 `setRefreshTokenCookie` 의 `COOKIE_PATH`(`/api/auth`) 와 반드시 일치해야 한다 — 불일치 시 브라우저가 쿠키를 삭제하지 못해 logout 후에도 쿠키가 잔존한다(silent failure)"). 이전 라운드 WARNING 은 이미 해소 상태다.
  - 제안: 없음. 현상 유지.

- **[INFO]** ReDoS 방어 단일 chokepoint — 완전 구현 확인
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`
  - 상세: `compileUserRegex`가 길이 검사(>200) → 문법 검사(`new RegExp`) → `safe-regex` 위험도 검사 → try/catch fail-closed 순서로 처리한다. `filter.handler.ts`, `transform.handler.ts`, `condition-evaluator.util.ts` 세 사이트 모두 이 단일 함수를 경유하여 ReDoS 방어가 일원화됐다.
  - 제안: 없음.

### 하드코딩된 시크릿

- **[WARNING]** `websocket.module.ts` — JWT fallback `'fallback'` 이 `INSECURE_JWT_SECRETS` 미포함
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` L18
  - 상세: `configService.get<string>('jwt.secret') ?? 'fallback'` 에서 `'fallback'` 값이 `production-guards.ts`의 `INSECURE_JWT_SECRETS` Set에 포함되지 않는다. `assertProductionConfig`는 `'dev-jwt-secret'`과 `'change-me-to-a-long-random-jwt-secret'`만 차단한다. 대부분의 경우 `assertProductionConfig`의 `process.env.JWT_SECRET` 직접 검사가 먼저 차단하지만, ConfigService가 null/undefined를 반환하는 구성 레이스 또는 NestJS DI 초기화 순서 이슈에서 `'fallback'` 으로 서명된 JWT가 production 을 통과하는 방어 계층 불완전 가능성이 있다. `'fallback'`은 공개된 값으로 임의 JWT 위조가 가능하다.
  - 제안: `INSECURE_JWT_SECRETS`에 `'fallback'`을 추가하거나, fallback 값을 `jwt.config.ts`의 dev fallback값(`'dev-jwt-secret'`)과 통일하여 기존 `INSECURE_JWT_SECRETS` 가드가 이미 차단하는 값으로 맞춘다.

- **[INFO]** `.env.example` 시크릿 플레이스홀더 적절
  - 위치: `codebase/backend/.env.example`
  - 상세: `JWT_SECRET`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY` 모두 플레이스홀더 형태이며 각각 `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS`에 등재되어 production 부팅을 차단한다. 신규 환경변수 3종(`ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP`)이 주석 플레이스홀더로 적절히 추가됐으며 시크릿 값은 없다. `S3_ACCESS_KEY=minioadmin`/`S3_SECRET_KEY=minioadmin`은 로컬 MinIO 기본값으로 dev 전용이며 별도 production 가드가 필요하나 이번 변경 범위는 아니다.
  - 제안: 없음(이번 변경 범위 내).

### 인증/인가

- **[INFO]** WebSocket 채널 IDOR 방어 완전 구현 (긍정적)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L107-191
  - 상세: `channelAuthorizers` 배열에 5개 채널 타입(`execution:`, `workflow:`, `notifications:`, `kb:`, `background:run:`)이 모두 authorizer를 갖추고 있다. `workflow:` IDOR 차단(workflowId→workspace 소유 검증), `notifications:` JWT sub 일치 검증, `execution:`/`kb:`/`background:run:` workspace 소유 검증이 각각 구현됐다. 비-UUID 입력은 DB 조회 전 `isValidUuid()`로 차단하여 ID enumeration을 방지한다.
  - 제안: 없음.

- **[INFO]** `notifications:` 채널 — `workspaceId` 공통 가드 암묵적 의존 (미래 위험)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L287-294
  - 상세: `handleSubscribe` 내 `if (!workspaceId)` 공통 가드가 `notifications:` 채널에도 적용된다. 현재 인증 체계에서 모든 JWT에 workspaceId가 포함되어 실제 위험은 없다. 향후 workspaceId 없이 발급되는 JWT(예: 게스트 토큰) 도입 시 정상 사용자의 `notifications:` 구독이 차단될 수 있다.
  - 제안: 현재 구현 유지. 향후 JWT 발급 구조 변경 시 이 의존 관계 인지 필요.

- **[INFO]** Swagger production 비노출 게이팅 올바름 (긍정적)
  - 위치: `codebase/backend/src/common/config/production-guards.ts` L77-80
  - 상세: `isSwaggerEnabled` 함수가 `isFlagOn` 엄격 판정(`'true'`/`'1'`만 ON)과 일관되게 구현됐다. production에서 기본 미노출 + opt-in escape hatch 패턴이 OWASP A05(Security Misconfiguration) — 무인증 API 표면 정찰을 올바르게 차단한다.
  - 제안: `ENABLE_SWAGGER_IN_PROD=true` opt-in 활성화 시 Swagger 엔드포인트에 IP 제한 또는 Basic Auth 추가를 중기적으로 고려. 현재는 opt-in만으로 무인증 노출이 복귀한다는 점을 운영 문서에 명시 권장.

- **[INFO]** `/auth/refresh` CSRF 방어 — 구현 완전
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` L391-399, `codebase/backend/src/common/utils/cors-origins.ts` L63-72
  - 상세: `isOriginAllowed`가 `'null'` 불투명 origin을 wildcard 모드에서도 명시 거부한다. origin 미설정(same-origin/non-browser)은 통과하는 의도된 동작이며 주석으로 기술됐다. refresh 쿠키 SameSite=None 환경의 CSRF를 서버 단 defense-in-depth로 차단하는 올바른 설계다.
  - 제안: 없음.

### 입력 검증

- **[INFO]** refresh 쿠키 path 축소 + SameSite 분리 — 구현 올바름
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`
  - 상세: `COOKIE_PATH = '/api/auth'`로 쿠키 전송 범위를 축소했다. `setRefreshTokenCookie`와 `clearRefreshTokenCookie`가 동일 상수를 참조하므로 clear가 올바르게 동작한다. `getRefreshCookieSameSite`는 인식되지 않는 값을 `'none'`으로 안전하게 폴백하며, `secure: true`를 항상 고정 설정하여 SameSite=None의 HTTPS 요건을 충족한다.
  - 제안: 없음.

- **[INFO]** `TRUST_CF_CONNECTING_IP` — `isFlagOn` 동일 엄격 판정 일관 적용
  - 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` L17-18
  - 상세: `v === 'true' || v === '1'` 만 ON으로 판정하여 `'TRUE'`/`'yes'`/`'on'` 등 오설정 값의 우발적 활성화를 차단한다. CF-Connecting-IP 헤더는 위변조 가능하여 기본 off(fail-safe) 정책이 rate-limit/감사로그 우회를 방지한다.
  - 제안: 없음.

### OWASP Top 10

- **[INFO]** CORS allowlist 단일 진입점 — HTTP + WebSocket 동일 정책
  - 위치: `codebase/backend/src/common/utils/cors-origins.ts`, `websocket.gateway.ts` L61-62
  - 상세: `corsOriginCallback`을 WebSocket gateway CORS `origin` 옵션에 직접 주입하여 두 경로가 동일 allowlist를 공유한다. production에서 `CORS_ORIGINS`/`FRONTEND_URL` 모두 미설정이면 `assertCorsOriginsConfigured()`가 부팅을 거부하는 fail-closed 설계가 올바르다.
  - 제안: 없음.

- **[INFO]** production fail-closed 가드 완전성 확인
  - 위치: `codebase/backend/src/common/config/production-guards.ts` L89-145
  - 상세: `assertProductionConfig`가 OAUTH_STUB_MODE, LLM_STUB_MODE, JWT_SECRET(미설정/기본값/짧은 길이 <32), ENCRYPTION_KEY(미설정/예시 키), MCP_ALLOW_INSECURE_URL 다섯 항목을 production 부팅 시 차단한다. 각 throw 메시지가 구체적인 수정 방법을 안내하며 외부 API 응답이 아닌 부팅 로그 수준에서만 노출된다.
  - 제안: 없음.

### 암호화

- **[INFO]** `SameSite=None` 필수 `Secure=true` 고정 설정
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` L43-44
  - 상세: 코드 주석 "SameSite=None 은 Secure 가 필수 — 항상 Secure 로 둔다"에 따라 `secure: true`가 하드코딩되어 있다. `COOKIE_SAMESITE=lax`/`strict` 로 변경해도 `secure: true`를 유지하는 것은 불필요하지만 보안상 더 엄격하여 무해하다.
  - 제안: 없음.

### 에러 처리

- **[INFO]** WebSocket 채널 거부 메시지 — 내부 구조 미노출
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: 거부 메시지들(`'Not authorized for this execution'`, `'Not authorized for this workflow'`, `'Not authorized for these notifications'` 등)이 소유권 불일치/부재를 구분하지 않아 ID enumeration 정보를 노출하지 않는다. `verifyOwnership`/`findById`가 내부에서 NotFound로 통일하는 설계와 일치한다.
  - 제안: 없음.

- **[INFO]** `buildContinuationErrorAck` — 임의 Error.message 클라이언트 전달 (낮은 위험)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L877-889
  - 상세: `error instanceof Error ? error.message : fallbackMessage` 패턴으로, `InvalidExecutionStateError` 외의 임의 Error 인스턴스의 `.message`를 클라이언트에 그대로 전달한다. 내부 서비스 레이어가 DB 오류 문자열이나 민감 정보를 Error.message에 포함하면 WebSocket ACK를 통해 노출될 수 있다. `handleRetryLastTurn`은 `RetryLastTurnError`/`InvalidExecutionStateError`만 message를 그대로 전달하고 그 외는 `'Retry failed'`로 일반화하는 더 안전한 별도 패턴을 사용한다.
  - 제안: `buildContinuationErrorAck`에서도 안전하다고 알려진 에러 클래스(`InvalidExecutionStateError`)만 message를 전달하고 그 외는 fallbackMessage로 일반화하는 방향으로 강화를 고려한다.

- **[INFO]** CSRF 차단 에러 메시지 `'Origin not allowed'` — 정보 노출 수준 적절
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` L398
  - 상세: 허용되는 origin 목록이나 CORS 설정 구조를 노출하지 않는다.
  - 제안: 없음.

### XSS / HTML Sanitization

- **[INFO]** DOMPurify 화이트리스트 전환 — XSS 표면 최소화 (긍정적)
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
  - 상세: `USE_PROFILES: { html: true }` + `FORBID_TAGS` 블랙리스트에서 `ALLOWED_TAGS`(30여 개)/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` 화이트리스트로 전환됐다. `svg`/`math` 기반 mXSS, `iframe`, `object`, 이벤트 핸들러 속성 등 미지 벡터가 기본 차단된다. `ALLOWED_URI_REGEXP`가 `javascript:`/`data:`/`vbscript:` scheme을 href/src에서 이중 차단한다.
  - 제안: `ALLOWED_URI_REGEXP`의 세 번째 대안 `[a-z+.-]+(?:[^a-z+.:-]|$)` 이 relative URL/anchor를 허용하기 위한 패턴임을 인라인 주석으로 보완하면 향후 수정 시 의도치 않은 scheme 허용을 방지할 수 있다.

- **[INFO]** `ensureLinkHook` — `target="_blank"` + `noopener noreferrer nofollow` 자동 추가 (긍정적)
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` L42-51
  - 상세: 모든 `<a>` 태그에 `rel="noopener noreferrer nofollow"`를 강제 추가하여 외부 링크가 host 페이지를 `window.opener`로 접근하는 탭내비게이션 공격을 차단한다. 임베드 위젯 컨텍스트에서 특히 중요한 설계다.
  - 제안: 없음.

### 의존성 보안

- **[INFO]** `safe-regex@2.1.1` — 알려진 취약점 없음, 사용처 단일 chokepoint
  - 위치: `codebase/backend/package.json`, `package-lock.json`
  - 상세: `safe-regex`(MIT)와 전이 의존성 `regexp-tree@0.1.27`(MIT) 모두 알려진 취약점 없음. `dependencies`(런타임)에 올바르게 배치됐다. `compileUserRegex` 단일 함수에서만 호출되어 의존성 범위가 잘 제어된다.
  - 제안: 없음.

---

## 요약

이번 refactor-04-security 2차 라운드 리뷰는 이전 라운드(20:32:29) 분석 결과와 실제 코드를 직접 대조하여 검증했다. 이전 라운드에서 WARNING으로 지적된 `clearRefreshTokenCookie` 경로 경고 주석 부재 및 INFO로 지적된 `safeRegex` try/catch 부재 사항은 실제 코드에 이미 구현되어 있었으며, 이전 라운드 분석의 부정확한 기술을 정정한다. 실질적 보안 발견사항은 `websocket.module.ts`의 JWT fallback `'fallback'`이 `INSECURE_JWT_SECRETS` blocklist에 미포함된 점(WARNING) 하나다. 이 값은 production에서 대부분 `assertProductionConfig`의 `process.env.JWT_SECRET` 직접 검사로 차단되지만, ConfigService 레이어 이슈 시 방어 계층이 불완전하다. 전반적으로 CSRF 방어(origin allowlist + null-origin 거부), IDOR 차단(채널별 ownership 검증 + UUID 사전 검증), ReDoS 방어(safe-regex 단일 chokepoint + fail-closed), Swagger production 비노출, DOMPurify 화이트리스트 전환, CF-Connecting-IP fail-safe 설계 모두 올바르게 구현됐으며 Critical 등급 신규 취약점은 발견되지 않았다.

## 위험도

LOW
