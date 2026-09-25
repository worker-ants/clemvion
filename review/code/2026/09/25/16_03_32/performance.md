# 성능(Performance) 코드 리뷰

## 발견사항

- **[WARNING]** `RolesGuard` 의 경로 워크스페이스 멤버십 조회가 `WorkspacesService` 의 기존 조회와 중복되어, admin/owner 대상 엔드포인트마다 DB 왕복이 1회(삭제 경로는 2회) 늘었다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:174-181`(`assertMember` 호출부, `assertMember` 본체는 `227-244`), 호출되는 쪽 `codebase/backend/src/modules/workspaces/workspaces.service.ts:218`(`listMembers`→`assertMembership`), `:258`(`addMemberByEmail`→`assertAdmin`), `:308`(`updateMemberRole`→`assertAdmin`), `:370`(`renameWorkspace`→`assertAdmin`), `:404`(`updateWorkspaceSettings`→`assertAdmin`), `:478`(`getWorkspaceSettings`→`getMemberRole` 직접), `:531`+`:563`(`deleteWorkspace`→`assertWorkspaceDeletable` 2회, 잠금 전/후), `:652`(`leaveWorkspace`→`assertMembership`).
  - 상세: 이번 PR 이전에는 `update`/`updateSettings`/`getSettings`/`remove`/`leave`/`listMembers`/`addMember`/`updateMember`/`removeMember`/`listInvitations`/`createInvitation`/`resendInvitation`/`revokeInvitation` 라우트가 평범한 `@Param('id', ParseUUIDPipe)` 를 썼고 `@Roles()` 도 없었던 자리가 대부분이라, `RolesGuard.canActivate` 는 `consumesRequestContext=false && needsRoleCheck=false` 로 즉시 `return true` 하고 워크스페이스 관련 DB 조회를 전혀 하지 않았다(가드 비용 0). 이번 PR 이 `@WorkspaceParam('id')` + (일부는) `@Roles('admin'|'owner')` 를 추가하면서, 가드가 매 요청마다 `assertMember` → `workspacesService.getMemberRole(workspaceId, userId)` 를 1회 실행하게 됐고, 그 값을 서비스 계층에 전달하는 경로가 없어 서비스가 자신의 `assertAdmin`/`assertMembership`/`getMemberRole`(위 인용 라인)로 **동일한 `(workspaceId, userId)` 조합을 다시 조회**한다. 즉 `PATCH /workspaces/:id`, `.../settings`, `POST/PATCH/DELETE .../members(/:memberId)`, `.../invitations*` 등 admin 경로 대부분이 요청당 2회의 `SELECT ... FROM workspace_members WHERE workspace_id=$1 AND user_id=$2` 를 순차로 실행하고, `deleteWorkspace` 는 서비스 자체가 이미 잠금 전/후 두 번 조회하던 데다 가드까지 더해 3회가 된다.
    같은 파일(`workspaces.service.ts:834-836` 근방, `removeMember`)의 주석은 "요청자 role 을 **한 번만** 읽는다 — `assertMembership` 과 `assertAdmin` 은 둘 다 `getMemberRole` 을 부르므로 그대로 이어 쓰면 같은 쿼리가 두 번 돈다" 고 명시하며, 정확히 이 중복을 서비스 내부에서는 이미 신경 써서 피해 왔다. 이번 PR 은 가드-서비스 경계에서 같은 패턴을 재도입한다.
  - 제안: 개별 쿼리 자체는 인덱스드 단건 조회라 비용이 작지만(치명적이진 않음), 트래픽이 큰 admin API 에서 요청당 DB 왕복이 배가되는 것은 회피 가능한 낭비다. `RolesGuard.assertMember` 가 조회한 role 을 `request`(예: `request[WORKSPACE_ROLE_CACHE_KEY]`)에 실어 두고 서비스의 `assertAdmin`/`assertMembership`/`getMemberRole` 이 먼저 그 캐시를 확인하도록 하거나, 최소한 이 트레이드오프를 가드/서비스 docstring에 "의도적 defense-in-depth" 로 명시해 다음 사람이 최적화 대상인지 판단할 수 있게 남긴다.

- **[INFO]** `pathParamNames` 순회가 순차 `await` 이고 값 기준 dedup 이 없다 — 현재는 영향 없지만 향후 회귀 여지.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:175-181`
  - 상세: `for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }` 는 매치되는 경로 파라미터 이름마다 **순차** DB 조회를 한다. `grep -rn "WorkspaceParam(" codebase/backend/src/modules/workspaces/workspaces.controller.ts codebase/backend/src/modules/auth/auth.controller.ts` 로 확인한 결과 현재 모든 핸들러가 `@WorkspaceParam` 을 메서드당 1개만 쓰므로 실질 성능 영향은 없다. 다만 향후 한 라우트가 워크스페이스 경로 파라미터를 2개 이상 받게 되면(예: 리소스 이동/복사 API) 순차 대기가 늘어나고, 두 이름이 같은 값을 가리켜도 동일 `(workspaceId, userId)` 재조회를 막는 장치가 없다.
  - 제안: 지금 고칠 필요는 없지만, 다음에 `@WorkspaceParam` 이 2개 이상 쓰이는 라우트가 생기면 `Promise.all` 병렬화 또는 값 기준 `Set` dedup 을 추가하는 것을 잊지 않도록 코드 주석에 남겨 둘 만하다.

