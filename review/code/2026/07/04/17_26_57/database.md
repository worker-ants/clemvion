# Database Review — RE-VERIFY (V105 인덱스 커버리지 · advisory lock 트랜잭션)

## 스코프
이전 리뷰가 지적한 두 항목의 재검증:
1. `V105__execution_workflow_status_index.sql` (`(workflow_id, status)` 인덱스, `CONCURRENTLY` + `.conf` `executeInTransaction=false`)가 admission COUNT hot-path 를 실제로 커버하는지.
2. `admitExecutionOrDefer` 의 `pg_advisory_xact_lock` 이 UPDATE 를 감싸는 트랜잭션 구조에 lock/isolation 문제가 없는지.

## 발견사항

- **[INFO]** V105 인덱스는 workflow-cap COUNT 는 완전히, workspace-cap COUNT 는 조인 방향에 따라 간접적으로만 커버
  - 위치: `codebase/backend/migrations/V105__execution_workflow_status_index.sql:13-14`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2648-2658`
  - 상세: `admitExecutionOrDefer` 의 UPDATE 서브쿼리 중 workflow-cap(`... WHERE workflow_id = $4 AND status = 'running'`)은 신설 `idx_execution_workflow_status (workflow_id, status)` 선두 컬럼과 정확히 일치해 완전히 커버된다. workspace-cap(`execution wfe JOIN workflow w ... WHERE w.workspace_id = $2 AND wfe.status = 'running'`)은 단일 컬럼이 아니라 workspace 내 여러 workflow 를 아우르므로, 이 인덱스가 유효하려면 플래너가 `workflow` 를 `idx_workflow_workspace_active (workspace_id, is_active)`(`V002__indexes.sql:4`)로 먼저 좁힌 뒤 `execution` 으로 nested-loop join 하며 각 workflow_id 에 대해 신설 인덱스로 `status='running'` 을 걸러야 한다. 이 조인 경로는 기존 인덱스(`idx_workflow_workspace_active` + 신설 `idx_execution_workflow_status`)로 실행 가능하지만, 최종 채택은 Postgres 플래너의 통계·row 추정에 달려 있어 항상 보장되지는 않는다(마이그레이션 자체 주석도 이를 인정). 현재 트래픽 규모(workspace/workflow 당 cap 기본 10/3)에서는 기능·성능 모두 문제 없다.
  - 제안: 조치 불필요(이미 실질적 개선). 향후 workspace 당 workflow 수·execution 누적량이 커지면 `EXPLAIN ANALYZE` 로 workspace-cap 서브쿼리의 실제 플랜(nested-loop vs seq scan)을 재확인 권장.

- **[INFO]** V105 에 CONCURRENTLY 실패 시 INVALID 인덱스 잔존에 대한 DOWN/복구 주석 누락 (동일 패턴의 V095/V099 대비)
  - 위치: `codebase/backend/migrations/V105__execution_workflow_status_index.sql` (전체, DOWN 섹션 없음)
  - 상세: 같은 저장소의 선례 `V095__node_execution_exec_status_active_index.sql`, `V099__node_config_gin_index.sql` 은 `CREATE INDEX CONCURRENTLY` 실패 시 `INVALID` 인덱스가 남을 수 있고 `IF NOT EXISTS` 는 이를 "이미 존재"로 간주해 재시도를 건너뛰므로 `DROP INDEX CONCURRENTLY IF EXISTS ...` 로 먼저 제거해야 한다는 `-- DOWN:` 주석을 포함한다. V105 는 이 주석이 없다. 기능적 결함은 아니나(운영 매뉴얼 대응으로 충분히 복구 가능), 동일 저장소 컨벤션과의 일관성 갭이며 실패 시 대응 속도에 영향을 줄 수 있다.
  - 제안: `V105__execution_workflow_status_index.sql` 말미에 V095/V099 와 동일한 `-- DOWN: DROP INDEX CONCURRENTLY IF EXISTS idx_execution_workflow_status;` 주석 추가 권장(low priority, 비차단).

- **[INFO]** advisory lock 은 트랜잭션 범위(`pg_advisory_xact_lock`)이며 잠금·해제·격리 설계 모두 타당
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2644-2661`
  - 상세: 확인된 사항 —
    (1) `pg_advisory_xact_lock` 은 트랜잭션 커밋/롤백 시 자동 해제되는 세션 종속 락으로, 명시적 unlock 이 불필요하고 예외 발생 시에도 (TypeORM `manager.transaction` 이 자동 rollback) 락이 누수되지 않는다.
    (2) lock 획득(`SELECT pg_advisory_xact_lock(hashtext($1))`) → COUNT 서브쿼리 포함 조건부 UPDATE 가 **동일 트랜잭션 내에서** 순차 실행되므로, 락이 COUNT 스냅샷과 전이(UPDATE)를 함께 직렬화한다 — 주석이 설명하는 TOCTOU race(서로 다른 executionId 두 admission 이 같은 COUNT 를 보고 둘 다 통과)를 실제로 차단한다.
    (3) 기본 격리수준(READ COMMITTED)에서도 advisory lock 자체가 직렬화를 제공하므로 SERIALIZABLE 격리로 인한 serialization-failure 재시도 부담 없이 동일한 안전성을 얻는다 — 적절한 설계 선택.
    (4) lock key 는 `hashtext(workspaceId ?? workflowId)` 로 workspace 단위(또는 workflow fallback) 스코프이며, 저장소 내 `pg_advisory` 사용처가 이 한 곳뿐이라(RECOVERY_LOCK_KEY 는 별도 Redis 기반) lock 순서 역전으로 인한 데드락 가능성이 없다. 트랜잭션 콜백 내부에 DB-local 쿼리 2개 외 외부 I/O·긴 대기가 없어 lock 보유 시간도 짧다.
    (5) `hashtext()` 32bit 해시 충돌로 서로 다른 workspace 가 우연히 같은 락 버킷에 걸려 불필요하게 직렬화될 가능성은 이론상 존재하나, 이는 성능 저하(false serialization) 방향일 뿐 정합성(false admission)을 해치지 않는다 — 허용 가능한 트레이드오프.
  - 제안: 없음(현재 설계 타당). 결함 아님, 참고용 기록.

## 요약
V105 인덱스는 이전 WARNING(admission COUNT hot-path 인덱스 부재)을 실질적으로 해소한다 — workflow-cap COUNT 는 완전히 커버되고, workspace-cap COUNT 도 기존 `idx_workflow_workspace_active` 와 조합한 nested-loop 조인 경로로 개선 가능하다(플래너 선택은 비보장이나 이는 인덱스 설계의 근본적 한계이지 결함이 아님). `CREATE INDEX CONCURRENTLY` + `.conf`(`executeInTransaction=false`) 조합은 저장소 내 기존 V095/V099 와 동일한 검증된 패턴을 따르며 무중단 안전하다(단, DOWN 복구 주석 누락은 사소한 일관성 갭). `admitExecutionOrDefer` 의 `pg_advisory_xact_lock` 은 트랜잭션 스코프로 자동 해제되고, COUNT-UPDATE 를 동일 트랜잭션에서 직렬화해 TOCTOU race 를 올바르게 차단하며, 락 순서 역전이나 장시간 보유로 인한 데드락/성능 리스크가 없다. 재검증 결과 CRITICAL/WARNING 급 신규 결함은 발견되지 않았다.

## 위험도
LOW
