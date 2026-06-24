# 테스트(Testing) 리뷰

## 발견사항

### 1. 테스트 존재 여부 / 회귀 테스트

- **[INFO]** 변경의 핵심 동작(early-return 제거 → shutdown 중 등록 허용)에 대응하는 테스트가 교체 형태로 존재하며, 구 동작을 검증하던 '멱등' 테스트는 삭제되고 새 시나리오 테스트로 대체됨.
  - 위치: `shutdown-state.service.spec.ts` 134~89행 (diff hunk)
  - 상세: 기존 테스트가 "shutdown 중 register는 noop" 이었으므로, 변경 후 그 테스트가 존재하면 새 구현과 충돌해 오히려 혼란이 된다. 교체 방식은 적절함.
  - 제안: 없음 — 교체 자체는 올바른 방향.

### 2. 커버리지 갭

- **[WARNING]** `ne-late`가 grace 만료 후 마킹 대상에 포함되는지를 검증하지만, `ne-late`를 shutdown *이후* 즉시 unregister 했을 때(정상 완료 경로) grace 내 drain이 되는지를 커버하는 테스트가 없음.
  - 위치: `shutdown-state.service.spec.ts` 233~256행 (신규 테스트)
  - 상세: M-2 변경으로 shutdown 중 등록된 노드는 drain 대상이 되어야 한다. "등록 후 grace 내 완료 → unregister → 마킹 안 됨" 경로가 기존 drain 테스트(`graceMs 안에 in-flight 가 drain 되면 UPDATE 호출 없이 종료`, 190행)는 pre-shutdown 등록 케이스만 커버하고, post-shutdown 등록 + drain 완료 케이스는 미커버.
  - 제안: `service.registerInFlight('ne-late', 'exec-1')` 후 `setTimeout(() => service.unregisterInFlight('ne-late'), 20)` 패턴으로 post-shutdown 등록 + drain 성공 시 UPDATE 미호출을 검증하는 테스트 추가.

- **[INFO]** `unregisterInFlight`를 shutdown 중 호출할 때 Map에서 정상 삭제되는지를 확인하는 독립 테스트가 없음(전체 흐름 통합 테스트에 내재됨).
  - 위치: `isShuttingDown / inFlight registry` describe 블록
  - 상세: 현재 `unregisterInFlight` 단위 테스트는 `isShuttingDown`이 false인 상태에서만 수행됨. shutdown 중 unregister 호출은 구현 상 막힘 없이 동작하지만 명시적 단위 확인이 없음.
  - 제안: `isShuttingDown / inFlight registry` describe 내에 shutdown flag 설정 후 unregister 테스트 한 케이스 추가(LOW 우선순위).

### 3. 엣지 케이스 테스트

- **[WARNING]** 동일한 `nodeExecutionId`를 shutdown 전 등록 후 shutdown 중 *재등록*하는 케이스가 없음.
  - 위치: 신규 테스트 전반
  - 상세: `inFlightNodeExecutions`가 Map이므로 동일 key 재등록 시 덮어쓰기가 발생한다. 실제 코드 흐름상 같은 nodeExecutionId가 두 번 등록되는 경우는 없겠지만, early-return 제거 후 이 경계가 명시적으로 검증되지 않아 Map 시맨틱에 의존하는 암묵적 신뢰가 남음.
  - 제안: 중복 등록 시 `inFlightCount`가 2가 아닌 1임을 단언하는 테스트 한 케이스 추가. (INFO 급으로도 수용 가능)

- **[INFO]** `ne-late`를 등록한 직후 grace가 만료되도록 타이밍을 설계했지만(graceMs=50, pollMs=10), 실제로 promise 생성 → 동기 코드 실행 → pollMs 사이클 사이의 타이밍 의존성이 존재함. 이는 기존 테스트 전반의 설계 패턴이므로 신규 도입 문제는 아니나 플랫폼 부하 시 간헐적 실패 가능성이 있음.
  - 위치: 233행 `service = buildService(50, 10)`
  - 상세: `onApplicationShutdown` await 전 동기 코드에서 `ne-late`를 등록하므로 실제 타이밍은 안전하지만, graceMs를 더 크게 잡아 flakiness 위험을 명확히 제거하는 편이 견고함.
  - 제안: graceMs를 150ms, pollMs를 10ms 등으로 여유를 주거나, 테스트 주석에 타이밍 설계 의도를 명시.

### 4. Mock 적절성

- **[WARNING]** WHERE 절 검증 방식이 mock chain의 내부 구조를 직접 탐색하는 방식으로 구현되어 있어, `markRemainingAsInterrupted` 내 QueryBuilder 호출 순서가 바뀌면 테스트가 조용히 깨짐.
  - 위치: `shutdown-state.service.spec.ts` 248~255행 및 268~276행
  - 상세: `(neChain.update.mock.results[0].value as { set: jest.Mock }).set.mock.results[0].value as { where: jest.Mock }` 형태로 mock chain을 depth-3 이상 순회한다. 이 패턴은 구현 상세(`.update().set().where()` 체인 순서)에 커플링되어, 리팩터링 시 구현이 동등해도 테스트가 실패할 수 있음. 또한 중간 단계 타입 캐스트가 모두 `as`라서 런타임 undefined가 나와도 에러 메시지가 불명확함.
  - 제안: `markRemainingAsInterrupted`를 private에서 `protected`/`@VisibleForTesting` 수준으로 분리하거나, 별도 spy 주입 패턴을 사용하거나, 최소한 중간 값 null 체크(`expect(whereCall).toBeDefined()`)를 추가해 실패 위치를 조기에 명확화.

