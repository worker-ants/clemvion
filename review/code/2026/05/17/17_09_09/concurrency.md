### 발견사항

- **[INFO]** `executeSync` timeout TOCTOU race window 가 코드 주석에도 명시되어 있음
  - 위치: `execution-engine.service.ts` `executeSync` 메서드, 주석 "WARN #13"
  - 상세: `Promise.race([runExecution, timeoutPromise])` 에서 timeout 분기로 reject 된 후, 백그라운드에서 여전히 진행 중인 `runExecution`이 나중에 `COMPLETED`로 마킹할 수 있다. catch 블록에서 `findOneBy`로 reload 후 상태를 확인하지만, reload 직후 백그라운드 runExecution이 동시에 상태를 바꾸는 race window가 잔존한다. 주석에서 "완전 차단 X"로 명시하고 있으며, AbortSignal 기반 해결책은 별도 PR로 분리된 상태이다.
  - 제안: 현재 구조에서는 허용된 trade-off이나, 향후 AbortSignal 주입 + 워커 협력 방식으로 완전한 취소를 구현하면 race window를 제거할 수 있다. 단기적으로는 timeout 후 FAILED 마킹 시 낙관적 잠금(version 컬럼) 또는 조건부 UPDATE(`WHERE status = RUNNING`)를 사용하면 TOCTOU를 줄일 수 있다.

- **[INFO]** `pendingContinuations` Map의 단일 인스턴스 한정 스레드 안전성
  - 위치: `execution-engine.service.ts`, `pendingContinuations` 필드 및 `resolvePending`/`rejectPending` 메서드
  - 상세: `pendingContinuations`는 `private readonly` Map으로 선언되어 있고, `resolvePending`은 `get` → `delete` → `resolve` 순으로 처리한다. Node.js의 단일 스레드 이벤트 루프 모델에서는 이 시퀀스가 원자적으로 실행되므로 동일 인스턴스 내에서 race condition이 없다. 그러나 분산 환경(다중 인스턴스)에서는 ContinuationBusService가 모든 인스턴스에 fan-out하고, 각 인스턴스는 자신의 Map에 키가 있을 때만 처리하는 설계로 이중 resolve를 방지한다. 이 패턴은 적절하게 구현되어 있다.
  - 제안: 해당 없음 (설계 의도대로 동작).

- **[INFO]** `llmDefaultConfigCache` Map의 single-flight 캐싱 패턴
  - 위치: `execution-engine.service.ts`, `llmDefaultConfigCache` 필드 (주석 "INFO #10")
  - 상세: `Promise<boolean>`을 Map에 저장하는 single-flight 패턴으로, 동일 키에 대한 동시 호출이 한 번의 DB 조회만 발동시킨다. Node.js 이벤트 루프 내에서는 안전하게 동작한다. 다만 `runExecution`의 finally 블록에서 같은 executionId prefix의 항목을 일괄 삭제하는 정리 로직이 있으며, 이 정리가 누락되면 메모리 누수로 이어질 수 있다.
  - 제안: finally 블록의 캐시 정리 로직이 실제로 구현되어 있는지 확인하고, 오류 발생 시에도 정리가 보장되는 try/finally 구조인지 검증 권장.

- **[INFO]** `V056` 마이그레이션의 `CREATE INDEX CONCURRENTLY` + `DROP INDEX CONCURRENTLY` 순서
  - 위치: `backend/migrations/V056__notification_active_partial_index.sql`
  - 상세: 신규 partial 인덱스를 먼저 생성한 뒤(`IF NOT EXISTS`로 재실행 안전), 구 인덱스를 삭제(`IF EXISTS`로 재실행 안전)하는 올바른 순서이다. `CONCURRENTLY` 옵션으로 인해 `executeInTransaction=false`(V056 conf 파일)가 설정되어 있어 트랜잭션 블록 밖에서 실행된다. 인덱스 전환 중 짧은 시간 동안 두 인덱스가 공존하므로 쓰기 부하가 일시적으로 증가하지만, 실제 락 없이 온라인 전환이 가능한 표준 패턴이다.
  - 제안: 해당 없음 (표준 PostgreSQL 온라인 인덱스 교체 패턴).

- **[INFO]** `recoverStuckExecutions`의 분산 락 획득/해제 패턴
  - 위치: `execution-engine.service.ts`, `recoverStuckExecutions` 메서드
  - 상세: `acquireLock`(SET NX) → try/finally → `releaseLock` 구조로 락 누수를 방지한다. DB 오류 발생 시에도 finally에서 releaseLock이 호출된다. TTL(60초) 설정으로 락 보유자가 비정상 종료되어도 자동 만료된다. `onApplicationBootstrap` 단계(모든 모듈의 `onModuleInit` 완료 후)에서 실행하여 `ContinuationBusService.publisher` 미초기화 race를 회피하는 올바른 설계이다.
  - 제안: 해당 없음 (적절히 구현됨).

- **[INFO]** fire-and-forget `runExecution` 패턴의 비동기 오류 처리
  - 위치: `execution-engine.service.ts`, `execute()` 및 `executeAsync()` 메서드
  - 상세: `this.runExecution(...).catch(...)` 패턴으로 백그라운드 실행 오류를 로깅만 하고 caller에게 전파하지 않는다. 이는 명시적 fire-and-forget 설계이나, catch 없이 `void runExecution(...)` 처럼 작성했다면 unhandled rejection이 발생할 수 있었다. 현재 구현은 `.catch` 핸들러가 있어 적절하다.
  - 제안: 해당 없음 (명시적으로 오류를 처리하고 있음).

### 요약

이번 변경은 동시성 관점에서 전반적으로 양호하게 구현되어 있다. DB 마이그레이션의 `CREATE/DROP INDEX CONCURRENTLY` 패턴은 표준 온라인 인덱스 교체 방식을 따르며, `executeInTransaction=false` 설정도 적절하다. 실행 엔진의 분산 락(`acquireLock/releaseLock`)은 try/finally 보호와 TTL 설정으로 락 누수를 방지하며, `onApplicationBootstrap` 단계 실행으로 초기화 race를 회피한다. `pendingContinuations` Map은 Node.js의 단일 스레드 모델과 Redis pub/sub fan-out 구조를 결합하여 분산 환경에서도 이중 resolve 없이 동작한다. 주목할 만한 잠재적 문제는 `executeSync`의 timeout TOCTOU race window이나, 이는 코드 주석에 명시된 알려진 한계이며 별도 PR로 개선 예정이다. 나머지 변경(mock surface 동기화, output shape 단순화, 커스텀 에러 클래스 제거)은 동시성과 무관한 리팩터링이다.

### 위험도
LOW
