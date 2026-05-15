### 발견사항

- **[WARNING]** `findBackgroundNodeExecution`의 raw SQL에서 TypeScript 프로퍼티명 사용
  - 위치: `background-runs.service.ts` — `findBackgroundNodeExecution` 메서드
  - 상세: `.andWhere("ne.outputData #>> '{meta,backgroundRunId}' = :backgroundRunId")` 에서 `outputData`는 TypeScript 엔티티 프로퍼티명이다. TypeORM QueryBuilder는 단순 조건(`ne.executionId = :id`)은 컬럼명으로 변환하지만, JSONB 연산자(`#>>`)가 포함된 복합 raw SQL 표현식에서의 프로퍼티명 변환은 TypeORM 버전에 따라 보장되지 않는다. 반면 동일 파일의 `verifyBackgroundRunOwnership`은 `ne.output_data`(실제 컬럼명)를 사용 — 이 불일치가 핵심 경고다.
  - 제안: `"ne.outputData #>> ..."` → `"ne.output_data #>> ..."` 로 변경. `verifyBackgroundRunOwnership`과 동일하게 raw SQL 내에는 항상 DB 컬럼명을 사용한다. 단위 테스트가 Repository를 mock하므로 이 버그는 테스트에서 잡히지 않고 e2e 또는 운영에서 `column "outputData" does not exist` 에러로 발현된다.

- **[WARNING]** `parentNodeExecutionId` 기반 쿼리에 인덱스 미생성
  - 위치: `background-runs.service.ts` — `fetchBodyPage`, `aggregateBodyStatus`
  - 상세: 두 메서드 모두 `WHERE ne.parentNodeExecutionId = :id`로 필터하고 `fetchBodyPage`는 `(startedAt ASC, id ASC)` 정렬까지 요구한다. V047 마이그레이션은 `output_data #>> '{meta,backgroundRunId}'` 인덱스만 추가했고, `parent_node_execution_id` 컬럼에 별도 인덱스가 없으면(기존 마이그레이션에서 미생성 시) 대용량 테이블에서 Sequential Scan이 발생한다. 본문 노드 수가 많은 Background 작업(Loop/ForEach 포함)에서 집계 쿼리도 같은 컬럼을 풀스캔한다.
  - 제안: `node_execution(parent_node_execution_id, started_at, id)` 복합 인덱스 존재 여부를 기존 마이그레이션에서 확인. 미존재 시 V048 마이그레이션으로 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ne_parent_started_id ON node_execution (parent_node_execution_id, started_at, id)` 추가.

- **[WARNING]** `notification(resource_type, resource_id)` 인덱스 부재 가능성
  - 위치: `background-runs.service.ts` — `fetchNotifications`
  - 상세: `find({ where: { resourceType: 'background_run', resourceId: backgroundRunId } })` — `notifications` 테이블이 커지면 `(resource_type, resource_id)` 복합 필터에 인덱스 없이 Sequential Scan 발생. 현재는 건수가 적어 영향 작지만 시스템 규모 성장 시 문제.
  - 제안: `notification(resource_type, resource_id)` 인덱스 존재 여부 확인. 미존재 시 마이그레이션 추가.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 실패 시 INVALID 인덱스 잔류
  - 위치: `V047__node_execution_background_run_id_index.sql`
  - 상세: CONCURRENTLY 도중 실패(예: 트랜잭션 충돌, 연결 단절)하면 PostgreSQL은 `INVALID` 상태의 인덱스 객체를 남긴다. Flyway는 해당 migration을 실패로 기록하지만, 재시도 시 `IF NOT EXISTS`는 INVALID 인덱스도 "존재함"으로 판단해 건너뛴다 — 인덱스가 실제로 사용되지 않는 채 배포가 진행될 수 있다.
  - 제안: 배포 후 `SELECT * FROM pg_indexes WHERE indexname = 'idx_node_execution_background_run_id'` 및 `SELECT indisvalid FROM pg_index JOIN pg_class ON pg_class.oid = pg_index.indrelid WHERE relname = 'node_execution'` 로 인덱스 유효성 확인 절차를 운영 체크리스트에 추가. 실패 시 `DROP INDEX CONCURRENTLY` 후 재실행.

- **[INFO]** `verifyBackgroundRunOwnership`의 raw 테이블명 조인
  - 위치: `background-runs.service.ts` — `verifyBackgroundRunOwnership`
  - 상세: `.innerJoin('execution', 'e', 'e.id = ne.execution_id').innerJoin('workflow', 'w', 'w.id = e.workflow_id')` — TypeORM 엔티티 관계가 아닌 raw 테이블명 사용. 테이블 rename 또는 스키마 분리 시 TypeORM 엔티티 메타데이터가 이를 추적하지 않아 런타임 에러 발생.
  - 제안: `.innerJoin('ne.execution', 'e')` 등 TypeORM 엔티티 관계 경로로 변경 권장. 단, 현재 구조에서는 `NodeExecution` 엔티티가 `Execution` 관계를 정의해야 한다.

- **[INFO]** `getBackgroundRun` 내 5개 쿼리 무트랜잭션 실행
  - 위치: `background-runs.service.ts` — `getBackgroundRun`
  - 상세: 소유권 검증 → 배경노드 조회 → 본문 페이지 → 집계 → 알림까지 5개 쿼리가 트랜잭션 없이 순차 실행된다. 읽기 전용 모니터링 API이므로 데이터 정합성 손실 위험은 없으나, 쿼리 사이 상태 변화(노드 실행 완료 등)로 `status`와 `nodeExecutions.data` 가 미세하게 불일치할 수 있다.
  - 제안: 모니터링 API의 특성상 허용 범위 내. 필요 시 `READ COMMITTED` isolation으로 단일 트랜잭션 묶기 가능하나 현재는 over-engineering.

---

### 요약

V047 마이그레이션은 `CONCURRENTLY + executeInTransaction=false + IF NOT EXISTS` 조합으로 무중단 배포 관점에서 올바르게 설계되었다. 그러나 `BackgroundRunsService.findBackgroundNodeExecution` 메서드에서 raw SQL 내 TypeScript 프로퍼티명(`ne.outputData`)을 DB 컬럼명(`ne.output_data`) 대신 사용하는 불일치가 존재하며, mock 기반 단위 테스트에서는 검출되지 않아 운영 환경에서 `column "outputData" does not exist` 오류로 발현될 가능성이 높다. 또한 `parentNodeExecutionId` 기반의 본문 노드 조회/집계 쿼리에 대한 복합 인덱스 부재 여부도 확인이 필요하며, 대규모 Background 본문(Loop/ForEach 포함) 실행 시 성능 저하 요인이 된다.

### 위험도

**MEDIUM** (raw SQL 컬럼명 오류 가능성이 운영 경로에 직접 영향)