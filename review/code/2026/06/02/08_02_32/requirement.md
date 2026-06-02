# 요구사항(Requirement) 리뷰 결과

**대상**: Cafe24 install endpoint rate limiting 강화 (A-3 Layer 2 — 실패 페널티 lockout)
**검토 일시**: 2026-06-02

---

## 발견사항

### [CRITICAL] spec 본문에 `CAFE24_INSTALL_RATE_LIMITED` 에러 코드 미등재

- **위치**: `spec/2-navigation/4-integration.md` §9.2 API 표 (install 행) / 에러 코드 vocabulary 표 (line ~781, ~1001)
- **상세**: 코드는 `429 CAFE24_INSTALL_RATE_LIMITED` 를 반환하도록 구현되어 있다 (`third-party-oauth.controller.ts` 내 `res.status(429).json({ error: { code: 'CAFE24_INSTALL_RATE_LIMITED', ... } })`). 그러나 `spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표에는 `CAFE24_INSTALL_MISSING_PARAMS` / `CAFE24_INSTALL_INVALID_TOKEN` / `CAFE24_INSTALL_INVALID_HMAC` / `CAFE24_INSTALL_REPLAY` 만 존재하며 `CAFE24_INSTALL_RATE_LIMITED` 는 없다. `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "보안 추가 조치" 와 "관련 코드 상수" 테이블에도 Layer 2 실패 페널티 + `FAIL_THRESHOLD` / `FAIL_WINDOW_SEC` 상수 / `CAFE24_INSTALL_RATE_LIMITED` 에러 코드가 전혀 기재되어 있지 않다.
- **spec fidelity 판정**: plan step 4 "DOCUMENTATION — spec 갱신" 이 `[x]` 완료로 체크돼 있으나 실제 spec 파일을 확인한 결과 두 파일 모두 갱신되지 않았다. 코드-spec 비대칭이 굳어진 상태로 review 에 진입한 것이다. consistency-check (review/consistency/2026/06/02/00_56_06) 의 W1·W2 경고가 여전히 미해소된 채 구현이 완료되었다.
- **제안**: 구현이 결정한 정책(429 + `CAFE24_INSTALL_RATE_LIMITED`, `FAIL_THRESHOLD=10`, `FAIL_WINDOW_SEC=600`)을 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "보안 추가 조치" 와 "관련 코드 상수" 표, 그리고 `spec/2-navigation/4-integration.md` install 행·에러 코드 vocabulary 표에 반영해야 한다. spec 수정 주체는 `project-planner`.

---

### [WARNING] plan 체크리스트와 실제 spec 갱신 간 상태 불일치

