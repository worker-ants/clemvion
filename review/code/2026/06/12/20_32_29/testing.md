# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `isSwaggerEnabled` describe 블록 중복 — 이전 리뷰 지적사항 해소 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/common/config/production-guards.spec.ts`
- 상세: 이전 리뷰(19_49_22)에서 `describe('isSwaggerEnabled ...')` 블록이 파일에 두 번 존재할 가능성을 지적했다. 현재 파일을 확인한 결과 블록은 L181에 단 한 번만 존재한다. **해소됨.**

### [INFO] 타이밍 기반 단언 — 이전 리뷰 지적사항 해소 확인
- 위치: `condition-evaluator.util.spec.ts`, `filter.handler.spec.ts`, `transform.handler.spec.ts`
- 상세: 이전 리뷰(19_49_22 RESOLUTION.md W3)에서 `elapsed < 100ms` 등의 타이밍 단언이 CI 환경 불안정 위험으로 지적됐다. 현재 세 파일에서 `elapsed`, `Date.now()` 를 검색한 결과 해당 코드가 존재하지 않는다. RESOLUTION.md 기록대로 타이밍 단언이 제거되어 핵심 불변식(`r.regex === null`, 출력 값, `invalidRegexPatterns`)으로 회귀를 검증하고 있다. **해소됨.**

### [WARNING] `shouldTrustCfConnectingIp` 함수 — 직접 단위 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/modules/auth/utils/client-ip.ts` (shouldTrustCfConnectingIp 함수), `client-ip.spec.ts`
- 상세: `shouldTrustCfConnectingIp(env)` 는 `env` 파라미터를 주입받도록 설계된 순수 함수임에도, 현재 `client-ip.spec.ts` 에는 이 함수 자체에 대한 직접 단위 테스트가 없다. `extractClientIp` 테스트가 `process.env.TRUST_CF_CONNECTING_IP` 를 직접 조작하는 방식으로 간접 검증하고 있으나, 함수의 파싱 계약(어떤 값이 true/false 인지)을 독립적으로 고정하지 않는다. `hooks.service.ts`, `public-webhook-throttle.guard.ts` 두 곳도 `shouldTrustCfConnectingIp()` 를 인수 없이 호출한다. 비교를 위해 `isFlagOn`, `getRefreshCookieSameSite`, `isSwaggerEnabled` 는 모두 env 주입 순수함수 패턴으로 직접 단위 테스트를 갖추고 있어 일관성이 깨진다.
- 제안: `client-ip.spec.ts` 에 `describe('shouldTrustCfConnectingIp')` 블록을 추가하고 `'true'`/`'1'` → true, `''`/`'TRUE'`/`'yes'`/`'0'`/미설정 → false 케이스를 단위 테스트로 고정한다.

### [INFO] `auth.controller.spec.ts` — Origin 미지정(same-origin) 케이스 의도 미명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/modules/auth/auth.controller.spec.ts` (refresh describe 블록)
- 상세: CSRF 방어 로직(`isOriginAllowed`)은 Origin 헤더가 없으면 통과한다. 기존 `should refresh tokens when cookie contains valid token` 테스트 요청에 `origin` 헤더가 없으므로 이 경로를 사실상 커버하고 있다. 그러나 테스트 이름이 이를 명시하지 않아 "Origin 미지정 = same-origin/non-browser 통과" 계약이 즉각적으로 드러나지 않는다.
- 제안: 기존 테스트에 `// Origin 헤더 없음 — same-origin / non-browser 는 CSRF 가드 통과` 주석을 추가하거나 별도 케이스를 추가한다. 기능 결함은 아니다.

### [INFO] `websocket.gateway.spec.ts` — `notifications:` 채널의 userId 미설정 소켓 케이스 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
- 상세: 이전 리뷰(19_49_22 testing.md)에서 지적된 사항으로 여전히 미해소. 구현부에서 `const userId = enriched.userId ?? ''` → `!!userId && targetUserId === userId` 이므로 userId 가 미설정인 소켓이 `notifications:` 채널을 구독 시도하면 거부된다. 현재 테스트는 `userId = 'user-1'` 설정 후 올바른 userId / 다른 userId 두 케이스만 커버하며, userId 자체가 없는 소켓의 거부를 검증하지 않는다.
- 제안: userId 미설정 소켓이 `notifications:user-1` 을 구독 시도하면 `success: false` 를 반환하는 케이스를 추가한다.

