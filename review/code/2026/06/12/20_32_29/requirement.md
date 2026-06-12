# 요구사항(Requirement) 리뷰 — refactor-04-security

## 발견사항

### [SPEC-DRIFT] [WARNING] spec/5-system/6-websocket-protocol.md §3.3 소유 검증 채널 목록에 `workflow:` · `notifications:` 미등록

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (channelAuthorizers 배열)
- 상세: 코드는 `workflow:{workflowId}` 와 `notifications:{userId}` 채널에 대해 올바른 authorizer 를 추가했다. 그러나 `/spec/5-system/6-websocket-protocol.md §3.3` 의 권한 검증 설명은 현재 `"execution: / kb: / background:run: 채널은 workspace 소유 검증"` 만 열거하며, `workflow:` 와 `notifications:` 는 포함되지 않는다. §3.2 채널 패턴 표에는 두 채널이 이미 정의되어 있으나 §3.3 소유 검증 채널 목록이 낡았다. 구현이 보안상 옳고(`workflow:` IDOR 차단, `notifications:` fail-closed) spec 만 갱신이 필요한 상황이다.
- 제안: 코드 유지. spec 갱신 — `spec/5-system/6-websocket-protocol.md §3.3` 의 권한 검증 문장에 `workflow:` (workflowId→workspace 소유 검증) 와 `notifications:` (userId→JWT sub 일치 검증) 를 추가한다. 담당: project-planner.

### [SPEC-DRIFT] [WARNING] spec/5-system/1-auth.md §2.3 클라이언트 IP 항목이 CF-Connecting-IP 무조건 신뢰로 기술

- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: `/spec/5-system/1-auth.md §2.3` 세션 정책 표에 `| 클라이언트 IP | Cloudflare 무료 플랜 호환: CF-Connecting-IP 헤더를 1순위, X-Forwarded-For 첫 IP, req.ip 순으로 추출 |` 라고 명시되어 있다. 코드는 `TRUST_CF_CONNECTING_IP` env 플래그 기본 off (fail-safe) 를 도입해 CF 헤더를 opt-in 으로만 신뢰하는 방식으로 변경됐다. 이는 의도적인 보안 강화(위변조 방어)이므로 코드가 옳고 spec 본문이 낡았다.
- 제안: 코드 유지. spec 갱신 — `spec/5-system/1-auth.md §2.3` 클라이언트 IP 항목을 `CF-Connecting-IP 는 TRUST_CF_CONNECTING_IP=true 일 때만 1순위 (기본 off — 위변조 방어), 미설정 시 X-Forwarded-For 첫 IP, req.ip 순` 으로 정정한다. 담당: project-planner.

### [SPEC-DRIFT] [WARNING] spec 의 transform/filter 노드 regex ReDoS 정책이 "길이 200" 만 언급, safe-regex 검사 미기재

- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` (compileUserRegex), `filter.handler.ts`, `transform.handler.ts`
- 상세: `/spec/4-nodes/5-data/1-transform.md` 는 `"ReDoS 방지를 위해 regex 패턴 길이는 200자 이내"` 로만 기술한다. `/spec/4-nodes/1-logic/2-switch.md §3` 의 `compileRegexCache` 설명도 `"잘못된/과길이 패턴은 skip"` 수준이다. 코드는 길이 200 이내여도 지수 백트래킹(`(a+)+$` 등)이 가능한 패턴을 `safe-regex` 휴리스틱으로 추가 거부한다. 이는 의도적 보안 강화로 되돌리는 것이 오답이다.
- 제안: 코드 유지. spec 갱신 — `spec/4-nodes/5-data/1-transform.md` 와 `spec/4-nodes/1-logic/2-switch.md` 의 regex 길이 설명에 `safe-regex 위험 패턴 (지수 백트래킹 가능) 도 거부` 문구 추가 및 ReDoS 정책 정의 단일화. 담당: project-planner.

### [SPEC-DRIFT] [WARNING] spec/conventions/swagger.md 에 production 비노출 정책 미기재

- 위치: `codebase/backend/src/main.ts`, `codebase/backend/src/common/config/production-guards.ts` (isSwaggerEnabled)
- 상세: `/spec/conventions/swagger.md` 는 Swagger 문서화 패턴 가이드이지만 production 환경에서의 `/docs` 노출 여부에 대해 아무런 언급이 없다. 코드는 `isSwaggerEnabled()` 를 통해 production 기본 비노출 + `ENABLE_SWAGGER_IN_PROD=true` opt-in 정책을 명시적으로 구현한다. 이는 보안 강화(무인증 API 표면 정찰 차단)로 의도적이다.
- 제안: 코드 유지. spec 갱신 — `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` 에 "Swagger UI(`/docs`) 는 non-production 전용; production 에서는 기본 미노출, `ENABLE_SWAGGER_IN_PROD=true` opt-in 으로만 활성화" 규약 추가. 담당: project-planner.

### [WARNING] refresh 쿠키 path `/api/auth` 축소 — spec 에 path 정책 미기재 (회색지대)

- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` (`COOKIE_PATH = '/api/auth'`)
- 상세: `/spec/5-system/1-auth.md §2.3` 세션 정책 표에는 refresh 쿠키 path 에 대한 명시적 기술이 없다. 기존 코드는 `COOKIE_PATH = '/'` 를 사용했으나 변경 후 `/api/auth` 로 축소했다. spec 이 path 를 정의하지 않아 의도적 개선인지 실수인지 명확하지 않으나, logout 에서 `clearRefreshTokenCookie` 가 동일 path 로 clear 하고 테스트도 갱신됐으므로 기능 동작에 문제없다. `/api/auth` 범위 외 엔드포인트는 모두 Bearer access token 기반이라 축소 의도도 타당하다. spec 에 명시되지 않은 변경이므로 WARNING 으로 남긴다 — SPEC-DRIFT 가 아닌 이유는 spec 이 침묵하는 영역이어서 "코드가 합리적 개선" 인지 "spec 정의 이탈" 인지 명확하지 않기 때문이다.
- 제안: 기능 동작 정상 확인됨. spec 갱신 권고 — `spec/5-system/1-auth.md §2.3` 에 `| Refresh 쿠키 Path | /api/auth — auth 엔드포인트로 한정 (표면 축소) |` 항목 추가. 담당: project-planner.

