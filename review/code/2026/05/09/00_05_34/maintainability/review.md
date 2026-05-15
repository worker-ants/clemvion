## 발견사항

### [WARNING] `registerContinuationHandlers` 내 5개 핸들러의 반복 구조
- **위치**: `execution-engine.service.ts` — `registerContinuationHandlers()`
- **상세**: 5개 핸들러가 모두 동일한 패턴(`pendingContinuations.get` → `if (!pending) return` → `.delete` → `pending.resolve/reject`)을 반복한다. `button_click`과 `ai_message`에서는 `payload` 캐스팅도 중복된다. 패턴이 변경될 경우(예: 로깅 추가) 5곳을 모두 수정해야 한다.
- **제안**: `resolvePending(executionId, value)` / `rejectPending(executionId, error)` 내부 헬퍼를 추출하여 공통 흐름을 한 곳에서 관리한다.

---

### [WARNING] `'exec:recover:lock'` 매직 문자열
- **위치**: `execution-engine.service.ts:recoverStuckExecutions()`
- **상세**: `acquireLock('exec:recover:lock', ...)` 에서 락 키가 하드코딩되어 있다. `STUCK_RECOVERY_STALE_MS`, `RECOVERY_LOCK_TTL_SECONDS`는 상수로 잘 정의되어 있으나 락 키만 예외다.
- **제안**:
  ```typescript
  private static readonly RECOVERY_LOCK_KEY = 'exec:recover:lock';
  ```

---

### [WARNING] 테스트에서 `private` 메서드를 `unknown` 캐스팅으로 접근
- **위치**: `execution-engine.service.spec.ts` 전반
- **상세**: `registerContinuationHandlers`, `continuationBus`, `pendingContinuations`, `recoverStuckExecutions` 모두 `(service as unknown as { ... })` 패턴으로 접근한다. 메서드·필드명이 바뀌면 타입 오류 없이 런타임에서 조용히 실패한다.
- **제안**: 테스트 전용 접근이 필요한 핵심 메서드(`registerContinuationHandlers` 등)는 `@VisibleForTesting` 주석이나 `protected`로 가시성을 상향하고, `beforeEach`에서 명시적으로 호출 시그니처를 검증할 수 있도록 한다.

---

### [WARNING] `CHANNEL` 상수 비공유로 인한 암묵적 문자열 의존
- **위치**: `continuation-bus.service.spec.ts:145`
- **상세**: 서비스 내부의 `const CHANNEL = 'execution:continuation'`이 `private` 스코프에 있어 테스트가 `'execution:continuation'`을 직접 하드코딩한다. 채널명 변경 시 서비스는 정상이나 테스트가 조용히 오동작한다.
- **제안**: `CHANNEL`을 `export const CHANNEL = 'execution:continuation'`으로 공개하거나, 별도 상수 파일로 분리하여 서비스·테스트가 동일 소스를 참조하도록 한다.

---

### [WARNING] 테스트 픽스처 `FakeExec`에 삭제된 `executionPath` 필드 잔존
- **위치**: `executions.service.spec.ts:23, 36`
- **상세**: `FakeExec` 타입과 `baseFake` 기본값에 `executionPath: string[]`이 여전히 존재하지만, `Execution` 엔티티에서 이 컬럼은 V035 마이그레이션으로 제거되었다. 컴파일은 통과하지만 픽스처가 더 이상 실제 엔티티를 반영하지 않는다.
- **제안**: `FakeExec`에서 `executionPath` 제거, `baseFake`의 기본값도 삭제한다.

---

### [INFO] `acquireLock`이 `publisher` 연결을 비pub/sub 목적으로 사용
- **위치**: `continuation-bus.service.ts:acquireLock()`
- **상세**: `publisher`는 이름상 pub/sub 발행 전용처럼 보이지만, `SET NX` 분산 락 명령도 수행한다. 실제로 pub/sub 모드(subscriber)가 아닌 일반 연결이므로 기술적으로 문제는 없다. 그러나 `publisher`라는 이름이 오해를 유발할 수 있다.
- **제안**: 필드명을 `redisClient` (general-purpose)와 `subscriber`로 분리하거나, 현재 이름 유지 시 클래스 JSDoc에 "publisher 연결은 발행 + 일반 명령 겸용"임을 명시한다.

---

### [INFO] `on()` 핸들러 덮어쓰기가 무음(silent)
- **위치**: `continuation-bus.service.ts:on()`
- **상세**: 같은 타입으로 `on()`을 두 번 호출하면 마지막 핸들러만 유지되고 경고가 없다. JSDoc에 현재 사용 패턴(1회 등록)이 설명되어 있으나, 향후 다중 구독 필요 시 버그가 무음으로 발생할 수 있다.
- **제안**: 기존 핸들러를 덮어쓸 때 `this.logger.warn('Overwriting continuation handler for type: ...')` 로그를 추가한다.

---

### [INFO] 테스트의 모듈 레벨 `subscribers` Map은 병렬 실행 시 취약
- **위치**: `continuation-bus.service.spec.ts:14`
- **상세**: `const subscribers = new Map<...>()` 가 모듈 최상위에 선언되어 모든 테스트 인스턴스가 공유한다. `beforeEach`에서 `.clear()`하므로 현재 순차 실행 환경에서는 안전하지만, Jest worker 병렬화(`--runInBand` 미사용 시) 환경에서 플레이키 테스트가 될 수 있다.
- **제안**: `subscribers`를 `beforeEach` 내부로 이동하고, `FakeRedis` 생성자에 주입하는 방식으로 스코프를 격리한다.

---

### [INFO] `findById` 3~4회 순차 DB 쿼리
- **위치**: `executions.service.ts:findById()`
- **상세**: execution 조회 → nodeExecutions → executionNodeLog → (조건부) parentWorkflowNames 가 순차로 실행된다. 단건 조회이므로 성능 임계값에는 여유가 있으나, 쿼리 수 증가 추이를 주석으로 표시해두면 향후 최적화 시점 판단에 도움이 된다.
- **제안**: 현재 구조 유지, 다만 메서드 선두에 `// 3 sequential queries: execution + nodeExecutions + nodeLogs` 한 줄로 명시한다.

---

## 요약

전체 변경은 분산 환경 대응을 위한 명확한 설계 의도를 가지며, `execution_node_log` 분리, Continuation Bus, 분산 락 Recovery 모두 합리적인 방향이다. 코드 자체의 가독성과 구조는 양호하나, `registerContinuationHandlers`의 5중 반복 패턴과 `'exec:recover:lock'` 매직 문자열은 향후 수정 시 실수 가능 지점이다. 테스트에서 `private` 멤버를 `unknown` 캐스팅으로 접근하는 패턴과 `CHANNEL` 상수 비공유는 리팩터링 안전망을 약화시키며, 삭제된 `executionPath` 필드가 픽스처에 잔존하는 점은 코드베이스 진실성(truth) 측면에서 즉시 정리가 필요하다.

## 위험도

**LOW**