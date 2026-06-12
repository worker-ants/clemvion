---
worktree: refactor-04-security-286de9
started: 2026-06-12
owner: project-planner
---

# Spec draft — refactor-04-security SPEC-DRIFT 정정

refactor-04-security 구현 PR(#570)에서 발생한 SPEC-DRIFT 6건을 spec 본문에 반영한다. **코드는 이미 구현·2회 ai-review(Critical 0) 완료** — spec 만 후행 정정하는 drift 해소다. 새 제품 결정이 아니라 "이미 합의·구현된 동작의 문서화".

## 변경 내역

### 1. auth — refresh 쿠키 SameSite·CSRF·Path + 클라이언트 IP (M-5·m-3)
`spec/5-system/1-auth.md`
- §2.1 표: Refresh Token = HttpOnly·Secure Cookie, SameSite 는 §2.3, **Path `/api/auth`**.
- §2.3 표:
  - **클라이언트 IP**: `CF-Connecting-IP` 를 **`TRUST_CF_CONNECTING_IP=true` 일 때만 1순위(기본 off)**. off 면 `X-Forwarded-For`→`req.ip`→`socket.remoteAddress`. (기존: "CF-Connecting-IP 무조건 1순위" → 정정)
  - **SameSite**: `COOKIE_SAMESITE` env, 기본 `none`(cross-site eTLD+1 배포 지원), `lax`/`strict` 하드닝. (기존: 완전 공백)
  - **Path**: `/api/auth` 한정.
  - **`/auth/refresh` CSRF**: Origin allowlist(`isOriginAllowed`) 대조 — allowlist 외·`'null'` Origin 403, 부재는 통과.
- Rationale 2.3.B 신설 — SameSite=none 근거(cross-site 배포), CSRF 를 CSRF토큰 대신 Origin 검증으로 보완하는 근거(쿠키는 refresh 전용 + CORS 가 응답 읽기 차단), CF-IP opt-in fail-safe 근거.

### 2. websocket — 소유검증 채널 (M-6)
`spec/5-system/6-websocket-protocol.md §3.3`
- 소유검증 채널 표에 `workflow:{workflowId}`(workspace 소유) + `notifications:{userId}`(JWT sub 일치, emit 미구현이나 fail-closed 선제) 추가. (기존: execution/kb/background 3채널만)

### 3. regex ReDoS 정책 (M-3)
`spec/4-nodes/1-logic/8-filter.md`, `spec/4-nodes/5-data/1-transform.md`(2곳), `spec/4-nodes/1-logic/1-if-else.md`
- "길이 200자" 단독 → "길이 ≤ 200 + `safe-regex` 위험 패턴(지수 백트래킹) 거부, 단일 헬퍼 `compileUserRegex`". 길이 200 단독은 ReDoS 방지 불충분 → safe-regex 1차, 길이 2차 방어 명시.

### 4. swagger 노출 정책 (M-1)
`spec/conventions/swagger.md §0` 신설
- Swagger UI non-production 전용 + `ENABLE_SWAGGER_IN_PROD` opt-in. frontmatter `code:` 에 production-guards.ts·main.ts 추가.

### 5. code stack 노출 staging 가이드 (m-2)
`spec/4-nodes/5-data/2-code.md §5.3`
- 코드 무변경(이미 spec 정합). "외부 노출 staging 은 NODE_ENV=production 으로 운영" 운영 가이드 1단락 추가.
- **이 단락은 기존 구현의 운영 가이드이며 새 code surface 를 약속하지 않는다 (code: frontmatter 갱신 불필요).**

## Rationale (연속성 주의점)
- **CF-Connecting-IP 번복**: 기존 §2.3 의 "CF-Connecting-IP 1순위 무조건"은 별도 Rationale 로 방어된 결정이 아니라 표 항목이었다. m-3 은 위변조 가능 헤더의 무조건 신뢰가 비-CF 배포에서 rate-limit/ip_whitelist 우회를 낳는다는 보안 근거로 opt-in 화한 것 — 합의 원칙 번복이 아니라 보안 강화. login_history IP(데이터 모델 §2.18.2)·EIA seq 등 IP 값의 *소비처* 는 동일하게 동작하며, 단지 IP *추출 소스* 의 신뢰 기준만 env 게이트로 바뀐다.
- **SameSite=none 유지**: cross-site 배포가 실사용 중이라는 사용자 확인에 근거. web-chat 임베드는 Bearer 라 None 의존 주체가 아님.
