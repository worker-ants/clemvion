# Code Review 통합 보고서

리뷰 대상: refactor-04-security (3차 라운드)
리뷰 일시: 2026-06-12 21:06:59

---

## 전체 위험도
**MEDIUM** — 테스트 커버리지 3건 경고(null-origin CSRF 케이스 미검증, clear 쿠키 domain 케이스 누락, 소켓 타입 캐스팅 불일치) + 보안 레이어 1건 경고(JWT fallback `'fallback'` blocklist 미포함) + DOMPurify 전략 전환에 따른 무음 태그 제거 부작용 + `process.env` 암묵 의존 부작용. Critical 발견 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 보안 — 하드코딩 시크릿 | `websocket.module.ts` JWT fallback `'fallback'`이 `INSECURE_JWT_SECRETS` Set에 미포함. ConfigService 레이스/DI 초기화 이슈 시 `'fallback'`으로 서명된 JWT가 production을 통과하는 방어 계층 불완전 가능성. `'fallback'`은 공개된 값으로 임의 JWT 위조 가능. | `codebase/backend/src/modules/websocket/websocket.module.ts` L18 | `INSECURE_JWT_SECRETS`에 `'fallback'` 추가하거나, fallback 값을 `jwt.config.ts`의 `'dev-jwt-secret'`으로 통일해 기존 가드가 차단하는 값으로 맞춘다. |
| W2 | 테스트 커버리지 | `websocket.gateway.spec.ts` 소켓 타입 캐스팅이 3가지 패턴으로 혼재. 작성자가 두 번째 캐스팅 라인을 누락하면 workspaceId 또는 userId가 미설정되어 authorizer가 조용히 거부해 테스트가 엉뚱한 이유로 통과/실패 가능. | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L158-L732 | 파일 상단에 `type EnrichedSocket = Socket & { workspaceId?: string; userId?: string }` 타입 별칭 선언 후 모든 캐스팅을 단일 패턴으로 통일. |
| W3 | 테스트 커버리지 | `auth.controller.spec.ts`에 `'null'` origin CSRF 차단 케이스 미존재. 컨트롤러 수준에서 null-origin 거부가 고정되지 않아 `isOriginAllowed` 구현 변경 시 회귀 탐지 불가. | `codebase/backend/src/modules/auth/auth.controller.spec.ts` | `it('rejects refresh from null origin (sandbox iframe CSRF)', ...)` 추가. wildcard 모드 ON/OFF 양쪽 모두 검증. |
| W4 | 테스트 커버리지 | `refresh-cookie.spec.ts`에 `clearRefreshTokenCookie`의 domain 포함 케이스 미존재. set/clear domain 불일치는 브라우저에서 쿠키 삭제 실패를 유발하는 silent 버그인데 회귀 탐지 불가. | `codebase/backend/src/modules/auth/utils/refresh-cookie.spec.ts` L102-112 | `describe('clearRefreshTokenCookie')` 블록에 `cookieDomain: '.example.com'` 시 `res.clearCookie`가 `{ path: '/api/auth', domain: '.example.com' }`로 호출됨을 검증하는 케이스 추가. |
| W5 | 부작용 — 렌더 비호환 | `safe-html.ts` DOMPurify 화이트리스트 전환으로 기존 HTML의 `<details>`, `<summary>`, `<abbr>`, `<figure>` 등이 무음 제거됨. 의도된 보안 강화지만 기존 렌더 동작과 비호환. | `codebase/channel-web-chat/src/lib/safe-html.ts` | 채팅 컴포넌트 스냅샷 테스트 추가로 태그 제거 부작용 사전 탐지 안전망 확보. 롤백 불필요. |
| W6 | 부작용 — 전역 상태 의존 | `extractClientIp`가 `shouldTrustCfConnectingIp()`를 인수 없이 호출해 `process.env` 전역에 암묵 의존. 테스트에서 env 직접 수정·복원 필요. 동일 패턴이 `hooks.service.ts`, `public-webhook-throttle.guard.ts`에도 반복. | `codebase/backend/src/modules/auth/utils/client-ip.ts` | `extractClientIp(req, env = process.env)` 서명 확장 또는 내부 호출을 `shouldTrustCfConnectingIp(process.env)`로 명시화. 현상 유지 시 JSDoc에 의존 명기. |
| W7 | SPEC-DRIFT | `spec/4-nodes/1-logic/2-switch.md §3` compileRegexCache 설명에 safe-regex 위험 패턴 거부 문구 미기재. 코드 구현은 compileUserRegex 경유로 정상 동작 — spec이 낡은 것. | `spec/4-nodes/1-logic/2-switch.md §3` | 코드 유지. spec §3 compileRegexCache 설명에 "safe-regex 위험 패턴(지수 백트래킹) 거부 포함 — if-else §6 각주 동일 정책" 1줄 추가. 담당: project-planner. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 — 긍정 | `compileUserRegex` ReDoS 방어 완전 구현: 길이 검사(>200) → 문법 검사 → safe-regex → try/catch fail-closed 순서. filter/transform/condition-evaluator 세 사이트 모두 단일 함수 경유. | `codebase/backend/src/nodes/core/condition-evaluator.util.ts` | 없음 |
| I2 | 보안 — 긍정 | WebSocket 채널 IDOR 방어 완전 구현. 5개 채널 타입 모두 authorizer 보유. 비-UUID 입력은 DB 조회 전 `isValidUuid()`로 차단. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` L107-191 | 없음 |
| I3 | 보안 — 긍정 | DOMPurify 화이트리스트 전환으로 XSS 표면 최소화. `ALLOWED_URI_REGEXP`가 `javascript:`/`data:`/`vbscript:` scheme 이중 차단. `ensureLinkHook`이 `rel="noopener noreferrer nofollow"` 강제 추가. | `codebase/channel-web-chat/src/lib/safe-html.ts` | `ALLOWED_URI_REGEXP` 세 번째 대안 패턴 옆에 `// relative URL / anchor (#hash, /path, ?query) 허용` 주석 추가 권장. |
| I4 | 보안 — 긍정 | CORS allowlist 단일 진입점. HTTP + WebSocket 동일 정책. production에서 CORS 미설정 시 `assertCorsOriginsConfigured()`가 부팅 거부(fail-closed). `'null'` origin은 wildcard 모드에서도 명시 거부. | `codebase/backend/src/common/utils/cors-origins.ts` | 없음 |
| I5 | 보안 — 긍정 | production fail-closed 가드: OAUTH_STUB_MODE, LLM_STUB_MODE, JWT_SECRET(미설정/기본값/짧은 길이), ENCRYPTION_KEY(미설정/예시), MCP_ALLOW_INSECURE_URL 5항목 차단. | `codebase/backend/src/common/config/production-guards.ts` | 없음 |
| I6 | 보안 — 긍정 | Swagger production 비노출 게이팅: `isFlagOn` 엄격 판정(`'true'`/`'1'`만 ON). default 미노출 + opt-in escape hatch. | `codebase/backend/src/common/config/production-guards.ts` L77-80 | opt-in 활성화 시 IP 제한 또는 Basic Auth 추가 중기 고려. |
| I7 | 보안 — 미래 위험 | `buildContinuationErrorAck`에서 임의 Error 인스턴스의 `.message`를 클라이언트에 그대로 전달. 내부 서비스에서 DB 오류 문자열 포함 시 노출 가능. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` L877-889 | 안전하다고 알려진 에러 클래스만 message 전달, 나머지는 fallbackMessage로 일반화 고려. |
| I8 | 부작용 — 배포 | `COOKIE_PATH` `'/'` → `'/api/auth'` 변경으로 기존 발급 쿠키가 logout 후에도 브라우저에 잔존(만료 시까지). 서버 측 토큰 무효화로 실질적 위험 낮음. | `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` | 배포 노트에 "이전 `path=/` 쿠키는 만료까지 잔존, 서버 측 무효화로 보완" 명기. 전환 기간 동안 `path='/'`도 함께 clear하는 구현 추가 권장. |
| I9 | 테스트 커버리지 | `notifications:` 채널의 userId 미설정(undefined) 거부 케이스 미존재. 소켓 인증 미들웨어 버그로 userId 미설정 시 알림 채널 접근 허용 회귀 탐지 불가. | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L356-392 | `it('rejects notifications channel when socket has no userId', ...)` 추가. |
| I10 | 테스트 — 패턴 | 환경변수 원복 패턴 불일치: `afterEach` vs. `try-finally` 혼재. 현재 동작에는 영향 없으나 신규 케이스에서 원복 누락 위험. | `auth.controller.spec.ts`, `public-webhook-throttle.guard.spec.ts` | `withEnv(vars, fn)` 공용 헬퍼 추출 또는 `afterEach` 패턴 통일. |
| I11 | 테스트 커버리지 | `safe-html.test.ts`에 relative URL/fragment anchor 허용 케이스 및 `blob:` scheme 차단 케이스 미검증. `ALLOWED_URI_REGEXP` 경계 미고정. | `codebase/channel-web-chat/src/lib/safe-html.test.ts` | relative href, anchor, blob: scheme 케이스 추가로 경계 고정. |
| I12 | 문서화 | `setRefreshTokenCookie` JSDoc 부재 지속(이전 라운드 INFO 미해소). `options.rememberMe`, `options.cookieDomain`, path 한정 부작용, SameSite 정책 등 파라미터 의미 파악 어려움. | `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` L33-50 | JSDoc 추가 (`@param res`, `@param token`, `@param options.rememberMe`, `@param options.cookieDomain`, `@remarks`). |
| I13 | 문서화 | `MAX_REGEX_LENGTH = 200` 상수 JSDoc에 선정 근거 미기재. 200자 기준의 의도(switch/filter/transform 노드 규약 계승, safe-regex 2차 방어 관계) 불명확. | `codebase/backend/src/nodes/core/condition-evaluator.util.ts` L37-41 | JSDoc에 "200자 기준은 기존 노드 규약 계승; safe-regex 가 1차 방어, 길이 상한은 AST 분석 한계를 보완하는 2차 방어" 1줄 추가. |
| I14 | 문서화 | `extractClientIp` JSDoc에 `process.env.TRUST_CF_CONNECTING_IP` 암묵 의존이 언급되지 않아 테스트 격리 시 직접 env 조작이 필요함을 모르는 기여자 위험. | `codebase/backend/src/modules/auth/utils/client-ip.ts` | JSDoc에 `@remarks process.env.TRUST_CF_CONNECTING_IP 에 암묵 의존` 추가. |
| I15 | spec 범위 | 이번 변경(dcacd58e)은 spec 파일만 수정. 코드 구현(1aa52b54)과 역할 분리 명확. spec-draft plan 문서에 `spec/1-data-model.md §2.18.1` ip_address 변경 항목 명시적 추가 시 추적성 향상. | `plan/in-progress/spec-draft-refactor-04-security-drift.md` | plan 문서에 해당 변경 항목 명시 권장. |
| I16 | 이전 라운드 정정 | 이전 라운드(20:32:29)에서 WARNING으로 지적된 `clearRefreshTokenCookie` 경고 주석 부재 및 INFO로 지적된 `safeRegex` try/catch 부재는 실제 코드에 이미 구현되어 있었음. | `refresh-cookie.ts` L52-55; `condition-evaluator.util.ts` L88-93 | 이전 라운드 분석 부정확 정정. 현상 유지. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | JWT fallback `'fallback'` INSECURE_JWT_SECRETS 미포함(W1 1건). 나머지는 모두 긍정 확인(ReDoS 단일 chokepoint, IDOR 채널 방어, CSRF 방어, DOMPurify 화이트리스트, production fail-closed 모두 정상). |
| requirement | LOW | SPEC-DRIFT 1건 잔여(switch.md §3 safe-regex 정책 미기재, W7). 이전 라운드 SPEC-DRIFT 4건 + WARNING 1건 모두 해소 확인. M-1/M-3/M-5/M-6/m-1/m-3 전 항목 코드+spec 정합 확인. |
| side_effect | LOW | 2건 주의 필요: COOKIE_PATH 변경으로 기존 쿠키 잔존(I8), DOMPurify 전략 전환으로 일부 태그 무음 제거(W5). `process.env` 암묵 의존(W6). 비의도적 전역 상태 오염·API 파괴 없음. |
| documentation | LOW | INFO 4건 미완: setRefreshTokenCookie JSDoc 부재(I12), MAX_REGEX_LENGTH 선정 근거 주석(I13), ALLOWED_URI_REGEXP 의도 주석(I3), extractClientIp env 의존 문서화(I14). 이전 WARNING 3건 모두 해소 확인. |
| testing | MEDIUM | WARNING 3건: 소켓 타입 캐스팅 혼재(W2), null-origin CSRF 케이스 누락(W3), clearRefreshTokenCookie domain 케이스 누락(W4). INFO 4건 추가 커버리지 개선 여지. |
| scope | NONE | 모든 변경이 plan/spec-draft 범위 내. spec·코드 커밋 역할 분리 명확. 무관한 파일 수정 없음. |

---

## 발견 없는 에이전트

scope: Critical/WARNING 발견 없음 (NONE 위험도).

---

## 권장 조치사항

1. **(즉시)** `websocket.module.ts` L18 `'fallback'` → `'dev-jwt-secret'`으로 변경하거나 `INSECURE_JWT_SECRETS`에 `'fallback'` 추가. production JWT 방어 계층 완전성 확보(W1).
2. **(즉시)** `auth.controller.spec.ts`에 null-origin CSRF 차단 케이스 추가 — wildcard 모드 ON/OFF 양쪽(W3).
3. **(즉시)** `refresh-cookie.spec.ts`에 `clearRefreshTokenCookie` domain 포함 케이스 추가(W4).
4. **(즉시)** `websocket.gateway.spec.ts` 소켓 타입 캐스팅을 `EnrichedSocket` 단일 타입 별칭으로 통일(W2).
5. **(단기)** `safe-html.ts` DOMPurify 전환 대응 채팅 컴포넌트 스냅샷 테스트 추가(W5).
6. **(단기)** `extractClientIp` `process.env` 암묵 의존 명시화: 서명 확장 또는 JSDoc 추가(W6).
7. **(단기, project-planner)** `spec/4-nodes/1-logic/2-switch.md §3`에 safe-regex 정책 1줄 추가(W7 SPEC-DRIFT).
8. **(배포 전)** 배포 노트에 `COOKIE_PATH` 변경으로 인한 기존 쿠키 잔존 과도기 명기(I8).
9. **(중기)** `setRefreshTokenCookie` JSDoc 추가(I12), `MAX_REGEX_LENGTH` 선정 근거 주석(I13), `ALLOWED_URI_REGEXP` 의도 주석(I3), `extractClientIp` env 의존 문서화(I14).
10. **(중기)** 환경변수 원복 패턴 `withEnv` 헬퍼로 통일(I10). `WebsocketModule` forwardRef 누적 해소를 위한 `ChannelAuthorizationService` 분리 별도 plan 수립.

---

## 라우터 결정

라우터가 선별 실행:

- **실행**: `security`, `requirement`, `side_effect`, `documentation`, `testing`, `scope` (6명)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation`, `requirement`