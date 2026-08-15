# 데이터베이스(Database) 리뷰

## 검토 범위 요약

이번 diff 는 EIA "DB = wire" 불변식을 닫는 작업(및 그 두 차례 `/ai-review` 라운드의 조치분,
관련 spec/plan/CHANGELOG 미러)이다. 실질 DB 표면이 있는 코드 변경은 4개 파일이다.

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
   `finalizeCancelledExecution`(4884-4934행): guarded UPDATE(`updateExecutionStatus`, 8556-8676행
   부근)의 반환값(`persisted`)을 이제 읽어, 0행(동시 writer 선점) 이면 `findOneBy` 로 재조회 후
   `CANCELLED` 일 때만 emit.
2. `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `finalizeGuarded`
   (584행~) CANCELLED 재진입 분기(641-676행)에 `.returning(['duration_ms', 'finished_at'])`
   추가로 `COALESCE` UPDATE 가 실제로 고른 영속값을 되읽음.
3. `codebase/backend/src/modules/external-interaction/interaction.service.ts` —
   `STATUS_PROJECTION_COLUMNS`(72-80행)에 `durationMs` 추가, `getStatus` 응답(438행)에 영속
   컬럼값을 그대로 실음.
4. `codebase/backend/src/shared/utils/terminal-duration.ts` — `toPersistedDate` 헬퍼 신규
   (`RETURNING` 원본 행의 timestamptz 파싱, `toFiniteNumber` 자매).

나머지(CHANGELOG, DTO, spec, plan, mdx 유저가이드, 그리고 이 코드 변경을 이미 두 차례
검토한 이전 `/ai-review` 라운드(`13_58_27`, `14_47_14`) 및 `/consistency-check`(`13_43_10`)
산출물 전체)는 DB 관점에서 실질 표면이 없다. 위 4개 파일은 `Read`/`Grep` 으로 실제 소스를
직접 열어 게이트 번호와 현재 줄 번호가 일치함을 확인했다(`updateExecutionStatus` 는
8556행부터, `finalizeGuarded` 는 584행부터, `STATUS_PROJECTION_COLUMNS` 는 72-80행).

## 발견사항

- **[INFO]** guarded UPDATE 반환값을 실제로 소비하도록 고쳐 "DB 미영속 종결 이벤트" 결함을 닫음 — 스키마·인덱스 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4929` (`finalizeCancelledExecution`), 원자적 조건부 UPDATE는 같은 파일 `updateExecutionStatus` else 분기(약 8660-8690행, `UPDATE execution SET ... WHERE id = $1 AND status IN (...) RETURNING id`)
  - 상세: 종전에는 `status IN (non-terminal)` 조건부 UPDATE(단일 SQL 문, `WHERE id = $1`(PK) 로 단일 행만 대상)의 결과를 읽지 않고 무조건 `EXECUTION_CANCELLED` 를 emit 했다. 이번 diff 는 `persisted` 를 확인해 `false`(0행 매칭 = 다른 writer 가 이미 terminal 로 선점)면 `findOneBy({ id })` 로 재조회한 뒤 실제 DB 상태가 `CANCELLED` 일 때만 emit 한다. 재조회는 `id` PK 단건 조회이며 반복문 안이 아니라 이 분기당 최대 1회이므로 N+1 표면이 아니다. SQL 형태·파라미터 바인딩(`$1..$8`)·트랜잭션 경계는 이번 diff 로 바뀌지 않았다.
  - 제안: 없음 (개선 확인).

- **[INFO]** `retry-turn.service.ts` `RETURNING` 추가는 별도 라운드트립 없이 `COALESCE` 결과를 되읽어 DB=wire 를 맞춤
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-676` (`finalizeGuarded` CANCELLED 재진입 분기)
  - 상세: `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)` 로 값을 정하는 그 UPDATE 문 자체에 `.returning(['duration_ms', 'finished_at'])` 를 추가했다 — PostgreSQL `RETURNING` 절은 같은 문장 실행의 일부라 추가 SELECT 왕복을 만들지 않는다. 파라미터는 전부 TypeORM QueryBuilder named binding(`:id`, `:status`, `:newFinishedAt`, `:newDurationMs`)으로 처리돼 문자열 결합 인젝션 경로가 없다. 되읽기는 `(result.affected ?? 0) > 0` 가드 뒤(658행)에서만 `result.raw[0]` 을 읽으므로, 0행(동시 cancel 선점) 케이스에서 undefined 접근 위험도 없다. pg 드라이버가 `duration_ms`(정수)/`finished_at`(timestamptz)를 문자열로도 반환할 수 있는 문제는 각각 `toFiniteNumber`/`toPersistedDate`(둘 다 파싱 실패 시 `null` 반환, 실패 시 기존 in-memory 값 보존)가 흡수한다.
  - 제안: 없음 (개선 확인).

- **[INFO]** `finalizeGuarded` 의 SELECT→UPDATE 는 명시적 트랜잭션이 아니라 SQL 레벨 guarded WHERE(+COALESCE)로 동시성을 방어하는 기존 설계 — 이번 diff 범위 밖
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:590`(`findOneBy`) ~ `:641-657`(조건부 UPDATE)
  - 상세: `findOneBy` 로 정본 상태를 읽은 뒤 별도 왕복으로 `WHERE id = :id AND status = :status` 가드 UPDATE 를 실행한다. SELECT-UPDATE 사이의 ABA 레이스는 애플리케이션 레벨 병합이 아니라 UPDATE 문 안의 SQL `COALESCE` 로 "그 순간의" DB 값을 재평가해 닫는 기존 설계이며, 이번 diff 는 이 패턴에 `.returning()` 만 추가했을 뿐 트랜잭션 경계·가드 조건을 바꾸지 않았다. `plan/in-progress/eia-db-wire-invariant.md` "범위 밖" 절이 종결 헬퍼 3자매 중 `finalizeStalledExhausted` 만 트랜잭션 밖이라는 사실을 별도 PR 로 이미 추적 중임을 확인했다 — 이번 diff 의 코드 변경 파일 목록에는 해당 함수가 없다.
  - 제안: 조치 불요. 참고용.

