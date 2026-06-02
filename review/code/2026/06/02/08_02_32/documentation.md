# 문서화(Documentation) 리뷰 결과

## 발견사항

### [WARNING] spec §10.3 에러 코드 목록에 CAFE24_INSTALL_RATE_LIMITED 미등록
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 780–784 (에러 코드 목록)
- 상세: 구현 코드(`third-party-oauth.controller.ts`)와 Swagger 어노테이션(`@ApiTooManyRequestsResponse`)에서 `CAFE24_INSTALL_RATE_LIMITED (429)` 에러 코드가 명시되어 있으나, spec `§10.3` 에러 코드 목록에 해당 항목이 빠져 있다. plan 체크리스트 step 4(DOCUMENTATION)가 `[x]` 완료로 표시되어 있으나 실제 spec 파일은 갱신되지 않은 상태다. consistency-check W2 경고에서도 이를 지적했다.
- 제안: `spec/2-navigation/4-integration.md` 에러 코드 목록(라인 783 다음)에 다음 항목 추가:
  `CAFE24_INSTALL_RATE_LIMITED (429) — 같은 IP 의 install_token 조회/HMAC 검증 실패가 임계치(10회/600초) 초과 시 lockout. 성공 install 은 카운트하지 않음 (token oracle enumeration 방어 Layer 2).`

---

### [WARNING] spec §9.8 "보안 추가 조치" 에 Layer 2 실패 페널티 미기재
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/4-cafe24.md` 라인 539–556 (§9.8 보안 추가 조치 + 관련 코드 상수 테이블)
- 상세: §9.8 "보안 추가 조치" 섹션에 nonce cache와 기존 Layer 1 throttle(`@Throttle({ limit: 30, ttl: 60_000 })`)에 대한 기술은 있으나, 이번에 추가된 **Layer 2 실패 페널티**(IP별 실패 카운터, `FAIL_THRESHOLD=10`, `FAIL_WINDOW_SEC=600`, `cafe24:install:fail:{ip}` 키, fail-open degradation 정책)가 전혀 기재되어 있지 않다. "관련 코드 상수" 테이블에도 두 신규 상수(`FAIL_THRESHOLD`, `FAIL_WINDOW_SEC`)가 없다. plan step 4가 완료로 표시되어 있으나 미반영이다. consistency-check W1, W3이 이를 사전에 지적했다.
- 제안:
  1. §9.8 "보안 추가 조치" 항목에 Layer 2 실패 페널티 단락 추가 — key 형식, 임계치, fixed window TTL, 차단 코드(429 CAFE24_INSTALL_RATE_LIMITED), fail-open 정책 기술
  2. "관련 코드 상수" 테이블에 `FAIL_THRESHOLD` / `FAIL_WINDOW_SEC` 행 추가
  3. Rationale에 "성공 install 카운트 제외" 정책 근거 및 Layer 1(in-memory throttle)과 Layer 2(Redis fail-penalty)의 degradation 차이 근거 명시

---

### [INFO] `buildKey` private 메서드에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` — `buildKey` 메서드
- 상세: 클래스 레벨 독스트링에서 key 형식(`cafe24:install:fail:{ip}`)을 설명하고 있으므로 치명적이지 않으나, private 메서드에도 key 충돌 방지 근거(세 번째 세그먼트 분리)를 한 줄 주석으로 달면 nonce key와의 관계를 직접 이해할 수 있다.
- 제안: 현재 클래스 독스트링의 key 형식 설명으로 충분하므로 필수는 아님. 선택적 개선.

---

### [INFO] 테스트 파일 상단에 파일 목적 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.spec.ts` 라인 1
- 상세: 테스트 파일은 `describe` 블록 이름과 각 `it` 설명이 충분히 자기 문서화되어 있어 별도 파일 헤더 주석 없이도 읽기 쉽다. 다만 spec 참조(`§9.8`) 가 `constants` describe 블록에만 있고 다른 블록에는 없어 일관성이 약간 부족하다.
- 제안: 옵션. 파일 상단에 `// Unit tests for Cafe24InstallRateLimitService — spec §9.8 Layer 2 fail-penalty.` 한 줄 추가.

---

### [INFO] `Cafe24InstallRateLimitService`가 module exports에 없음 — 타 모듈 사용 제약
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/integrations.module.ts` 라인 668–672 (`exports` 배열)
- 상세: `Cafe24InstallRateLimitService`가 `providers`에 등록되었으나 `exports` 배열에는 포함되지 않았다. 현재는 `ThirdPartyOAuthController`가 동일 모듈 내에서 사용하므로 문제없으나, 향후 다른 모듈에서 이 서비스를 활용하려면 export가 필요하다. 의도적 미export라면 주석으로 이유를 명시하면 좋다.
- 제안: 현재 설계상 문제 없음. 필요 시 exports 배열에 추가하거나, 현재 범위가 통합 모듈 내부 전용임을 모듈 주석에 명시.

---

## 요약

전체적으로 코드 레벨 문서화 품질은 우수하다. `Cafe24InstallRateLimitService` 클래스 독스트링은 구현 배경·fail-open 정책·Lua 스크립트 선택 이유를 상세히 설명하고, 공개 메서드 각각에 `@returns` 및 동작 보장이 기술되어 있다. 컨트롤러 메서드 JSDoc과 `@ApiTooManyRequestsResponse` Swagger 어노테이션도 추가되어 API 계층 문서화는 완결적이다. 그러나 **spec 문서 갱신이 누락**된 것이 핵심 문제다. plan step 4(DOCUMENTATION)가 완료로 표시되어 있음에도 불구하고 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 와 `spec/2-navigation/4-integration.md §10.3` 에 Layer 2 실패 페널티, 신규 상수, `CAFE24_INSTALL_RATE_LIMITED` 에러 코드가 반영되지 않아 코드-spec 비대칭이 존재한다. 이 두 spec 파일 업데이트가 완료되어야 문서화 관점의 완결성이 확보된다.

## 위험도

MEDIUM