- **위치**: `plan/in-progress/cafe24-install-ratelimit.md` step 4 (`[x]`)
- **상세**: plan step 4 가 완료(`[x]`)로 표기되어 있으나, `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/4-cafe24.md` §9.8 과 `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 에 Layer 2 관련 내용이 존재하지 않는다. 체크가 잘못 표시되었거나 spec 갱신이 적용되지 않은 상태다.
- **제안**: spec 갱신 미완료라면 step 4 체크를 되돌리고 spec 갱신 후 REVIEW WORKFLOW 재진입. spec 갱신이 별도 커밋으로 존재한다면 해당 커밋이 이 worktree에 포함되어 있는지 확인 필요.

---

### [WARNING] 상수 이름 불일치: 코드 vs. plan

- **위치**: `cafe24-install-rate-limit.service.ts` (line ~296-298) vs. `plan/in-progress/cafe24-install-ratelimit.md` §상수 테이블
- **상세**: plan "상수" 테이블은 `INSTALL_FAIL_THRESHOLD` / `INSTALL_FAIL_WINDOW_SEC` 로 명명하고 있으나, 실제 구현 코드는 `FAIL_THRESHOLD` / `FAIL_WINDOW_SEC` (클래스 정적 상수, `Cafe24InstallRateLimitService.FAIL_THRESHOLD` / `Cafe24InstallRateLimitService.FAIL_WINDOW_SEC`) 를 사용한다. 테스트 `constants` 블록도 `spec §9.8` 을 참조하며 10 / 600 을 검증한다. 값 자체는 일치하나 식별자 이름이 다르다. spec 이 갱신되면 plan 의 상수명과 코드의 상수명 중 어느 것이 SoT 가 되는지 불명확하다.
- **제안**: spec 갱신 시 코드의 `FAIL_THRESHOLD` / `FAIL_WINDOW_SEC` (class-scoped prefix 포함 시 `Cafe24InstallRateLimitService.FAIL_THRESHOLD`) 를 기준으로 spec "관련 코드 상수" 표를 작성하고, plan 의 서술을 코드 실제 식별자로 통일.

---

### [WARNING] `Cafe24InstallRateLimitService` 가 `IntegrationsModule` exports 에 미포함

- **위치**: `codebase/backend/src/modules/integrations/integrations.module.ts` (line ~669-673)
- **상세**: `Cafe24InstallRateLimitService` 는 `providers` 배열에는 등록되었으나 `exports` 배열에는 포함되지 않았다. 현재는 `ThirdPartyOAuthController` 가 동일 module 내에 있어 문제가 없다. 그러나 미래에 다른 module (예: Cafe24 refresh 담당 module 이나 별도 보안 module) 에서 이 서비스를 주입해야 할 경우 exports 누락으로 DI 실패가 발생한다.
- **제안**: 현재 소비자가 같은 module 내부에만 있으므로 BLOCKER 수준은 아니나, 다른 `exported` 서비스 (`Cafe24InstallNonceCache` 가 exports 에 없는 것도 동일 패턴) 와 비교해 의도적 결정이면 주석으로 명시 권장.

---

### [WARNING] isLockedOut threshold 조건: `>=` vs. `>` — 의도 명확화 필요

- **위치**: `cafe24-install-rate-limit.service.ts` line ~361-364, 테스트 line ~69-74
- **상세**: `count >= FAIL_THRESHOLD` (이 값 이상이면 lockout). 주석은 "window 내 허용 실패 횟수. 이 값 이상이면 lockout". 테스트는 "at threshold → true" 로 검증 (`FAIL_THRESHOLD` 정확히 10 번에 lockout). plan 은 "임계치 초과 시 차단" 이라고 표현하는데, "초과"(strictly greater than, `>`) 와 "이상"(at-or-above, `>=`) 은 의미가 다르다.
- **판정**: 코드와 테스트는 일관(`>=`). plan 문구만 "초과"로 다소 모호하게 기술. 기능 구현은 올바르나 spec 갱신 시 ">= 10" (10번째 실패에서 lockout) 임을 명시적으로 기재해야 한다.

---

### [INFO] `Cafe24InstallRateLimitService` exports 미포함 — `Cafe24InstallNonceCache` 와 동일한 패턴인지 확인 필요

- **위치**: `integrations.module.ts` exports 배열
- **상세**: `Cafe24InstallNonceCache` 도 `exports` 에 있다. 즉 nonce cache 는 외부 노출, fail-penalty 는 미노출. 아키텍처 의도가 명확하면 무관하나, 미래 멀티 모듈 환경에서의 확장성을 위해 exports 여부를 명시적으로 문서화하는 것이 권장된다.
- **제안**: INFO 수준. 현재 기능에는 영향 없음.

---

### [INFO] `recordFailure` 테스트 — Lua 스크립트 내 EXPIRE 조건 검증 없음

- **위치**: `cafe24-install-rate-limit.service.spec.ts` line ~99-124
- **상세**: `recordFailure` 테스트는 `eval` 에 `'INCR'` 문자열 포함 여부만 검증하고, Lua 스크립트의 핵심 보안 특성인 "최초 생성 시에만 EXPIRE 호출" (`if c == 1 then`) 은 별도로 검증하지 않는다. 해당 조건이 생략되면 매 실패마다 TTL 이 리셋되어 sliding window 로 동작하게 되는 잠재적 버그가 있다. 현재 구현은 올바르나, Lua 스크립트 자체의 `c == 1` 조건 여부를 검증하는 테스트가 없으면 미래 Lua 수정 시 회귀 탐지가 어렵다.
- **제안**: `expect.stringContaining('if c == 1')` 또는 `expect.stringContaining("if c == 1")` 을 추가해 fixed-window 의미가 보장됨을 코드 레벨에서 단언.

---

### [INFO] `req.ip` 의 undefined 처리 — 미인증 엔드포인트 실환경 보장 여부

- **위치**: `third-party-oauth.controller.ts` line ~921 (`const clientIp = req.ip`)
- **상세**: Express 의 `req.ip` 는 `trust proxy` 설정에 따라 `undefined` 가 될 수 있다. 코드는 `isLockedOut(clientIp)` 와 `recordFailure(clientIp)` 에 `undefined` 를 전달하는 경우를 서비스 내부에서 no-op / false 로 처리하므로 런타임 에러는 없다. 그러나 `req.ip` 가 `undefined` 이면 rate limiting 이 완전히 비활성화된다.
- **제안**: 프로덕션 환경의 `trust proxy` 설정이 정상이면 문제 없음. INFO 수준. 환경별 통합 테스트나 e2e 에서 `X-Forwarded-For` 헤더가 올바르게 해석되는지 검증 권장.

---

### [INFO] 테스트 "does NOT record failure on REPLAY" — REPLAY 에러 케이스의 recordFailure 미호출 확인 범위 제한

- **위치**: `third-party-oauth.controller.spec.ts` line ~819-828
- **상세**: REPLAY 케이스는 `oauthService.handleInstall` 을 mock reject 로 처리한다. 그러나 실제 `cafe24Install` 구현에서 `CAFE24_INSTALL_REPLAY` 는 파라미터 검증 후 `oauthService.handleInstall` 호출 전에 발생할 가능성도 있다. 테스트가 service 레이어에서 throw 되는 시나리오만 커버하므로 controller 내 사전 REPLAY 체크 경로가 있다면 그 경로 테스트가 누락될 수 있다.
- **제안**: 현재 구현 코드가 REPLAY 를 `handleInstall` 내에서만 던진다면 테스트 커버리지 충분. 그렇지 않다면 별도 케이스 추가 권장.

---

## 요약

A-3 Layer 2 (fail-penalty lockout) 의 핵심 기능 — `isLockedOut` 조회, `recordFailure` 원자적 INCR+EXPIRE, 429 차단, fail-open degradation, 모듈 등록 — 은 완전하게 구현되어 있다. 테스트 커버리지도 경계값(at-threshold, below, above), Redis 미설정, undefined IP, 에러 시나리오까지 망라한다. 그러나 **CRITICAL 발견이 1건** 존재한다: plan step 4 가 완료(`[x]`) 로 체크되어 있음에도 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 과 `spec/2-navigation/4-integration.md` 에 Layer 2 관련 내용(에러 코드 `CAFE24_INSTALL_RATE_LIMITED`, 상수 `FAIL_THRESHOLD=10`/`FAIL_WINDOW_SEC=600`, 429 차단 정책)이 전혀 반영되어 있지 않다. 구현이 spec 을 앞질러 굳어진 상태이므로, spec 갱신(`project-planner` 위임) 후 review 를 완결해야 한다.

---

## 위험도

**HIGH**

(기능 구현 자체는 올바르나, CRITICAL spec fidelity 갭 — 구현이 결정한 에러 코드·상수·정책이 spec 에 미기재 — 으로 인해 단일 진실 원칙이 이미 위반된 상태. spec 갱신 없이 merge 하면 코드-spec 비대칭이 영구화된다.)
