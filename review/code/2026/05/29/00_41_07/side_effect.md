# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상 커밋

`840db52d` — fix(external-interaction): terminal jti revoke 를 notification config 게이트 위로 hoist

---

## 발견사항

### 1. notification-fanout.service.ts — revoke 호출 위치 변경으로 인한 실행 순서 부작용

- **[INFO]** `revokeAllForExecution` 호출이 `triggerRepository.findOne` 보다 앞으로 이동
  - 위치: `/codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` 라인 96–104
  - 상세: 이전 코드는 `dispatcher.enqueue` 완료 후 revoke를 수행했다. 변경 후에는 trigger DB 조회보다 먼저 revoke가 수행된다. 이로써 trigger 조회·notification 게이트와 완전히 독립되는 것이 의도이며, 이는 EIA-AU-04 요구사항의 핵심이다. 의도된 순서 변경이므로 부작용이 아니라 버그 수정이다.
  - 제안: 해당 없음 (의도된 변경).

### 2. notification-fanout.service.ts — triggerId 없는 manual 실행에서 revoke 미호출

- **[INFO]** `triggerId` 문자열 검사 early return 이 revoke 블록보다 앞에 위치
  - 위치: 라인 82–91 (triggerId early return), 라인 96–104 (revoke 블록)
  - 상세: `triggerId`가 없는 manual 실행(수동 실행)은 revoke 블록에 도달하지 않는다. 코드상 주석("수동 실행은 triggerId 없음")과 테스트 케이스("triggerId 없는 manual 실행 terminal → revoke 미호출")가 이 동작을 명시적으로 검증한다. 수동 실행은 iext 토큰 발급 경로가 아니므로 무효화 대상이 아니다.
  - 제안: 해당 없음 (의도된 동작, 테스트로 커버됨).

### 3. notification-fanout.service.ts — revokeAllForExecution fail-open 패턴의 보안 함의

- **[WARNING]** Redis 장애 시 revoke가 무음으로 실패하고 토큰이 계속 유효한 상태로 남을 수 있음
  - 위치: 라인 96–104 (`catch` 블록, `logger.warn` 후 진행)
  - 상세: 이 패턴은 이전 코드에서도 동일하게 존재했으므로 본 커밋이 새로 도입한 부작용은 아니다. 그러나 revoke 블록이 notification 게이트 앞으로 이동함으로써 이 fail-open 경로의 노출 빈도가 증가한다. 이전 코드는 notification 구독이 있는 execution만 revoke를 시도했으나, 변경 후에는 모든 terminal + triggerId 있는 execution이 revoke를 시도하게 된다. 실패 시 warn 로그만 남고 실행이 계속되므로, Redis 장애 중에는 토큰 무효화 없이 notification도 계속 전송된다.
  - 제안: EIA-AU-04가 필수 요건이라면 fail-open 대신 fail-closed(revoke 실패 시 execution 상태를 격리 큐에 등록 후 재시도)를 고려할 수 있다. 현재 설계가 의도적 트레이드오프라면 spec에 명시하는 것을 권장한다.

### 4. interaction.guard.spec.ts — `setHeader` 호출 경로 검증

- **[INFO]** 신규 테스트 케이스가 `ctx.setHeader`를 `res.setHeader`가 아닌 컨텍스트 루트 mock으로 검증
  - 위치: `/codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts` 라인 70–73 (신규 케이스), 라인 164–167 (기존 케이스)
  - 상세: `makeContext` 헬퍼는 `req.res.setHeader`와 `ctx.setHeader`를 동일한 mock 함수로 공유하므로(`const setHeader = jest.fn()`) 검증이 올바르다. 실제 가드는 `req.res.setHeader`를 호출하고, 테스트는 같은 참조인 `ctx.setHeader`로 검증한다. 기존 테스트와 동일한 패턴이며 의도치 않은 부작용 없음.
  - 제안: 해당 없음.

### 5. notification-fanout.service.spec.ts — private `handle()` 직접 접근

- **[INFO]** 테스트가 `as unknown as` 캐스팅으로 private 메서드를 직접 호출
  - 위치: `/codebase/backend/src/modules/external-interaction/notification-fanout.service.spec.ts` 라인 439–446 (`invoke` 헬퍼)
  - 상세: 테스트 파일이므로 프로덕션 코드의 부작용은 없다. 다만 `handle`의 시그니처가 변경되면 테스트가 런타임 에러 없이 잘못된 인자로 호출될 수 있다 (TypeScript 컴파일러가 `never` 캐스팅으로 우회되므로). 단위 테스트의 구조적 취약점이지 부작용은 아니다.
  - 제안: 해당 없음 (테스트 전용 코드, 프로덕션 영향 없음).

### 6. 전역 변수·환경 변수·네트워크 호출·파일시스템

- **[INFO]** 해당 없음
  - 세 파일 모두 전역 변수 수정 없음. 두 `Set` 상수(`TERMINAL_EVENTS`, `FANOUT_EVENTS`)는 모듈 스코프 읽기 전용이며 변경 전후 동일하다. 환경 변수 읽기·쓰기 없음. 파일시스템 접근 없음. 직접적인 외부 네트워크 호출 없음 (Redis 접근은 `tokenService`를 통해 간접적으로만 발생하며 이는 설계 의도).

### 7. 이벤트/콜백 — subscription 패턴

- **[INFO]** `onModuleInit`의 `void this.handle(event)` 패턴은 변경 없음
  - 위치: 라인 59–68
  - 상세: `handle`의 내부 실행 순서가 바뀌었지만 subscription 구조(fire-and-forget, `void` discarding) 자체는 동일하다. revoke 실패 시 `catch`가 있으므로 unhandled rejection이 subscription 에러 핸들러로 전파되지 않는다.
  - 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 `revokeAllForExecution` 호출 위치를 notification 게이트 뒤에서 앞으로 이동한 것으로, 의도된 버그 수정(EIA-AU-04 준수)이다. 의도치 않은 상태 변경, 전역 변수, 파일시스템, 환경 변수, 시그니처·인터페이스 변경은 발견되지 않았다. 주목할 점은 fail-open revoke 패턴의 노출 범위가 확대된다는 것인데, 이는 이전 코드에도 존재하던 패턴이며 의도적 트레이드오프로 보인다. Redis 장애 시나리오에서 토큰이 무효화되지 않을 수 있다는 보안 함의를 spec에 명시하거나 재시도 메커니즘을 보강하면 더 견고해진다.

---

## 위험도

LOW