- **[INFO]** 전역 가드 경로에서 `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` 조회가 요청당 1회에서 2회로 늘었다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` — `handlerConsumesWorkspaceId` (약 62-81번째 줄, `Reflect.getMetadata` 호출부), `workspaceParamNamesOf` (약 124-140번째 줄, 동일 key 로 별도 `Reflect.getMetadata` 호출). 호출부: `codebase/backend/src/common/guards/roles.guard.ts:167-173`.
  - 상세: 두 함수 모두 `ROUTE_ARGS_METADATA` 를 같은 `(controllerClass, methodName)` 키로 독립적으로 조회한 뒤 각자 `factory` 를 비교한다. `RolesGuard.canActivate` 는 전역 가드라 인증된 모든 요청에서 이제 이 둘을 순서대로 호출하므로, reflect-metadata 조회 횟수가 요청당 1회(종전 `handlerConsumesWorkspaceId` 만)에서 2회로 늘었다. `reflect-metadata` 는 Map 기반 조회라 개별 비용은 마이크로초 단위로 미미하지만, 두 판별이 같은 원본 메타데이터를 다시 읽는 것은 불필요한 중복 연산이다.
  - 제안: 시급하지 않음. 필요하면 `Reflect.getMetadata` 결과를 한 번만 읽어 두 팩토리(`extractWorkspaceId`, `extractWorkspaceParam`)를 함께 비교하는 단일 함수로 합쳐 호출부에서 한 번만 부르게 리팩터링할 수 있다(캐너리 쪽 `countWorkspaceConsumingRoutes` 도 같은 패턴이라 부트 시점엔 영향 없음 — 요청 경로만 해당).

- **[INFO]** `deleteWorkspace`/`leaveWorkspace` 에 인가-먼저 순서로 `assertMembership` 호출이 추가되어 DB 왕복이 1회 더 늘었다(보안 목적의 의도된 트레이드오프).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:652`(`leaveWorkspace`), 관련 순서 변경은 `renameWorkspace`(구 `addMemberByEmail` 인근) 등에서도 `assertAdmin` → `assertWorkspaceType` 순서 교체로 나타난다.
  - 상세: "인가가 조회보다 먼저다 — 거꾸로면 비멤버가 존재/유형을 구분한다" 는 근거로 추가된 것으로, 오라클 차단이 목적이라 되돌릴 사안은 아니다. 다만 위 첫 번째 WARNING 과 합쳐지면(가드도 같은 라우트에서 멤버십을 이미 확인) `leaveWorkspace`/`deleteWorkspace` 한 요청당 순차 DB 호출 수가 더 늘어난다는 점은 기록해 둔다.
  - 제안: 별도 조치 불요. 위 WARNING 의 캐싱 개선이 이뤄지면 이 항목의 비용도 함께 줄어든다.

- **[INFO]** `workspace-reflection-canary.ts` 의 `countWorkspaceConsumingRoutes` 는 전 컨트롤러 × 전 메서드를 순회하며 이제 라우트당 reflection 호출이 2배(`handlerConsumesWorkspaceId` + `workspaceParamNamesOf`)가 됐다.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:98-124`(`countWorkspaceConsumingRoutes`)
  - 상세: 이 함수는 **부팅 시 1회**만 실행되는 캐너리이고 컨트롤러/메서드 수는 이 저장소 규모(수백 라우트)에서 명확히 유한하므로, 순회 비용이 2배가 되어도 부팅 지연에 미치는 영향은 무시할 수준이다. 런타임 요청 경로가 아니라는 점에서 위 WARNING/INFO 항목들과 성격이 다르다.
  - 제안: 조치 불요.

## 요약

이번 변경의 핵심은 `@WorkspaceParam` 경로 파라미터를 `RolesGuard` 가 reflection 으로 인식해 멤버십·역할을 매 요청 검증하도록 만든 보안 강화이며, 알고리즘 복잡도·캐싱 전략·자료구조 선택 자체에는 문제가 없다. 다만 종전에 서비스 계층에서만 수행되던 `getMemberRole` 조회를 가드 계층에도 추가하면서, admin/owner 대상 워크스페이스 엔드포인트 대부분(rename·settings·members·invitations·delete·leave 등)이 요청당 사실상 동일한 멤버십 쿼리를 가드와 서비스에서 각각 한 번씩(삭제 경로는 그 이상) 중복 실행하게 됐다. 이는 같은 서비스 파일이 다른 자리(`removeMember`)에서 명시적으로 피해 온 패턴을 가드-서비스 경계에서 재도입한 것으로, 개별 쿼리 비용은 작지만 트래픽이 몰리는 admin API 에서는 회피 가능한 DB 왕복 배가다. 그 외 reflection 이중 조회, 순차 `await` 루프는 현재 규모에서는 실질 영향이 없는 낮은 우선순위 항목이다.

## 위험도
LOW
