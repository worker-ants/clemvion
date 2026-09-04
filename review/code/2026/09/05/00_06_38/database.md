# 데이터베이스(Database) 코드 리뷰

## 검토 범위

이 changeset(원본 대비 65개 파일, 4,610줄 추가)의 실질 DB 변경은 신규 Flyway 마이그레이션 쌍
`codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}` (schedule
목록 조회가 쓰지 않던 부분 인덱스 `idx_schedule_next_run (next_run_at, is_active) WHERE
is_active` 를 실제 접근 패턴에 맞는 `idx_schedule_workspace_next_run (workspace_id,
next_run_at)` 로 교체) 와, 그 대상 쿼리(`GET /api/schedules`)를 검증하는
`codebase/backend/test/schedule-trigger.e2e-spec.ts` 신규 e2e 2건(스키마 drift 방지 + 워크스페이스
격리·정렬), `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 유닛 테스트
1건이다. `spec/1-data-model.md`(§3 + `## Rationale`), `spec/data-flow/10-triggers.md`(§2.1),
`plan/complete/spec-draft-schedule-index.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
는 같은 결정의 문서 미러다. 나머지 다수 파일(`review/code/2026/09/04/{23_02_51,23_26_09,23_47_43}/**`,
`review/consistency/2026/09/04/{22_34_55,22_43_40}/**`)은 이 changeset 이 포함하는 **선행 3라운드
코드 리뷰 + 2라운드 consistency-check 산출물**이며 DB 코드 자체가 아니다.

이 changeset 은 이미 세 차례(`23_02_51`, `23_26_09`, `23_47_43`) database 관점 LOW 판정을 받았고,
그 라운드들이 낸 database 관련 실질 결함(`23_02_51` "CREATE INDEX CONCURRENTLY IF NOT EXISTS 재실행
시 invalid 인덱스 잔존 위험")은 DROP-먼저(DROP→CREATE→DROP) 패턴 추가로 조치되어 실제로 재현·검증까지
거쳤다(`review/code/2026/09/04/23_02_51/RESOLUTION.md` — UNIQUE 인덱스+중복 데이터로 결정적 실패를
만들어 종전 순서가 "인덱스 0개"로 귀결하고 신규 순서가 정상 복구됨을 직접 재현). 이번 라운드는 그
조치가 실제 소스에 반영돼 있는지와 새로 도입된 DB 결함이 있는지를 직접 파일을 열어 재확인하는 데
집중했다.

### 직접 확인한 사실

- `V110__schedule_workspace_next_run_index.sql` 현재 상태(직접 Read): `DROP INDEX CONCURRENTLY
  IF EXISTS idx_schedule_workspace_next_run;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` → `DROP INDEX
  CONCURRENTLY IF EXISTS idx_schedule_next_run;` 순서. 어느 지점에서 중단돼도 DB 는 "마이그레이션
  이전" 또는 "완료" 상태이지 "인덱스 0개" 상태로 가지 않는다 — DROP-먼저 패턴이 실제로 적용됨.
- `.conf` 에 `executeInTransaction=false` — `CREATE/DROP INDEX CONCURRENTLY` 는 트랜잭션 블록
  안에서 실행 불가하므로 필요하고 정확히 설정돼 있다.
- `SchedulesService.findAll`(`codebase/backend/src/modules/schedules/schedules.service.ts:66-105`,
  직접 Read): TypeORM `QueryBuilder` 로 `leftJoinAndSelect` + `where('s.workspace_id =
  :workspaceId', …)` + 화이트리스트 `orderBy` + `offset/limit` 을 단일 쿼리로 구성, 카운트는
  `getCount()` 로 별도 1회 — 반복문 내 개별 쿼리(N+1) 패턴 없음. `resolveOrderBy` 가 정렬 컬럼을
  고정 맵(`allowed: Record<string, string>`)으로 화이트리스트해 정렬 축을 통한 SQL 인젝션을 막는다
  (컬럼 식별자는 파라미터 바인딩이 안 되는 자리라 화이트리스트가 정답).
- `codebase/backend/src/common/dto/pagination.dto.ts` 를 통해 `sort` 는
  `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)`, `order` 는 `@IsIn(['asc','desc'])`, `limit` 은
  `@Max(100)` 상한 — DTO 레벨 + 서비스 레벨 이중 화이트리스트.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 신규 schema 테스트(직접 Read, L66-83)는
  `pg_index.indisvalid=true` + `pg_get_indexdef` 로 컬럼 순서(`(workspace_id, next_run_at)`) +
  non-partial(`WHERE` 없음)을 확인하고, 구 인덱스는 `relkind = 'i'` 필터까지 포함해 부재를 확인한다
  — 신규 인덱스 존재와 구 인덱스 삭제를 양방향으로 검증. `J.` 테스트(L347-411)는 실제
  `GET /api/schedules?sort=next_run_at&order=asc|desc` 호출로 워크스페이스 격리(다른 워크스페이스
  조회 시 `toEqual([])` 직접 단언 — `23_47_43` W1 에서 "빈 배열이라 루프가 안 도는" 공허 단언을
  이미 교정) + 정렬(asc/desc 양방향, 서로 다른 `next_run_at` 값 ≥2 확보) + 기본 정렬(`created_at`)
  까지 실 API 응답으로 확인 — "인덱스가 존재한다"와 "그 인덱스로 서빙되는 쿼리가 옳다"는 별개
  명제를 둘 다 닫는다.
- `codebase/backend/migrations/` 전체 grep — `schedule` 에 걸린 인덱스는 V002(`idx_schedule_next_run`,
  이번에 DROP), V106(`idx_schedule_trigger_id`, 무관), V110(신규)뿐. 신규 인덱스와 중복되는
  기존 인덱스 없음. 버전 번호(`V110`)도 직전(`V109`)과 충돌 없음.
- 마이그레이션 SQL·DDL 은 사용자 입력이나 동적 문자열 결합이 없는 정적 리터럴뿐 — SQL 인젝션
  표면 없음.

## 발견사항

- **[INFO]** partial → full 인덱스 전환에 따른 쓰기 경로(INSERT/UPDATE) 유지비용 증가는 크기
  추정(+2.6 MB, 200,000행 기준)으로만 문서화되고 별도 처리량/지연시간 벤치마크는 없음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:26-27`
  - 상세: 종전 인덱스는 `WHERE is_active = TRUE` partial 이라 활성 스케줄(실측 70%)만 유지보수
    대상이었다. 신규 `(workspace_id, next_run_at)` 은 non-partial 이라 비활성 스케줄도 인덱스
    갱신 대상에 포함된다. `ScheduleRunnerService` 의 발사 후 `UPDATE last_run_at, next_run_at`
    이 cron tick 마다 반복되므로, 워크스페이스당 스케줄 수·평균 cron 주기가 매우 커지는 규모에서
    이 증가분이 누적될 수 있다. 읽기 개선폭(20배, `EXPLAIN (ANALYZE, BUFFERS)` 실측)이 압도적이라
    결정을 뒤집을 사안은 아니며, `spec/1-data-model.md` `## Rationale` 도 이 트레이드오프를 명시적
    으로 인지하고 있다.
  - 제안: 배포를 막을 사유 아님. 실 운영 스케일에서 `pg_stat_user_tables.n_tup_upd`·인덱스 쓰기
    지연을 모니터링하는 정도면 충분.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 실패 후 재실행 시 invalid 인덱스가 남는 위험은 이
  changeset 안에서 이미 해소·실증됨 (확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`
  - 상세: `IF NOT EXISTS`/`IF EXISTS` 는 이름 존재만 보고 `indisvalid` 를 보지 않는다 —
    CREATE 앞에 신규 인덱스명에 대한 `DROP INDEX CONCURRENTLY IF EXISTS` 를 둬 정상 첫 실행은
    no-op, 실패 후 재실행에서만 invalid 잔재를 치우도록 했다. 다만 이 DROP-먼저 패턴 자체가
    새 비대칭(이미 성공한 마이그레이션을 Flyway 정상 흐름 밖에서 수동 재실행하면 살아 있는
    인덱스를 지우고 재빌드하는 구간 동안 seq scan 으로 떨어짐)을 만드는데, 이는 헤더 주석(L53-58)
    에 명시돼 있고 Flyway 정상 흐름에서는 발생하지 않는다. 선례 `V056`/`V106` 은 이 DROP-먼저
    줄이 없어 반대 위험(재실행 시 인덱스 0개)이 남아 있으나 append-only 라 소급 수정 대상이
    아니고, 규약 차원의 통일 처리는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 후속으로 등재돼 있다.
  - 제안: 없음(이미 조치·실증됨). 후속 항목 진행 상황만 추적하면 충분.

- **[INFO]** SQL 인젝션·N+1·트랜잭션·커넥션 관리·대량 데이터 페이지네이션 관점에서 새로 도입된
  문제 없음 (확인용 기재)
  - 위치: `SchedulesService.findAll`, `pagination.dto.ts`, `V110__*.sql`
  - 상세: 마이그레이션은 정적 DDL 리터럴뿐. `findAll` 은 조인 포함 단일 쿼리 + `getCount()` 1회로
    N+1 없음. `.conf` 의 `executeInTransaction=false` 는 필요·정확. `limit` 은 DTO 에서 100 으로
    상한, `sort`/`order` 는 이중 화이트리스트로 인젝션 차단. 목록 조회는 `OFFSET`/`LIMIT` 페이지
    네이션을 쓰는데, 깊은 페이지(큰 offset)에서는 인덱스가 있어도 Postgres 가 앞쪽 행을 스캔해
    버리는 비용이 남는 일반적 한계가 있다 — 다만 이는 이 PR 이 새로 만든 문제가 아니라 기존
    페이지네이션 설계이며, 이번 인덱스는 오히려 그 스캔 비용의 시작점(첫 진입)을 인덱스 스캔으로
    바꿔 개선하는 방향이라 이 changeset 이 악화시키는 지점이 아니다.

## 요약

이 changeset 의 핵심은 `schedule` 목록 조회(`WHERE workspace_id = ? ORDER BY next_run_at DESC
LIMIT 20`)가 사용되지 않던 부분 인덱스 때문에 매번 전 테이블 Parallel Seq Scan 을 하던 것을,
`EXPLAIN (ANALYZE, BUFFERS)` 실측(200,000행/2,000 워크스페이스, 5회 median)으로 확인하고 실제
접근 패턴에 맞는 `(workspace_id, next_run_at)` 복합 인덱스로 교체하는 Flyway 마이그레이션(V110)
이다(5.99ms → 0.30ms, 20배). `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` +
DROP-먼저 재실행 안전성 패턴은 이 저장소의 기존 선례(V056)보다 한 단계 더 견고하게 구현돼 있고,
이미 세 차례의 선행 리뷰 라운드가 지적한 database 관련 실질 결함(invalid 인덱스 잔존 위험)은
결정적 재현 테스트로 검증까지 거쳐 조치됐다. `SchedulesService.findAll` 은 파라미터화 쿼리 +
정렬 컬럼 화이트리스트(DTO+서비스 이중)로 SQL 인젝션 표면이 없고, 단일 쿼리 + 별도 카운트 구조라
N+1 문제도 없다. 신규 e2e 테스트는 인덱스 존재·컬럼 순서·구 인덱스 부재를 스키마 레벨에서, 그리고
그 인덱스가 서빙하는 실제 API 응답(워크스페이스 격리 + 정렬 양방향)을 별도로 검증해 두 명제를 모두
닫는다. 이번 라운드에서 직접 소스를 열어 재확인한 결과 새로 도입된 database 결함은 발견하지 못했고,
남은 항목(쓰기 경로 비용 미실측, DROP-먼저 패턴의 잔여 비대칭)은 모두 문서화·수용된 트레이드오프이며
규약 성문화 후속 항목으로 별도 등재돼 있어 이 PR 을 막을 사유가 아니다.

## 위험도
LOW
