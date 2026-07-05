# 데이터베이스(Database) 리뷰 — V106 schedule.trigger_id 인덱스

## 발견사항

- **[INFO]** 인덱스는 단일 컬럼 `(trigger_id)` — 이것으로 충분, 복합 인덱스 불필요
  - 위치: `codebase/backend/migrations/V106__schedule_trigger_id_index.sql`
  - 상세: 실제 호출부(`triggers.service.ts` `findAll`)의 쿼리는 `scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds), workspaceId } })` 이다. `schedule` 테이블 스키마(`V001__initial_schema.sql`)를 확인하면 `trigger_id UUID NOT NULL REFERENCES trigger(id) ON DELETE CASCADE` 이고, 트리거:스케줄 = 1:1 관계라 `trigger_id` 자체의 selectivity 가 매우 높다(사실상 유니크에 가까움). `workspace_id` 는 이미 `trigger_id` 로 결정되는 행을 재확인하는 보조 필터일 뿐이라 `(trigger_id, workspace_id)` 복합 인덱스로 확장해도 실질 이득이 거의 없다 — Postgres 플래너는 `trigger_id IN (...)` 하나만으로 이미 각 행을 1~0개로 좁히므로, 남은 `workspace_id` 조건은 인덱스 스캔 후 필터(heap access 또는 index condition 재확인) 비용이 무시할 수준이다. 단일 컬럼 인덱스가 크기·유지비 면에서도 더 효율적이며, 프롬프트가 요청한 "단일 vs 복합 적정성" 판단에 대해 **단일 컬럼으로 충분**하다고 결론.
  - 제안: 현행 유지. 참고로 `workspace_id` 는 이미 애플리케이션 레이어에서 cross-workspace 데이터 누수 방지용 이중 스코프 필터로 쓰이고 있고(security 리뷰 기존 확인), 인덱스 설계와는 별개 목적이므로 그대로 두면 된다.

- **[INFO]** `CONCURRENTLY` + `executeInTransaction=false` 조합, 무중단 배포 안전성 확인
  - 위치: `V106__schedule_trigger_id_index.sql`, `V106__schedule_trigger_id_index.conf`
  - 상세: `CREATE INDEX CONCURRENTLY` 는 PostgreSQL 트랜잭션 블록 내에서 실행할 수 없다(에러 발생). Flyway 는 기본적으로 마이그레이션을 트랜잭션으로 감싸므로, 동봉된 `.conf` 파일의 `executeInTransaction=false` 없이는 이 SQL 이 아예 실행 실패한다 — 두 파일이 반드시 짝을 이뤄야 하며 실제로 그렇게 되어 있다. 내용은 기존에 검증된 `V105__execution_workflow_status_index.conf` 와 바이트 단위로 동일(`executeInTransaction=false` 한 줄)하며, 리포지토리 내 CONCURRENTLY 계열 마이그레이션 30여 건이 모두 같은 패턴을 따른다(`V022`, `V034`, `V047`, `V099` 등). `CONCURRENTLY` 는 테이블에 대한 강한 락(`ACCESS EXCLUSIVE`) 없이 `SHARE UPDATE EXCLUSIVE` 수준으로 진행되어 동시 읽기/쓰기를 차단하지 않으므로 무중단 배포에 안전하다.
  - 제안: 없음 (올바른 구현).

