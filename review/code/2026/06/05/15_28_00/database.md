# Database Review — V086 agent_memory scope updated index

대상: `V086__agent_memory_scope_updated_index.{sql,conf}`
쿼리: `listScopes` (`GET /agent-memories/scopes`) — `WHERE workspace_id=$1 GROUP BY scope_key ORDER BY MAX(updated_at) DESC`

---

## CRITICAL

없음.

---

## WARNING

### W-1: INDEX-ONLY SCAN 보장 불가 — `updated_at` 커버리지의 한계

- **위치**: `V086__agent_memory_scope_updated_index.sql` line 15–16
- **상세**: 인덱스 `(workspace_id, scope_key, updated_at)` 는 `MAX(am.updated_at)` 집계를
  커버한다는 전제로 설계되었으나, **PostgreSQL B-tree 에는 "loose index scan" (distinct prefix skip scan) 이 없다**.
  실제 플래너 동작은 다음과 같다:

  - `workspace_id = $1` 조건으로 인덱스 범위를 좁힌 후, `GROUP BY scope_key` 를 수행하기 위해
    플래너는 `HashAggregate` 또는 `GroupAggregate` 를 선택한다.
  - **`HashAggregate` 경로**: `MAX(updated_at)` 는 heap fetch 없이 인덱스 리프 페이지에서
    직접 읽을 수 있으므로 **index-only scan + hash aggregate** 가 가능하다. 단 `visibility map`
    이 충분히 vacuum 된 페이지에 한해 heap fetch 가 면제된다. vacuum 미완료 페이지에서는
    heap fetch 가 재발생한다.
  - **`GroupAggregate` 경로**: `scope_key` 순으로 스캔할 경우에만 선택되며, 이때 `MAX(updated_at)` 는
    각 그룹의 마지막 값이 아니라 **전체 그룹을 스캔해야** 얻어진다 — Oracle/MySQL 의 skip scan 과 달리
    PostgreSQL 은 각 `scope_key` 그룹을 끝까지 읽어야 하므로 loose index scan 이 아니다.
  - **결론**: vacuum 상태·플래너 통계 품질·`scope_key` 카디널리티에 따라 seq scan + hashagg 보다
    느릴 수 있다. SQL 주석의 "index-only scan 으로 커버" 표현은 과장이다. 정확히는
    "heap fetch 를 최소화하는 covering index" 수준이며, 실제 gain 은 `EXPLAIN (ANALYZE, BUFFERS)`
    로 배포 후 반드시 확인해야 한다.
- **제안**:
  1. 주석의 "index-only scan 으로 커버" 표현을 "heap fetch 를 최소화하는 covering index" 로 수정해
     오해를 방지한다.
  2. 배포 직후 `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` 로 실 플랜을 확인하고 `Heap Fetches` 수치를
     기록한다. `HashAggregate on index` + `Heap Fetches: 0` 이 이상적 목표이며, vacuum 주기가
     길면 `autovacuum_vacuum_cost_delay` 조정 또는 수동 `VACUUM ANALYZE agent_memory` 를 권장한다.

---

## INFO

### I-1: 기존 `idx_agent_memory_scope(workspace_id, scope_key, created_at)` 와의 중복/포함 관계 없음 — 별도 가치 확인

- **위치**: `V073__agent_memory.sql` line 29, `V086` line 15–16
- **상세**: 두 인덱스의 3번째 컬럼이 `created_at` vs `updated_at` 으로 다르므로 **포함 관계가 없다**.
  - `idx_agent_memory_scope`: evict/FIFO (`ORDER BY created_at`) 경로 전용.
  - `idx_agent_memory_scope_updated`: `listScopes` `MAX(updated_at)` 경로 전용.
  - 쿼리 목적이 명확히 분리되어 있고, SQL 주석과 코드 주석 모두 근거를 기술하고 있다. 중복 제거 대상이 아니다.
- **제안**: 현 설계 유지. 향후 `listScopes` 쿼리에 `created_at` 정렬 요구가 추가될 경우 두 인덱스를
  합치는 검토가 가능하나, 현재는 불필요하다.

### I-2: CONCURRENTLY + `.conf` 패턴 — 기존 컨벤션과 일치

