# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 인덱스

- **[INFO]** `@Index(['executionId', 'status'])` TypeORM 데코레이터 추가 — 실제 DB 인덱스와의 정합성 확인
  - 위치: `/codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` L752
  - 상세: Flyway V095(`idx_node_execution_exec_status_active`)가 `WHERE status IN ('waiting_for_input','running')` partial index로 이미 생성되어 있다. TypeORM의 `@Index` 데코레이터는 synchronize 모드에서 `CREATE INDEX` DDL을 생성하므로, Flyway로 관리되는 프로젝트에서 `synchronize: false` 설정이 확인되어야 한다. 커밋 메시지에서 "중복 DDL 방지를 위해 새 마이그레이션 없이 이 데코레이터로 TypeORM 스키마 인식만 선언"이라고 명시하고 있으나, TypeORM이 `synchronize: true`로 설정된 경우 full index(partial 조건 없음)가 추가 생성되어 V095의 partial index와 중복이 발생할 수 있다.
  - 제안: TypeORM 설정에서 `synchronize: false`임을 명시적으로 확인하거나, 데코레이터에 Flyway 인덱스와 동일한 이름(`name: 'idx_node_execution_exec_status_active'`)과 partial 조건을 지정하는 것이 명확성을 높인다. 단, TypeORM `@Index`의 `where` 옵션으로 partial 조건을 설정할 수 있다 — `@Index(['executionId', 'status'], { where: "status IN ('waiting_for_input','running')" }`. 현재는 주석으로 의도를 설명하고 있으나, DB/ORM 이중 정의의 drift 위험이 낮음 수준으로 존재한다.

- **[INFO]** `getStatus()` 내 `nodeExecutionRepository.findOne` 쿼리는 V095 partial index의 혜택을 받음
  - 위치: `/codebase/backend/src/modules/external-interaction/interaction.service.ts` L487-L494
  - 상세: `WHERE execution_id=$1 AND status='waiting_for_input'`는 V095의 partial index 범위에 정확히 포함된다. `order: { startedAt: 'DESC' }` 정렬이 추가되어 있으나, 한 execution 내 `waiting_for_input` 상태의 행 수는 극히 적어(설계상 최대 1건) 인덱스 효율에 영향 없음. 문제 없음.

### N+1 쿼리

- **[INFO]** `getStatus()` 내 쿼리 패턴 — 최대 2회 쿼리로 적절
  - 위치: `interaction.service.ts` L471, L487
  - 상세: execution 1회 조회 후 `waiting_for_input` 상태인 경우에만 nodeExecution을 조회하는 조건부 패턴이다. N+1 패턴 없음.

### 트랜잭션

- **[INFO]** `getStatus()`는 읽기 전용 단순 조회로 트랜잭션 불필요 — 적절함
  - 위치: `interaction.service.ts` `getStatus()` 전체
  - 상세: 두 개의 독립 SELECT이며 쓰기 없음. 트랜잭션 없는 것이 올바르다.

### 마이그레이션 안전성

- **[INFO]** 이번 변경에 신규 Flyway 마이그레이션 파일 없음 — V095는 기존 파일
  - 상세: V095에는 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`와 `executeInTransaction=false` 설정이 적용되어 있어 무중단 배포에 안전한 구조다. 이번 커밋은 DDL 변경 없이 TypeORM 엔티티 데코레이터만 추가한 것으로, 마이그레이션 안전성 관점의 신규 위험 없음.

### 스키마 설계 / 커넥션 관리 / SQL 인젝션 / 대량 데이터

- **[INFO]** TypeORM Repository API 사용으로 파라미터화 쿼리가 자동 적용됨 — SQL 인젝션 위험 없음
- **[INFO]** Repository 인젝션 방식의 커넥션 풀 관리 — TypeORM/NestJS 표준 패턴이므로 적절함
- **[INFO]** 대량 데이터 관점: `findOne` + `WHERE executionId AND status` 조합에 V095 partial index가 적용되어 대용량 테이블에서도 인덱스 스캔이 보장됨

---

## 요약

이번 변경의 핵심 DB 관련 변경은 `node-execution.entity.ts`에 `@Index(['executionId', 'status'])` TypeORM 데코레이터를 추가한 것이다. 실제 DB 인덱스는 Flyway V095(`CREATE INDEX CONCURRENTLY … WHERE status IN ('waiting_for_input','running')`)로 이미 생성되어 있으며 partial index 설계도 적절하다. 주의할 점은 TypeORM `@Index` 데코레이터가 full index(partial 조건 없음)를 선언하고 있어, `synchronize: true` 환경에서는 Flyway index와 별개의 중복 full index가 생성될 수 있다는 점이다. 이는 `synchronize: false`가 보장된다면 문제없으나, 명시적으로 `@Index`의 `where` 옵션으로 partial 조건을 동기화하거나 JSDoc 수준의 경고로 남기는 것이 drift를 방지한다. `getStatus()` 쿼리 패턴(최대 2회 SELECT, N+1 없음, 인덱스 활용 적절)은 DB 관점에서 무결하다. 마이그레이션 신규 DDL 없으므로 배포 위험 없음.

## 위험도

LOW
