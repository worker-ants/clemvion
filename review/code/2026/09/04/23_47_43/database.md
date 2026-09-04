# 데이터베이스(Database) 코드 리뷰

## 검토 범위

이 changeset 의 실질 DB 변경은 신규 Flyway 마이그레이션 쌍 `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}` (schedule 인덱스를 `(next_run_at, is_active) WHERE is_active` → `(workspace_id, next_run_at)` 로 교체) 와, 그 대상 쿼리(`GET /api/schedules`)를 검증하는 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 신규 e2e 2건(schema drift 방지 + 워크스페이스 격리·정렬), 그리고 `schedules.service.spec.ts` 의 유닛 테스트 1건 추가다. `spec/1-data-model.md` §3+`## Rationale`, `spec/data-flow/10-triggers.md` §2.1, `plan/complete/spec-draft-schedule-index.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 같은 결정의 문서 미러다. 나머지 다수 파일(`review/code/2026/09/04/23_02_51/**`, `review/code/2026/09/04/23_26_09/**`, `review/consistency/2026/09/04/22_34_55/**`, `review/consistency/2026/09/04/22_43_40/**`)은 이 저장소 관례상 커밋되는 **선행 두 라운드 리뷰/consistency-check 산출물**이며, DB 코드 자체가 아니다.

이 changeset 은 이미 **직전 두 라운드(`23_02_51`, `23_26_09`)에서 database 관점으로 각각 LOW 판정**을 받았고, 두 라운드가 낸 warning(전부 database 카테고리 자체가 아니라 side_effect/documentation/testing 소관)은 `RESOLUTION.md` 기준 모두 조치됐다. 이번 라운드는 그 조치 결과가 실제 소스에 반영됐는지 및 새로 도입된 DB 결함이 있는지를 직접 파일을 열어 재검증하는 데 집중했다.

### 직접 확인한 사실

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` 현재 상태: `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` → `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;` 순서로 DROP-먼저 패턴이 실제로 적용돼 있다(23_02_51 W1 조치 확인).
- `codebase/backend/migrations/README.md` §5 "`executeInTransaction=false` 파일은 `CREATE INDEX CONCURRENTLY` 를 정확히 한 개만" 컨벤션을 직접 읽었다 — 조문은 **CREATE 개수만** 제한하고 DROP 개수는 제한하지 않는다. V110 은 CREATE 1개 + DROP 2개로 위반이 아니다. 선례 `V056__notification_active_partial_index.sql` (CREATE 1 + DROP 1)과 형태·이유 모두 정합함을 직접 대조로 확인.
- `codebase/backend/migrations/V001__initial_schema.sql:161-171` 로 `schedule` 테이블 정의를 직접 확인 — `workspace_id UUID NOT NULL REFERENCES workspace(id)` 에 컬럼 자체 인덱스가 없다(Postgres 는 FK 컬럼을 자동 인덱싱하지 않음). `next_run_at TIMESTAMPTZ` (nullable). 마이그레이션 헤더의 "schedule 에는 workspace_id 인덱스가 아예 없었다" 주장과 일치.
- `codebase/backend/migrations/` 전체를 grep — `schedule` 테이블에 걸린 인덱스는 V002(`idx_schedule_next_run`, 이번에 DROP), V106(`idx_schedule_trigger_id`, 무관), V110(신규) 뿐. 신규 인덱스와 중복/redundant 되는 기존 인덱스 없음. `V110` 버전 번호 자체도 `V109` 다음으로 충돌 없음.
- `codebase/backend/src/modules/schedules/schedules.service.ts:66-105` (`findAll`) 를 직접 열어 확인 — TypeORM `QueryBuilder` 로 `leftJoinAndSelect` + `where('s.workspace_id = :workspaceId', …)` + 화이트리스트 `orderBy` + `offset/limit` 을 **단일 쿼리**로 구성한다(카운트는 `getCount()` 로 별도 1회, N+1 아님). `resolveOrderBy` 가 컬럼명을 고정 맵으로 화이트리스트해 정렬 축 인젝션을 막는다(param 값이 아니라 식별자이므로 바인딩이 아니라 화이트리스트가 정답인 자리).
- `codebase/backend/src/common/dto/pagination.dto.ts` 를 직접 열어 확인 — `sort` 는 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 로 1차 방어, `order` 는 `@IsIn(['asc','desc'])`, `limit` 은 `@Max(100)` 으로 상한. DTO 레벨 화이트리스트 + 서비스 레벨 화이트리스트의 이중 방어가 실제로 소스에 있다.
- `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` 의 실제 diff 를 직접 열어 대조 — 벤치마크 수치(5.99/12.77/0.30 ms, 2.2배, +2.6 MB)가 마이그레이션 헤더·`## Rationale` 항목 사이에서 정확히 일치한다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 실제 diff 를 직접 열어 확인 — 신규 schema 테스트는 `pg_index.indisvalid=true` + `indexdef` 컬럼 순서 + non-partial 여부(신규) 와 `idx_schedule_next_run` 부재(구 인덱스)를 **양방향**으로 확인한다. `J.` 테스트는 실제 `GET /api/schedules?sort=next_run_at&order=asc|desc` 를 호출해 워크스페이스 격리 + 정렬(asc/desc 양방향, 값이 다른 행 ≥2 확보) + 기본 정렬(`created_at`)까지 실제 API 응답으로 단언한다 — "인덱스가 존재한다"와 "그 인덱스로 서빙되는 쿼리가 옳다"는 별개 명제를 둘 다 닫는다.

## 발견사항

- **[INFO]** `CREATE INDEX CONCURRENTLY` 실패 후 재실행 시 invalid 인덱스가 남을 수 있는 위험은 이번 diff 에서 이미 해소됨 (확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`
  - 상세: `IF NOT EXISTS`/`IF EXISTS` 는 이름 존재만 보고 `indisvalid` 를 보지 않으므로, `CREATE INDEX CONCURRENTLY` 가 중간 실패로 invalid 인덱스를 남긴 채 재실행되면 원래는 CREATE 가 스킵되고 뒤이은 옛 인덱스 DROP 만 정상 수행돼 "쓸 수 있는 인덱스 0개"(seq scan 회귀, 조회 성능 원상복구 불가)로 귀결할 수 있었다. 이 diff 는 CREATE 앞에 신규 인덱스명에 대한 `DROP INDEX CONCURRENTLY IF EXISTS` 를 둬 이를 막는다 — 정상 첫 실행은 no-op, 실패 후 재실행에서만 invalid 잔재를 치운다. `RESOLUTION.md` (`review/code/2026/09/04/23_02_51/RESOLUTION.md`)는 UNIQUE+중복 데이터로 결정적 실패를 재현해 종전 순서가 실제로 "인덱스 0개"를 만들고 신규 순서가 정상 복구됨을 실증했다고 기록한다 — 이 재현 자체는 본 라운드에서 재실행하지 않았고 문서 기록을 근거로 신뢰했다.
  - 제안: 없음(이미 조치됨). 선례 `V056`/`V106` 은 이 DROP-먼저 줄이 없어 같은 잠재 위험이 남아 있으나, 이미 적용된 마이그레이션은 append-only 라 소급 수정 대상이 아니고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 규약 성문화 후속 항목으로 등재돼 있다.

- **[INFO]** DROP-먼저 패턴이 만드는 비대칭(이미 성공한 마이그레이션의 수동 재실행 시 살아있는 인덱스 재빌드)이 헤더에 명시돼 있음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-58`
  - 상세: 선두 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run` 는 대상이 실패가 남긴 invalid 잔재인지 정상 인덱스인지 구분하지 않는다 — 구분하려면 `indisvalid` 를 읽는 조건 분기(`DO` 블록)가 필요한데 `DO` 는 트랜잭션이라 같은 파일에서 `CONCURRENTLY` 와 섞을 수 없다. 그래서 이미 성공한 이 마이그레이션을 Flyway 정상 흐름 밖에서 수동 재실행하면 살아 있는 인덱스를 지우고 처음부터 다시 만든다(그 재빌드 구간 동안 목록 조회가 seq scan 으로 떨어짐). Flyway 는 성공한 마이그레이션을 다시 실행하지 않으므로 **정상 배포 흐름에서는 발생하지 않는다.**
  - 제안: 없음 — 트레이드오프의 반대편(DROP-먼저 없이 실패 후 재실행하면 인덱스 0개로 영구 고정)이 더 나쁘기 때문에 의도적으로 택한 것이며 근거가 문서화돼 있다. 두 위험(V056/V106 의 "실패 후 재실행 시 0개" vs V110 의 "성공 후 수동 재실행 시 재빌드 구간 seq scan")을 규약 차원에서 어느 쪽으로 통일할지는 이미 후속 항목으로 등재됨.

- **[INFO]** partial → full 인덱스 전환에 따른 쓰기 경로(INSERT/UPDATE) 유지비용 증가는 크기 추정(+2.6 MB, 200,000행 기준)으로만 문서화되고 별도 처리량/지연시간 벤치마크는 없음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:26-27`
  - 상세: 종전 인덱스는 `WHERE is_active = TRUE` partial 이라 활성 스케줄(실측 70%)만 유지보수 대상이었다. 신규 `(workspace_id, next_run_at)` 은 non-partial 이라 비활성 스케줄도 포함한다. `ScheduleRunnerService` 가 스케줄 발사 후 `UPDATE last_run_at, next_run_at` 을 반복 실행하므로(cron tick 마다), 워크스페이스당 스케줄 수·평균 cron 주기가 매우 커지는 규모에서는 이 증가분이 누적될 수 있다. 읽기 개선폭(20배)이 압도적이라 결정을 뒤집을 사안은 아니며, 문서(spec `## Rationale`)도 이 트레이드오프를 명시적으로 인지하고 있다.
  - 제안: 배포 후 실 운영 스케일에서 `pg_stat_user_tables.n_tup_upd`·인덱스 쓰기 지연을 모니터링하는 정도로 충분. 이번 PR 을 막을 사유 아님.

- **[INFO]** SQL 인젝션·N+1·트랜잭션·커넥션 관리·대량 데이터 페이지네이션 — 새로 도입된 문제 없음 (확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (정적 DDL, 리터럴만), `codebase/backend/src/modules/schedules/schedules.service.ts:66-105`, `codebase/backend/src/common/dto/pagination.dto.ts`
  - 상세: 마이그레이션은 사용자 입력이나 동적 문자열 결합이 없는 정적 DDL. `findAll` 은 조인 포함 단일 쿼리 + `getCount()` 1회로 반복문 내 개별 쿼리(N+1) 패턴이 없다. `.conf` 의 `executeInTransaction=false` 는 `CREATE/DROP INDEX CONCURRENTLY` 가 트랜잭션 블록 안에서 실행 불가능하기 때문에 필요하며 정확히 설정돼 있다. e2e 신규 테스트는 파일 공유 `db` 클라이언트(`beforeAll`/`afterAll` 로 열고 닫음)를 재사용해 별도 커넥션 누수가 없다. 목록 쿼리는 이미 `LIMIT`(≤100)/`OFFSET` 페이지네이션을 쓰고 있고 이 마이그레이션이 그 진입 인덱스를 제공한다.

## 요약

이 changeset 의 핵심은 `schedule` 목록 조회(`WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`)가 사용되지 않던 부분 인덱스(`(next_run_at, is_active) WHERE is_active`) 때문에 매번 전 테이블 Parallel Seq Scan 을 하고 있었다는 사실을 `EXPLAIN (ANALYZE, BUFFERS)` 실측(200,000행/2,000 워크스페이스, 5회 median)으로 확인하고, 실제 접근 패턴에 맞는 `(workspace_id, next_run_at)` 복합 인덱스로 교체하는 Flyway 마이그레이션(V110)이다. 목표 쿼리는 5.99ms → 0.30ms(20배), 기본 정렬(`created_at`)도 6.89ms → 1.08ms 로 개선되며, "정렬 컬럼만 남기는 안이 오히려 2.2배 느려진다"는 반직관적 대안까지 실측·`EXPLAIN` 계획으로 기각 근거를 남겼다. `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` + `IF NOT EXISTS`/`IF EXISTS` 조합은 무중단 배포 요건을 충족하며, 두 차례의 선행 리뷰가 지적한 "재실행 시 invalid 인덱스 잔존" 위험은 CREATE 앞에 동일 이름 DROP 을 추가해 실제로 해소됐음을 소스에서 직접 확인했다(선례 `V056`/`V106` 보다 한 단계 더 견고함). 신규 e2e 테스트는 인덱스 존재·컬럼 순서·구 인덱스 부재를 양방향으로, 그리고 그 인덱스가 서빙하는 실제 API(워크스페이스 격리 + 정렬)를 별도로 검증해 "인덱스가 있다"와 "그 인덱스로 쿼리가 옳게 동작한다"는 두 명제를 모두 닫는다. SQL 인젝션 표면은 정적 DDL과 DTO+서비스 이중 화이트리스트로 차단되어 있고, N+1·트랜잭션·커넥션 관리 관점에서 새로 도입된 결함은 없다. 남은 항목은 모두 이미 문서화·수용된 트레이드오프(DROP-먼저 패턴의 잔여 비대칭, 쓰기 경로 비용 미실측)이며 규약 차원의 후속 성문화는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 등재되어 있어 이 PR 을 막을 사유가 아니다.

## 위험도
LOW
