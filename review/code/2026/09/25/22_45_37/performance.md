# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** 역할(role) 조회 DB 왕복이 요청당 두 번(가드 + 핸들러) 일어나는 패턴이 이번 변경으로 3개 엔드포인트에 더 확산됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:456`(`update`, `@Roles('editor')` 는 445줄), `:514`(`rotate`, `@Roles('editor')` 는 497줄), `:645`(`remove`, `@Roles('editor')` 는 634줄) — 각 핸들러 본문의 `resolveRole(...)` 호출은 462/520/650줄
  - 상세: `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts:209` `assertMember`)는 `@Roles()` 가 붙은 라우트에 대해 매 요청 `workspacesService.getMemberRole(workspaceId, userId)` 를 호출해 역할을 조회한다(`memberRepository.findOne` — `codebase/backend/src/modules/workspaces/workspaces.service.ts:112`). 그런데 `update`/`rotate`/`remove` 핸들러는 가드 통과 뒤 **같은 `(workspaceId, userId)` 에 대해** `this.integrationsService.resolveRole(...)` 를 다시 호출하고, 이 메서드도 내부적으로 동일한 `workspacesService.getMemberRole` 을 부른다(`integrations.service.ts:1833`). 가드가 계산한 역할 값이 `request` 객체 등에 실리지 않아 핸들러가 재사용할 수 없고, 결과적으로 요청당 동일한 조회가 두 번 나간다.
  - 이 패턴 자체는 이번 diff 가 새로 만든 것이 아니라 기존 `create`(`integrations.controller.ts:415~441`, `@Roles('editor')` + 핸들러 내부 `resolveRole`)에 이미 있던 것이다. 이번 변경은 §8 권한 강제를 위해 같은 패턴을 `update`/`rotate`/`remove` 3곳에 **추가로 복제**해, 중복 DB 왕복이 발생하는 엔드포인트 수가 1개(`create`)에서 4개로 늘었다.
  - 각 조회는 인덱스 매치되는 단건 `findOne` 이라 개별 비용은 작지만, 통합을 다루는 4개 mutating 엔드포인트 전부에서 요청당 불필요한 네트워크 왕복 1회씩이 상시로 발생한다.
  - 제안: 가드가 조회한 역할을 `request.workspaceRole` 같은 필드에 실어 핸들러의 `@CurrentUser()` 처럼 데코레이터로 꺼내 쓰게 하거나, `resolveRole` 호출부를 가드 통과 이후 재조회가 아니라 가드 결과를 전달받는 구조로 바꿔 중복 조회를 제거한다. 최소한 이번 PR 범위에서는 새로 추가한 `reauthorize`/`requestScopes`/`updateScope`(§8 신규 권한 로직, `@Roles()` 없음이라 가드가 이 값을 조회하지 않음 — 순수 필요 조회)와 `update`/`rotate`/`remove`(가드가 이미 조회한 값의 중복)를 구분해, 후자만이라도 우선 정리할 가치가 있다.

- **[INFO]** Personal 통합 가시성 SQL 필터에 전용 인덱스 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:25`(`integrationVisibilityClause`) — 호출부는 `codebase/backend/src/modules/integrations/integrations.service.ts:519`(`findAll`)와 `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:172`(`listIntegrations`)
  - 상세: `(i.scope <> 'personal' OR i.created_by = :viewerId)` 조건이 `WHERE workspace_id = :workspaceId` 뒤에 `AND` 로 붙는다. `Integration` 엔티티(`entities/integration.entity.ts:21`)에는 `(workspaceId, status)` 복합 인덱스만 있고 `scope`/`created_by` 를 포함한 인덱스는 없다 — 다만 이 조건은 이미 `workspace_id` 로 좁혀진 소수의 행(워크스페이스당 통합 개수)에 대해서만 평가되므로, 현재 규모에서는 순차 스캔 비용이 무시할 만하다. 워크스페이스당 통합 수가 크게 늘어나는 시나리오가 생기면 재검토 대상.
  - 제안: 당장 조치 불필요. 워크스페이스별 통합 개수가 수백~수천 단위로 늘어나는 사용 패턴이 생기면 `(workspace_id, scope, created_by)` 복합 인덱스를 고려.

- **[INFO]** SQL 레벨 필터링은 올바른 설계 선택
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:513-519`(`findAll`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:163-176`(`listIntegrations`)
  - 상세: 남의 personal 통합을 애플리케이션 메모리에서 거르지 않고 쿼리 단계에서 걸러 페이지네이션 `total`/`limit` 이 정확하게 유지된다(주석에 명시). N+1 이나 불필요한 전량 로딩 없음 — 긍정적 평가.

- **[INFO]** `candidate-lookup.service.ts` 의 `fillCandidates` 는 `Promise.all` 로 필드별 후보 조회를 병렬화
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:56-67`
  - 상세: `userId` 매개변수 추가는 순수 plumbing 이고 기존 병렬 조회 패턴(순차 N+1 아님)은 그대로 유지된다. 새로운 성능 리스크 없음.

## 요약
이번 변경은 personal/organization 통합 가시성·소유자 강제 로직을 SQL 필터(`integrationVisibilityClause`)와 단건 조회(`requireVisible`/`requireModifiable`) 중심으로 구현해 N+1, 불필요한 전량 로딩, 과도한 메모리 할당 같은 새로운 성능 리스크는 발견되지 않았다. 다만 `update`/`rotate`/`remove` 3개 엔드포인트에서 이미 `create` 에 있던 "가드가 역할을 조회하고 핸들러가 같은 역할을 다시 조회하는" 중복 DB 왕복 패턴이 그대로 복제되어, 해당 패턴이 적용되는 mutating 엔드포인트 수가 늘었다는 점은 정리할 가치가 있는 비효율이다(요청당 영향은 작지만 상시 발생). Personal 가시성 SQL 조건에 전용 인덱스가 없는 점은 현재 규모에서는 무시 가능한 수준이라 INFO 로만 남긴다.

## 위험도
LOW
