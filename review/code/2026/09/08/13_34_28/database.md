# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `listMembers` 가 JS 매핑 투영에서 DB `select` 투영으로 전환 — 성능·데이터 최소화 관점에서 개선
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-231` (`listMembers`)
  - 상세: 기존에는 `relations: ['user']` 로 `User` 전체 컬럼을 로드한 뒤 `.map` 에서 6키만 골랐다. 이번 변경은 TypeORM `find()` 의 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 를 추가해 **쿼리 레벨**에서 컬럼을 좁힌다. `relations: ['user']` 는 그대로 두고 `select` 로 조인 대상 컬럼만 지정했으므로 여전히 단일 쿼리(LEFT JOIN)이며 N+1 이 발생하지 않는다. `WorkspaceMember` 엔티티는 `@Unique(['workspaceId', 'userId'])` 복합 유니크 인덱스를 갖고 있어 `where: { workspaceId }` 필터는 그 인덱스의 선두 컬럼으로 커버된다(신규 인덱스 필요 없음). 전송 컬럼 수가 줄어 네트워크·직렬화 비용도 감소한다. 이 쿼리는 단일 워크스페이스 멤버 목록으로 규모가 제한적이라 페이지네이션 부재는 이번 diff 가 새로 만든 문제가 아니다(기존 설계 유지).
  - 제안: 없음 — 개선으로 판단. 다만 워크스페이스 멤버 수가 매우 커질 잠재 가능성이 있다면(예: 대형 조직 지원 로드맵) 추후 별도 트래킹으로 페이지네이션 도입을 검토할 수 있다(이번 diff 범위 밖).

- **[INFO]** 전역 예외 필터의 unique violation 판정 표면 확대 — DB 에러 매핑 정확도 개선, 신규 리스크 없음
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:11, 70` (`GlobalExceptionFilter.catch`, `isUniqueViolation` → `isPostgresUniqueViolation`)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, TypeORM 이 감싸지 않은 raw 표면(`err.code === '23505'`)으로 올라오는 unique 위반을 놓치고 500 으로 응답했다. `pg-error.ts` 의 `isPostgresUniqueViolation` 은 `err.code` 와 `err.driverError.code` 두 표면을 모두 흡수해 판정 범위를 넓혔다. 클라이언트에 노출되는 메시지는 여전히 고정 문구(`'Resource already exists or has been modified concurrently.'`)라 raw 드라이버 메시지(제약명·SQL 등)가 새지 않는다 — CWE-209 마스킹 유지. 확대된 매칭이 다른 에러 코드까지 409 로 잘못 넓히지 않는지는 `23502`(not-null) → 500 유지 테스트로 회귀 고정되어 있다.
  - 제안: 없음.

- **[INFO]** `integration-oauth.service.ts` 의 제약명 추출 로직을 공용 헬퍼(`pgErrorConstraint`)로 통합 — 중복 제거, 동작 동일
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (두 catch 블록, `STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 비교부)
  - 상세: 인라인으로 두 표면(`err.constraint` / `err.driverError.constraint`)을 흡수하던 코드를 `pgErrorConstraint()` 호출로 대체했다. 로직은 기존과 동일(`??` 우선순위 동일)하여 회귀 위험이 없고, `pg-error.spec.ts` 유닛 테스트 외에 cafe24/makeshop 두 callsite 스펙에 `driverError` wrap 표면 케이스가 추가되어 실제 TypeORM 이 반환하는 형태(wrap 됨)까지 회귀 고정되었다. 트랜잭션·커넥션 관리에는 영향 없음(단일 `save()` 호출의 에러 후처리만 변경).
  - 제안: 없음.

- **[INFO]** `webhook-trigger.e2e-spec.ts` B4 케이스 추가 — `(workspace_id, endpoint_path)` UNIQUE 제약을 실제 DB 로 검증
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (`'B4. 같은 워크스페이스에 같은 endpointPath → 409 RESOURCE_CONFLICT...'`)
  - 상세: 기존 유닛 테스트는 `QueryFailedError` 를 손으로 흉내 내 `rethrowEndpointPathConflict` 분기를 태웠으나, 실 Postgres 가 그 형태(SQLSTATE·제약 이름)를 실제로 반환하는지는 검증하지 못했다. 이번 e2e 는 실 DB 유니크 제약 위반을 직접 유발해 409 응답과 `details` 페이로드, 원문 미노출(`'duplicate key'` 문자열 부재)을 함께 단언한다 — DB 계층 통합 검증으로 바람직하다.
  - 제안: 없음.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 순수 타입 리네이밍
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (타입 선언부 및 `findOne` 반환 타입)
  - 상세: 쿼리 자체(`select`/`relations`)는 변경되지 않았다. 프런트엔드 손-미러 타입과의 이름 충돌로 인한 "유일 정의" 오판을 방지하기 위한 개명이며, 실행 시점 쿼리·DB 동작에는 영향이 없다.
  - 제안: 없음.

이번 diff 에는 스키마 마이그레이션 파일이 포함되어 있지 않다 — 마이그레이션 안전성(lock, 데이터 손실) 관점의 점검 대상 없음. 나머지 파일(`.claude/test-stages.sh`, `CHANGELOG.md`, `PROJECT.md`, `tsconfig.build.json`, repo-guard 정적 분석 테스트류, plan 문서)은 타입체크 ratchet 배선·문서·정적 AST 가드로 DB 와 무관하다.

## 요약

이번 변경 집합에서 실행 경로에 영향을 주는 DB 관련 코드는 세 곳이다: (1) `WorkspacesService.listMembers` 를 JS 매핑 투영에서 TypeORM `select` 쿼리 투영으로 전환(단일 JOIN 쿼리 유지, 인덱스 커버됨, N+1 없음, 컬럼 축소로 오히려 효율 개선), (2) 전역 예외 필터의 unique-violation 판정을 두 드라이버 표면(raw/wrapped) 모두 잡도록 넓혀 이전에 500 으로 새던 케이스를 409 로 정확히 매핑(메시지 마스킹 유지, 회귀 테스트로 과확대 여부 확인됨), (3) `integration-oauth.service.ts` 의 제약명 추출을 공용 헬퍼로 DRY 화(동작 동일). 마이그레이션·트랜잭션 경계 변경, 신규 raw SQL, 커넥션 풀 조작은 없으며 모두 기존 파라미터화된 TypeORM 리포지토리 API 를 사용한다. 종합적으로 이번 diff 는 DB 관점에서 위험을 추가하지 않고 일부는 개선(데이터 최소화, 에러 매핑 정확도)이다.

## 위험도

NONE
