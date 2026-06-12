# Code Review 통합 보고서

리뷰 대상: `refactor-04-security` 브랜치 변경사항
리뷰 일시: 2026-06-12 20:32:29

---

## 전체 위험도
**MEDIUM** — 기능 구현 완전성·보안 강화 방향은 우수하나, 유저 가이드 문서 동반 갱신 누락(README.md 신규 환경변수 3종, 세션 쿠키 변경) 및 SPEC-DRIFT 4건(코드 개선으로 spec 이 낡아짐)이 존재한다. Critical 발견 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/6-websocket-protocol.md §3.3` 소유 검증 채널 목록에 `workflow:` · `notifications:` 미등록 — 코드는 올바르게 IDOR 차단을 구현, spec 만 낡음 | `websocket.gateway.ts` (channelAuthorizers) | 코드 유지. spec §3.3 에 `workflow:` (workflowId→workspace 소유 검증), `notifications:` (userId→JWT sub 일치 검증) 추가. 담당: project-planner |
| W2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md §2.3` 클라이언트 IP 항목이 CF-Connecting-IP 무조건 신뢰로 기술 — 코드는 `TRUST_CF_CONNECTING_IP` opt-in(기본 off) 으로 강화 | `client-ip.ts`, `hooks.service.ts`, `public-webhook-throttle.guard.ts` | 코드 유지. spec §2.3 클라이언트 IP 항목을 `TRUST_CF_CONNECTING_IP=true` 일 때만 1순위(기본 off) 로 정정. 담당: project-planner |
| W3 | SPEC-DRIFT | [SPEC-DRIFT] spec 의 transform/filter/switch regex ReDoS 정책이 "길이 200자" 만 언급, `safe-regex` 검사 미기재 — 코드는 길이 이내의 지수 백트래킹 패턴도 추가 거부 | `condition-evaluator.util.ts`, `filter.handler.ts`, `transform.handler.ts` | 코드 유지. `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/1-logic/2-switch.md` 에 safe-regex 위험 패턴 거부 문구 추가. 담당: project-planner |
| W4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/swagger.md` 에 production 비노출 정책 미기재 — 코드는 production 기본 미노출 + `ENABLE_SWAGGER_IN_PROD=true` opt-in 정책 구현 | `main.ts`, `production-guards.ts` | 코드 유지. `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` 에 Swagger UI production 비노출 규약 추가. 담당: project-planner |
| W5 | Documentation | `clearRefreshTokenCookie` 에 "set/clear 경로 일치" 제약 경고 주석 부재 — 미래 기여자가 `path` 를 `/` 로 바꾸면 logout 후 쿠키 잔존(silent failure) 위험 | `refresh-cookie.ts` — `clearRefreshTokenCookie` 함수 | 함수 상단에 `// IMPORTANT: path must match setRefreshTokenCookie's COOKIE_PATH ('/api/auth')` 경고 주석 추가 |
| W6 | Testing | `shouldTrustCfConnectingIp` 함수 직접 단위 테스트 부재 — `isFlagOn`, `getRefreshCookieSameSite`, `isSwaggerEnabled` 등 동일 모듈 내 유사 함수들은 모두 env-injection 직접 단위 테스트 보유, 일관성 깨짐 | `client-ip.spec.ts` | `describe('shouldTrustCfConnectingIp')` 블록 추가: `'true'`/`'1'` → true, `''`/`'TRUE'`/미설정 → false 케이스 고정 |
| W7 | Maintainability | `notifications:` authorizer 의 `Promise.resolve` 래핑 의도 미문서화 — 신규 동기 authorizer 작성자가 패턴 혼란 겪을 수 있음 | `websocket.gateway.ts` L152-159 (`channelAuthorizers` 인터페이스 정의 근처) | 인터페이스 정의 직전 주석에 `// 동기 판별 시에도 Promise.resolve()로 감싸야 한다` 추가, 또는 반환 타입을 `MaybePromise<...>` 로 완화 |
| W8 | User Guide Sync | `auth·세션` 흐름 변경 — `07-workspace-and-team/security-2fa.mdx` 갱신 누락. refresh 쿠키 경로 축소·SameSite configurable·CSRF 403 응답 변화가 사용자 가이드에 미반영 | `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` (및 `.en.mdx`) | 세션 쿠키 정책 변경(경로 한정, SameSite 설정, CSRF Origin 검증) 설명 추가. 배포자 전용 내용이라면 PR 본문에 근거 명시 |
| W9 | User Guide Sync | 신규 환경변수 3종(`ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP`) README.md 갱신 누락 | `/Volumes/project/private/clemvion/README.md` — `## 환경 변수` §Backend 블록 | README `## 환경 변수` §Backend `# Security` 항목 아래에 세 변수 설명 및 `### 런타임 환경변수 (k8s ConfigMap/Secret)` §Backend 에도 추가 |
| W10 | Requirement | refresh 쿠키 path `/api/auth` 축소 — spec 에 path 정책 미기재 (회색지대). 기능 동작 정상, set/clear 동일 path 확인됨 | `refresh-cookie.ts` (`COOKIE_PATH = '/api/auth'`) | spec 갱신 권고: `spec/5-system/1-auth.md §2.3` 에 `| Refresh 쿠키 Path | /api/auth — auth 엔드포인트로 한정 |` 추가. 담당: project-planner |
| W11 | Side Effect | `extractClientIp` 가 `shouldTrustCfConnectingIp()` 를 인자 없이 호출해 `process.env` 전역에 암묵적 의존 — 테스트에서 `process.env` 직접 수정·복원 필요 | `client-ip.ts` — `extractClientIp` 내부 호출 | `extractClientIp(req, env = process.env)` 로 서명 확장 또는 `shouldTrustCfConnectingIp(process.env)` 명시화. 현 설계 유지 시 주석으로 의존 문서화 |
| W12 | Side Effect | DOMPurify 전략 전환(`USE_PROFILES.html` → `ALLOWED_TAGS` 화이트리스트)으로 기존 HTML 콘텐츠의 `<details>`, `<summary>`, `<abbr>`, `<figure>` 등 태그가 무음 제거됨 — 의도된 하드닝이나 기존 콘텐츠에 부작용 | `channel-web-chat/src/lib/safe-html.ts` | 기존 HTML 콘텐츠 렌더 컴포넌트에 스냅샷 테스트 추가로 태그 제거 부작용 미리 탐지 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Security | `safeRegex(source)` 호출에 try/catch 부재 — `regexp-tree` 내부 예외 발생 시 uncaught exception 전파 가능. 앞선 `new RegExp` 검사로 실제 발생 확률은 낮으나 방어적 코딩 권장 | `condition-evaluator.util.ts` — `compileUserRegex` 내 `safeRegex(source)` 호출 | `safeRegex(source)` 를 try/catch 로 감싸 예외 시 `{ regex: null, reason: 'unsafe' }` 반환 |
| I2 | Security | JWT fallback `'fallback'` 이 `INSECURE_JWT_SECRETS` 미포함 (기존 이슈, 이번 변경 범위 외) | `websocket.module.ts` | `'fallback'` 을 `INSECURE_JWT_SECRETS` 에 추가 또는 `jwt.config.ts` 반환값으로 통일 |
| I3 | Security | `notifications:` 채널의 `workspaceId` 가드 암묵적 의존 관계 — 향후 workspaceId 없는 JWT 도입 시 정상 구독 차단 가능성 | `websocket.gateway.ts` — `handleSubscribe` 내 `if (!workspaceId)` 가드 | 현재 구현 유지. JWT 발급 구조 변경 시 이 의존 관계 인지 필요 |
| I4 | Security | `ENABLE_SWAGGER_IN_PROD` opt-in 활성화 시 Swagger 엔드포인트에 IP 제한 또는 Basic Auth 없음 | `main.ts`, `production-guards.ts` | 운영 문서에 opt-in 시 무인증 노출이 복귀한다는 점 명시 권장 |
| I5 | Requirement | `isOriginAllowed('null')` 거부 — spec 에 null origin 거부 정책 미기재 | `cors-origins.ts` | spec 에 언급 없는 구현 확장. 별도 문서화 필요 시 project-planner 위임 |
| I6 | Requirement | `notifications:` 채널 emit 미구현 상태에서 authorizer 선제 추가 — spec 과 코드 모두 미구현(Planned) 일치 | `websocket.gateway.ts` | 해당 없음 |
| I7 | Side Effect | `COOKIE_PATH` 변경(`'/'` → `'/api/auth'`)으로 기존 `path=/` 쿠키가 logout 후에도 브라우저에 잔존(서버 측 토큰 무효화로 보완) | `refresh-cookie.ts` | 배포 노트에 "이전 `path=/` 쿠키는 만료 시까지 잔존" 명시 또는 `clearRefreshTokenCookie` 에서 `path='/'` 도 함께 clear 하는 전환 기간 처리 추가 |
| I8 | Testing | `websocket.gateway.spec.ts` — `notifications:` 채널의 userId 미설정 소켓 거부 케이스 부재 | `websocket.gateway.spec.ts` | userId 미설정 소켓이 `notifications:user-1` 구독 시도 시 `success: false` 케이스 추가 |
| I9 | Testing | `condition-evaluator.util.spec.ts` — 빈 문자열 패턴 동작 미명시 (`compileUserRegex('')` 계약 미고정) | `condition-evaluator.util.spec.ts` | `it('accepts empty pattern (matches everything)')` 케이스 추가 |
| I10 | Testing | `compileUserRegex` — `safeRegex()` 예외 경로 방어·테스트 미비 (I1 과 연동) | `condition-evaluator.util.ts`, `condition-evaluator.util.spec.ts` | try/catch 방어 추가 후 예외 경로 테스트 추가 |
| I11 | Testing | `refresh-cookie.spec.ts` — `clearRefreshTokenCookie` domain 옵션 케이스 부재 | `refresh-cookie.spec.ts` | domain 포함 `clearRefreshTokenCookie` 케이스 추가 |
| I12 | Testing | 환경변수 복원 패턴 불일치 (`afterEach` vs `try/finally` 혼재) | `sessions.controller.spec.ts`, `hooks.service.spec.ts`, `client-ip.spec.ts` | `sessions`/`hooks` spec 에도 `afterEach` 패턴 적용 또는 `withEnv(vars, fn)` 테스트 유틸리티 추출 |
| I13 | Maintainability | `websocket.gateway.spec.ts` — 소켓 타입 캐스팅 패턴 중복 (`workspaceId?` 단독 vs `workspaceId?; userId?` 혼재) | `websocket.gateway.spec.ts` L306, L321, L338 등 | 파일 상단에 `type EnrichedSocket = Socket & { workspaceId?: string; userId?: string }` 선언 후 일괄 교체 |
| I14 | Maintainability | `ALLOWED_URI_REGEXP` 세 번째 대안 패턴 — relative URL/anchor 허용 의도 미명시 | `safe-html.ts`, `condition-evaluator.util.ts` | 인라인 주석 추가: `// relative URL/anchor 허용` |
| I15 | Maintainability | `MAX_REGEX_LENGTH = 200` 선정 근거 JSDoc 미명시 | `condition-evaluator.util.ts` — 상수 선언부 | 상수 JSDoc 에 "safe-regex 와의 관계, 길이는 2차 방어" 한 줄 추가 |
| I16 | Documentation | `setRefreshTokenCookie` / `clearRefreshTokenCookie` 공개 함수 JSDoc 부재 | `refresh-cookie.ts` | 최소 `@param`, `@remarks` 수준 JSDoc 추가 |
| I17 | Documentation | spec 갱신 후행 항목(M-5, m-3 포함) — `spec/5-system/1-auth.md`, `spec/conventions/` 반영 여부 planner 확인 필요 | `plan/in-progress/refactor/04-security.md` | planner 위임 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 전체적으로 취약점 도입 없음. `safeRegex()` try/catch 부재(INFO), JWT fallback 기존 이슈(INFO) |
| requirement | LOW | SPEC-DRIFT 4건(W1~W4) — 코드가 spec 을 앞서 개선, 코드 유지 + spec 갱신 필요. refresh 쿠키 path spec 회색지대(W10) |
| scope | NONE | 범위 이탈 없음. 모든 변경이 작업 항목 내 |
| side_effect | LOW | DOMPurify 화이트리스트 전환으로 기존 HTML 태그 무음 제거(W12), `extractClientIp` 암묵적 `process.env` 의존(W11), 쿠키 path 전환 기간 잔존 쿠키(I7) |
| maintainability | LOW | `Promise.resolve` 래핑 의도 미문서화(W7), 환경변수 원복 보일러플레이트 반복(I12), 소켓 타입 캐스팅 중복(I13) |
| testing | LOW | `shouldTrustCfConnectingIp` 직접 단위 테스트 부재(W6). 이전 라운드 지적(describe 중복, 타이밍 단언) 해소 확인 |
| documentation | LOW | `clearRefreshTokenCookie` 경로 일치 경고 주석 부재(W5), `setRefreshTokenCookie` JSDoc 누락(I16) |
| dependency | NONE | `safe-regex@2.1.1` 추가 적절. MIT, 취약점 없음, 전이 의존성 최소 |
| api_contract | NONE | breaking change 없음. `/auth/refresh` 403 추가·쿠키 path 축소·WebSocket 신규 채널 모두 정규 클라이언트 무영향 |
| user_guide_sync | MEDIUM | README.md 신규 env 3종 누락(W9), `07-workspace-and-team/security-2fa.mdx` 세션 변경 미반영(W8) |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 사항 없음, 모든 변경이 refactor-04-security 작업 항목 내
- **dependency**: 신규 의존성(`safe-regex`) 적절, 취약점·라이선스·호환성 이슈 없음
- **api_contract**: 외부 REST API URL/상태코드/인증 방식 변경 없음, breaking change 없음

