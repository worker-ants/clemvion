# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 단일 UPDATE 문을 명시 트랜잭션으로 감싸면서 라운드트립이 늘어난다 (BEGIN/COMMIT 추가)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8692` (`updateExecutionStatus` else 분기, `await this.dataSource.transaction(async (manager) => { ... })`)
  - 상세: 기존에는 `executionRepository.query(...)` 단발 UPDATE(자동커밋 단일 statement)였는데, 이번 변경으로 `dataSource.transaction()` 으로 감싸 BEGIN/COMMIT(또는 ROLLBACK) 왕복이 추가된다. 이 메서드는 주석에 "Execution 상태 전이의 단일 choke point" 라고 명시되어 있어 모든 상태 전이(RUNNING/COMPLETED/FAILED/CANCELLED 등)가 이 경로를 지난다 — 즉 매우 빈번히 호출되는 hot path다. 단일 UPDATE 는 PostgreSQL 에서 이미 원자적이므로, 이 트랜잭션 래핑이 주는 것은 "쓰기 원자성" 이 아니라 "쓰기+결과 해석(shape 검증)을 하나의 unit 으로 묶어 shape 위반 시 UPDATE 자체를 롤백한다" 는 목적이다(주석에도 명시). 목적 자체는 타당하지만, 고빈도 경로에 왕복이 늘어나는 트레이드오프는 인지해 둘 만하다.
  - 제안: 별도 조치 불필요 — 목적(관측 불가능한 유실 방지, 롤백 보장)이 성능 비용보다 명확히 크다. 다만 향후 이 choke point 가 처리량 병목으로 확인되면, 단일 커넥션 재사용(예: `queryRunner` 직접 관리) 등으로 오버헤드를 더 줄일 여지가 있다는 점만 참고.

- **[INFO]** `elseStatusesSql` 문자열 보간은 SQL 인젝션 벡터가 아님을 확인함 (오탐 방지 목적의 명시적 기록)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8704` (`AND status IN (${elseStatusesSql})`)
  - 상세: `elseStatusesSql` 은 `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 정적 클래스 상수(522~549행)로, `Object.values(ExecutionStatus)` (고정 enum) 에서 파생되며 사용자 입력이 전혀 개입하지 않는다. 나머지 8개 값(`execution.id`, `newStatus`, `activeRunningMs` 등)은 전부 `$1`~`$8` 파라미터 바인딩으로 전달되어 파라미터화 규약을 준수한다. 인젝션 위험 없음.
  - 제안: 조치 불필요. 다만 이 상수를 만드는 코드가 미래에 사용자 제어 값을 흡수하지 않도록(예: 동적 status 문자열 병합) 주의할 필요는 있다.

## 리뷰한 변경 요약 (참고)

이번 변경의 핵심은 `updateExecutionStatus` else 분기(짝 전이가 아닌 단독 상태 전이: RUNNING/COMPLETED/FAILED/CANCELLED 직접 마감)의 guarded raw UPDATE(`WHERE id=$1 AND status IN (non-terminal[,'failed'])... RETURNING id`)를 트랜잭션 밖 단발 쿼리에서 `this.dataSource.transaction(async (manager) => { manager.query(...) })` 안으로 옮긴 것이다.

