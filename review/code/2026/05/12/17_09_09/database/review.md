### 발견사항

- **[WARNING]** `created_by` 컬럼 인덱스 부재 가능성
  - 위치: `workflows.service.ts` — ownership 필터 블록
  - 상세: `ownership='mine'`은 `w.created_by = :userId`, `ownership='shared'`는 `w.created_by != :userId` 조건을 추가한다. 기존 쿼리는 `workspace_id` 인덱스만 활용했으나, 이제 `created_by` 컬럼도 필터 조건이 된다. 별도의 `(workspace_id, created_by)` 복합 인덱스가 없다면, DB가 `workspace_id`로 좁혀진 row set을 `created_by` 기준으로 순차 스캔한다. 특히 팀 워크스페이스에 워크플로가 수백~수천 건 이상 쌓이면 성능 저하가 눈에 띄게 나타날 수 있다.
  - 제안: 마이그레이션에 `CREATE INDEX CONCURRENTLY idx_workflows_workspace_created_by ON workflows (workspace_id, created_by);` 추가를 권장. `CONCURRENTLY`를 사용하면 테이블 락 없이 운영 중에 추가 가능하다.

- **[WARNING]** `created_by != :userId` 가 NULL을 제외
  - 위치: `workflows.service.ts` L96 `qb.andWhere('w.created_by != :userId', ...)`
  - 상세: SQL에서 `NULL != 'user-id'`는 `NULL`(= FALSE)로 평가되므로, `created_by IS NULL`인 워크플로는 `shared` 결과에서 누락된다. 기존 데이터 중 `created_by`가 NULL인 row가 있으면 소유 필터가 정확하지 않다.
  - 제안: 마이그레이션이나 엔티티에서 `created_by NOT NULL` 제약을 확인하고, NOT NULL이 보장되지 않는다면 `qb.andWhere('w.created_by != :userId OR w.created_by IS NULL', { userId })`로 방어하거나, 스키마 레벨에서 NOT NULL을 강제한다.

- **[INFO]** `ownership='mine' | 'shared'` 시 워크스페이스 타입 확인용 추가 쿼리 발생
  - 위치: `workflows.service.ts` L88 `this.workspacesService.findById(workspaceId)`
  - 상세: 기존 `findAll`은 DB 쿼리 2회(count + select)였지만, ownership 필터 적용 시 워크스페이스 타입 확인용 쿼리가 1회 추가되어 3회로 늘어난다. 현재 규모에서는 큰 문제가 아니나, 워크스페이스 타입은 세션 수명 동안 변하지 않으므로 애플리케이션 캐시(예: `CacheModule`) 또는 JWT 클레임에 포함시키면 불필요한 쿼리를 제거할 수 있다.
  - 제안: 즉시 수정 불필요. 단, 워크스페이스 타입을 JWT payload나 Redis 캐시로 관리하는 방향을 중기 과제로 고려.

- **[INFO]** 파라미터화된 쿼리 — SQL 인젝션 없음
  - `qb.andWhere('w.created_by = :userId', { userId })` 형태로 TypeORM QueryBuilder의 바인딩 파라미터를 올바르게 사용. 문제 없음.

- **[INFO]** 마이그레이션 변경 없음
  - `created_by` 컬럼은 기존 엔티티에 이미 존재하고 이번 PR에서 스키마 변경이 없으므로 무중단 배포 안전성 관련 추가 리스크는 없다.

---

### 요약

이번 변경의 데이터베이스 영향은 `GET /workflows` 쿼리에 `created_by` 필터 조건 추가와, 해당 필터 적용 시 워크스페이스 타입 확인용 추가 쿼리 발생 두 가지로 요약된다. 쿼리 자체는 파라미터화되어 SQL 인젝션 위험이 없고, 트랜잭션·마이그레이션·N+1 문제도 없다. 다만 `created_by` 컬럼에 `(workspace_id, created_by)` 복합 인덱스가 없으면 팀 워크스페이스 규모가 커질 때 소유 필터 쿼리 성능이 저하될 수 있고, `created_by`가 NOT NULL로 보장되지 않는 경우 `shared` 필터에서 NULL 행이 누락된다는 두 가지 점을 조치하는 것이 권장된다.

### 위험도
**MEDIUM**