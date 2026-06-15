# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] list() 쿼리의 소프트 리밋 200행 — 페이지네이션 없음
- 위치: `workflow-test-datasets.service.ts` `list()` 메서드, `.take(200)`
- 상세: 현재 `take(200)` 으로 DoS 방지 상한을 두고 있으며 코드 주석에서 "워크플로우당 소수로 유지되는 것이 정상" 이라는 설계 근거를 명시함. 실제 운영 상황에서 한 워크플로우의 데이터셋이 200개를 초과할 경우 조용히 잘림(truncation) 이 발생하며 클라이언트는 이를 알 수 없음.
- 제안: 현재 상태는 INFO 수준 — 설계 의도가 명확하고 실제 use-case에서 200개 초과는 비정상적임. 단, 응답에 `truncated: true` 플래그나 `X-Total-Count` 헤더를 추가해 클라이언트가 잘림 여부를 감지할 수 있게 하면 더 안전함.

### [INFO] list() 쿼리 내 컬럼명 리터럴 사용 (스네이크 케이스 하드코딩)
- 위치: `workflow-test-datasets.service.ts` `list()`, `andWhere` 절
- 상세: `'d.workflow_id'`, `'d.workspace_id'`, `'d.owner_id'`, `'d.updated_at'`, `'d.visibility'` 등 DB 컬럼명을 raw 문자열로 사용. TypeORM QueryBuilder 에서 entity 프로퍼티명(`d.workflowId`)을 쓰면 TypeORM 이 컬럼명 매핑을 처리하므로 컬럼명 변경 시 버그가 발생할 가능성을 줄일 수 있음.
- 제안: `'(d.owner_id = :userId OR ...)'` 부분을 `'(d.ownerId = :userId OR ...)'` 로 변경하면 entity 속성 기반으로 통일됨. 단, 실제 test assertion(`expect.stringContaining('owner_id = :userId OR')`)도 맞춰 변경 필요. 현재 동작에 실질적 문제는 없고 마이그레이션 불일치 위험만 존재하여 INFO 수준.

### [INFO] updated_at 트리거/자동 갱신 메커니즘 없음 (마이그레이션 레벨)
- 위치: `V097__workflow_test_dataset.sql`
- 상세: `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` 로 초기값은 설정되나, 행 UPDATE 시 자동으로 갱신되는 트리거가 마이그레이션에 없음. TypeORM `@UpdateDateColumn` 이 ORM 레이어에서 갱신을 처리하므로 애플리케이션 경로에서는 문제없음. 다만 DB 직접 UPDATE(DBA 패치, 마이그레이션 데이터 보정 등)시 `updated_at` 이 갱신되지 않는 불일치가 발생할 수 있음.
- 제안: 운영 정책상 직접 DB UPDATE 를 허용하지 않는 환경이면 무시 가능. 허용하는 환경이라면 `set_updated_at()` 트리거를 추가하는 것이 안전함.

---

## 긍정적 평가

- **마이그레이션 안전성**: `CREATE TABLE`만으로 기존 테이블에 락이 걸리지 않음. 신규 테이블 추가이므로 무중단 배포에 완전히 안전.
- **인덱스 설계**: 주요 쿼리 패턴(`owner_id + workflow_id`, `workspace_id + visibility`)에 복합 인덱스가 정확히 설계되어 있음. `UNIQUE(workflow_id, owner_id, name)` 제약도 인덱스를 겸하므로 중복 방지와 조회 성능을 동시에 확보.
- **FK 및 CASCADE**: 모든 외래키에 `ON DELETE CASCADE` 가 명시되어 상위 레코드(workflow, user, workspace) 삭제 시 orphan 데이터가 남지 않음.
- **트랜잭션**: create/update/delete 는 단일 row 단순 조작이므로 별도 트랜잭션 없이 안전하며, `saveUnique()` 래핑으로 UNIQUE 위반(23505)을 ConflictException 으로 정확히 변환.
- **SQL 인젝션**: TypeORM QueryBuilder 파라미터 바인딩(`:workflowId`, `:workspaceId`, `:userId`, `:workspace`)을 일관되게 사용하여 SQL Injection 위험 없음. `Repository.findOne({ where: { id, workspaceId } })` 도 ORM 파라미터화 경로.
- **커넥션 관리**: NestJS `TypeOrmModule.forFeature` + `@InjectRepository` 패턴으로 커넥션 풀이 프레임워크에 의해 관리됨. 직접 커넥션 획득·해제 없음.
- **N+1 없음**: `list()` 는 단일 QueryBuilder 쿼리로 결과를 가져오고 이후 `rows.map(toDto)` 는 순수 메모리 변환. 반복 쿼리 없음.
- **스키마 설계**: `workspace_id` 비정규화 저장은 코멘트에서 근거(워크스페이스 격리·공유 목록 쿼리용)를 명시하고 있으며, 공유 목록 쿼리 시 JOIN 없이 필터 가능하므로 적절한 의도적 비정규화.
- **JSONB**: Mock Input 을 `jsonb` 타입으로 저장하는 것은 PostgreSQL 에서 색인 가능하고 유효성 검사도 DB 레벨에서 수행되므로 적절.

---

## 요약

이번 변경은 신규 테이블 `workflow_test_dataset` 추가 및 NestJS 모듈 전체 구현으로, 데이터베이스 관점에서 전반적으로 안전하고 잘 설계되어 있다. 마이그레이션은 새 테이블 생성만이므로 무중단 배포에 완전히 안전하며, 인덱스·FK·UNIQUE 제약이 쿼리 패턴과 정합하게 정의되어 있다. SQL Injection 방어, 커넥션 풀 사용, N+1 없음 모두 양호하다. 발견된 3건은 모두 INFO 수준(페이지네이션 없는 200행 소프트 리밋, QueryBuilder 컬럼명 리터럴, updated_at 트리거 부재)으로 현재 운영 환경에서 즉각적인 위험을 초래하지 않는다.

### 위험도
LOW
