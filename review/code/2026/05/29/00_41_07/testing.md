# Testing Review — fix(external-interaction): terminal jti revoke hoist

대상 커밋: `840db52d`  
리뷰 파일:
- `codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts`
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.spec.ts`
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts`

---

## 발견사항

### [INFO] 테스트 존재 여부 — 신설·추가 모두 충족

- 위치: `notification-fanout.service.spec.ts` (신규 파일), `interaction.guard.spec.ts` (추가 케이스)
- 상세: 이번 커밋 이전 `NotificationFanout`에 대한 단위 테스트가 0건이었으나, 신규 파일 1개와 8개 케이스로 핵심 revoke 경로 전체를 커버한다. `InteractionGuard`에는 `blacklisted` reason → `TOKEN_REVOKED` 매핑을 검증하는 케이스 1건이 추가되었다. 커밋 메시지가 명시한 "fanout terminal → revokeAll → Redis blacklist → verify → guard 401 전 구간이 결정적 단위 테스트로 커버" 서술은 테스트 구성과 부합한다.
- 제안: 현재 수준으로 충분. 추가 조치 불필요.

---

### [INFO] private 메서드 직접 호출 (`invoke` 헬퍼) — 의도적 설계

- 위치: `notification-fanout.service.spec.ts` L439-446
- 상세: `invoke()` 함수가 `as unknown as { handle: ... }` 캐스팅으로 private `handle()`을 직접 호출한다. 코드에 명시된 주석("subscription 의 fire-and-forget 우회")처럼 RxJS 구독 경로를 거치면 비동기 타이밍이 불결정적이 되므로, 이 접근은 테스트 결정성을 위한 합리적인 선택이다. 다만 `handle`의 메서드 시그니처 변경 시 컴파일 오류가 아닌 런타임 오류로만 드러난다는 약점이 있다.
- 제안: 현재 트레이드오프는 수용 가능하다. `NotificationFanout`에 `protected handle()`로 접근성을 올리거나 테스트용 인터페이스를 별도 노출하는 방식도 있으나, 프로덕션 코드 변경이 수반되므로 의무 사항은 아니다.

---

### [WARNING] `onModuleInit` / `onModuleDestroy` 라이프사이클 경로 미커버

- 위치: `notification-fanout.service.spec.ts` — `makeFanout` 팩토리 참고
- 상세: `makeFanout`이 `NotificationFanout`을 직접 `new`로 생성하므로 `onModuleInit`은 호출되지 않는다. 따라서 실제 구독 설정(`websocketService.executionEvents$.subscribe`) 경로와 `onModuleDestroy`의 `unsubscribe` 경로는 현재 테스트 범위 밖이다. 특히 `onModuleInit`의 `next: void this.handle(event)` 구독 콜백은 fire-and-forget 오류가 `error` 핸들러를 통해 올라오지 않기 때문에, 구독 연결 자체에 버그가 생겨도 현재 테스트로는 탐지되지 않는다.
- 제안: 최소한 `onModuleInit` 호출 시 `subscribe`가 정확히 1회 호출되는지, `onModuleDestroy` 호출 시 `unsubscribe`가 호출되는지를 확인하는 케이스 2개를 추가한다.

---

### [WARNING] `non-terminal` 케이스 — triggerId 유·무 경우 중 하나 누락

- 위치: `notification-fanout.service.spec.ts` L500-513 (`non-terminal event (waiting_for_input) → revoke 미호출`)
- 상세: 해당 케이스는 `triggerId`가 있는 non-terminal 이벤트만 검증한다. `triggerId`가 없는 non-terminal 이벤트에 대한 별도 케이스는 `triggerId 없는 manual 실행 terminal` 케이스(L516)에서 terminal 이벤트로만 검증되므로, non-terminal + triggerId 없음 조합은 명시적으로 검증되지 않는다. 실제로는 `!FANOUT_EVENTS.has(event.eventType)`에서 early return 하거나 triggerId 체크에서 skip 되겠지만, 서비스 코드를 보면 `execution.waiting_for_input`은 `FANOUT_EVENTS`에 포함되어 있어 triggerId 없는 경우 `debug` 로그 후 return 하는 경로를 타게 된다. 이 경로는 테스트로 명시적 확인이 없다.
- 제안: `event('execution.waiting_for_input', {})` — triggerId 없는 non-terminal — 케이스를 추가해 revoke와 enqueue 모두 미호출 확인.

---

### [WARNING] `fail-open` 케이스 — revoke throw 시 enqueue 미구독 트리거 경우 미커버

