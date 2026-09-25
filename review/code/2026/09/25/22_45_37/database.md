# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** `update`·`rotate`·`remove` (+기존 `create`) 라우트에서 역할(role) 조회 쿼리가 요청당 두 번 실행된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:445`(`@Roles('editor')`) ~ `462-465`(`update` 내 `resolveRole` 호출), `497` ~ `520-523`(`rotate`), `634` ~ `650-653`(`remove`)
  - 상세: 이 세 라우트는 `@Roles('editor')` 데코레이터가 붙어 있다. 전역 `APP_GUARD` 인 `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts`)는 `@Roles()` 가 있는 라우트에 대해 **헤더 유무와 무관하게 항상** `assertMember()` → `WorkspacesService.getMemberRole(workspaceId, userId)` 를 호출해 멤버십·역할을 확인한다(그 파일 자체 docstring "역할 계층 비교 — `@Roles()` 가 있는 라우트는 헤더 유무와 무관하게 항상"). 이번 PR 은 `update`/`rotate`/`remove` 핸들러 본문에 `const role = await this.integrationsService.resolveRole(workspaceId, user.sub)` 를 새로 추가했는데, `resolveRole` 은 그대로 `this.workspacesService.getMemberRole(workspaceId, userId)` 를 호출한다(`integrations.service.ts:1833-1837`). 즉 **같은 `(workspace_id, user_id)` 조건의 조회가 가드에서 한 번, 컨트롤러에서 한 번, 요청당 두 번** 실행된다. 인덱스(`@Unique(['workspaceId','userId'])`, `workspace-member.entity.ts:14`)가 있어 각 쿼리 자체는 저비용이지만, 이 저장소는 정확히 같은 패턴("`getMemberRole` 을 부르므로 그대로 이어 쓰면 같은 쿼리가 두 번 돈다", `workspaces.service.ts:842` 주석)을 이미 알고 피해 온 이력이 있다 — 이번 변경은 그 안티패턴을 `create` 1곳에서 3곳(update/rotate/remove) 더 확장한다.
  - 제안: `RolesGuard` 가 검증한 role 을 `request` 객체(또는 커스텀 `@CurrentRole()` 데코레이터)에 실어 컨트롤러가 재사용하게 하거나, `resolveRole` 호출을 컨트롤러에서 걷어내고 서비스 내부(`requireModifiable`/`assertCanModify` 호출부)에서 한 번만 조회하도록 통합. 트래픽이 낮은 control-plane 엔드포인트라 즉시 성능 문제는 아니지만, 같은 PR 로 3곳을 늘렸으므로 지금 정리하는 편이 싸다.

- **[INFO]** 새 personal 가시성 필터(`scope <> 'personal' OR created_by = :param`)가 커버 인덱스 밖의 컬럼을 건드린다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:515-519`(`findAll`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:170-174`(`listIntegrations`)
  - 상세: `Integration` 엔티티의 기존 인덱스는 `idx_integration_workspace_status`(`workspace_id, status`) 하나뿐이고 `scope`·`created_by` 는 인덱싱되어 있지 않다(`entities/integration.entity.ts:20`). 새로 추가된 `andWhere(integrationVisibilityClause('i'), ...)` 는 `workspace_id` 필터로 좁혀진 행 집합 안에서 `scope`/`created_by` 를 OR 로 다시 필터링해야 한다. `workspace_id` 인덱스가 먼저 행을 좁혀 주므로 통합(Integration) 테이블처럼 워크스페이스당 로우 수가 작은(control-plane 설정 테이블) 경우 실측 영향은 미미할 것으로 보이지만, 이 OR 조건은 인덱스만으로 접근 가능한 범위가 아니라 워크스페이스당 로우가 크게 늘면(예: 대규모 조직에서 통합을 수백~수천 개 등록) 시퀀셜 필터 비용이 함께 증가한다.
  - 제안: 현재 규모에서는 조치 불요. 다만 워크스페이스당 통합 개수가 커질 가능성이 있다면 `(workspace_id, scope, created_by)` 복합 인덱스 또는 `(workspace_id, created_by) WHERE scope = 'personal'` 부분 인덱스를 고려할 수 있다는 점을 기록해 둔다.

- **[INFO]** `integrationVisibilityClause` 의 `alias` 파라미터는 파라미터화되지 않고 SQL 문자열에 직접 보간된다
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:25-27`
  - 상세: `viewerId` 값 자체는 `:${INTEGRATION_VIEWER_PARAM}` 바인드 파라미터로 안전하게 처리되지만, `alias` 는 `` `(${alias}.scope <> 'personal' OR ${alias}.created_by = :...)` `` 형태로 그대로 문자열에 삽입된다. 현재 두 호출부(`integrations.service.ts:517`, `explore-tools.service.ts:173`) 모두 하드코딩된 리터럴 `'i'` 를 넘기므로 실제로 악용 가능한 인젝션 경로는 없다.
  - 제안: 지금 당장 수정할 필요는 없으나, 향후 이 헬퍼에 사용자 입력이나 동적으로 계산된 값을 `alias` 로 넘기는 호출이 추가되지 않도록 타입 수준에서 리터럴 유니온으로 제한하거나 JSDoc에 "컴파일타임 상수만 허용" 주석을 명시하는 것을 권장.

- **[정보/확인]** 트랜잭션·페이지네이션·마이그레이션은 이번 변경 범위에서 문제 없음
  - `rotate()` 의 비관적 락 구간은 기존 패턴을 유지하면서 락 안에서 `isIntegrationVisibleTo(fresh, userId)` 재검증을 추가했다(`integrations.service.ts:1266-1271`) — 락 전/락 안 스냅샷이 갈릴 수 있는 TOCTOU 를 올바르게 재확인한다.
  - `findAll` 은 신설 가시성 필터를 `getCount()`·`getMany()` 양쪽에 적용되는 동일 `qb` 인스턴스에 걸어, 메모리 필터링으로 인한 페이지네이션 `total` 왜곡(스펙 §8 이 명시적으로 우려하는 지점)을 SQL 레벨에서 막는다 — 올바른 구현이다.
  - 이번 PR 은 엔티티·마이그레이션 파일을 건드리지 않는다(`scope`/`created_by` 컬럼은 기존 것). 무중단 배포 관점의 lock/데이터 손실 위험 없음.
  - `CandidateLookupService.fillCandidates` 는 여전히 `Promise.all` 병렬 조회를 사용하며 반복문 내 순차 개별 쿼리(N+1) 패턴은 도입되지 않았다.

## 요약

이번 변경은 Integration 의 personal/organization 가시성 규칙(§8)을 서비스·컨트롤러 전반에 배선하는 작업으로, 가시성 SQL 절을 `WHERE` 수준에서 걸어 페이지네이션 total 왜곡을 막고 락 재검증도 올바르게 확장하는 등 DB 관점에서 견고하게 처리되어 있다. 다만 `update`/`rotate`/`remove` 컨트롤러에 새로 추가된 `resolveRole()` 호출이 이미 `RolesGuard` 가 같은 조건으로 수행한 `getMemberRole` 조회를 요청당 한 번 더 중복 실행시키는 점은, 이 저장소가 이미 알고 있는 안티패턴을 3곳 더 늘린 것이라 정리 대상으로 남긴다. 인덱스·마이그레이션·SQL 인젝션 관점에서 즉각적인 위험은 없다.

## 위험도

LOW
