# Database 코드 리뷰

## 컨텍스트

이번 리뷰 대상 5개 파일은 diff 가 아니라 전체 컨텍스트로 제공됐다. `git log`/`git diff
025aedd0f..HEAD` 로 실제 변경분을 확인한 결과, 이번 라운드(8R~10R)의 실질 코드 변경은
`execution.retry_last_turn` 재진입의 짝 전이가 DB 가드(`lockNonTerminalExecutionRow` FOR
UPDATE 조회 + `updateExecutionStatus` else 분기 guarded UPDATE)에서 `allowRetryReentry`
opt-in 을 전혀 반영하지 못해 **항상 0행**이었던 결함(8R CRITICAL)과, 그 opt-in 전파 배선
자체가 무검증이었던 잔여(9R/10R CRITICAL)를 닫는 작업이다. `retry-turn.service.ts` 는 이
구간에서 무변경(diff 없음, 컨텍스트 제공용)이다. 데이터베이스 관점에서 이 변경 자체와 그
주변 상시 가드 패턴(트랜잭션/락/파라미터화)을 검증했다.

## 발견사항

- **[WARNING]** DB 가드 SQL 이 `allowRetryReentry` opt-in 상태에서도 `COMPLETED`/
  `CANCELLED` 를 실제로 계속 배제하는지 검증하는 회귀 테스트가 없음 (state-machine 계층과
  DB-가드 계층의 비대칭).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8168`
    (`lockNonTerminalExecutionRow`) / `execution-engine.service.ts:8354`
    (`updateExecutionStatus`) — 대응 테스트는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5115-5201`.
  - 상세: `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(`execution-engine.service.ts:534`)의
    필터식(`!TERMINAL_STATUSES.has(status) || status === FAILED`)을 직접 계산해보면
    `{pending, running, waiting_for_input, failed}` 만 남고 `completed`/`cancelled` 는
    여전히 제외된다 — 코드 자체는 현재 정확하다. 그러나 새로 추가된 4개 단위 테스트
    (`opt-in 시 짝 전이가 FAILED → WAITING_FOR_INPUT 를 persist`,
    `opt-in 없으면 FAILED 행의 짝 전이는 persist 되지 않는다`,
    `opt-in(allowRetryReentry) 시 else 분기 guarded UPDATE 가 failed 를 조건에 포함`,
    `opt-in 없으면 else 분기 guarded UPDATE 가 failed 를 포함하지 않는다`)은 전부
    "FAILED 포함 여부"만 대조할 뿐, `allowRetryReentry: true` + DB 상 실제 상태가
    `completed`/`cancelled` 인 조합에서 `persisted === false` 가 되는지(= opt-in 이
    진짜 terminal 상태까지 되살리지 않는지)를 SQL/mock 레벨에서 직접 단언하지 않는다.
    현재는 `assertTransition` 이 `canTransition(FAILED, COMPLETED/CANCELLED, {allowRetryReentry:true})`
    를 이미 `false` 로 막아 이 경로가 실무상 도달하지 않지만, 이 PR 체인 자체가
    "레이어 A(상태머신)는 옳은데 레이어 B(DB 가드)로의 배선이 끊어져도 아무도 몰랐다"는
    정확히 이 결함 클래스를 8~10R 에 걸쳐 반복 재발견했다 — 같은 패턴의 방어선을 SQL
    가드 자체에도 하나 세워두는 편이 안전하다. (동일 항목이 `testing` 리뷰어에서도
    독립적으로 지적됨 — 두 관점 모두 수렴.)
  - 제안: `dbExecutionStatus = ExecutionStatus.COMPLETED`(또는 `CANCELLED`) +
    `{ allowRetryReentry: true }` 조합에서 `persisted === false` 를 단언하는 대조
    테스트 1~2건 추가.

- **[WARNING]** `retryLastTurn` 이 부모 `Execution.status` 를 검증하지 않고 `NodeExecution`
  만 보고 새 `RUNNING` 행을 spawn — Execution 이 실제로는 `cancelled` 인데 stale
  `FAILED` `NodeExecution` 에 retry 하면 spawn 된 행이 영구 `RUNNING` 고아로 남을 수 있음
  (이미 `plan/in-progress/retry-turn-terminal-guard.md` #20 에 P2 defer 로 추적 중인
  pre-existing 이슈 — 이번 8R~10R diff 의 신규 회귀는 아님).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:130-148`
    (`retryLastTurn` — `nodeExec.status !== NodeExecutionStatus.FAILED` 만 검사, `Execution`
    로드/검증 없음).
  - 상세: `retryLastTurn`(WS 동기 호출)은 `NodeExecution` 이 `FAILED` 이고 재시도 가능
    조건을 만족하면 즉시 새 `NodeExecution` row 를 `status: RUNNING` 으로 spawn 한다(원자
    JSONB consume + insert, `retry-turn.service.ts:207-236`). 부모 `Execution` 이 그 사이
    사용자 Stop 으로 이미 `cancelled` 로 전이돼 있어도 이 spawn 자체는 막히지 않는다.
    이후 `applyRetryLastTurn`(worker 재진입)이 도달했을 때 `finalizeAiNode` 의 전이 시도가
    `assertTransition('cancelled', 'running'/'waiting_for_input', {allowRetryReentry:true})`
    로 **동기 throw**(opt-in 은 `from===FAILED` 전용이라 `CANCELLED` 에서는 적용되지 않음)
    하면, `applyRetryLastTurn` catch → `failRetryExecution` 은 **Execution 만** guarded
    로 마감하고(`finalizeGuarded` 가 `canTransition('cancelled','failed')===false` 로
    스스로 no-op) `spawnedRow`(NodeExecution)는 어디서도 terminal 로 마킹되지 않는다 —
    `recoverStuckExecutions` 의 stale-RUNNING 재구동 백스톱도 Execution 이 이미
    terminal(`cancelled`)이라 대상이 아니다. 결과는 진행률/타임라인 집계에 잡히는 영구
    `RUNNING` 고아 `NodeExecution` row.
  - 제안: `retryLastTurn` 1.5단계로 `Execution.status === FAILED` 명시 검증 추가(spawn
    이전 차단이 근본 조치) — 이미 defer 로 등재돼 있으므로 이번 라운드에서 즉시 처리를
    요구하는 것은 아니나, 스키마 정합성(고아 행) 관점에서 재확인차 기록.

