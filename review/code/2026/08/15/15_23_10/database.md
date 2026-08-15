# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `finalizeCancelledExecution` — guarded UPDATE 0행 시 추가 재조회(`findOneBy`)를 도입, 단일 PK 조회라 성능·인덱스 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution` (`private async finalizeCancelledExecution(...)`)
  - 상세: `updateExecutionStatus`(`UPDATE ... WHERE id = $1 AND status IN (non-terminal) ... RETURNING id`)가 0행이면, 종전(직전 라운드까지)엔 `savedExecution.status !== CANCELLED` 로 로컬 상태만 보고 skip 여부를 판정했으나 이번 버전은 `this.executionRepository.findOneBy({ id: savedExecution.id })` 로 DB 를 재조회해 `live.status === CANCELLED` 일 때만 emit 한다. 이 재조회는 (a) 드문 경로(동시 writer 가 이미 선점한 0행 매칭 케이스)에서만 실행되고, (b) `id`(PK) 단건 조회라 인덱스·페이지네이션 우려가 없다. 재조회 실패도 catch 해 emit 을 skip 하며 호출부(둘 다 catch 블록)로 예외를 전파하지 않는다 — 안전한 fail-closed.
  - 제안: 없음. 추가 라운드트립은 rare-path 이고 단일 행 PK 조회라 대량 트래픽에도 영향 없음.

- **[INFO]** `finalizeGuarded` CANCELLED 재진입 분기 — `COALESCE(...)` UPDATE 에 `.returning(['duration_ms', 'finished_at'])` 추가, 파라미터화 유지 + 단일 SQL 문 원자성 보존
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `finalizeGuarded` — CANCELLED 분기 (`.returning(['duration_ms', 'finished_at'])` 및 뒤이은 `if ((result.affected ?? 0) > 0) { ... }` 블록)
  - 상세: `UPDATE Execution SET finished_at = COALESCE(finished_at, :newFinishedAt), duration_ms = COALESCE(duration_ms, :newDurationMs) WHERE id = :id AND status = :status RETURNING duration_ms, finished_at` 형태로, 모든 값이 `setParameter`/QueryBuilder 바인딩(`:id`, `:status`, `:newFinishedAt`, `:newDurationMs`)을 통해 전달되어 문자열 결합에 의한 SQL 인젝션 표면이 없다. `RETURNING` 은 같은 UPDATE 문 내에서 실행되므로 별도 SELECT 왕복이 추가되지 않고, COALESCE 가 실제로 어느 쪽 값을 골랐는지와 100% 일치하는 원자적 스냅샷을 되읽는다. `(result.affected ?? 0) > 0` 가드 뒤에서만 `result.raw[0]` 을 읽어 0행(동시 cancel 선점) 케이스에서 undefined 역참조도 없다. pg 드라이버가 `duration_ms`(numeric/bigint)를 문자열로, `finished_at`(timestamptz)을 Date 또는 문자열로 반환할 수 있는 문제는 `toFiniteNumber`/`toPersistedDate`(`codebase/backend/src/shared/utils/terminal-duration.ts`)가 양쪽 형태를 모두 좁혀 처리한다.
  - 제안: 없음.

- **[INFO]** `interaction.service.ts` — `durationMs` 를 프로젝션·응답에 추가. 신규 마이그레이션·인덱스 불필요, N+1·페이지네이션과 무관
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `STATUS_PROJECTION_COLUMNS`(배열에 `'durationMs'` 추가) 및 `getStatus`(`durationMs: execution.durationMs ?? null,`)
  - 상세: `duration_ms` 컬럼은 이 diff 이전에 이미 존재하는 nullable 컬럼이며(`Execution` 엔티티, 별도 PR 에서 도입), 이번 변경은 이미 로드되는 단일 execution(PK `id` 기준 단건 조회, `getStatus` 는 2단계 조회 중 첫 단계가 컬럼 projection)에 필드 하나를 select 목록·응답 매핑에 추가하는 것뿐이다. 반복문 내 쿼리가 아니고, 페이지네이션·대량 데이터 스캔과 무관한 단건 조회 경로다. 신규 마이그레이션 파일도 diff 에 포함돼 있지 않음을 확인했다(`git diff` 상 `entities/`·`migration` 매치 없음).
  - 제안: 없음.

- **[INFO]** `toPersistedDate` 신규 헬퍼 — 순수 함수, DB 접근 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toPersistedDate`
  - 상세: `RETURNING` 원본 행의 timestamptz 값(Date 또는 string)을 파싱하는 순수 함수다. 쿼리·커넥션과 무관하고, 자매 `toFiniteNumber` 와 동일 관용구(파싱 실패 시 `null`)를 따른다.
  - 제안: 없음.

- **[INFO]** 이번 diff 에 스키마 변경(마이그레이션·엔티티 컬럼 추가/삭제)이 없음을 직접 확인
  - 상세: `git diff origin/main...HEAD` 를 엔티티·마이그레이션 경로로 필터링한 결과 매치가 없다. `duration_ms`/`finished_at` 컬럼은 기존에 이미 nullable 로 존재하는 컬럼이고, 이번 diff 는 그 컬럼을 (1) 재조회해 emit 값과 일치시키거나 (2) REST 응답 projection 에 추가하는 애플리케이션 레벨 변경뿐이다.
  - 제안: 없음.

## 요약

이번 diff 의 실질 코드 변경(`execution-engine.service.ts` `finalizeCancelledExecution`, `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기, `interaction.service.ts` `durationMs` projection, `terminal-duration.ts` 신규 헬퍼)은 모두 이미 존재하는 nullable 컬럼(`duration_ms`, `finished_at`)을 다루며 스키마·마이그레이션·인덱스를 건드리지 않는다. 모든 쿼리가 파라미터 바인딩(`$n` 또는 QueryBuilder `:name`)을 사용해 SQL 인젝션 표면이 없고, 조건부 UPDATE 는 `id`(PK) + `status` 단일행 대상이라 대량 데이터·페이지네이션 우려가 없다. 새로 추가된 `RETURNING` 절과 재조회(`findOneBy`)는 각각 (1) 같은 UPDATE 문 내에서 원자적으로 실행돼 추가 SELECT-then-write 창을 만들지 않고, (2) 드문 0행 레이스 경로에서만 실행되는 단건 PK 조회라 성능 영향이 미미하다. N+1, 트랜잭션 경계 변경, 커넥션 누수, 대용량 스캔 등 DB 관점의 새로운 위험은 발견되지 않았다. 이 소재는 이미 같은 PR 계열의 이전 리뷰 라운드(`13_58_27`, `14_47_14`, `15_00_41`)에서도 database 리뷰가 NONE 위험도로 판정한 바 있으며, 이번 라운드에서 소스를 직접 재확인한 결과도 동일하다.

## 위험도

NONE
