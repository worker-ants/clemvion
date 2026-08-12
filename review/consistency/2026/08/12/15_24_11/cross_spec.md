# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 와 그 spec 테스트
파일 단 2개에 한정된다. 변경 내용은 `IdempotencyInterceptor` 의 Redis **런타임** 장애(연결은
살아있다가 `get()`/`set()` 이 reject)를 `catchError` 로 캐시 미스/warn 강등해 fail-open 시키는
버그 수정이다 (종전에는 생성자 시점 null 체크만 fail-open 이었고, 런타임 reject 는 그대로 500 으로
전파됨).

## 발견사항

교차 검토 결과 CRITICAL/WARNING 급 충돌 없음. 확인한 근거는 다음과 같다.

- **spec 표방 정책과의 일치**: `spec/data-flow/15-external-interaction.md` §4(외부 의존)는 이미
  "Redis … blacklist · idempotency · seq · BullMQ. **전 경로 fail-open (warn) — 가용성 우선**" 이라고
  명시해 왔다(이 문서 자체는 diff 대상이 아니라 기존 서술). `spec/5-system/14-external-interaction-api.md`
  §8.3(보안 trade-off), rate-limiter(§`InteractionRateLimiterService` fail-open 서술), terminal
  revoke(EIA-RL-06)도 동일하게 "Redis 미가용 시 fail-open" 을 모듈 전반의 원칙으로 반복 명시한다.
  diff 는 이 기존 spec 서술을 코드가 실제로 만족하도록 만드는 수정이라, spec 새 주장을 만들지 않고
  기존 SoT 를 따라간다 — 충돌 방향이 아니라 정합 방향.
- **에러 코드·응답 계약 불변**: `ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT' })` 발생 경로는
  유지되며(캐너리 테스트로 `catchError` 가 `switchMap` **앞**에 위치함을 고정), 이는
  `spec/5-system/3-error-handling.md` 의 `IDEMPOTENCY_KEY_CONFLICT → 409` 표와 정합한다. 새 필드·새
  응답 shape·새 endpoint 는 없음.
- **§R8(EIA)** — "`400 VALIDATION_ERROR` 만 캐시 제외, 그 외 캐시" 규칙은 diff 가 건드리는 GET/SET
  실패 경로와 직교(orthogonal)라 영향 없음.
- **RBAC·상태 전이·요구사항 ID**: 신규 권한 구조, 상태 머신 변경, 신규 요구사항 ID 부여 없음. 순수
  가용성 보강 버그 수정.
- (참고, diff 무관 사전 존재 사항) `spec/5-system/15-chat-channel.md` CCH-SE-02 는 chat-channel
  인터랙션이 "EIA Idempotency-Key 를 어댑터가 자동 발급" 한다고 서술하는데, target 문서(§1.2 "In-process
  trusted 경로")는 chat-channel inbound 가 HTTP `IdempotencyInterceptor` 를 거치지 않고 dispatch 를
  직접 호출한다고 명시한다. 이 관계 자체가 애매해 보일 수 있으나 **이번 diff 가 만들거나 건드린
  불일치가 아니며**, `IdempotencyInterceptor` 의 Redis fail-open 수정과 무관하다 — cross-spec 관점의
  참고용 각주로만 남긴다(별도 조사 대상이면 새 리뷰 티켓으로 분리 권장, 본 리뷰의 diff scope 밖).

## 요약

diff 는 `spec/data-flow/15-external-interaction.md` 와 `spec/5-system/14-external-interaction-api.md`
가 이미 선언한 "Redis 전 경로 fail-open — 가용성 우선" 원칙을 코드에 뒤늦게 정합시키는 좁은 범위의
버그 수정이며, 에러 코드·API 계약·데이터 모델·RBAC·상태 전이 어느 쪽도 변경하지 않는다. Cross-spec
관점에서 새로 발생한 모순은 없다.

## 위험도
NONE