### [INFO] `condition-evaluator.util.spec.ts` — 빈 문자열 패턴 동작 미명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/nodes/core/condition-evaluator.util.spec.ts` (compileUserRegex describe 블록)
- 상세: 이전 리뷰에서 지적된 사항으로 여전히 미해소. `compileUserRegex('')` 는 길이 0, RegExp 유효, safeRegex true 이므로 `{ regex: /(?:)/ }` 를 반환하지만 이 계약이 테스트로 고정되지 않았다.
- 제안: `it('accepts empty pattern (matches everything)')` 형태의 케이스를 추가한다.

### [INFO] `compileUserRegex` — `safeRegex()` 예외 경로 방어·테스트 미비
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/nodes/core/condition-evaluator.util.ts` (safeRegex 호출부)
- 상세: 이전 security 리뷰(19_49_22)에서도 동일하게 지적됐으나 미수정 상태. `safeRegex(source)` 호출이 try/catch 없이 실행된다. `regexp-tree` 내부 파싱 버그로 예외가 발생하면 filter 루프, transform 실행으로 uncaught exception 이 전파된다. 이 경로를 커버하는 테스트가 없다.
- 제안: `safeRegex(source)` 를 try/catch 로 감싸 예외 시 `{ regex: null, reason: 'unsafe' }` 반환하도록 방어적 처리를 추가하고, 이에 대응하는 테스트를 추가한다.

### [INFO] `refresh-cookie.spec.ts` — `clearRefreshTokenCookie` domain 옵션 케이스 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/modules/auth/utils/refresh-cookie.spec.ts`
- 상세: `clearRefreshTokenCookie` 테스트는 domain 없는 케이스만 존재한다. `setRefreshTokenCookie` 는 domain 있는/없는 두 케이스를 각각 검증하는 반면, `clearRefreshTokenCookie` 는 domain 있는 케이스가 없다. set/clear 가 동일 path + domain 으로 맞아야 쿠키가 정상 삭제되므로 domain 포함 clear 테스트 누락은 경로 매칭 회귀 탐지의 빈틈이다.
- 제안: domain 을 포함한 `clearRefreshTokenCookie` 케이스를 추가한다.

### [INFO] 환경변수 복원 패턴 불일치 — try/finally vs afterEach
- 위치: `sessions.controller.spec.ts`, `hooks.service.spec.ts` (try/finally 패턴), `client-ip.spec.ts` (afterEach 패턴)
- 상세: `TRUST_CF_CONNECTING_IP` 환경변수 복원 방식이 파일마다 다르다. `client-ip.spec.ts` 는 `afterEach` 훅으로 일관되게 복원하는 반면, `sessions.controller.spec.ts` 와 `hooks.service.spec.ts` 는 각 테스트의 try/finally 로 수동 복원한다. 기능상 결함은 없으나, 테스트 격리 일관성이 깨지고 향후 이 env 를 의존하는 테스트 추가 시 패턴 혼선을 야기한다.
- 제안: sessions/hooks spec 의 `TRUST_CF_CONNECTING_IP` 조작 테스트에도 `beforeEach`/`afterEach` 패턴을 적용하거나, describe 블록 레벨로 설정/복원 훅을 분리한다.

## 요약

이번 변경(refactor-04-security)은 테스트 관점에서 전반적으로 우수하다. 04 M-1(`isSwaggerEnabled`), 04 M-3(`compileUserRegex`/ReDoS), 04 M-5(쿠키 SameSite/CSRF), 04 M-6(WebSocket IDOR), 04 m-3(CF-IP 신뢰 opt-in), 04 m-1(HTML 화이트리스트) 각 항목에 대해 순수 함수 env-injection 패턴과 단위 테스트가 체계적으로 추가됐다. 이전 리뷰(19_49_22)에서 지적된 describe 블록 중복과 타이밍 단언 문제는 올바르게 해소됐다. 잔여 갭은 WARNING 1건(`shouldTrustCfConnectingIp` 직접 단위 테스트 부재 — 동일 모듈 내 유사 함수들과 일관성 불일치)과 INFO 6건(notifications userId 미설정 케이스, safeRegex 예외 경로, 빈 패턴 계약, clear 쿠키 domain 케이스, Origin 미지정 의도 명시, env 복원 패턴 일관성)이며, CRITICAL 수준 문제는 없다.

## 위험도

LOW