- **[INFO]** 전이 허용 여부의 이중 진실 소스 — TS 상태머신(`ALLOWED_TRANSITIONS`/
  `canTransition`)과 DB 가드 SQL 허용 목록(`NON_TERMINAL_STATUSES_SQL`/
  `NON_TERMINAL_OR_FAILED_STATUSES_SQL`)이 독립적으로 존재하고 수동 동기화에 의존한다.
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:7-39`
    (`ALLOWED_TRANSITIONS`) vs
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-543`
    (`NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL`).
  - 상세: 이번 8R CRITICAL 자체가 "상태머신은 opt-in 을 확장했는데 DB 가드 SQL 상수는
    안 따라감" 이라는 이 이중 소스의 불일치였다. 이번 수정으로 둘은 다시 정합해졌지만
    (직접 계산 검증 완료 — 위 참조), 구조 자체는 그대로 남아 향후 세 번째 opt-in 전이가
    추가되면 같은 클래스의 결함이 재발할 수 있다. 이미 `plan/in-progress/retry-turn-terminal-guard.md`
    #21 로 추적 중(P2, 구조 변경이라 defer). 새 조치 요구 아님 — DB 가드 유지보수 시
    유의할 결합도로 기록.

## 점검한 항목 중 이상 없음

- **트랜잭션/락**: `updateExecutionStatus`(linkedNodeExec 분기)·`tryLockActiveExecutionAndSaveNodeExec`·
  `cancelParkedExecution`·`markWebChatIdleTimeout`·`claimResumeEntry`·`retryLastTurn`
  atomic consume+spawn 모두 `dataSource.transaction()` 콜백 안에서 `FOR UPDATE` 행 잠금 또는
  조건부 `UPDATE ... WHERE status IN (...)`(CAS) 패턴으로 검사-후-사용 race 를 닫는다. 예외
  발생 시 자동 롤백(`ResumeClaimExecTerminalError` sentinel 패턴 포함)도 확인.