- **[INFO]** `createQueryBuilder`가 `mockReturnValue` (단순 동기 반환)로 설정되어 있어 실제 TypeORM QueryBuilder의 비동기 흐름·트랜잭션 컨텍스트를 모사하지 않음. 이는 의도적인 단위 테스트 접근이므로 문제는 아니나, integration 계층에서 실제 DB와의 동작 검증이 없으면 WHERE IN 문법(`:...ids` 스프레드) 동작이 검증 안 됨.
  - 위치: `beforeEach` buildChain (119~140행)
  - 제안: integration 테스트 또는 e2e에서 TypeORM QueryBuilder의 실제 IN 절 생성 여부 검증 추가(현재 범위 밖이지만 커버리지 갭으로 기록).

### 5. 테스트 격리

- **[INFO]** `beforeEach`에서 mock을 매번 재생성하므로 격리는 충분함. `service` 변수가 describe 외부 let으로 선언되고 각 테스트에서 buildService로 재초기화되는 패턴도 적절함.
  - 제안: 없음.

### 6. 테스트 가독성

- **[INFO]** 신규 테스트 제목이 `'shutdown 중(세그먼트 완료 진행 중) register 된 노드도 추적되어 grace 만료 시 마킹된다 (M-2 — §11.4 보존)'`으로 변경 의도와 spec 참조를 명확히 포함해 가독성이 우수함.
  - 위치: 233행
  - 상세: spec 섹션 번호와 의도가 테스트 제목에 담겨 있어, 회귀 실패 시 컨텍스트를 즉시 파악할 수 있음.

- **[WARNING]** WHERE 절 검증 블록(248~255행)의 변수명이 `neChain`, `whereCall`, `whereArgs`로 적절하지 않게 중첩되어, `whereCall`이 실제로는 `{ where: jest.Mock }` 객체이고 `whereArgs`가 where의 첫 번째 call 인자 배열을 JSON화한 것임을 이름만으로는 알기 어려움.
  - 위치: 248~255행, 269~276행 (동일 패턴 두 곳)
  - 제안: 변수명을 `whereMethodContainer`, `whereCallArgs` 등으로 의미를 좀 더 명확히 하거나, 인라인 주석으로 각 단계가 무엇을 참조하는지 1줄씩 설명 추가.

### 7. 회귀 테스트

- **[INFO]** 구 '멱등' 테스트가 삭제되면서 "shutdown 중 register를 호출해도 Map 사이즈가 0" 단언이 사라짐. 구현이 early-return 제거 방향이므로 이 단언은 의도적으로 제거된 것이나, 향후 누군가 early-return을 재도입할 경우 new test가 그것을 잡아주는지 확인 필요.
  - 위치: diff 60~73행 (삭제된 old test)
  - 상세: 신규 테스트에서 `expect(service.inFlightCount).toBe(2)` (76행)가 early-return 재도입 시 실패하므로 회귀 가드로 충분함.
  - 제안: 없음 — 회귀 커버리지 충족됨.

### 8. 테스트 용이성

- **[INFO]** `ShutdownStateService`가 `@Optional()` 인젝터로 graceMs/pollMs를 받아 `buildService(ms, pollMs)` 직접 생성을 허용하는 구조는 테스트 용이성 측면에서 우수함. DI 컨테이너 없이 단위 테스트가 가능하고 타이밍 제어도 pollMs 주입으로 해결됨.
  - 제안: 없음.

---

## 요약

이번 변경은 `registerInFlight`의 early-return 제거라는 단순 1줄 수정이지만, 테스트 측면에서 대응 테스트를 정확히 교체했고 spec 섹션 참조와 의도가 테스트 명칭에 명확히 담겨 있다. 주요 리스크는 두 가지다. 첫째, WHERE 절 검증을 mock chain depth-3 순회로 구현해 구현 상세에 강하게 커플링되어 있으며 중간 단계 undefined 시 에러 위치가 불명확하다 (WARNING). 둘째, shutdown 후 등록된 노드가 grace 내 정상 완료(unregister)되는 경로가 테스트되지 않아 post-shutdown 등록 노드의 정상 종료 케이스 커버리지 갭이 존재한다 (WARNING). 나머지는 INFO 수준으로, 기존 테스트의 타이밍 의존 패턴 답습과 mock 가독성 개선 여지다. 전체적으로 변경 핵심 동작은 테스트로 충분히 검증되고 있으며 회귀 가드도 작동한다.

## 위험도

LOW