- **위치**: `V086__agent_memory_scope_updated_index.conf` line 1
- **상세**: `executeInTransaction=false` 단일 라인 패턴은 V022 ~ V079 의 모든 CONCURRENTLY 마이그레이션과
  동일하다. `IF NOT EXISTS` 가 포함되어 **멱등성**이 보장된다. DOWN 주석
  (`DROP INDEX CONCURRENTLY IF EXISTS`) 도 명시되어 있다. 컨벤션 준수 완료.
- **제안**: 없음.

### I-3: 인덱스 생성 실패(INVALID 상태) 리스크 — 모니터링 필요

- **위치**: `V086__agent_memory_scope_updated_index.sql` line 15
- **상세**: `CREATE INDEX CONCURRENTLY` 는 빌드 중 충돌(데드락, 쿼리 타임아웃 등)로 `INVALID` 상태로
  남을 수 있다. e2e 테스트에서 `indisvalid=t` 확인이 이미 수행되었다고 기술되어 있으므로
  정상 경로는 검증된 상태이다. 그러나 **프로덕션 배포 시** 장기 실행 쿼리가 lock을 선점하고 있으면
  CONCURRENTLY 빌드가 수 분~수십 분 대기 후 실패할 수 있다.
  - INVALID 인덱스는 `pg_index WHERE indisvalid = false` 로 탐지되며, Flyway 는 이를 성공으로
    처리해 다음 마이그레이션이 진행된다.
  - INVALID 인덱스는 플래너가 사용하지 않고, write 에는 오버헤드를 유발한다.
- **제안**:
  1. 배포 후 `SELECT indexname FROM pg_indexes WHERE tablename='agent_memory'` 와
     `SELECT indisvalid FROM pg_index JOIN pg_class ON pg_class.oid=pg_index.indexrelid WHERE relname='idx_agent_memory_scope_updated'` 를
     모니터링 단계에 추가한다.
  2. INVALID 발견 시 `DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memory_scope_updated` 후
     `CREATE INDEX CONCURRENTLY` 를 수동 재실행한다. Flyway checksum 충돌 방지를 위해 재실행은
     마이그레이션 파일 외부(psql 직접)로 수행한다.

### I-4: write 오버헤드 — 수용 가능 수준

- **위치**: `V086__agent_memory_scope_updated_index.sql` line 15–16
- **상세**: `agent_memory` 테이블에 B-tree 인덱스가 1개 추가된다. 기존에 이미
  `idx_agent_memory_scope(workspace_id, scope_key, created_at)` + 최대 6개 HNSW partial index
  (V074~V079) 가 존재하므로 인덱스 총 수는 7→8개가 된다. B-tree write overhead 는 HNSW 대비
  경미하다. `INSERT/UPDATE` 빈도가 read 보다 낮은 메모리 저장소 특성상 오버헤드는 수용 가능하다.
- **제안**: 없음. 단, `agent_memory` row 수가 수백만 건 이상으로 증가하는 경우 `pg_stat_user_indexes`
  로 `idx_agent_memory_scope_updated` 의 `idx_scan` 수치를 정기 점검해 실사용 여부를 확인한다.

---

## 요약

V086 마이그레이션은 `listScopes` 쿼리의 `MAX(updated_at)` filesort를 해소하기 위해
`(workspace_id, scope_key, updated_at)` B-tree 인덱스를 CONCURRENTLY 방식으로 추가한다.
`executeInTransaction=false` + `IF NOT EXISTS` 패턴은 기존 컨벤션(V022~V079)과 완전히 일치하며
무중단 배포 안전성도 충족된다. 기존 `idx_agent_memory_scope` 와는 3번째 컬럼이 달라 포함 관계가
없고 용도가 분리되어 중복이 아니다. 주요 리스크는 두 가지다: (1) SQL 주석이 "index-only scan" 으로
단언하고 있으나 PostgreSQL B-tree에 loose index scan이 없어 실제 gain은 vacuum 상태와 플래너 통계에
의존한다는 점, (2) CONCURRENTLY 빌드 실패 시 INVALID 인덱스가 write 오버헤드를 유발한다는 점.
둘 다 배포 후 `EXPLAIN ANALYZE` + `indisvalid` 확인으로 즉시 탐지·대응 가능하다. 블로킹 이슈는 없다.

---

## 위험도

LOW

---

BLOCK: NO
