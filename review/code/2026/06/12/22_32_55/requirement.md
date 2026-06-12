# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 파일 1: audit-action.const.ts — 주석 명칭 업데이트 (spec fidelity 양호)
- 위치: `audit-action.const.ts` 파일 헤더 주석
- 상세: 기존 `llm_config.*·rerank_config.*·password_change·2fa_*` → `model_config.*·user.password_changed·user.2fa_enabled·user.2fa_disabled` 로 Planned action 목록을 갱신. spec §4.1 표의 현재 표기(`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`, `model_config.*`)와 정확히 일치한다. AUDIT_ACTIONS 본체(구현된 액션)는 변경 없음 — spec §4.1 "현재 구현된 액션" 표와 1:1 대응 유지.
- 제안: 없음. 변경이 올바름.

---

### [INFO] 파일 2: auth.controller.spec.ts — `null` origin CSRF 테스트 추가
- 위치: `auth.controller.spec.ts` 라인 104–124 (새 it 블록)
- 상세: spec §2.3 세션 정책 표 `/auth/refresh` CSRF 항목 — "allowlist 외·불투명(`'null'`) Origin 은 `403`" — 에 해당하는 단위 테스트가 추가됐다. CORS_ORIGINS 미설정(wildcard 모드)에서도 `'null'` origin이 거부되는 것을 검증한다. 구현체(`isOriginAllowed`)의 `origin === 'null' → false` 규칙과 정합. 테스트 시나리오(env 저장·삭제·복원 패턴)는 인접 테스트와 일관.
- 제안: 없음.

---

### [INFO] 파일 3: client-ip.spec.ts — `extractClientIpFromHeaders` 단위 테스트 추가
- 위치: `client-ip.spec.ts` 라인 1–56 (새 describe 블록)
- 상세: 새 export `extractClientIpFromHeaders` 에 대한 3개 케이스가 추가됐다. CF off(default), CF on, IPv6-mapped IPv4 + 헤더 없음(null 반환). spec §2.3 클라이언트 IP 우선순위(CF-Connecting-IP 조건부 → XFF → ...)에 대응. 기존 `extractClientIp`/`shouldTrustCfConnectingIp` 테스트와 겹치지 않는 새 범위.
- 제안: 없음.

---

### [INFO] 파일 4: client-ip.ts — `extractClientIpFromHeaders` 추출 리팩터링
- 위치: `client-ip.ts` 전체
- 상세: 헤더 전용 IP 추출 로직을 `extractClientIpFromHeaders(headers)` 로 분리하고, `extractClientIp(req)` 가 이를 1차로 호출 후 `req.ip`/`socket` 폴백을 덧붙이는 구조. 기능 동작은 동일(우선순위 보존). spec §2.3 IP 우선순위(CF → XFF → req.ip → socket) 준수. `hooks.service.ts`·`public-webhook-throttle.guard.ts` 의 중복 구현을 단일 chokepoint 로 통합해 drift를 방지하는 합리적 개선.
- 제안: 없음.

---

### [INFO] 파일 5: refresh-cookie.spec.ts — `clearRefreshTokenCookie` domain 패리티 테스트 추가
- 위치: `refresh-cookie.spec.ts` 라인 929–938
- 상세: `clearRefreshTokenCookie`가 `cookieDomain` 제공 시 `domain` 옵션을 포함하는지 검증. spec §2.3 "set/clear 가 동일 Path 사용 필수" 및 `Refresh 쿠키 Domain` 정책과 정합. `setRefreshTokenCookie`에는 이미 동일 케이스 테스트가 존재하므로 대칭성 완성.
- 제안: 없음.

---

### [INFO] 파일 6: refresh-cookie.ts — `setRefreshTokenCookie` JSDoc 추가
- 위치: `refresh-cookie.ts` 라인 1087–1097
- 상세: 기존 구현에 JSDoc 블록만 추가됨. 파라미터 설명·`SameSite`·Path 정책·`clearRefreshTokenCookie`와의 동일 Path 의무를 명시. 구현 자체는 변경 없음. spec §2.3과 일치.
- 제안: 없음.

---

### [INFO] 파일 7: hooks.service.ts — IP 추출 위임 리팩터링
- 위치: `hooks.service.ts` 라인 1220–1230
- 상세: `extractClientIp` 로컬 헬퍼가 `extractClientIpFromHeaders` 에 위임하도록 단순화됐다. 기존 직접 구현(shouldTrustCfConnectingIp + XFF 파싱)을 제거하고 공유 코어로 교체. 반환 타입 `string | undefined` 유지(`?? undefined` 변환). 주석에서 req.ip(trust-proxy) 폴백을 현재 헤더 기반으로 유지하는 이유(req를 handleWebhook에 전달해야 함)를 명시 — 의도적 제약.
- 제안: 없음.

---

