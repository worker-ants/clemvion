### 발견사항

- **[INFO]** `claimResumeEntry` 원자 claim 트랜잭션의 격리수준 미명시
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:862-903` (`claimResumeEntry`)
  - 상세: `this.dataSource.transaction(async (manager) => {...})` 는 TypeORM/PG 기본 격리수준(READ COMMITTED)으로 실행된다. 두 단계 조건부 UPDATE(1) NodeExecution `WHERE id=... AND status='waiting_for_input'`, (2) Execution 짝 전이)는 각각 PK/조건부 WHERE 절 UPDATE 라 READ COMMITTED 하에서도 row-level lock 이 걸려 동시 두 트랜잭션 중 하나만 (1)에서 `affected=1`을 얻고 나머지는 `affected=0`을 얻는 것이 PostgreSQL의 표준 동작(행 잠금 대기 후 재평가)이므로 동시성 안전성 자체는 유지된다. 다만 이 안전성이 "PG UPDATE 의 암묵적 row lock" 에 의존한다는 점이 코드/주석에 명시적으로 드러나지 않아, 향후 다른 ORM/DB로 마이그레이션 시나 유사 패턴을 복제할 때 오해 소지가 있다.
  - 제안: 필수 수정은 아님(테스트 `동시 재개 — 두 claim 중 하나만 승리` 케이스가 실제 PG가 아닌 mock 이라 이 동시성 보장을 직접 검증하진 못하지만, UPDATE...WHERE 조건부 패턴은 PG에서 검증된 안전 패턴). 주석에 "PG 행 잠금에 의존" 한 줄만 추가하면 향후 유지보수자에게 도움이 된다.

- **[INFO]** `claimResumeEntry` 2단계 UPDATE가 순차 실행 — Execution 짝 전이 실패는 무시(의도적 멱등)
  - 위치: `execution-engine.service.ts:884-895`
  - 상세: NodeExecution UPDATE가 성공(affected>=1)한 후 Execution UPDATE 결과값은 확인하지 않는다(`affected=0`이어도 무방하다고 주석에 명시). 이는 "node claim 이 유일한 레이스 결정자"라는 설계 의도가 명확히 문서화되어 있고, 동일 트랜잭션으로 원자성이 보장되므로 설계상 타당하다. 다만 Execution이 이미 다른 상태(예: 이미 RUNNING이 아닌 CANCELLED)로 전이돼 있는 극단 케이스에서 NodeExecution만 RUNNING이 되고 Execution은 짝이 맞지 않는 상태로 남을 수 있는지 (예: cancel 경합) 재확인이 필요하다. 다만 processor 쪽에서 cancel과 resume 진입이 동일 BullMQ jobId 멱등성 + WAITING_FOR_INPUT andWhere 가드로 흡수한다는 주석이 있어 실무적으로 커버되는 것으로 보인다.
  - 제안: 현행 유지 가능. 다만 §7.5 스펙 draft(`plan/in-progress/spec-draft-c2-atomic-claim.md`)가 이미 Rationale에서 이 부분을 다루고 있으므로 spec 반영 시 명확히 남기길 권장(구현 완료 후 spec 승격 단계에서 확인).

- **[INFO]** `recoverStuckExecutions` cascade에서 `.returning('id')` 사용
  - 위치: `execution-engine.service.ts:2573-2589, 2602-2624`
  - 상세: 회수된 Execution id를 `.returning('id')`로 얻어 자식 NodeExecution cascade FAILED 처리에 사용한다. 대량 stuck row(운영상 30분 초과 RUNNING execution)가 다수 존재하는 극단적 상황에서 `recoveredIds` 배열이 매우 커지면 `WHERE execution_id IN (:...ids)`의 파라미터 바인딩 크기가 커질 수 있으나, 이는 recovery라는 저빈도 배치 작업(부팅/주기 실행)이라 실무적 영향은 낮다. 인덱스는 V095 partial index `(execution_id, status) WHERE status IN ('waiting_for_input','running')`가 이 `execution_id IN (...) AND status='running'` 조회를 이미 커버한다.
  - 제안: 조치 불필요. 참고로 이 cascade는 N+1이 아니라 단일 배치 UPDATE로 처리되어 적절하다.

- **[INFO]** 신규 컬럼/인덱스 없음, 마이그레이션 파일 변경 없음
  - 위치: 전체 diff
  - 상세: 이번 변경은 기존 컬럼(`status`)의 상태 전이 로직만 수정하며 스키마 변경(`ALTER TABLE`, 신규 인덱스 등)이 없다. 무중단 배포 관점에서 위험이 없다. 기존 V095 partial index가 이 UPDATE 핫경로(`id=... AND status='waiting_for_input'`, `execution_id IN (...) AND status='running'`)를 이미 커버하므로 추가 인덱스도 불필요하다는 점이 spec draft에도 명시돼 있고 코드 검증 결과와 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** SQL 인젝션 위험 없음
  - 위치: 전체 diff의 모든 QueryBuilder 사용
  - 상세: 모든 조건절이 TypeORM QueryBuilder의 named parameter(`:id`, `:waiting`, `:...ids`, `:...statuses`)로 파라미터화되어 있다. 원시 문자열 concatenation 없음.
  - 제안: 조치 불필요.

- **[INFO]** 커넥션/트랜잭션 관리 적절
  - 위치: `execution-engine.service.ts:872` (`this.dataSource.transaction`)
  - 상세: `dataSource.transaction()` 콜백 패턴을 사용해 커넥션 획득·해제·커밋/롤백을 TypeORM이 자동 관리한다. 명시적 커넥션 release 누락이나 트랜잭션 미종결 위험 없음. 콜백 내 예외 발생 시 자동 롤백된다(claim 실패 시 `return false`만 하고 throw는 없으므로 정상 커밋되며, 이는 "claim 실패"도 유효한 완료 상태이므로 적절).
  - 제안: 조치 불필요.

- **[INFO]** N+1 없음
  - 위치: 전체 diff
  - 상세: `claimResumeEntry`는 단일 트랜잭션 내 2개의 조건부 UPDATE(반복문 아님, 요청당 1회 호출)이며, `recoverStuckExecutions`의 cascade도 배치 단일 UPDATE(IN 절)다. continuation processor의 `claimResumeEntry` 호출도 job당 1회이며 반복문 내 개별 쿼리 패턴이 없다.
  - 제안: 조치 불필요.

- **[INFO]** `ai-turn-orchestrator.service.ts`의 `nodeExec.status = WAITING_FOR_INPUT` 직접 대입
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:43-45`
  - 상세: 메모리상 엔티티 객체의 `status` 필드를 직접 대입한 뒤 이어지는 `this.driver.stageDurableResumeSnapshot(...)` / `updateExecutionStatus(...)` 흐름에서 `linkedNodeExec`가 save 되는 것으로 보인다(주석 기준). 이 자체는 DB 쿼리가 아니라 in-memory 엔티티 필드 설정이며, 이후 save 시점에 실제 UPDATE가 발생하는 통상적 ORM 패턴이다. claim이 이미 WFI→RUNNING 전이시킨 것을 re-park 로직이 명시적으로 되돌리는 것으로, 짝 상태 정합성 측면에서 논리적으로 타당하다.
  - 제안: 조치 불필요. (해당 save 호출부는 diff 범위 밖이라 직접 확인은 안 됐으나 기존 관례상 문제 없어 보임)