---

## 권장 조치사항

1. **(W8, W9 — User Guide Sync)** `README.md` §Backend 환경변수 블록에 `ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP` 3종 추가 및 `07-workspace-and-team/security-2fa.mdx` 세션 쿠키 정책 변경 반영
2. **(W1~W4 — SPEC-DRIFT)** project-planner 에게 위임: `spec/5-system/6-websocket-protocol.md §3.3` (workflow·notifications 검증 추가), `spec/5-system/1-auth.md §2.3` (CF-IP 신뢰 opt-in 정정, refresh 쿠키 path 추가), `spec/4-nodes/5-data/1-transform.md` + `spec/4-nodes/1-logic/2-switch.md` (safe-regex ReDoS 정책 추가), `spec/conventions/swagger.md` (production 비노출 규약 추가)
3. **(W5 — Documentation)** `clearRefreshTokenCookie` 상단에 path 일치 제약 경고 주석 추가
4. **(W6 — Testing)** `client-ip.spec.ts` 에 `shouldTrustCfConnectingIp` 직접 단위 테스트 추가
5. **(W7 — Maintainability)** `channelAuthorizers` 인터페이스 정의 근처에 `Promise.resolve` 래핑 의도 주석 추가
6. **(W10 — Requirement)** project-planner 에게 refresh 쿠키 path spec 명시 위임
7. **(W11 — Side Effect)** `extractClientIp` 서명에 `env = process.env` 기본 파라미터 추가 또는 주석으로 의존 문서화
8. **(W12 — Side Effect)** 기존 HTML 콘텐츠 렌더 컴포넌트에 스냅샷 테스트 추가(DOMPurify 화이트리스트 전환 안전망)
9. **(I1, I10 — Security/Testing)** `safeRegex(source)` try/catch 방어 추가 + 예외 경로 단위 테스트
10. **(I7 — Side Effect)** 배포 노트에 `path=/` 기존 쿠키 잔존 기간 명시 또는 전환 기간 clear 로직 추가

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (10명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `api_contract`, `user_guide_sync`
- **강제 포함 (router_safety)** (8명): `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (4명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단: 본 변경은 보안 리팩터링으로 성능 임팩트 없음 |
| architecture | 라우터 판단: 아키텍처 구조 변경 없음 (기존 패턴 내 확장) |
| database | 라우터 판단: DB 스키마·쿼리 변경 없음 |
| concurrency | 라우터 판단: 동시성 관련 변경 없음 |