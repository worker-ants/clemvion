# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 경로 워크스페이스로 전환된 15개 라우트 전부에서 가드-계층과 서비스-계층이 같은 멤버십/역할 쿼리를 중복 수행한다(추가 DB round-trip)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `RolesGuard.canActivate` (경로 분기, `pathParamNames.length > 0` 블록) + `codebase/backend/src/modules/workspaces/workspaces.service.ts` `assertAdmin`/`assertMembership`(933, 941번째 줄 부근) + `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `assertAdmin`
  - 상세: `workspaces.controller.ts`의 14개 라우트 + `auth.controller.ts`의 `switchWorkspace` 1개(총 15곳, `workspace-roles-attachment.spec.ts`의 신규 표로 확인)가 `@Param` → `@WorkspaceParam`으로 바뀌면서, 종전에는 `@Roles()`도 `@WorkspaceId()`도 없어 `RolesGuard`가 무조건 단축 통과(`return true`, DB 조회 0회)시키던 라우트들이 이제 가드에서 `getMemberRole` 1회를 무조건 수행한다. 그런데 이 라우트들을 받는 서비스 메서드(`renameWorkspace`·`updateWorkspaceSettings`·`addMemberByEmail`·`updateMemberRole`·`removeMember`(내부 `getMemberRole` 직접 호출)·`leaveWorkspace`·`WorkspaceInvitationsService.invite/resend/listPending/revoke`)는 이 diff 이후에도 여전히 자신만의 `assertAdmin`/`assertMembership`/`getMemberRole` 호출을 그대로 유지한다. 결과적으로 정상 성공 경로에서 같은 `(workspaceId, userId)` 쌍에 대한 멤버십 조회가 요청당 2회(가드 1회 + 서비스 1회) 발생한다 — 종전에는 서비스 1회뿐이었다. `transferOwnership`/`deleteWorkspace`는 docstring에 "가드는 첫 차단선, service 는 트랜잭션 내부 락 하의 재검증"으로 이 이중화가 명시적으로 정당화되어 있으나, 나머지 ~12개 라우트(rename·updateSettings·addMember·updateMemberRole·removeMember·leave·listInvitations·createInvitation·resendInvitation·revokeInvitation·listMembers·getSettings)에는 이 이중 조회에 대한 언급이 없다.
  - 제안: 의도된 defense-in-depth라면 각 서비스 메서드 docstring에 "가드가 이미 검증했지만 두 번째 방어선으로 유지" 취지를 남겨 다음 사람이 착오로 "죽은 코드"라 여기고 제거하지 않게 한다. 성능이 중요하면 가드가 검증한 role을 request-scoped 값으로 전달해 서비스가 재조회하지 않게 하는 리팩터를 별도 트래킹.

