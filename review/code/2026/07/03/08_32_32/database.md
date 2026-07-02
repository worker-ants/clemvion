### 발견사항

- **[INFO]** `claimResumeEntry` 조건부 UPDATE 두 건이 PK/조건 컬럼 인덱스에 잘 부합
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `claimResumeEntry()` (NodeExecution `WHERE id = :id AND status = :waiting`, Execution `WHERE id = :id AND status IN (...)`)
  - 상세: 두 UPDATE 모두 PK(`id`) 등호 조건이 선행이라 인덱스 스캔 비용이 낮다. `status` 조건은 post-filter 이지만 PK 단일 row 조회라 실질 성능 영향은 미미하다. `recoverStuckExecutions` cascade 신설 UPDATE(`WHERE execution_id IN (:...ids) AND status = :running`)도 기존 V095 partial index `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 범위에 정확히 들어가 인덱스 스캔으로 처리된다 — 별도 인덱스 불필요.
  - 제안: 없음. plan draft(`plan/in-progress/spec-draft-c2-atomic-claim.md` side-effect 점검)에서도 이미 V095 재사용을 인지하고 있어 정합적이다.

- **[INFO]** `claimResumeEntry` 트랜잭션 격리수준 미지정 — 기본 READ COMMITTED 의존
  - 위치: `execution-engine.service.ts` `claimResumeEntry()` — `this.dataSource.transaction(async (manager) => {...})`
  - 상세: 격리수준을 명시하지 않아 TypeORM/Postgres 기본값(READ COMMITTED)을 사용한다. 이 패턴은 두 조건부 UPDATE(`WHERE status = :x`)의 원자성을 "조건부 UPDATE + affected 카운트" 로 보장하므로 READ COMMITTED 로도 race 는 안전하다(각 UPDATE 문 자체가 row-level 잠금을 걸고 조건을 재평가하는 postgres MVCC 특성 활용). SERIALIZABLE 이 굳이 필요하지 않은 설계로 보인다.
  - 제안: 현재 방식이 적절하나, 두 번째 UPDATE(Execution 짝 전이)가 실패해 `throw`로 롤백하는 경로에서 "짝 불일치 시 첫 번째 UPDATE(NodeExecution claim)도 함께 롤백"이 트랜잭션 하나로 이뤄지는지 재확인(테스트 `node claim 성공하나 Execution terminal → 롤백·false` 케이스로 커버돼 보임 — 문제 없음).

- **[INFO]** `markNodeExecutionFailed`/`recoverStuckExecutions`/`claimResumeEntry` 등 신규 UPDATE 전부 파라미터 바인딩(`:id`, `:waiting`, `:ids` 등) 사용
  - 위치: 여러 지점 (`execution-engine.service.ts`)
  - 상세: 모든 신규/수정 쿼리가 TypeORM QueryBuilder 의 named parameter 바인딩을 사용해 SQL 인젝션 위험 없음.
  - 제안: 없음.

- **[INFO]** `recoverStuckExecutions` cascade UPDATE 는 `updateResult.raw`(RETURNING 결과) 개수가 이론상 대량일 수 있으나 실무 노출 낮음
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions()` — `.returning('id')` 추가 후 `recoveredIds` 배열을 `IN (:...ids)` 로 재사용
  - 상세: `recoverStuckExecutions`는 "30분 초과 RUNNING" 대상이라 정상 운영에서는 배치 크기가 작다(스터크 execution 은 예외적 상황). `IN (:...ids)` 파라미터화 배열 바인딩도 TypeORM 표준 패턴으로 인젝션 안전. 다만 이론적으로 매우 많은 stuck execution 이 누적되면(장애 상황) `IN` 절 파라미터 개수가 커질 수 있음.
  - 제안: 현재 스케일(30분 타임아웃 기반 회수, 통상 소수 건)에서는 문제 없음. 향후 대량 장애 복구 시나리오를 위해 배치 크기 상한(chunk) 고려 가능하나 이번 변경 범위에서는 불필요.