- **트랜잭션 사용 적절성**: 타당하다. 이 UPDATE 결과(`updateReturningRows`)가 튜플 shape 위반이면 throw 하도록 이미 이전 변경(`17_15_21` WARNING 1)에서 고쳐졌는데, 트랜잭션 밖에서는 그 UPDATE 가 이미 커밋된 뒤였다 — throw 해도 DB 는 terminal 상태로 남고 종결 이벤트(`execution.completed`/`failed`)는 나가지 않아, 그 실행은 stuck-recovery(비-terminal만 스캔)에도 잡히지 않는 "가드가 만든 무기한 대기" 상태가 됐다. 트랜잭션으로 감싸면 throw 시 UPDATE 자체가 롤백되어 행이 비-terminal 로 남고 재구동 스캔 대상이 된다 — 정합성 결함(고아 terminal 상태)을 정확히 겨냥한 수정이다.
- **일관성**: 같은 메서드의 짝 전이(`linkedNodeExec`) 분기가 이미 동일한 이유로 `dataSource.transaction` + `FOR UPDATE` 락을 쓰고 있었다(8600~8653행). 이번 변경으로 두 분기의 트랜잭션 사용 형태가 통일됐다.
- **트랜잭션 경계**: 부작용(메트릭 기록 `emitTerminalExecutionMetrics`, `recordRunningSegmentStart`)은 트랜잭션 콜백 밖(8728~8733행)에서 `persisted` 로컬 변수를 통해 실행된다 — 트랜잭션을 불필요하게 오래 열어두지 않는 올바른 경계 설정.
- **커넥션 관리**: TypeORM `dataSource.transaction()` 은 커넥션을 pool 에서 획득 → BEGIN → 콜백 → COMMIT/ROLLBACK → 커넥션 반환을 자동 처리한다. 명시적 해제가 필요 없고 누수 위험도 없다.
- **SQL 인젝션**: 위 발견사항 참고 — 파라미터 바인딩 준수, 문자열 보간부는 정적 enum 상수뿐.
- **인덱스/대량 데이터**: `WHERE id = $1` (PK 단일 행 UPDATE) 로 기존과 동일 — 신규 인덱스 요구나 대량 스캔 없음.
- **N+1**: 호출 패턴 변화 없음(호출당 단일 쿼리) — 신규 N+1 없음.
- **마이그레이션 안전성**: 이번 diff 에 스키마 변경 없음 — 해당 없음.
- **테스트 커버리지 (DB 관점)**: `execution-engine.service.spec.ts` 에 추가된 두 테스트는 (a) throw 가 트랜잭션 콜백 밖으로 전파되는지, (b) UPDATE 가 실제로 트랜잭션 manager 를 경유하는지, (c) 정상 경로도 동일 배선인지(공허 테스트 방지)를 각각 축으로 고정한다. mock 이 `mockTxManagerQuery` → 기존 `mockExecutionRepo.query` 로 위임하는 구조라 기존 수십 개 단언을 보존하면서 "트랜잭션 경유 여부" 신호도 별도로 기록 — mock 설계가 두 관심사를 잘 분리했다. plan 문서(`backend-lint-gate-broken-on-main.md`, `update-returning-tuple-shape.md`)에 기록된 뮤테이션 실측(트랜잭션 제거 → RED 2, throw 삼킴 → RED 2)도 두 축이 실제로 회귀를 잡는다는 근거로 타당하다.

나머지 파일(`plan/in-progress/*.md` 2건)은 이 작업을 추적하는 plan 문서 갱신으로 DB 코드 변경이 아니다.

## 요약

이번 변경은 `updateExecutionStatus` else 분기의 단일 guarded UPDATE 를 명시 트랜잭션으로 감싸, shape-검증 실패(throw) 시 이미 실행된 UPDATE 를 롤백시켜 "DB 는 terminal 인데 종결 이벤트가 영구히 안 나가는" 고아 상태를 막는다. 짝 전이 분기와 트랜잭션 형태를 통일했고, 부작용은 트랜잭션 경계 밖에서 수행되며, 파라미터 바인딩·enum 기반 상수만 문자열 보간에 사용해 SQL 인젝션 위험이 없다. 커넥션 관리는 TypeORM 표준 트랜잭션 패턴을 따라 누수 위험이 없다. 유일한 트레이드오프는 고빈도 choke point 에 트랜잭션 왕복이 추가된다는 점이나, 목적(정합성 보장)이 그 비용을 상회하며 별도 조치가 필요한 수준은 아니다. 스키마 변경·마이그레이션·인덱스·N+1·대량 데이터 관련 이슈는 이번 diff 범위에 없다.

## 위험도

NONE — 발견된 항목은 모두 정보성(INFO)이며, DB 정합성 관점에서는 오히려 결함을 고친 개선.