- **[WARNING]** `removeMember`의 기존 rationale 주석이 같은 changeset의 형제 변경으로 인해 이미 사실과 다르게 되었다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:824-828` (`removeMember` 본문 상단 주석, "가드 층은 이 라우트를 막지 못한다 — `@Roles()` 가 없고 `handlerConsumesWorkspaceId` 가 false(`@WorkspaceId()` 가 아니라 `@Param('id')`)라 `RolesGuard` 가 단축 통과시킨다.")
  - 상세: `git blame` 확인 결과 이 주석은 본 PR 바로 전날(2026-09-24, 커밋 `33caa750c0`)에 작성됐고 본 PR(`d5031b699`)에서는 건드리지 않았다. 그런데 같은 PR이 `workspaces.controller.ts`의 `removeMember` 핸들러를 `@Param('id', ParseUUIDPipe)` → `@WorkspaceParam('id')`로 바꿨다(`workspace-roles-attachment.spec.ts`의 새 표에도 `[WorkspacesController, 'removeMember', null]`로 등재돼 `workspaceParamNamesOf`가 `['id']`를 반환함을 고정한다). 즉 지금은 `RolesGuard`가 이 라우트에서도 경로 분기를 타 `assertMember(raw, userId, [])`로 멤버십을 먼저 확인하고 비멤버를 403으로 막는다 — 주석이 말하는 "가드가 이 라우트를 막지 못한다"는 전제가 더 이상 참이 아니다(역할 검사는 여전히 가드가 안 하므로 admin 판정까지 가드가 대신한다는 뜻은 아니지만, "가드가 전혀 개입하지 않는다"는 서술은 틀렸다). 다음에 이 주석만 보고 보안 모델을 판단하는 사람은 가드가 이 경로에 아무 보호도 안 준다고 오판할 수 있다.
  - 제안: 주석을 "가드가 경로 워크스페이스 멤버십은 확인하지만 admin 판정은 하지 않는다(`@Roles()` 없음)"로 갱신.

- **[INFO]** `RolesGuard`의 거부 응답 바디가 애플리케이션 전역으로 바뀐다(의도된 변경이나 영향 범위가 넓음)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember` (`ForbiddenException(NOT_A_MEMBER)` / `ForbiddenException(ROLE_REQUIRED[threshold])`)
  - 상세: 종전에는 `canActivate`가 거부 시 `false`를 반환해 Nest 기본 `ForbiddenException`(메시지 `Forbidden`)이 발생했고, `GlobalExceptionFilter.getCodeFromStatus(403)`가 `code: 'FORBIDDEN'`을 채웠다. 이번 변경으로 **새 경로(`@WorkspaceParam`)뿐 아니라 기존의 모든 `@Roles()` 보호 라우트**의 거부 응답이 `{code: 'NOT_A_MEMBER'|'EDITOR_REQUIRED'|...}`로 바뀐다 — 커밋 메시지("가드 거부는 코드를 싣는다")와 `workspace-rbac.e2e-spec.ts`의 갱신된 단언들(`EDITOR_REQUIRED`, `ADMIN_REQUIRED` 등)로 볼 때 의도된 전면 변경이다. `grep`으로 프런트/백엔드에서 옛 리터럴 `'Forbidden'`을 소비하는 코드는 발견되지 않았으나, 이 diff의 changeset(`codebase/**` 22개 파일)에는 프런트엔드 에러 핸들링 코드가 포함돼 있지 않으므로 그쪽에서 `error.code`를 사용하는 로직이 이 변경과 정합적인지는 이 리뷰의 시야 밖이다.
  - 제안: 프런트엔드가 403 응답 바디의 `code` 필드에 의존하는 곳(토스트 메시지 등)이 있다면 함께 감사했는지 확인.

- **[INFO]** exported 함수 시그니처 변경 — 현재는 유일한 호출자가 같은 파일이라 외부 영향 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:98` (`export function countWorkspaceConsumingRoutes`, 종전 이름 `countWorkspaceIdConsumingRoutes`)
  - 상세: 반환 타입이 `number` → `WorkspaceConsumingRouteCount`(`{requestContext, pathParam, total}`)로 바뀌고 함수명도 바뀌었다. `grep -rn` 결과 `codebase/backend/src` 내 유일한 (테스트 제외) 호출자는 같은 파일의 `assertWorkspaceIdReflectionWorks`뿐이라 실제 호출자 파손은 없다. 이 함수를 부팅 시점에 호출하는 `main.ts`의 `assertWorkspaceIdReflectionWorks(app)` 시그니처(인자·반환 `number`)는 변경되지 않았다.
  - 제안: 없음(export이므로 향후 재사용 시 이 파일의 반환 타입 변경을 인지할 것).

## 요약

핵심 프로덕션 변경(`workspace.decorator.ts`의 `WorkspaceParam`/`workspaceParamNamesOf`, `roles.guard.ts`의 경로 워크스페이스 분기·코드 실은 `ForbiddenException`)은 문서화·테스트가 매우 두텁고 전역 변수·파일시스템·네트워크·환경변수 측면에서 관측 가능한 새로운 부작용은 없다. 실제로 발견된 부작용은 두 가지 결이다 — (1) 경로 워크스페이스로 전환된 15개 라우트 전부가 가드 계층에서 멤버십을 무조건 재조회하면서, 이미 존재하던 서비스 계층의 동일 조회가 제거되지 않아 정상 요청에서 DB round-trip이 두 배로 늘었고 이 중복이 명시적으로 정당화된 곳(transferOwnership/deleteWorkspace)과 그렇지 않은 곳(나머지 대부분)이 섞여 있다. (2) 같은 changeset이 `removeMember` 핸들러의 바인딩을 바꾸면서 바로 전날 작성된 인접 rationale 주석("가드가 이 라우트를 막지 못한다")의 전제를 깨뜨렸는데 그 주석은 갱신되지 않았다. 둘 다 정정 가능한 수준이며 보안 회귀는 아니다. `RolesGuard`의 403 응답 바디 변경은 전 라우트에 영향을 주는 의도된 인터페이스 변경이라 CRITICAL로 볼 것은 아니지만 범위가 넓다는 점은 기록해 둔다.

## 위험도

LOW