- **[INFO]** REST 프로젝션에 `durationMs` 컬럼 추가는 스키마 변경 없는 select 목록 확장, 대량 데이터·N+1 무관
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:72-80`(`STATUS_PROJECTION_COLUMNS`), `:438`(`durationMs: execution.durationMs ?? null`)
  - 상세: `duration_ms` 컬럼은 이전 PR 에서 이미 도입돼 `@Column({ name: 'duration_ms', nullable: true })` 로 존재하므로(`codebase/backend/src/modules/executions/entities/execution.entity.ts:62-63`, 직접 확인) 이번 diff 에 신규 마이그레이션이 없다(migrations 디렉토리 diff 없음, `git diff --stat origin/main...HEAD` 로 확인). `getStatus` 는 `id`(PK) 단건 조회 projection SELECT 이고 반복문 안이 아니므로 N+1·페이지네이션 우려 대상이 아니다. `satisfies (keyof Execution)[]` 로 컬럼명 오기를 컴파일 타임에 잡는 기존 가드가 신규 필드에도 그대로 적용된다.
  - 제안: 없음.

- **[INFO]** `status IN (...)` 가드에 삽입되는 SQL 리터럴은 사용자 입력이 아닌 enum 파생 상수 — SQL 인젝션 표면 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `NON_TERMINAL_STATUSES_SQL`(522행)/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`(543행), 소비처 `updateExecutionStatus` else 분기(약 8661-8676행)
  - 상세: `elseStatusesSql` 이 raw UPDATE 문자열에 템플릿 삽입되지만, 값은 `Object.values(ExecutionStatus)` 에서 파생되는 고정 enum 리터럴이며 이번 diff 로 바뀌지 않았고 외부 입력 경로가 없다. 나머지 바인딩 값(`execution.id`, `newStatus`, `activeRunningMs`, `finishedAt`, `durationMs`, `outputData`, `resumeCallStack`, `error`)은 전부 `$1..$8` 파라미터.
  - 제안: 없음.

## 요약

이번 diff 의 DB 관련 실질 변경(`execution-engine.service.ts`/`retry-turn.service.ts`/
`interaction.service.ts`/`terminal-duration.ts` 및 대응 spec)은 스키마·마이그레이션·인덱스를
건드리지 않고, 기존 guarded UPDATE(파라미터화 쿼리, `status IN (...)` 조건, PK `id` 단일행
대상) 패턴 위에 (1) 반환값을 실제로 소비해 "DB 미영속인데 종결 이벤트가 나가는" 결함을 닫고
(2) `COALESCE` UPDATE 에 `RETURNING` 을 추가해 DB 가 실제로 고른 값을 wire 로 그대로 실어
"DB=wire" 불변식을 보강했다. 두 수정 모두 추가 SELECT 왕복을 만들지 않는 단일 원자적 SQL 문
(`UPDATE ... WHERE ... RETURNING`)에 의존한다. 모든 쿼리가 파라미터 바인딩(`$n` 또는
QueryBuilder named parameter)을 쓰고, non-terminal 상태 목록은 사용자 입력과 무관한 enum
파생 상수라 SQL 인젝션 표면이 없다. REST 프로젝션에 추가된 `durationMs` 는 이미 존재하는
컬럼을 select 목록에 포함시킨 것뿐이라 대량 데이터·페이지네이션 영향이 없고 단건 PK 조회라
N+1 과도 무관하다. 소스를 직접 `Read`/`Grep` 으로 대조해 이 코드 계열이 이미 두 차례
(`13_58_27`, `14_47_14`) DB 리뷰에서 NONE 판정을 받았음을 확인했고, 이번 라운드에서도 새로
도입된 DB 위험은 발견되지 않았다.

## 위험도

NONE
