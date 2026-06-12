# 보안(Security) 코드 리뷰

리뷰 대상: refactor-04-security 브랜치 변경사항 (47개 파일)
리뷰 일시: 2026-06-12

---

## 발견사항

### 인젝션 취약점 / ReDoS

- **[INFO]** `safe-regex` 도입으로 ReDoS 방어 강화 (긍정적)
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `filter.handler.ts`, `transform.handler.ts`
  - 상세: 기존 길이 200자 제한만으로는 `(a+)+$` 같은 200자 이내의 지수 백트래킹 패턴을 막지 못했다. 이번 변경에서 `compileUserRegex` 단일 chokepoint 함수가 길이·문법·`safe-regex` 위험도 판정을 순서대로 수행하며, 세 평가 사이트(condition-evaluator/filter/transform) 모두 이를 경유한다. 문법 검사를 `safe-regex` 호출보다 먼저 수행해 오분류를 방지한 점도 올바르다.
  - 제안: 현 구조 양호.

- **[INFO]** `safeRegex(source)` 호출에 예외 처리 부재
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `compileUserRegex` 함수 내 `if (!safeRegex(source))` 라인
  - 상세: `safeRegex(source)` 호출이 try/catch 없이 실행된다. `safe-regex` 내부(`regexp-tree` AST 파서)가 예외를 throw할 경우 호출 스택 상위로 uncaught exception이 전파될 수 있다. 앞선 `new RegExp` 단계에서 문법 오류는 이미 걸러지므로 실제 발생 확률은 낮지만, 라이브러리 버전 업그레이드 시 새로운 엣지케이스가 생길 수 있다.
  - 제안: `safeRegex(source)` 호출을 try/catch로 감싸고 예외 발생 시 `{ regex: null, reason: 'unsafe' }`를 반환하는 방어적 코딩을 권장한다.

- **[INFO]** Prototype pollution 방어 유지 확인
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `transform.handler.ts`
  - 상세: `getNestedValue`의 `__proto__`·`constructor`·`prototype` 경로 차단 및 `BLOCKED_OBJECT_KEYS` 방어가 이번 변경에서도 유지됨을 확인했다.
  - 제안: 이상 없음.

### 하드코딩된 시크릿

- **[INFO]** `websocket.module.ts`의 JWT fallback 값 `'fallback'`이 `INSECURE_JWT_SECRETS` 미포함 (기존 이슈, 이번 변경 범위 외)
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` (본 diff 미포함)
  - 상세: 이전 리뷰에서 지적된 사항으로, `configService.get<string>('jwt.secret') ?? 'fallback'`의 `'fallback'`이 `production-guards.ts`의 `INSECURE_JWT_SECRETS` blocklist에 포함되지 않는다. `assertProductionConfig`가 JWT_SECRET 미설정/예시값을 검사하므로 production에서 사용될 확률은 낮으나 방어 계층이 불완전하다. 이번 변경에서 해당 파일의 수정이 없어 여전히 미해결 상태다.
  - 제안: `'fallback'`을 `INSECURE_JWT_SECRETS`에 추가하거나 dev-fallback과 동일한 `jwt.config.ts` 반환값으로 통일한다.

### 인증/인가

- **[INFO]** WebSocket 채널 IDOR 방어 신규 추가 (긍정적)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `workflow:<workflowId>` 채널에 `WorkflowsService.findById(workflowId, workspaceId)` 소유권 검증을 추가했다. `notifications:<userId>` 채널에는 JWT sub 기반 userId 일치 검증을 추가했다. 두 채널 모두 `isValidUuid()` 사전 검증으로 비-UUID 입력 시 DB 조회 전 차단하여 ID enumeration 공격을 방지한다.
  - 제안: 이상 없음. 보안 개선사항으로 긍정 평가.

- **[INFO]** `notifications:` 채널의 `workspaceId` 가드 암묵적 의존 관계
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` 내 `if (!workspaceId)` 가드
  - 상세: `notifications:` 채널은 user 단위 채널이지만, 공통 `workspaceId` 부재 차단 가드를 통과한 뒤에야 authorizer가 실행된다. 향후 workspaceId 없이 발급되는 JWT가 도입될 경우 정상 사용자의 `notifications:` 구독이 "Not authenticated"로 차단될 수 있다. 현재 인증 체계에서는 발생하지 않는 시나리오다.
  - 제안: 현재 구현 유지. 향후 JWT 발급 구조 변경 시 이 의존 관계를 인지하고 `handleSubscribe` 가드 로직을 검토할 것.

