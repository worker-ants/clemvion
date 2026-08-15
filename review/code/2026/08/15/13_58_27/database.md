# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** guarded UPDATE 결과 미확인 → emit 불일치 결함을 실제로 닫음 (스키마·인덱스 변경 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4891-4902` (`finalizeCancelledExecution`)
  - 상세: `updateExecutionStatus`(`UPDATE ... WHERE id = $1 AND status IN (non-terminal) RETURNING id`, execution-engine.service.ts:8631-8657)의 반환값(`persisted`)을 이제 읽어 0행(동시 writer 선점) 시 emit 을 skip 한다. 쿼리 자체는 이번 diff 이전부터 파라미터화(`$1..$8`)돼 있었고 `WHERE id = $1`(PK)로 단일 행만 대상이라 인덱스 문제도 없다. 변경은 애플리케이션 레벨의 반환값 소비 로직뿐이며 SQL 형태·트랜잭션 경계는 그대로다.
  - 제안: 없음 (개선 확인).

- **[INFO]** `RETURNING` 추가로 COALESCE 결과를 되읽어 DB=wire 정합성 확보
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:640-679` (`finalizeGuarded` CANCELLED 재진입 분기)
  - 상세: `COALESCE(duration_ms, :newDurationMs)` / `COALESCE(finished_at, :newFinishedAt)` 로 값을 정하는 UPDATE 에 `.returning(['duration_ms', 'finished_at'])`(TypeORM QueryBuilder, Postgres `RETURNING` 절)를 추가해 실제 영속값을 in-memory 로 되쓴다. 파라미터는 전부 `setParameter`/QueryBuilder 바인딩(`:id`, `:status`, `:newFinishedAt`, `:newDurationMs`)으로 처리되어 문자열 결합 인젝션 경로가 없다. `RETURNING` 은 별도 라운드트립을 추가하지 않고 같은 UPDATE 문의 일부로 실행된다 — 성능 영향 없음. pg 드라이버가 `numeric`/`bigint` 를 문자열로 반환할 수 있는 문제도 `toFiniteNumber`(codebase/backend/src/shared/utils/terminal-duration.ts:71-78)가 숫자·문자열 양쪽을 좁혀 처리한다.
  - 제안: 없음 (개선 확인).

- **[INFO]** `finalizeGuarded` 의 SELECT→UPDATE 는 명시적 트랜잭션이 아니라 SQL 레벨 guarded WHERE(+COALESCE)로 동시성을 방어하는 기존 설계 — 이번 diff 범위 밖
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:589` (`findOneBy`) ~ `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-656` (조건부 UPDATE)
  - 상세: `findOneBy` 로 정본 상태를 읽은 뒤 별도 왕복으로 `WHERE id = :id AND status = :status` 가드 UPDATE 를 실행한다. SELECT-UPDATE 사이의 ABA 레이스는 앱 레벨 `??` 병합이 아니라 UPDATE 문 안의 SQL `COALESCE` 로 "그 순간의" DB 값을 재평가해 닫는 설계이며, 코드 주석(624-639행)에 근거가 상세히 기록돼 있다. 이번 diff 는 이 기존 패턴에 `.returning()` 만 추가했을 뿐 트랜잭션 경계를 바꾸지 않았다.
  - 제안: 조치 불요. 참고로 plan 문서(`plan/in-progress/eia-db-wire-invariant.md` "범위 밖" 절)가 `finalizeStalledExhausted`(자매 셋 중 하나만 트랜잭션 밖)를 별도 PR 로 이미 추적 중임을 확인함 — 이번 diff 에는 해당 함수가 포함되지 않는다.

- **[INFO]** REST 프로젝션에 `durationMs` 컬럼 추가는 스키마 변경 없는 select 목록 확장
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:75-79`(`STATUS_PROJECTION_COLUMNS`), `codebase/backend/src/modules/external-interaction/interaction.service.ts:431-438`(`durationMs: execution.durationMs ?? null`)
  - 상세: `duration_ms` 컬럼은 기존에 이미 존재(`nullable: true`, 이전 PR 에서 도입)하므로 이번 diff 에 신규 마이그레이션이 없다(`find ... -iname '*migration*'` 결과 없음 확인). `getStatus` 는 단일 execution 을 `id` 로 조회하는 projection SELECT 라 페이지네이션·대량 데이터 우려 대상이 아니며, 반복문 내 쿼리도 아니라 N+1 과 무관하다.
  - 제안: 없음.

- **[INFO]** `status IN (...)` 가드에 쓰이는 SQL 리터럴 목록은 사용자 입력이 아닌 enum 파생 상수
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:522-527`(`NON_TERMINAL_STATUSES_SQL`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:543-550`(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)
  - 상세: `elseStatusesSql` 이 raw UPDATE 문자열에 템플릿 삽입되지만(`execution-engine.service.ts:8627-8641`), 값은 `Object.values(ExecutionStatus)` 에서 파생된 고정 enum 리터럴이며 외부 입력 경로가 없어 SQL 인젝션 표면이 아니다. 나머지 바인딩 값은 전부 `$1..$8` 파라미터.
  - 제안: 없음 (기존 코드 주석에도 동일 근거 명시됨 — 재확인 완료).

## 요약

이번 diff 의 실질 코드 변경(`execution-engine.service.ts`/`retry-turn.service.ts`/`interaction.service.ts` 및 대응 스펙)은 스키마·마이그레이션·인덱스를 건드리지 않고, 기존 guarded UPDATE(파라미터화 쿼리, `status IN (...)` 조건, PK `id` 단일행 대상) 패턴 위에 (1) 반환값을 실제로 소비해 "DB 미영속인데 종결 이벤트가 나가는" 결함을 닫고 (2) `COALESCE` UPDATE 에 `RETURNING` 을 추가해 DB 영속값을 wire 로 그대로 실어 "DB=wire" 불변식을 보강했다. 모든 쿼리가 파라미터 바인딩(`$n` 또는 QueryBuilder `:name`)을 쓰고, non-terminal 상태 리스트는 사용자 입력과 무관한 enum 파생 상수라 SQL 인젝션 표면이 없다. 다중 테이블 쓰기(Execution+NodeExecution)는 기존과 동일하게 `dataSource.transaction()` 으로 원자성을 유지하며, 단일 행 조건부 UPDATE 는 트랜잭션 대신 SQL 레벨 가드로 동시성을 방어하는 기존 설계를 그대로 따른다. REST 프로젝션에 추가된 `durationMs` 는 이미 존재하는 컬럼을 select 목록에 포함시킨 것뿐이라 대량 데이터·페이지네이션 영향이 없다. DB 관점에서 새로 도입된 위험은 발견되지 않았다.

## 위험도
NONE
