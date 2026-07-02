### 발견사항

- **[INFO]** `claimResumeEntry` 원자 UPDATE 는 정확히 의도대로 구현됨 — 인덱스·락 범위 적절
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:854-865` (`claimResumeEntry`)
  - 상세: 기존 `findOne` (SELECT) 재검증 → 조건부 `UPDATE ... WHERE id = :id AND status = :waiting` 단일 원자 문으로 대체해 check-then-act 레이스 창을 제거했다. `id` 는 PK 이므로 단일 row lock 만 걸리고(row-level, PostgreSQL 기본 `READ COMMITTED`에서 UPDATE 는 자동으로 원자적 조건부 갱신을 보장), `affected` 카운트로 승자를 판별하는 패턴은 이미 코드베이스에 있는 `_retryState` "affected=1 인 쪽만 진행" 패턴과 동일해 일관성이 있다. spec(`spec/5-system/4-execution-engine.md` §1.1 원자성 노트, `1-data-model.md §3` V095 partial index)에 언급된 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` partial index 가 이 UPDATE 의 `WHERE id=... AND status=...` 핫경로를 커버한다고 명시(신규 인덱스 불요, INFO #3). PK 단일 row UPDATE 이므로 인덱스 이슈 자체가 크지 않다.
  - 제안: 없음. 설계가 준수됨.

- **[INFO]** 트랜잭션 원자성 — 단일 `UPDATE` 문이라 자체로 원자적, 별도 `START TRANSACTION` 불요
  - 위치: `execution-engine.service.ts:855-864`
  - 상세: `claimResumeEntry` 는 TypeORM QueryBuilder 로 단일 `UPDATE` 실행. DB 엔진(PostgreSQL 추정) 은 단일 statement 자체가 원자적이므로 명시적 트랜잭션 래핑이 없어도 race 조건은 발생하지 않는다. spec 은 "Execution·NodeExecution 을 단일 트랜잭션으로 갱신" 이라 서술하는데, 실제 diff 의 `claimResumeEntry` 는 `NodeExecution` 단일 테이블만 갱신하며 `Execution.status` 는 별도 갱신 지점이 없다(기존 consistency-check WARNING #1 로도 지적됨 — "claim UPDATE 가 NodeExecution 단독으로 보임"). 코드 레벨에서 `Execution.status` 를 갱신하는 별도 호출은 이 diff 범위에 보이지 않는다.
  - 제안: `Execution.status` 를 실제로 함께 갱신하는 경로가 있는지(다른 파일, 이 diff 범위 밖) 재확인 필요. 만약 claim 시점에는 `NodeExecution.status` 만 갱신하고 `Execution.status` 는 이후 별도 단계에서 갱신된다면, spec 의 "단일 트랜잭션으로 갱신" 서술과 코드가 불일치할 수 있음 — DB 관점보다는 spec-code 정합성 문제이나 참고용으로 기록.

- **[INFO]** `markNodeExecutionFailed` 롤백 경로의 `status IN (:...statuses)` 확장은 올바른 회귀 방지
  - 위치: `execution-engine.service.ts:2404-2436`
  - 상세: claim 이후 대상 row 가 `RUNNING` 이 되므로, 기존 `WAITING_FOR_INPUT` 단일 매치였던 `andWhere` 를 `WAITING_FOR_INPUT`/`RUNNING` 둘 다 매치하도록 확장한 것은 claim-후-실패 시 stuck RUNNING 을 막는 필수 변경이며 정확히 구현됨. 단일 조건부 UPDATE + idempotent(이미 terminal 이면 affected=0) 설계도 적절.
  - 제안: 없음.

- **[INFO]** `markExecutionCancelled` + `markNodeExecutionFailed` 순차 호출 — 두 개의 별도 await, 단일 DB 트랜잭션 아님 (pre-existing, 이번 diff 범위 밖)
  - 위치: `execution-engine.service.ts:1014-1017`, `1031-1037`
  - 상세: rehydration 실패 시 `Execution` 갱신과 `NodeExecution` 갱신이 각각 별도의 `UPDATE` 문으로 순차 실행된다(원자적 다중-테이블 트랜잭션이 아님). 두 호출 사이에 프로세스가 크래시하면 `Execution=cancelled` 이지만 `NodeExecution` 은 여전히 `running`으로 남는 partial-failure 창이 이론상 존재한다. 다만 이는 이번 diff 가 새로 만든 패턴이 아니라 기존 코드 구조를 그대로 재사용한 것이며, spec 이 이 경로를 "claim 후 rehydration 실패는 RESUME_* terminal 로 원자 마감" 이라고 서술하는 점과는 다소 괴리가 있다. 크래시로 인한 잔여 `running` row 는 `recoverStuckExecutions`(stale RUNNING 회수)가 최종적으로 정리하므로 실무 영향은 제한적.
  - 제안: 이번 PR 범위는 아니지만, 두 UPDATE 를 하나의 DB 트랜잭션(`queryRunner.startTransaction()` 또는 `DataSource.transaction()`)으로 묶으면 spec 의 "원자 마감" 서술과 코드가 완전히 일치하게 된다. 현재도 `recoverStuckExecutions` 세이프티넷이 있어 CRITICAL 은 아님.

- **[INFO]** N+1/대량 데이터/커넥션 풀/SQL 인젝션 — 해당 없음
  - 상세: 변경된 쿼리는 모두 PK 단건 대상 파라미터화 QueryBuilder(`.where('id = :id', {...})`, `.andWhere('status = :waiting', {...})`)로 SQL 인젝션 위험 없음. 반복문 내 쿼리 실행(N+1) 패턴 없음(단건 claim/rollback). 마이그레이션(스키마 변경) 없음 — enum 값·컬럼 추가 없이 기존 `waiting_for_input`/`running` 값의 전이 흐름만 변경. 커넥션은 기존 TypeORM repository/QueryBuilder 재사용으로 신규 커넥션 관리 이슈 없음.

- **[INFO]** 테스트 커버리지(`execution-engine.service.spec.ts`) — 동시성 시나리오 unit 검증 존재
  - 위치: `execution-engine.service.spec.ts:508-604`
  - 상세: `affected>=1 → true`, `affected=0 → false`, "두 claim 중 하나만 승리"(Promise.all mock 시뮬레이션), legacy `__no_node_exec__`/빈 id 우회, `markNodeExecutionFailed` 의 `status IN` 회귀 가드까지 커버. mock 기반이라 실제 DB 원자성(진짜 동시 UPDATE 레이스)은 검증하지 못하지만, spec draft(`plan/in-progress/spec-draft-c2-atomic-claim.md`)에 "form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e" 착수 조건이 명시돼 있어 실제 DB-level 검증은 후속 e2e 로 계획됨.
  - 제안: 없음(계획된 e2e 로 커버 예정 확인).

### 요약
이번 변경은 재개(rehydration) 진입 가드를 비원자 SELECT 재검증(check-then-act)에서 단일 조건부 `UPDATE ... WHERE status='waiting_for_input'` 원자 claim으로 교체하는 동시성 안전성 개선이다. PK 단건 대상 UPDATE + `affected` 카운트 판별 패턴은 기존 `_retryState` 소비 패턴의 일반화로 코드베이스 관례에 부합하며, 파라미터화된 쿼리로 SQL 인젝션 위험이 없고, 신규 인덱스 없이도 기존 partial index 가 핫경로를 커버한다고 spec 에 근거가 명시돼 있다. claim 이후 롤백 경로(`markNodeExecutionFailed`)의 `status IN (WAITING_FOR_INPUT, RUNNING)` 확장도 stuck RUNNING 회귀를 정확히 방지한다. 다만 `Execution`/`NodeExecution` 두 테이블 갱신이 별도의 순차 `UPDATE` 문(진짜 DB 트랜잭션 아님)으로 이뤄지는 기존 패턴이 spec 의 "단일 트랜잭션 원자 마감" 서술과 다소 괴리되는 부분이 있으나, 이는 이번 diff 가 새로 도입한 리스크가 아니라 기존 구조를 재사용한 것이고 `recoverStuckExecutions` 세이프티넷이 있어 실질 위험은 낮다. 마이그레이션·대량 데이터·커넥션 관리 관련 신규 리스크는 없다.

### 위험도
LOW