- **[INFO]** 신규 cascade UPDATE(`recoverStuckExecutions` 내 NodeExecution FAILED 마킹)는 부모 UPDATE 트랜잭션과 분리된 별도 문장
  - 위치: `execution-engine.service.ts` — Execution UPDATE(`returning('id')`) 실행 후 `if (recoveredIds.length > 0) { await nodeExecutionRepository.createQueryBuilder()... }` 별도 실행
  - 상세: Execution 회수 UPDATE 와 자식 NodeExecution cascade FAILED UPDATE 가 단일 트랜잭션으로 묶여 있지 않다. 두 UPDATE 사이 크래시 시 "Execution=FAILED(회수됨), NodeExecution=RUNNING(잔존)" 불일치가 남을 수 있다. 다만 이 케이스는 (a) Execution 이 이미 terminal(`FAILED`)이라 재개 대상이 아니고, (b) 코드 주석에도 "Execution 이 이미 terminal 이라 재개는 없지만 데이터 정합·모니터링 목적"이라고 명시돼 있어 기능적 영향은 제한적이며, (c) 다음 `recoverStuckExecutions` 배치 실행(주기 스케줄) 시 재시도 가능성이 있는지는 `status = :running` 조건상 자연 재시도된다.
  - 제안: 정합성이 엄격히 요구되는 것은 아니므로 현행 유지 가능. 다만 "orphan NodeExecution RUNNING 잔존" 케이스가 반복 재수집되도록(다음 스케줄 tick에서 같은 cascade 로직이 남은 RUNNING 자식을 다시 잡을 수 있는지) 여부를 명시 주석/테스트로 남기면 운영 시 디버깅에 도움.

- **[INFO]** `claimResumeEntry` legacy sentinel 우회(`__no_node_exec__`/빈 문자열) 시 DB 트랜잭션 없이 즉시 `true` 반환
  - 위치: `execution-engine.service.ts` `claimResumeEntry()` 최상단 early return
  - 상세: 이 경로는 claim 없이 재개를 허용한다. 이는 기존 `isNodeExecutionWaiting`의 동일 undocumented 우회를 그대로 승계한 것으로 새로운 위험은 아니다. 다만 이 경로에서는 "동일 turn 이중 실행 0" 불변식이 claim 으로 보장되지 않는다(legacy 경로 한정 — 주석에 그렇게 명시돼 있음).
  - 제안: 기존 동작 유지이므로 이번 diff 범위에서 추가 조치 불필요.

### 요약

이번 변경(06 C-2)은 재개(rehydration) 진입을 비원자 `SELECT` 재검증에서 DB 조건부 원자 `UPDATE`(`claimResumeEntry`) 로 교체하는 동시성/정합성 개선이다. 핵심 트랜잭션 로직(`dataSource.transaction` 안에서 NodeExecution claim → 실패 시 즉시 discard, 성공 시 같은 트랜잭션으로 Execution 짝 전이 → 짝 불일치 시 throw 로 전체 롤백)은 견고하게 설계돼 있고, 모든 쿼리가 파라미터 바인딩을 사용해 SQL 인젝션 우려가 없다. 인덱스 측면에서도 신규 조건부 UPDATE 는 PK 등호 조건이 주가 되고, `recoverStuckExecutions`의 신규 cascade UPDATE(`execution_id IN (...) AND status='running'`)는 기존 V095 partial index 범위와 정확히 일치해 추가 인덱스가 불필요하다는 점을 spec draft 문서에서도 스스로 확인하고 있다. 유일하게 주목할 점은 `recoverStuckExecutions`에서 Execution 회수 UPDATE 와 자식 NodeExecution cascade FAILED UPDATE 가 하나의 트랜잭션으로 묶이지 않아 이론적 crash-window 불일치 가능성이 남지만, 이는 이미 terminal 상태에 대한 부가적 정리(모니터링/정합 목적)이며 기능적 재개 경로에 영향을 주지 않으므로 실질 위험도는 낮다. N+1 쿼리, 커넥션 누수, 대량 데이터 페이지네이션 관련 이슈는 발견되지 않았다.

### 위험도
LOW