- **[INFO]** 멱등성(idempotency) — `IF NOT EXISTS`
  - 위치: `V106__schedule_trigger_id_index.sql` 라인 5
  - 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id)` 로 재실행 시 안전하다. 다만 알려진 Postgres 특성으로, `CREATE INDEX CONCURRENTLY` 가 중간에 실패하면 `INVALID` 상태의 인덱스가 남을 수 있고 이 경우 `IF NOT EXISTS` 는 그 invalid 인덱스가 "존재"하는 것으로 간주해 재생성을 건너뛴다(수동으로 `DROP INDEX CONCURRENTLY` 후 재실행 필요). 이는 이 마이그레이션만의 결함이 아니라 Postgres `CONCURRENTLY` 자체의 일반적 한계이며, 리포지토리의 기존 30여 개 CONCURRENTLY 마이그레이션과 동일 리스크 프로파일이라 이 PR 범위에서 추가 조치할 필요는 없다.
  - 제안: 없음 (운영 절차상 배포 후 `pg_index.indisvalid` 확인은 인프라/운영 문서 영역이지 이 마이그레이션 코드의 결함 아님).

- **[INFO]** 네이밍 컨벤션 일관성
  - 위치: 파일명 `V106__schedule_trigger_id_index.sql`, 인덱스명 `idx_schedule_trigger_id`
  - 상세: `idx_<table>_<column(s)>` 규약을 따르며 `V105__execution_workflow_status_index.sql` / `idx_execution_workflow_status` 와 동일 패턴. 버전 번호(V106)도 최신 마이그레이션(V105)에 이어 연속적이라 충돌 없음.
  - 제안: 없음.

- **[INFO]** N+1 회피 및 트랜잭션/커넥션 관리 (참고 확인, 이번 diff 의 핵심은 아니나 인덱스가 보호하는 쿼리의 맥락)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `findAll()`
  - 상세: `scheduleTriggerIds.length > 0` 가드로 schedule 타입이 없으면 조회 자체를 스킵하고, 있으면 `IN (...)` 배치 조회 1회로 처리해 N+1 을 회피한다. 단일 읽기 전용 조회이고 별도 상태 변경이 없어 트랜잭션 래핑이 불필요하며, `@InjectRepository` 를 통한 TypeORM pool 사용도 기존 패턴과 동일하다. 파라미터는 `In(scheduleTriggerIds)` 와 `workspaceId` 모두 TypeORM 이 파라미터 바인딩하므로 SQL 인젝션 벡터 없음. 이 항목은 V106 인덱스가 정확히 이 쿼리를 겨냥한 것임을 재확인하는 차원의 기록이며 별도 조치 불요(이미 이전 리뷰 라운드에서 database/testing INFO 로 다뤄졌고 이번 diff 는 그 후속 조치).
  - 제안: 없음.

## 요약

`V106__schedule_trigger_id_index.sql`/`.conf` 는 이전 리뷰 라운드(17_44_41)에서 지적된 `schedule.trigger_id` 인덱스 부재(Postgres 는 FK 에 자동 인덱스를 만들지 않음) 갭에 대한 후속 조치다. `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `executeInTransaction=false` 짝은 리포지토리에서 이미 30여 회 검증된 무중단 배포 패턴(`V105` 등)을 그대로 미러링했고 내용도 정확하다. 대상 쿼리(`triggerId IN (...) AND workspaceId = ?`)에 대해 `trigger_id` 단일 컬럼 인덱스는 1:1 관계 특성상 이미 충분한 selectivity 를 제공하므로 복합 인덱스로 확장할 실익이 없다. 네이밍·멱등성·락 안전성 모두 기존 컨벤션과 일치하며, 이번 diff 자체에서 새로 발견된 CRITICAL/WARNING 급 문제는 없다.

## 위험도

NONE

관련 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-list-cron-nextrun-6ecaff/codebase/backend/migrations/V106__schedule_trigger_id_index.sql`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-list-cron-nextrun-6ecaff/codebase/backend/migrations/V106__schedule_trigger_id_index.conf`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-list-cron-nextrun-6ecaff/codebase/backend/src/modules/triggers/triggers.service.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-list-cron-nextrun-6ecaff/codebase/backend/migrations/V001__initial_schema.sql` (schedule 테이블 스키마 참조)
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-list-cron-nextrun-6ecaff/codebase/backend/migrations/V105__execution_workflow_status_index.sql` (미러링 대상 선례)
