# 데이터베이스(Database) 리뷰 결과

## 발견사항

### **[INFO]** `list()` 쿼리에서 assertWorkflow 로 인한 추가 SELECT 발생
- 위치: `workflow-test-datasets.service.ts` `list()` / `create()` 메서드
- 상세: `assertWorkflow` 가 매 list/create 호출마다 workflow 테이블에 SELECT를 추가로 발행한다. 워크플로우 존재 검증 목적이라 원칙적으로 필요하나, 동일 요청에서 `workspaceId` 는 JWT/미들웨어에서 이미 검증된 값이고 워크플로우 삭제 시 FK ON DELETE CASCADE 로 데이터셋도 정리되므로, 고트래픽 환경에서는 이 추가 쿼리가 부하가 될 수 있다. 단기적으로는 문제없으나 인지해둘 사항.
- 제안: 현재 규모에서는 수용 가능. 향후 캐싱(예: TTL 짧은 workflowId 존재 캐시)을 고려할 수 있다.

### **[INFO]** `list()` 쿼리 컬럼 참조 방식 혼용 (snake_case raw vs. TypeORM alias)
- 위치: `workflow-test-datasets.service.ts` 라인 1621-1628
- 상세: `createQueryBuilder('d')` 사용 시 `.where('d.workflow_id = :workflowId')` 처럼 DB 컬럼명(snake_case)을 직접 사용하고 있다. TypeORM QueryBuilder에서는 엔티티 프로퍼티명(`d.workflowId`)을 쓰는 것이 권장 방식이며, 컬럼명 매핑이 변경될 경우 쿼리가 묵시적으로 깨질 위험이 있다. 현재 동작에는 문제없으나 일관성 측면의 잠재 함정.
- 제안: `d.workflow_id` → `d.workflowId`, `d.workspace_id` → `d.workspaceId`, `d.owner_id` → `d.ownerId`, `d.updated_at` → `d.updatedAt`, `d.visibility` 로 통일.

### **[INFO]** `updated_at` 자동 갱신 트리거 부재
- 위치: `V097__workflow_test_dataset.sql`
- 상세: `updated_at` 컬럼이 `DEFAULT NOW()` 만 선언되어 있고, DB 레벨 UPDATE 트리거가 없다. TypeORM `@UpdateDateColumn` 이 ORM 레이어에서 자동 갱신하므로 정상 운용 경로에서는 문제없다. 단, ORM 우회 쿼리(마이그레이션, 직접 SQL UPDATE)를 실행하면 `updated_at` 이 갱신되지 않는다.
- 제안: 필요 시 `CREATE TRIGGER set_updated_at BEFORE UPDATE ON workflow_test_dataset FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()` 패턴 추가(다른 테이블과 일관성 확인 후 적용).

### **[INFO]** `visibility` 컬럼 CHECK constraint 와 TypeORM enum 이중 관리
- 위치: `V097__workflow_test_dataset.sql` + `workflow-test-dataset.entity.ts`
- 상세: DB에 `CHECK (visibility IN ('private', 'workspace'))` 가 있고 TypeORM 엔티티에는 `varchar` 타입으로 선언(PostgreSQL native enum 미사용). 두 곳의 허용값이 동기화 깨질 위험은 낮으나, 향후 visibility 값이 추가될 경우 SQL 마이그레이션과 TypeScript enum 양쪽을 함께 갱신해야 한다. 현재 설계 자체는 의도적 선택(VARCHAR + CHECK)으로 합리적.
- 제안: 값 추가 시 마이그레이션 체크리스트에 두 위치 동기화를 명시.

## 긍정적 평가

1. **마이그레이션 안전성**: `CREATE TABLE`은 신규 테이블 생성이므로 기존 테이블에 대한 락 없음. 무중단 배포 안전.
2. **인덱스 설계**: 주요 조회 패턴 3가지(`(owner_id, workflow_id)`, `(workspace_id, visibility)`, UNIQUE `(workflow_id, owner_id, name)`)가 모두 커버됨. UNIQUE 제약이 인덱스 역할도 겸한다.
3. **N+1 없음**: `list()` 는 단일 쿼리로 모든 행을 가져와 애플리케이션 레이어에서 `isOwner` 계산. 반복 쿼리 없음.
4. **파라미터화 쿼리**: QueryBuilder의 `:param` 바인딩 방식을 일관되게 사용, SQL 인젝션 위험 없음.
5. **커넥션 관리**: TypeORM Repository/QueryBuilder를 통해 커넥션 풀 관리가 프레임워크에 위임됨. 명시적 커넥션 획득·해제 불필요.
6. **대량 데이터 방어**: `take(200)` 소프트 리미트 적용. 워크플로우 당 데이터셋 수는 소수로 유지될 설계임을 주석에서도 명시.
7. **FK ON DELETE CASCADE**: 워크플로우/유저/워크스페이스 삭제 시 孤 데이터 자동 정리.
8. **UNIQUE 위반 → 409 변환**: `saveUnique()` 에서 PostgreSQL 에러코드 `23505`를 감지해 `ConflictException`으로 변환. 깔끔한 처리.

## 요약

이번 변경은 신규 테이블(`workflow_test_dataset`) 생성과 해당 CRUD 서비스 구현으로 구성된다. 마이그레이션은 기존 테이블에 영향을 주지 않는 순수 신규 생성이므로 무중단 배포에 안전하다. 인덱스는 실제 조회 패턴(유저별 워크플로우 데이터셋, 워크스페이스 공유본 필터)을 충분히 커버하며, N+1 문제나 SQL 인젝션 위험도 없다. 지적 사항은 모두 INFO 수준으로, QueryBuilder에서 DB 컬럼명 직접 참조(snake_case raw) 방식이 TypeORM 권장 방식과 다른 점과 `assertWorkflow` 추가 SELECT 부하가 눈에 띄나 현재 운영 규모에서 실질적 위험은 없다. 전반적으로 DB 설계와 쿼리 구현 모두 양호하다.

## 위험도

LOW

---

STATUS=success ISSUES=0