### [INFO] isOriginAllowed('null') 거부 — spec 에 null origin 거부 정책 미기재

- 위치: `codebase/backend/src/common/utils/cors-origins.ts` (if (origin === 'null') return false)
- 상세: 코드는 null-origin CSRF 방어를 위해 `'null'` 문자열 origin 을 명시적으로 거부한다. `/spec/5-system/1-auth.md` 또는 CORS 관련 문서에 이 정책에 대한 언급이 없다. 기능적으로 올바른 보안 강화이므로 INFO 수준.
- 제안: spec 에 언급 없는 구현 확장. 별도 문서화 필요성 있으면 project-planner 에 위임.

### [INFO] safe-regex 가 alternation-overlap 계열을 통과시키는 한계 — 코드 내 명시적 문서화

- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` (compileUserRegex 주석)
- 상세: 코드에 `"safe-regex 는 alternation-overlap((a|a)* 계열) 같은 일부 ReDoS 는 통과할 수 있음 — 길이 상한이 2차 방어"` 라고 명시됐다. 알려진 한계를 정직하게 문서화한 것으로 기능 요구사항 위반 아님. 테스트에서도 해당 케이스를 의도적으로 제외하고 주석으로 설명했다.
- 제안: 해당 없음.

### [INFO] notifications: 채널 emit 미구현 상태에서 authorizer 선제 추가

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (notifications authorizer)
- 상세: `/spec/5-system/6-websocket-protocol.md §4.4` 는 `notifications:` 채널이 "미구현 (Planned)" 임을 명시한다. 코드 주석도 동일하게 인지하며 fail-closed 선제 추가 이유를 설명한다. spec 과 코드 모두 미구현 상태를 일치하게 기술하고 있어 요구사항 괴리 아님.
- 제안: 해당 없음.

### [INFO] ENABLE_SWAGGER_IN_PROD .env.example 플레이스홀더 추가 확인

- 위치: `codebase/backend/.env.example`
- 상세: diff 에 `# ENABLE_SWAGGER_IN_PROD=false` 주석 플레이스홀더가 추가됐다. 이전 documentation 리뷰에서 우려했던 누락이 이미 처리됐음을 확인.
- 제안: 해당 없음.

---

## 요약

refactor-04-security 변경의 요구사항 충족 관점에서, M-1(Swagger 게이팅), M-3(ReDoS safe-regex 방어), M-5(refresh 쿠키 SameSite/path/CSRF Origin 검증), M-6(WebSocket workflow·notifications IDOR 차단), m-1(DOMPurify 화이트리스트), m-3(CF-IP 신뢰 opt-in) 의 모든 기능이 완전히 구현됐으며, 에지 케이스(비-UUID 선차단, null origin 거부, TRUST_CF_CONNECTING_IP 비표준 값 무시, COOKIE_SAMESITE 미인식 값 fallback, ENABLE_SWAGGER_IN_PROD 정확히 true/1 만 ON)를 빠짐없이 처리하고 단위 테스트로 계약을 고정하고 있다. CRITICAL 및 일반 요구사항 미충족 WARNING 은 없다. SPEC-DRIFT 4건은 코드가 의도적으로 개선된 영역으로 spec 갱신 누락에 해당하며(`spec/5-system/6-websocket-protocol.md §3.3`, `spec/5-system/1-auth.md §2.3 클라이언트 IP`, `spec/4-nodes/5-data/1-transform.md 및 switch 대응 문서`, `spec/conventions/swagger.md`), 모두 코드를 되돌리는 것이 아니라 spec 반영이 해결책이다. refresh 쿠키 path 변경 1건은 spec 이 침묵하는 회색지대 WARNING 으로, 기능 동작에는 이상 없다.

## 위험도

LOW
