# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[WARNING]** admission gate 원자 UPDATE 의 두 서브쿼리에 대응하는 복합 인덱스 부재 — 순차 스캔/비효율 인덱스 사용 위험
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`admitExecutionOrDefer`, raw SQL `UPDATE execution ... WHERE ... AND (SELECT COUNT(*) FROM execution wfe JOIN workflow w ON w.id = wfe.workflow_id WHERE w.workspace_id = $2 AND wfe.status = 'running') < $3 AND (SELECT COUNT(*) FROM execution WHERE workflow_id = $4 AND status = 'running') < $5`)
  - 상세: 기존 인덱스는 `idx_execution_status (status)` 단일 컬럼과 `idx_execution_workflow_started (workflow_id, started_at DESC)` 뿐이다(`codebase/backend/migrations/V002__indexes.sql`). 두 서브쿼리 모두 "특정 조건(workflow_id 또는 workspace_id join) + `status='running'`" 형태인데, 이를 커버하는 `(workflow_id, status)` 복합 인덱스가 없다. workflow 당 카운트는 `idx_execution_workflow_started`로 workflow_id 는 걸러지지만 status 필터링은 인덱스 스캔 후 재확인해야 하고, workspace 스코프 카운트는 `execution JOIN workflow` 후 `workflow.workspace_id` 필터 + `execution.status='running'` 필터로, execution 이 커지면 `idx_execution_status` 만으로는 status='running' 전체 row 를 긁은 뒤 join 하는 형태가 될 수 있다(planner 가 `idx_workflow_workspace_active` 를 이용한 반대 방향 join 을 택할 수도 있으나 보장 안 됨). 이 UPDATE 는 **매 admission(모든 신규 pending Execution 마다) 호출**되므로 인덱스 최적화가 없으면 실행량 증가에 따라 매우 빈번히 실행되는 hot path 쿼리의 성능 저하로 이어진다.
  - 제안: `CREATE INDEX idx_execution_workflow_status ON execution (workflow_id, status)` 신설을 검토. 이 인덱스는 workflow-scope COUNT 를 완전히 커버하며, workspace-scope COUNT(`execution JOIN workflow ON workflow_id WHERE workflow.workspace_id=$2 AND status='running'`)에서도 `workflow` 테이블을 `idx_workflow_workspace_active(workspace_id, is_active)` 로 좁혀 join 하는 nested-loop 플랜에서 재사용 가능하다. 트래픽 규모가 아직 작다면(워크스페이스당 cap 기본 10, 워크플로우당 3) 현재도 기능적으로는 문제 없으나, 워크플로우 수·execution 누적량이 커질수록 순차 스캔 비용이 커지므로 후속 마이그레이션으로 반영 권장.

- **[INFO]** admission gate 원자 UPDATE 는 트랜잭션·SQL 인젝션·락 측면에서 적절히 설계됨
  - 위치: 상동, `admitExecutionOrDefer`
  - 상세: 단일 `UPDATE ... WHERE status='pending' AND (COUNT<cap) AND (COUNT<cap) RETURNING id` 로 "카운트 확인 + 상태 전이"를 한 문장에 원자화해 TOCTOU/advisory lock 없이 cap 정합성을 보장한 설계는 타당하다(Postgres 는 단일 statement 내 MVCC snapshot 이 일관되며, `WHERE status='pending'` row-level 잠금 경쟁도 row 단위라 무관한 pending row 끼리는 블로킹하지 않음). 파라미터는 `$1..$5` positional placeholder + 별도 배열 바인딩으로 전달되어 SQL 인젝션 벡터 없음(`workspaceId`/`execution.workflowId` 는 값으로만 사용, 문자열 interpolation 없음). `markQueueWaitTimeout` 도 QueryBuilder 파라미터 바인딩(`:id`, `:pending`) 사용 — 인젝션 안전.
  - 참고용 정보이며 조치 불요.

