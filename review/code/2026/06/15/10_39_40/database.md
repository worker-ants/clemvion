# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] list() 쿼리 — 복합 OR 조건과 기존 인덱스 매칭 확인 필요
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` list() L79-88
- 상세: `WHERE workflow_id = ? AND workspace_id = ? AND (owner_id = ? OR visibility = 'workspace')` 쿼리가 실행된다. 정의된 인덱스는 `(owner_id, workflow_id)` 와 `(workspace_id, visibility)` 두 개다. 이 쿼리의 선두 필터가 `workflow_id` + `workspace_id` 이므로 두 인덱스 모두 선두 컬럼 매칭이 되지 않는다. PostgreSQL 플래너가 `(workspace_id, visibility)` 인덱스를 `workspace_id =` 조건으로 부분 활용하거나 Bitmap Index Scan 을 조합할 수 있으나, 워크스페이스 당 데이터셋이 많아지면 `(workflow_id, workspace_id)` 또는 `(workflow_id, workspace_id, owner_id)` 복합 인덱스가 이 쿼리에 더 효율적일 수 있다. 현재 구조에서 `list()` 가 가장 빈번하게 호출될 조회 경로임을 감안하면 검토 가치가 있다.
- 제안: EXPLAIN ANALYZE 로 실행 계획을 확인하고, 필요 시 `(workflow_id, workspace_id)` 복합 인덱스를 추가하는 것을 고려한다. 기존 두 인덱스(owner_id/workspace_id 기준)는 update/remove/clone 의 `findAccessible` 단건 조회에는 적절하다.

### [INFO] UNIQUE 제약 위반 처리 — 경쟁 조건(race condition) 안전
- 위치: `workflow-test-datasets.service.ts` saveUnique() L186-204, migration V097 L64-65
- 상세: `(workflow_id, owner_id, name)` UNIQUE 제약을 DB 레벨에서 선언하고, 애플리케이션 레이어에서 `QueryFailedError` code `23505` 를 잡아 409 로 변환하는 방식은 올바르다. check-then-insert 패턴(조회 후 중복 확인 후 삽입) 대신 DB UNIQUE 제약으로 경쟁 조건을 원천 차단한다. 트랜잭션 없이도 정합성이 보장된다.
- 제안: 현 구현 유지. 적절한 패턴이다.

### [INFO] clone() — 이름 충돌 시 단순 suffix 전략, 재귀 충돌 가능성
- 위치: `workflow-test-datasets.service.ts` copyName() L207-211, clone() L169-184
- 상세: clone 시 이름을 `"원본 (Copy)"` 로 고정 생성한다. 동일 소유자가 같은 데이터셋을 두 번 clone 하면 두 번째 clone 에서 `(workflow_id, ownerId, "원본 (Copy)")` UNIQUE 충돌이 발생하여 409 ConflictException 을 반환한다. 이는 DB 이슈가 아니라 UX 이슈이나, clone 재시도 흐름에서 사용자가 이름 충돌 오류를 받게 된다. copyName() 이 `"(Copy 2)"`, `"(Copy 3)"` 같은 증분 suffix 를 시도하는 로직이 없어 실제로는 JSDoc 주석("충돌 시 Copy 2…")과 구현이 불일치한다.
- 제안: copyName() 은 현재 단일 suffix 만 붙이므로 JSDoc 의 "Copy 2…" 설명을 실제 동작에 맞게 수정하거나, DB에서 기존 이름을 조회한 뒤 증분 suffix 를 결정하는 로직을 추가한다. DB 관점에서 데이터 손상 위험은 없으나 사용자 경험 불일치는 있다.

### [INFO] JSONB `data` 컬럼 기본값 `'{}'` — TypeORM 엔티티와 마이그레이션 일치
- 위치: migration V097 L61, entity L492-493
- 상세: SQL 에서 `DEFAULT '{}'`, TypeORM 엔티티에서 `default: {}` 로 일치한다. TypeORM 이 sync 모드에서 기본값 형식 차이로 스키마 drift 를 감지하지 않도록 마이그레이션 전용(Flyway V097)으로 관리하는 것은 올바른 방식이다.
- 제안: 현 구현 유지.

### [INFO] assertWorkflow() — list/create 시 별도 SELECT 추가 쿼리
- 위치: `workflow-test-datasets.service.ts` assertWorkflow() L39-53, list() L78, create() L98
- 상세: list() 와 create() 마다 `assertWorkflow()` 가 workflow 테이블에 별도 SELECT 를 실행한 후 dataset 쿼리를 수행한다. 이는 N+1 이 아니라 1+1 구조(2 쿼리 직렬)로, 워크플로우 존재/소유 검증을 위한 의도적 설계다. 단일 쿼리(JOIN 또는 EXISTS 서브쿼리)로 통합 가능하나 현재 규모에서는 미미한 차이다.
- 제안: 허용 범위. 향후 성능 요구사항이 생기면 list() 쿼리에 EXISTS (SELECT 1 FROM workflow WHERE ...) 조건을 추가해 단일 왕복으로 통합할 수 있다.

## 요약

V097 마이그레이션은 무중단 배포 관점에서 안전하다 — 신규 테이블 생성이며 기존 테이블에 락을 유발하는 스키마 변경(ALTER TABLE, 인덱스 재구성 등)이 없다. `(workflow_id, owner_id, name)` UNIQUE 제약, FK ON DELETE CASCADE, JSONB 컬럼 기본값 설계가 적절하다. TypeORM 서비스 코드는 N+1 없이 단건 bulk 조회를 사용하며, UNIQUE 위반을 DB 레벨에서 보장하여 경쟁 조건으로부터 안전하다. 단, `list()` 쿼리 패턴이 기존 인덱스 선두 컬럼과 일치하지 않아 데이터 규모 증가 시 쿼리 플랜 확인이 권고되며, `clone()` 의 이름 suffix 전략이 JSDoc 설명과 불일치하는 사소한 문서/로직 갭이 있다. SQL 인젝션 위험은 없다 — QueryBuilder 파라미터 바인딩이 전 경로에 사용된다.

## 위험도
LOW

---

STATUS=success ISSUES=2
