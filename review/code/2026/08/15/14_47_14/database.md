# 데이터베이스(Database) 리뷰

## 검토 범위 요약

이번 diff 의 실질 코드 변경은 4개 파일이다.

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
   `finalizeCancelledExecution`: guarded UPDATE(`updateExecutionStatus`)의 반환값(`persisted`)을
   읽어, 0행(동시 writer 선점)이면 재조회 후 `CANCELLED` 일 때만 emit.
2. `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `finalizeGuarded`
   CANCELLED 재진입 분기에 `.returning(['duration_ms', 'finished_at'])` 추가로 `COALESCE` 가
   실제로 고른 영속값을 되읽음.
3. `codebase/backend/src/modules/external-interaction/interaction.service.ts` —
   `STATUS_PROJECTION_COLUMNS` 에 `durationMs` 추가, 응답에 영속 컬럼값을 그대로 실음.
4. `codebase/backend/src/shared/utils/terminal-duration.ts` — `toPersistedDate` 헬퍼 신규(
   `RETURNING` 원본 행의 timestamptz 파싱, `toFiniteNumber` 자매).

나머지(CHANGELOG, DTO, spec, plan, 이전 리뷰 라운드 산출물, mdx 문서)는 DB 관점에서 실질 표면이
없다. 직전 리뷰 라운드(`review/code/2026/08/15/13_58_27/database.md`)가 이미 같은 변경계열을
NONE 으로 판정했고, 이번엔 그 라운드의 후속 수정분(RETURNING 결과 소비, `finalizeCancelledExecution`
emit 조건 재정정)을 포함해 소스를 직접 대조했다.

## 발견사항

- **[INFO]** guarded UPDATE 는 단일 SQL 문 안에서 조건부 갱신 + `RETURNING` 을 수행해 TOCTOU 창이 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus` else 분기(`UPDATE execution SET ... WHERE id = $1 AND status IN (...) RETURNING id`)
  - 상세: `Read` 로 직접 확인. `WHERE id = $1`(PK) + `status IN (non-terminal)` 조건과 값 바인딩(`$1..$8`)이 전부 파라미터화돼 있다. `finalizeCancelledExecution`(4899-4929)은 이 함수의 반환(`persisted`)이 `false` 일 때만 `findOneBy({ id })` 로 1회 재조회한다 — 반복문 안이 아니라 "0행 매칭"이라는 예외적 분기 1회 한정이므로 N+1 이 아니다.
  - 제안: 없음.

- **[INFO]** retry-turn `finalizeGuarded` CANCELLED 분기의 `RETURNING` 추가는 라운드트립을 늘리지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `finalizeGuarded`(약 641-676행, `.returning(['duration_ms', 'finished_at'])`)
  - 상세: `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)` 로 값을 정하는 **같은 UPDATE 문**에 `RETURNING` 절만 추가했다 — 추가 SELECT 왕복이 아니라 같은 원자적 문장의 결과를 되읽는 것이다. `(result.affected ?? 0) > 0` 가드 뒤에서만 `result.raw[0]` 을 읽어, 0행(동시 선점) 케이스에서 undefined 접근 위험도 없다. 파라미터는 전부 `setParameter`/QueryBuilder named binding(`:id`, `:status`, `:newFinishedAt`, `:newDurationMs`) — 문자열 결합 인젝션 경로 없음.
  - 제안: 없음.

- **[INFO]** pg 드라이버 값 형태(문자열/Date) 양쪽을 좁히는 헬퍼가 컬럼별로 대칭 적용됨
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toPersistedDate`(신규) / `toFiniteNumber`(기존), 소비처 `retry-turn.service.ts:664,670`
  - 상세: `RETURNING` 으로 받은 `duration_ms`(숫자 컬럼)는 `toFiniteNumber`, `finished_at`(timestamptz 컬럼)는 신규 `toPersistedDate` 로 각각 파싱한다. pg 가 `timestamptz` 를 `Date` 로도 문자열로도 반환할 수 있는 실제 드라이버 동작을 두 형태 모두 테스트(`terminal-duration.spec.ts`)로 고정했다. 직전 리뷰 라운드(`13_58_27/maintainability.md` WARNING)가 지적한 "인라인 재구현·헬퍼 부재"가 이번 diff 에서 실제로 해소됐다.
  - 제안: 없음.

- **[INFO]** `durationMs` REST 프로젝션 추가는 스키마 변경 없는 select 목록 확장, 페이지네이션/대량 데이터 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `STATUS_PROJECTION_COLUMNS`(약 75-79행), `getStatus` 응답 매핑(약 434행 `durationMs: execution.durationMs ?? null`)
  - 상세: `duration_ms` 컬럼은 직전 PR(#1171)에서 이미 도입돼 있어(`execution.entity.ts:62-63`, `@Column({ nullable: true })`) 이번 diff 에 신규 마이그레이션이 없다. `getStatus` 는 `id` 단건 조회(PK, "2단계 조회" projection) 라 대량 데이터·페이지네이션 표면이 아니고, 반복문 안이 아니므로 N+1 과 무관하다.
  - 제안: 없음.

- **[INFO]** `status IN (...)` SQL 에 삽입되는 값은 사용자 입력이 아닌 enum 파생 상수 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(raw UPDATE 문자열에 템플릿 삽입되는 부분)
  - 상세: 이번 diff 가 이 상수 자체를 바꾸지 않았고, `Object.values(ExecutionStatus)` 에서 파생되는 고정 리터럴이라 외부 입력 경로가 없다. 나머지 값 바인딩은 전부 `$n` 파라미터.
  - 제안: 없음.

- **[INFO]** (범위 확인) `finalizeStalledExhausted` 는 이번 diff 에 포함되지 않음 — 트랜잭션 부재는 plan 이 별도 PR 로 명시 추적 중
  - 위치: `plan/in-progress/eia-db-wire-invariant.md` "## 범위 밖 (등재됨)" 절
  - 상세: 종결 헬퍼 3자매 중 `finalizeStalledExhausted` 만 트랜잭션 밖이라는 사실이 문서화돼 있고, 이번 diff 의 실제 코드 변경 파일 목록에 해당 함수는 없다. 이번 리뷰의 판정 범위 밖임을 확인만 하고 별도 조치를 요구하지 않는다.
  - 제안: 없음 — 참고용.

## 요약

이번 diff 의 DB 관련 변경은 스키마·마이그레이션·인덱스를 건드리지 않는다. 핵심은 (1) guarded UPDATE
의 반환값을 실제로 소비해 "DB 에 반영되지 않은 종결 이벤트 발행"을 막고 (2) `COALESCE` UPDATE 에
`RETURNING` 을 추가해 DB 가 실제로 고른 값을 그대로 wire 에 싣는 것이다. 두 수정 모두 추가 SELECT
왕복을 만들지 않는 단일 원자적 SQL 문(`UPDATE ... WHERE ... RETURNING`)에 의존하고, 파라미터
바인딩(`$n` 또는 QueryBuilder named parameter)을 일관되게 써 SQL 인젝션 표면이 없다. `durationMs`
REST 프로젝션 확장은 이미 존재하는 컬럼을 select 목록에 추가한 것뿐이라 대량 데이터·페이지네이션
영향이 없고, 단건 PK 조회라 N+1 표면도 아니다. 직전 리뷰 라운드가 지적했던 날짜 파싱 헬퍼 부재(
유지보수성 WARNING)도 `toPersistedDate` 도입으로 이번 diff 에서 해소됐다. DB 관점에서 새로 도입된
위험은 발견되지 않았다.

## 위험도

NONE