### [INFO] 파일 8: public-webhook-throttle.guard.ts — IP 추출 위임 리팩터링
- 위치: `public-webhook-throttle.guard.ts` 라인 1933–1951
- 상세: `extractClientIp` 로컬 헬퍼가 동일하게 `extractClientIpFromHeaders` 에 위임. `Record<string, unknown>` → `Record<string, string | string[] | undefined>` 타입 단언 캐스트는 Express 헤더 타입 현실과 맞지 않을 수 있으나 동작 상 영향은 없음(pickFirst 내부에서 타입 가드 처리). 기능 동작 보존.
- 제안: 없음.

---

### [INFO] 파일 9: websocket.gateway.spec.ts — `userId` 미설정 소켓 notifications 거부 테스트
- 위치: `websocket.gateway.spec.ts` 라인 2151–2167
- 상세: `workspaceId`는 있으나 `userId`가 없는 소켓이 `notifications:user-1` 구독 시도 시 `success=false`·`error='Not authorized for these notifications'` 로 거부되는 것을 검증. 실제 `authorize` 구현의 `!!userId && targetUserId === userId` 를 직접 테스트. fail-closed 정책(인증 미들웨어 회귀 방어) 커버.
- 제안: 없음.

---

### [INFO] 파일 10: websocket.module.ts — JWT fallback sentinel 통일
- 위치: `websocket.module.ts` 라인 3103
- 상세: `'fallback'` → `'dev-jwt-secret'` 으로 변경. `assertProductionConfig`의 `INSECURE_JWT_SECRETS` 세트에 포함된 값으로 통일해, DI 경합 등으로 fallback이 실제로 쓰여도 production 부팅 가드가 잡는다. spec §2.1 "JWT_SECRET production fail-closed (refactor 04 C-1)" 의도 강화. 기존 `'fallback'`은 sentinel 세트 밖이라 production 부팅 가드를 피해 실수로 사용될 위험이 있었음.
- 제안: 없음.

---

### [INFO] 파일 11: condition-evaluator.util.ts — `MAX_REGEX_LENGTH` 주석 강화
- 위치: `condition-evaluator.util.ts` 라인 3172–3176
- 상세: `safe-regex`가 1차 방어, 길이 상한이 2차 방어임을 명시한 주석 추가. `compileUserRegex` 함수 참조도 JSDoc에 추가. 구현 자체는 변경 없음. 이미 `compileUserRegex` 함수 내부에 동일 설명이 있으며, 주석 일관성 향상.
- 제안: 없음.

---

### [INFO] 파일 12: safe-html.test.ts — relative URL·blob: scheme 경계 테스트 추가
- 위치: `safe-html.test.ts` 라인 3482–3497
- 상세: 2개 케이스 추가 — (1) `/path?q=1`·`#sec` 같은 relative href·anchor는 유지, (2) `blob:https://...`는 제거. spec/7-channel-web-chat/4-security.md 의 허용 scheme 화이트리스트(`ALLOWED_URI_REGEXP`) 경계를 고정하는 회귀 테스트. 기존 `data:` 제거 케이스와 일관된 패턴.
- 제안: 없음.

---

## spec fidelity 점검 요약

| 파일 | 관련 spec | 일치 여부 |
|---|---|---|
| audit-action.const.ts | spec/5-system/1-auth.md §4.1 | 일치 (명칭 정렬 완료) |
| auth.controller.spec.ts | spec §2.3 `/auth/refresh` CSRF 정책 | 일치 |
| client-ip.ts·spec.ts | spec §2.3 클라이언트 IP 우선순위 | 일치 |
| refresh-cookie.ts·spec.ts | spec §2.3 쿠키 Path/Domain/SameSite | 일치 |
| hooks.service.ts·throttle.guard.ts | spec §2.3 IP 우선순위 (헤더 기반) | 일치 |
| websocket.gateway.spec.ts | spec §4.4 notifications 채널 IDOR | 일치 |
| websocket.module.ts | spec §2.1 production fail-closed | 일치 |
| condition-evaluator.util.ts | (ReDoS 방어 주석) | 내부 일관성 향상 |
| safe-html.test.ts | spec/7-channel-web-chat/4-security.md | 일치 |

---

## 요약

이번 변경은 보안 강화(04 m-1·m-3·M-5·M-6) 후속 정리(follow-ups) 집합이다. 핵심 기능 변경 없이 (1) IP 추출 로직의 단일 chokepoint 통합으로 중복 구현 drift 제거, (2) `null` origin CSRF 방어 및 `userId` 미설정 소켓 fail-closed에 대한 회귀 테스트 추가, (3) JWT fallback sentinel 통일, (4) safe-html scheme 경계 테스트 고정이 이루어졌다. 모든 변경이 관련 spec(주로 spec/5-system/1-auth.md §2.3, §4.1)과 line-level로 일치하며, TODO/FIXME 미완성 항목 없음. 구현 기능 완전성·엣지 케이스·에러 경로 모두 적절히 커버되어 있다.

## 위험도

NONE
