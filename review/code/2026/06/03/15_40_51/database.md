# 데이터베이스(Database) 코드 리뷰

## 발견사항

### [WARNING] `updateWorkspaceSettings` — assertAdmin 과 findOne 사이 비원자적 2-step 읽기
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings()` (라인 365~382)
- **상세**: `assertAdmin(workspaceId, userId)` 는 내부적으로 `workspace_member` 테이블에 SELECT 를 수행하고, 이어서 `workspaceRepository.findOne({ where: { id: workspaceId } })` 로 workspace 를 별도 SELECT 한다. 두 쿼리가 단일 트랜잭션 안에 있지 않으므로, 이론적으로 assertAdmin 시점에 멤버였던 사용자가 findOne 직전에 강등/제거되더라도 save 까지 도달할 수 있다. 또한 settings JSONB 를 `{ ...workspace.settings, interactionAllowedOrigins: normalized }` 로 읽어서 save 하는 read-modify-write 패턴은 두 Admin 이 동시에 다른 설정 키를 수정할 경우 한 쪽 변경이 덮어쓰여 손실될 수 있다(lost update). 현재 `settings` 컬럼에 낙관적 잠금(version column)이나 `UPDATE SET settings = settings || $1::jsonb` 형태의 atomic 머지가 없다.
- **제안**: 두 가지 중 하나를 선택한다.
  1. `updateWorkspaceSettings` 전체를 `@Transactional()` 또는 `DataSource.transaction()` 으로 감싸 assertAdmin → findOne → save 를 단일 트랜잭션으로 처리.
  2. 동시 수정 경합이 실제로 드물다면 트랜잭션 대신 TypeORM `save` 전에 `updated_at` 낙관적 잠금(`@VersionColumn`) 을 두거나, PostgreSQL 의 `jsonb_set` / `||` 를 직접 사용하는 쿼리로 atomic 업데이트.

---

### [WARNING] `getWorkspaceSettings` — 동일 workspaceId 에 대한 2회 DB 조회 (불필요한 중복 SELECT)
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `getWorkspaceSettings()` (라인 392~414)
- **상세**: `getMemberRole(workspaceId, userId)` 가 `workspace_member` 테이블을 SELECT 한 뒤, 별도로 `workspaceRepository.findOne({ where: { id: workspaceId } })` 를 다시 SELECT 한다. 두 쿼리를 한 번의 JOIN 으로 합치거나, `assertAdmin`/`getMemberRole` 계열 메서드가 workspace 엔티티를 같이 반환하도록 리팩토링하면 DB 라운드트립 1회를 절약할 수 있다.
- **제안**: `workspaceRepository.findOne` 에 `relations: ['members']` 를 추가하거나, 단일 쿼리로 멤버 역할과 workspace settings 를 함께 로드하도록 QueryBuilder 를 사용.

---

### [INFO] settings JSONB 컬럼에 대한 인덱스 없음 — 현재 쿼리 패턴에서 미영향이나 향후 위험 존재
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — 전반, Workspace entity
- **상세**: `workspace.settings` 는 PostgreSQL JSONB 컬럼으로 추정된다. 현재 변경에서는 `interactionAllowedOrigins` 키를 primary key(`workspace.id`) 기반으로 읽고 쓰기 때문에 JSONB 인덱스가 없어도 성능 문제가 없다. 그러나 향후 `settings->>'interactionAllowedOrigins'` 를 필터 조건으로 사용하는 쿼리가 추가될 경우 전체 테이블 스캔이 발생할 수 있다.
- **제안**: 현재 기능 범위에서는 인덱스 추가가 불필요하다. 향후 settings 키로 필터링이 필요해지면 `CREATE INDEX ON workspace USING gin(settings)` 를 마이그레이션에 추가한다.

---

### [INFO] 마이그레이션 파일 부재 확인 필요
- **위치**: 변경된 파일 목록 전체
- **상세**: 이번 변경에서 DB 스키마를 변경하는 마이그레이션 파일이 확인되지 않는다. `interactionAllowedOrigins` 는 기존 `Workspace.settings` JSONB 컬럼 내부 키이므로 스키마 DDL 변경 자체는 없다. 단, `settings` 컬럼이 아직 `NOT NULL DEFAULT '{}'::jsonb` 로 선언되어 있지 않다면 `workspace.settings ?? {}` 방어 코드(서비스 layne 378)가 런타임에서 null 을 처리하는 것은 올바르나, DB 레벨에서 NULL 허용 상태인지 확인이 필요하다.
- **제안**: `Workspace` 엔티티의 `settings` 컬럼 정의(`@Column({ type: 'jsonb', default: {} })`)가 `NOT NULL DEFAULT '{}' ` 인지 확인한다. 만약 nullable 이라면 기존 rows 에 NULL 이 있을 수 있으므로 마이그레이션에서 `UPDATE workspace SET settings = '{}' WHERE settings IS NULL` + `ALTER COLUMN SET NOT NULL` 을 추가할 것.

---

### [INFO] e2e 테스트에서 raw SQL 직접 조회 — 파라미터화된 쿼리 사용 여부
- **위치**: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 라인 478~484
- **상세**: `db.query('SELECT settings FROM workspace WHERE id = $1', [ws])` 는 PostgreSQL parameterized query `$1` 플레이스홀더를 사용하고 있어 SQL 인젝션 위험은 없다. 테스트 코드이므로 프로덕션 영향은 없다. 확인 완료.
- **제안**: 해당 없음(정상 패턴).

---

## 요약

이번 변경은 `Workspace.settings` JSONB 컬럼의 `interactionAllowedOrigins` 키를 읽고 쓰는 두 개의 서비스 메서드(`updateWorkspaceSettings`, `getWorkspaceSettings`)를 추가한다. 스키마 DDL 변경이 없어 마이그레이션 안전성 문제는 없다. 가장 주목할 DB 관련 이슈는 read-modify-write 패턴의 비원자성으로, 동시 Admin 이 서로 다른 설정 키를 수정할 경우 lost update 가 발생할 수 있고, assertAdmin-findOne-save 3단계가 단일 트랜잭션 없이 실행되어 엄밀한 정합성이 보장되지 않는다. 실제 트래픽에서 Admin 이 설정을 동시에 수정하는 빈도가 낮다면 즉각적인 장애 위험은 낮지만, 트랜잭션 또는 atomic JSON 업데이트(`jsonb ||` 연산)로 보강하는 것이 권장된다. 불필요한 중복 SELECT(getWorkspaceSettings 내 2회 DB 조회)는 성능 개선 여지가 있으며, settings 컬럼의 NULL 허용 여부도 명시적으로 확인이 필요하다.

## 위험도

LOW