- **[INFO]** Swagger UI production 비노출 게이팅 추가 (긍정적)
  - 위치: `codebase/backend/src/main.ts`, `codebase/backend/src/common/config/production-guards.ts`
  - 상세: `isSwaggerEnabled` 함수가 `NODE_ENV !== 'production'`에서는 항상 true, production에서는 `ENABLE_SWAGGER_IN_PROD`가 정확히 `'true'`/`'1'`일 때만 true를 반환한다. `isFlagOn`의 대소문자/값 정책과 일관성을 유지한다. OWASP A05(Security Misconfiguration) — 무인증 API 표면 정찰 차단의 올바른 구현이다. `isSwaggerEnabled(process.env)` 결과를 부팅 초반 `swaggerEnabled` 변수에 1회 저장해 마운트·로그 두 곳이 동일 결정을 공유하도록 개선된 점도 확인했다.
  - 제안: `ENABLE_SWAGGER_IN_PROD=true` opt-in 활성화 시 Swagger 엔드포인트에 IP 제한 또는 Basic Auth를 추가하면 더욱 강화된다. 현재는 opt-in만으로 무인증 노출이 복귀한다는 점을 운영 문서에 명시할 것을 권장한다.

- **[INFO]** `/auth/refresh` CSRF 방어 Origin allowlist 검증 추가 (긍정적)
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/common/utils/cors-origins.ts`
  - 상세: refresh 쿠키 SameSite=None 모드에서 타 사이트가 쿠키를 자동 첨부해 강제 refresh를 유발하는 CSRF 시나리오를 Origin allowlist 검증으로 차단한다. `isOriginAllowed`는 `'null'` 불투명 origin도 명시적으로 거부해 sandbox iframe 기반 CSRF 벡터를 차단한다. 서버 단 defense-in-depth로 올바른 설계다.
  - 제안: 이상 없음.

- **[INFO]** refresh 쿠키 path 축소 (`/` → `/api/auth`) (긍정적)
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`
  - 상세: 쿠키 전송 범위를 `/api/auth/*` 엔드포인트로 한정해 불필요한 쿠키 첨부 표면을 축소했다. 다른 엔드포인트는 Bearer access token만 사용하므로 쿠키가 불필요하다. `setRefreshTokenCookie`와 `clearRefreshTokenCookie`가 동일 path를 사용하므로 clear가 올바르게 동작함도 확인했다.
  - 제안: 이상 없음.

### 입력 검증

- **[INFO]** `'null'` 불투명 origin 거부 추가 (긍정적)
  - 위치: `codebase/backend/src/common/utils/cors-origins.ts`
  - 상세: `sandbox` 속성 iframe, `data:`, `file:` 등에서 발생하는 불투명 `'null'` origin을 wildcard 모드에서도 명시적으로 거부한다. null-origin CSRF 방어로 올바른 추가다.
  - 제안: 이상 없음.

- **[INFO]** UUID 형식 사전 검증으로 DB 쿼리 전 차단
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `workflow:`, `execution:`, `background:run:` 채널 모두 `isValidUuid()` 형식 검증 후 DB 조회를 수행한다. 비-UUID 입력은 DB 진입 전에 거부해 ID enumeration을 방지한다.
  - 제안: 이상 없음.

### OWASP Top 10

- **[INFO]** CF-Connecting-IP 헤더 신뢰 기본 off (fail-safe) (긍정적)
  - 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`, `hooks.service.ts`, `public-webhook-throttle.guard.ts`
  - 상세: `TRUST_CF_CONNECTING_IP` 환경변수가 정확히 `'true'`/`'1'`인 경우에만 CF-Connecting-IP를 신뢰한다. 기본 off 상태에서는 위변조 가능한 CF 헤더를 무시하고 X-Forwarded-For로 폴백한다. 비-Cloudflare 배포에서 헤더 조작으로 rate-limit·ip_whitelist를 우회하는 공격을 차단하는 fail-safe 설계다.
  - 제안: 이상 없음. `isFlagOn`과 동일한 `'true'`/`'1'` 엄격 판정 정책이 일관되게 적용되고 있다.

- **[INFO]** `x-powered-by` 헤더 비활성화 유지
  - 위치: `codebase/backend/src/main.ts`
  - 상세: `expressInstance.disable('x-powered-by')`가 이번 리팩터링 후에도 유지되어 기술 스택 노출을 방지하고 있다.
  - 제안: 이상 없음.

- **[INFO]** ALLOW_PRIVATE_HOST_TARGETS SSRF warn-only 처리 유지 (의도적 설계)
  - 위치: `codebase/backend/src/main.ts`
  - 상세: self-host 용도를 위해 throw 대신 warning 처리하는 설계가 유지됐다. 운영자에게 egress 방화벽/IP allowlist 병행을 경고하는 메시지가 출력된다.
  - 제안: `ALLOW_PRIVATE_HOST_TARGETS` 활성화 이벤트를 감사 로그에도 기록하는 것을 장기적으로 고려할 수 있다.

### 암호화

- **[INFO]** refresh 쿠키 SameSite 정책 환경변수 분리 (긍정적)
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`
  - 상세: 기존 하드코딩된 `sameSite: 'none'`을 `COOKIE_SAMESITE` 환경변수 기반 `getRefreshCookieSameSite()` 함수로 분리했다. 기본값 `'none'`(cross-site 배포 지원)을 유지하면서 동일 사이트 배포는 `lax`/`strict`로 하드닝 가능하다. 인식되지 않는 값은 `'none'`으로 안전하게 폴백한다. `SameSite=None` 설정 시 `Secure: true`가 항상 함께 설정되어 HTTPS 필수 요건을 충족한다.
  - 제안: 이상 없음.