- 위치: `notification-fanout.service.spec.ts` L523-541 (`revokeAllForExecution throw 해도 fail-open`)
- 상세: 이 케이스는 revoke throw + notification 구독 트리거 조합만 검증한다. `revoke throw + notification 미설정 트리거` 조합(interaction-only 트리거에서 Redis down)은 별도 케이스로 검증되지 않는다. 실제 서비스 코드에서는 try-catch 이후 trigger 조회로 계속 진행되므로 동작 자체는 올바르나, 이 경로에 대한 명시적 테스트 커버리지가 없다.
- 제안: `revokeAllForExecution throw + notification 미설정 트리거` 케이스를 추가해 throw 후에도 정상 return 됨(enqueue 미호출)을 확인.

---

### [INFO] `InteractionGuard` — `iext_revoked` 토큰 픽스처 명명

- 위치: `interaction.guard.spec.ts` L63, 211
- 상세: 신규 케이스에서 토큰 값을 `'Bearer iext_revoked'`로 설정했다. `verifyPerExecution`이 mock으로 주입되므로 실제 토큰 검증은 수행되지 않는다. 토큰 값은 `'iext_revoked'`와 같이 의미를 가진 문자열이면 충분하며, 픽스처 일관성 측면에서 기존 케이스의 `iext_xxx` 패턴과 약간 다르지만 가독성에는 영향 없다.
- 제안: 문제 없음. 현재 명명이 의도를 명확히 전달한다.

---

### [INFO] `ctx.setHeader` 어서션 — 기존 `expired` 케이스와 `blacklisted` 케이스 동일 패턴 확인

- 위치: `interaction.guard.spec.ts` L151-167 vs L203-221
- 상세: `refresh-token URL 헤더가 401 응답에 첨부` 케이스(reason=expired)와 신규 `blacklisted` 케이스 양쪽에서 `REFRESH_TOKEN_URL_HEADER` 헤더 첨부를 확인한다. `InteractionGuard.deny`가 모든 인증 실패에 동일한 헤더를 추가함을 두 케이스가 교차 검증한다.
- 제안: 현재 수준으로 충분.

---

### [INFO] `InteractionGuard` — `audience_mismatch` reason 매핑 케이스 누락

- 위치: `interaction.guard.spec.ts` — 전체 파일
- 상세: `mapReason`이 처리하는 `'expired'`, `'scope_mismatch'`, `'blacklisted'`에 대한 테스트는 있으나 `'audience_mismatch'` → `TOKEN_AUDIENCE_MISMATCH` 매핑을 검증하는 케이스가 없다. 기존 버그가 아닌 누락된 커버리지다.
- 제안: `reason: 'audience_mismatch'`를 반환하는 mock을 가진 케이스를 추가해 `TOKEN_AUDIENCE_MISMATCH` 코드 매핑 확인. 이번 PR 범위 외이므로 후속 작업으로 처리 가능하다.

---

### [INFO] 테스트 격리 — 각 케이스가 독립적인 팩토리 호출로 구성

- 위치: 두 spec 파일 모두
- 상세: `makeFanout`과 `makeGuard` 팩토리가 케이스마다 호출되어 의존성이 공유되지 않는다. `beforeEach`/`afterEach`가 없어도 상태 누출 위험 없음. 테스트 격리 양호.
- 제안: 현재 수준으로 충분.

---

### [INFO] 테스트 가독성 — 케이스 명칭이 인과 구조를 명확히 표현

- 위치: `notification-fanout.service.spec.ts` 전체 케이스
- 상세: `terminal + notification 미설정 트리거 → revokeAllForExecution 호출 (enqueue 는 skip)` 형식으로 전제조건 → 기대결과 패턴을 일관되게 사용한다. spec 조항(`[EIA-AU-04]`) 참조도 포함되어 있어 회귀 시 근거 추적이 용이하다.
- 제안: 현재 수준으로 충분.

---

## 요약

이번 변경은 EIA-AU-04 버그(notification config 게이트 뒤 revoke)를 수정하면서, 기존 0건이던 `NotificationFanout` 단위 테스트를 8케이스로 신설하고 `InteractionGuard`에 `blacklisted` 매핑 케이스를 추가했다. 핵심 시나리오(terminal × notification 유무 × trigger 발견 × fail-open)는 결정적으로 커버되며, 테스트 격리·가독성·spec 참조도 양호하다. 다만 `onModuleInit`/`onModuleDestroy` 구독 라이프사이클이 테스트 범위 밖이고, non-terminal + triggerId 없음 조합과 revoke throw + notification 미설정 조합이 명시적으로 검증되지 않는 소규모 커버리지 갭이 존재한다. 또한 `audience_mismatch` reason 매핑 케이스가 기존부터 누락된 상태로, 이번 PR과 연계하여 후속 처리를 권장한다. 전반적으로 구현 변경의 위험도를 적절히 낮추는 테스트 수준이다.

## 위험도

LOW