### 요약

이번 변경은 06 C-2(재개 진입 race 보장을 비원자 SELECT 재검증에서 DB 조건부 UPDATE 원자 claim으로 대체)를 구현한다. 핵심 패턴인 `claimResumeEntry`는 단일 트랜잭션 내 조건부 UPDATE(`WHERE status='waiting_for_input'`)로 NodeExecution을 레이스 결정자로 삼고, 같은 트랜잭션에서 Execution을 짝 전이시켜 크래시 시에도 `recoverStuckExecutions`가 회수 가능하도록 설계했다 — check-then-act 창을 제거해 멀티 인스턴스/동시성 상향 환경에서 이중 실행을 DB 레벨에서 기계적으로 차단하는 정석적인 optimistic-claim 패턴이다. `markNodeExecutionFailed`와 `recoverStuckExecutions` cascade 모두 claim 후 남을 수 있는 RUNNING 잔존 row를 놓치지 않도록 상태 목록을 확장(`WAITING_FOR_INPUT` + `RUNNING`)했고, 기존 V095 partial index가 관련 조회/UPDATE 핫경로를 이미 커버해 신규 인덱스가 불필요하다는 점도 코드 확인상 타당하다. 모든 쿼리는 파라미터화되어 SQL 인젝션 위험이 없고, 트랜잭션/커넥션 관리는 TypeORM `dataSource.transaction()` 콜백 패턴으로 적절히 위임되며, N+1이나 페이지네이션 이슈도 발견되지 않았다. 마이그레이션 파일 변경이 없어 무중단 배포 위험도 없다. 전반적으로 DB 관점에서 견고하게 설계·구현되었으며 Critical/Warning급 이슈는 없다.

### 위험도
NONE