- **[INFO]** V104 마이그레이션은 무중단 배포 관점에서 안전
  - 위치: `codebase/backend/migrations/V104__execution_queued_at.sql`
  - 상세: `ALTER TABLE execution ADD COLUMN queued_at TIMESTAMPTZ DEFAULT NOW();` — Postgres 11+ 는 상수든 volatile(`NOW()`) 이든 `ADD COLUMN ... DEFAULT` 를 카탈로그 메타데이터 변경만으로 처리하며 테이블 전체 rewrite 를 하지 않는다(구버전 Postgres 의 "non-null default 는 rewrite 유발" 제약은 상수 default 한정 이슈였고, 11+ 이후로는 `NOW()` 같은 volatile 표현식도 즉시 추가 가능 — 단, 각 tuple 은 이후 access 시 개별 계산되는 것이 아니라 ALTER 실행 시점 값이 저장된다는 점은 맞음. 이 마이그레이션은 그 특성을 정확히 인지하고 "기존 row 는 마이그레이션 시각으로 채워지나 이미 종결 상태라 무해" 라고 주석에 명시함). `ADD COLUMN` 자체는 `ACCESS EXCLUSIVE` 락을 아주 짧게(카탈로그 갱신만) 잡으므로 대용량 execution 테이블에서도 실질적 다운타임 없이 적용 가능하다. `nullable: true` 로 기존 row NULL 허용 처리도 TypeORM 엔티티와 일치.
  - 참고용 정보이며 조치 불요.

- **[INFO]** N+1 없음 — admission gate 는 루프 내부가 아닌 단건 승인 경로
  - 위치: `admitExecutionOrDefer` / `runExecutionFromQueue` 호출부(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 3324행 부근)
  - 상세: `workflowRepository.findOne` 1회 + 원자 UPDATE 1회로 구성되어 있고, `EXECUTION_RUN_WORKER_CONCURRENCY` 기본값 1(직렬)이라 worker 인스턴스당 동시 N+1 유발 가능성은 낮다. cap 초과 시 `executionRunQueue.add` 로 재큐하는 backoff(2초) 방식은 폴링성 재조회이지만 이는 BullMQ job 재-pick up 이지 코드 레벨 루프 내 쿼리가 아니므로 N+1 패턴에 해당하지 않는다.
  - 참고용 정보이며 조치 불요.

- **[INFO]** `queued_at` 컬럼 활용과 `started_at` 분리 설계는 스키마 설계 관점에서 타당
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` (`queuedAt` 컬럼), V104 마이그레이션 주석
  - 상세: `started_at`(RUNNING 전이 시각, `recoverStuckExecutions` stale 판정에 재사용됨)과 `queued_at`(pending 진입 시각, admission 5분 타임아웃 판정)의 의미 분리는 정확하며, 필드 재사용으로 인한 로직 충돌을 사전에 회피한 설계다.
  - 참고용 정보이며 조치 불요.

- **[INFO]** 커넥션 관리 — 기존 repository/DataSource 패턴 재사용, 별도 우려 없음
  - 위치: `admitExecutionOrDefer`, `markQueueWaitTimeout`
  - 상세: `this.executionRepository.query(...)` / `createQueryBuilder().update(...)` 모두 NestJS TypeORM 의 공유 커넥션 풀을 사용하며, 별도 커넥션 획득/해제 로직을 직접 다루지 않는다(TypeORM 이 관리). 트랜잭션을 명시적으로 열지 않았지만 단일 원자 statement 이므로 문제 없다.
  - 참고용 정보이며 조치 불요.

## 요약

이번 변경은 §8 동시성 cap admission gate 를 위해 `Execution.queued_at` 컬럼을 추가(V104, 무중단 안전)하고, workspace/workflow 동시 실행 수를 단일 조건부 UPDATE(raw SQL, 파라미터 바인딩)로 원자적으로 검증·전이하는 admission gate 를 도입했다. 트랜잭션 원자성, SQL 인젝션 방어, 마이그레이션 안전성은 모두 적절히 설계되었고 N+1 문제도 없다. 다만 admission gate 의 두 COUNT 서브쿼리(workflow_id 단독, workflow join 을 통한 workspace_id)를 완전히 커버하는 복합 인덱스(`(workflow_id, status)`)가 아직 없어, execution 테이블/트래픽이 커질 경우 이 hot-path UPDATE 가 성능 이슈가 될 잠재적 여지가 있다 — 기능적으로는 문제 없으나 후속 인덱스 마이그레이션을 권장한다.

## 위험도
LOW

STATUS: SUCCESS