- **SQL 인젝션**: `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 은
  `Object.values(ExecutionStatus)`(TS enum, 사용자 입력 아님)에서 파생. `executionId`/
  `nodeExecutionId` 등 실제 가변값은 전부 `$1`/`:id` 파라미터 바인딩. `RETRY_STATE_KEY`
  (`retry-turn.service.ts:42`)는 raw SQL 에 문자열 보간되지만 컴파일 타임 상수(`'_retryState'`)
  라 인젝션 경로 없음.
  - `updateExecutionStatus` 의 boolean 필터 로직도 직접 계산 검증: `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
    = `{pending, running, waiting_for_input, failed}` — `completed`/`cancelled` 는 opt-in 여부와
    무관하게 항상 제외됨.
- **인덱스**: `execution` 테이블 쿼리는 전부 `id`(PK) 필터라 추가 인덱스 불요. `node_execution`
  의 `execution_id + status` 조합 쿼리(`cancelParkedExecution`/`markWebChatIdleTimeout`)는
  기존 partial 복합 인덱스(`node-execution.entity.ts` `@Index(['executionId','status'])`,
  Flyway V095, `WHERE status IN ('waiting_for_input','running')`)로 이미 커버됨 — 이번
  변경이 새 쿼리 패턴을 추가하지 않았음.
- **마이그레이션 안전성**: 이번 리뷰 대상에 스키마/마이그레이션 파일 없음 — 해당 없음.
- **N+1**: `applyRetryLastTurn` 의 `Promise.all([executionRepository.findOneBy, nodeRepository.findOneBy])`
  등 반복문 내 개별 쿼리 패턴 없음.
- **커넥션 관리**: NestJS TypeORM DI 주입 `Repository`/`DataSource` 만 사용, `dataSource.transaction(cb)`
  콜백 형태라 커밋/롤백/커넥션 반환이 자동 처리됨. 수동 `queryRunner` 획득/해제 없음.
- **대량 데이터**: 이번 대상 쿼리는 전부 단건(PK 또는 executionId 단위) 조회/갱신 — 페이지네이션
  대상 리스트 쿼리 없음.

## 요약

이번 라운드가 수정한 핵심(`allowRetryReentry` opt-in 을 DB 가드 SQL 허용 목록까지 정확히
전파)은 데이터베이스 관점에서 건전하다 — 파라미터화·트랜잭션·행 잠금 패턴을 기존 코드베이스의
검증된 관례 그대로 따르고, opt-in 범위도 `FAILED` 만 추가할 뿐 `COMPLETED`/`CANCELLED` 부활은
여전히 차단함을 직접 계산으로 확인했다. 남은 리스크는 두 가지 WARNING 뿐이다: (1) 그 "여전히
차단됨"을 증명하는 DB-레벨 대조 테스트가 없다는 테스트 커버리지 갭(이 PR 체인이 라운드마다
재발견해 온 "계층 간 배선 무검증" 패턴과 동일 계열이라 우선 보강 권장), (2) `retryLastTurn` 이
부모 Execution 상태를 검증하지 않아 드문 레이스(retry 직전 Stop)에서 NodeExecution 고아 행이
남을 수 있는 pre-existing 갭(이미 defer 로 추적 중, 이번 diff 의 신규 회귀 아님). 인덱스·
마이그레이션·SQL 인젝션·커넥션 관리·N+1·페이지네이션 항목은 모두 이상 없음.

## 위험도

LOW