### 에러 처리

- **[INFO]** CSRF 차단 시 에러 메시지 `'Origin not allowed'` — 정보 노출 수준 적절
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`
  - 상세: `throw new ForbiddenException('Origin not allowed')`가 반환하는 메시지는 공격자에게 허용되는 origin 목록 등 구체적인 내부 구조를 노출하지 않는다.
  - 제안: 이상 없음.

- **[INFO]** WebSocket 채널 거부 메시지 — 특정 리소스 정보 미노출
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `'Not authorized for this workflow'`, `'Not authorized for these notifications'` 등 거부 메시지가 workflowId나 구체적인 검증 실패 원인을 포함하지 않아 적절하다.
  - 제안: 이상 없음.

### 의존성 보안

- **[INFO]** `safe-regex@2.1.1` 및 전이 의존성 `regexp-tree@0.1.27` — 알려진 취약점 없음
  - 위치: `codebase/backend/package.json`, `package-lock.json`
  - 상세: MIT 라이선스, 현재 npm audit 기준 알려진 취약점 없음. `safe-regex`가 `dependencies`(런타임)에 올바르게 배치되어 있다(`@types/safe-regex`는 `devDependencies` 정상). 런타임 `compileUserRegex` 함수에서 직접 호출하므로 런타임 의존성 배치가 올바르다.
  - 제안: 이상 없음.

- **[INFO]** `@nestjs-modules/mailer` 간접 의존성(`chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0`) lock 파일 추가
  - 위치: `codebase/backend/package-lock.json`
  - 상세: `npm install` 실행 시 npm이 기존에 미기록된 optional/peer 의존성들을 함께 기록했다. 모두 MIT 라이선스, optional+peer 플래그로 프로덕션 바이너리에 포함되지 않는다.
  - 제안: 이상 없음.

### XSS / HTML Sanitization

- **[INFO]** DOMPurify 블랙리스트에서 화이트리스트(deny-by-default)로 전환 (긍정적)
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
  - 상세: 기존 `USE_PROFILES: { html: true }` + `FORBID_TAGS/FORBID_ATTR` 블랙리스트에서 `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP`를 사용하는 화이트리스트 방식으로 전환했다. `svg`/`math` 기반 mXSS 벡터, `iframe`, `object`, 이벤트 핸들러 속성 등 미지의 신규 벡터가 기본 차단된다. 임베드 위젯(host 사이트로 XSS 전파 위험)에서 특히 중요한 하드닝이다. `javascript:`, `data:`, `vbscript:` scheme을 href/src 속성에서 차단하는 `ALLOWED_URI_REGEXP` 추가도 올바르다.
  - 제안: `ALLOWED_URI_REGEXP`의 세 번째 대안 `[a-z+.-]+(?:[^a-z+.:-]|$)`이 relative URL/anchor를 허용하기 위한 패턴임을 인라인 주석으로 추가하면 향후 수정 시 오해를 방지할 수 있다.

---

## 요약

이번 refactor-04-security 변경은 M-1(Swagger production 게이팅), M-3(ReDoS safe-regex 사전 검출), M-5(CSRF 방어 + 쿠키 SameSite 환경변수 분리 + path 축소), M-6(WebSocket workflow/notifications IDOR 차단), m-1(HTML sanitize 화이트리스트 전환), m-3(CF-Connecting-IP 신뢰 기본 off)을 구현한다. 전체적으로 이번 변경은 취약점을 도입하지 않고 기존 보안 표면을 명시적으로 축소하는 방향으로 진행되었다. `compileUserRegex` 단일 chokepoint, `'null'` origin 거부, CSRF defense-in-depth, deny-by-default DOMPurify 화이트리스트 전환, CF-Connecting-IP 기본 off는 각각 OWASP 관련 위험을 적절히 완화한다. 지적 사항은 두 가지로: (1) `safeRegex(source)` 호출에 try/catch 방어가 없어 `regexp-tree` 내부 예외가 전파될 수 있다 — 실제 발생 확률은 낮으나 방어적 코딩을 권장한다. (2) `websocket.module.ts` JWT fallback `'fallback'`의 `INSECURE_JWT_SECRETS` 미포함 — 기존 이슈가 이번 변경 범위 밖이라 미해결 상태다. Critical 및 Warning 등급의 신규 취약점은 발견되지 않았다.

## 위험도

LOW
