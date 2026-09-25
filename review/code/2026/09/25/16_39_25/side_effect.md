# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `RolesGuard` 거부 응답의 wire 코드 변경이 저장소 전역 `@Roles()` 라우트에 적용된다 (블라스트 반경이 PR 범위보다 넓다)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` — `assertMember` (게이트 220~237행), `canActivate` (게이트 144~188행)
  - 상세: 종전엔 멤버십·역할 거부가 `false` 반환 → 전역 필터가 기본 `403 FORBIDDEN` 코드를 채웠다. 이번 변경은 `ForbiddenException(NOT_A_MEMBER | EDITOR_REQUIRED | ADMIN_REQUIRED | OWNER_REQUIRED)` 를 던진다. 이 가드는 `APP_GUARD` 로 전역 등록돼 있어, 이 코드 변경은 이번 PR 이 다루는 경로 워크스페이스 15곳뿐 아니라 **`@Roles()` 가 붙은 저장소 전체 라우트**(spec 실측: editor 66 · admin 9 · owner 7 · viewer 5)의 403 응답 본문(`error.code`)을 `FORBIDDEN` 에서 위 코드들로 바꾼다. `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" 가 이를 명시적으로 설계·정당화하고, FE `axiosMessage`(`codebase/frontend/src/lib/api/errors.ts`)는 코드가 아니라 `message` 문자열을 우선 소비해 대부분 화면에서 안전하게 저하(degrade)된다. 다만 `error.code === 'FORBIDDEN'` 을 직접 분기하는 외부/미문서 소비자(서드파티 통합, 모니터링·알림 규칙 등 이 diff 밖의 코드)가 있다면 그 판정이 조용히 깨진다 — 이 diff 내에서는 그런 소비자가 발견되지 않았다.
  - 제안: 의도된 변경이므로 되돌릴 필요는 없으나, API 버전 노트/CHANGELOG 에 "모든 `@Roles()` 라우트의 403 코드가 `FORBIDDEN`→구체 코드로 바뀐다"를 명시적으로 남겨 이 PR 을 좁은 "경로 가드" 변경으로 오인하지 않게 할 것을 권장한다.

- **[INFO]** 멤버십 조회가 가드 + 서비스 계층에서 중복 실행된다 (의도된 중복이나 범위가 넓다)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:assertMember`(게이트 220~230행) · `codebase/backend/src/modules/workspaces/workspaces.service.ts:assertMembership`/`assertAdmin` · `codebase/backend/src/modules/auth/auth.controller.ts:switchWorkspace`(게이트 448~455행) → `auth.service.ts` 의 `resolveTokenWorkspaceContext`
  - 상세: `@WorkspaceParam` + (해당 시) `@Roles()` 가 붙은 15개 라우트(`workspaces.controller.ts` 14곳 · `auth.controller.ts` `switchWorkspace` 1곳) 전부에서, 가드의 `assertMember` 가 `getMemberRole` 을 한 번 조회하고, 핸들러가 위임하는 서비스 메서드가 **같은 워크스페이스·같은 사용자**에 대해 `getMemberRole` 을 또 한 번 조회한다 — 요청당 DB 왕복이 1회에서 2회로 늘었다. `workspaces.service.ts` 의 `assertMembership`/`assertAdmin` docstring(게이트 936~942행)과 `spec/data-flow/12-workspace.md` §"서비스 계층 검사는 남는다" 는 이 중복을 "가드 인식이 깨졌을 때의 두 번째 선"으로 명시적으로 정당화한다. 반면 `auth.service.ts` 의 `resolveTokenWorkspaceContext`(`switchWorkspace` 경로)에는 같은 취지의 주석이 없다 — spec 문서의 일반 rationale 이 이 라우트도 포함한다고 언급하지만, 코드 자리에는 "의도된 중복" 표시가 없어 다음 사람이 "가드가 이미 검증했으니 이 조회는 죽은 코드"로 오판해 제거할 위험이 있다.
  - 제안: `auth.service.ts` 의 `resolveTokenWorkspaceContext`(또는 `switchWorkspace`) 에도 `workspaces.service.ts` 와 동일한 "가드가 먼저 조회하지만 두 번째 선으로 남긴다" 주석을 추가해 대칭을 맞출 것을 권장한다.

- **[INFO]** `RolesGuard` 의 경로-파라미터 루프는 `@WorkspaceParam` 이 여럿이면 순차 DB 조회 N회 + 조기 예외로 이어질 수 있다 (현재는 도달 불가하지만 가드 레벨 테스트가 없다)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:canActivate` 게이트 166~179행 (`for (const name of pathParamNames) { ...; await this.assertMember(raw, userId, requiredRoles); }`)
  - 상세: 오늘 실제로 배선된 15개 라우트는 모두 `@WorkspaceParam('id')` 단 하나만 쓰므로 루프는 항상 1회만 돈다. 그러나 코드 자체는 핸들러가 `@WorkspaceParam` 을 둘 이상 쓰면(예: `workspace.decorator.spec.ts` 의 `twoParams` 픽스처처럼) 각 이름마다 순차로 `getMemberRole` 을 호출하고, 첫 워크스페이스에서 멤버십/역할 미달이면 두 번째 워크스페이스는 조회하지 않고 바로 던진다. `roles.guard.spec.ts` 는 이 다중-파라미터 시나리오에 대한 가드 레벨 단언(쿼리 횟수·조기 예외 순서)이 없다 — 데코레이터 단위 테스트(`workspace.decorator.spec.ts`)는 이름 추출만 검증한다.
  - 제안: 현재는 위험이 낮지만(정적 가드 `workspace-roles-attachment.spec.ts` 가 15곳의 바인딩을 고정하고 있어 신규 라우트가 생기면 그 표에 드러난다), 향후 다중 `@WorkspaceParam` 라우트가 생길 가능성을 열어 둔다면 가드 레벨에 N>1 케이스 테스트를 추가해 두는 편이 안전하다.

- **[INFO]** 내부 전용이지만 export 된 함수의 이름·반환 시그니처 변경 — 영향 범위는 확인 완료(무해)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 게이트 98~101행 (`countWorkspaceIdConsumingRoutes` → `countWorkspaceConsumingRoutes`, 반환 타입 `number` → `WorkspaceConsumingRouteCount { requestContext; pathParam; total }`)
  - 상세: `export` 된 심볼의 이름과 반환 타입이 바뀌었다. 저장소 전체 grep 으로 확인한 결과 이 함수의 유일한 소비처는 같은 파일의 `assertWorkspaceIdReflectionWorks`(내부 구조분해로 `total` 만 사용)와 자기 자신의 spec 뿐이다. 외부에서 유일하게 호출되는 `assertWorkspaceIdReflectionWorks(app, logger?)` 는 시그니처(`(INestApplication, Pick<Logger,'log'>) => number`)가 그대로 유지되어 `main.ts:192` 의 호출부는 영향받지 않는다.
  - 제안: 조치 불필요 — 영향 범위 확인 완료.

- **[INFO]** 인가·조회 순서 반전이 서비스 계층 에러 우선순위를 바꾼다 (의도된 수정, 정보 제공 목적)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateMemberRole`(게이트 255~258행, `assertAdmin` 이 `assertWorkspaceType` 보다 먼저 실행) · `leaveWorkspace`(게이트 649~654행, `assertMembership` 이 `workspaceRepository.findOne` 보다 먼저 실행) · `removeMember` 관련 주석(게이트 822~834행)
  - 상세: 이 순서 반전은 "비-admin/비멤버가 워크스페이스의 존재·유형을 조회 결과로 추론할 수 있었던" 오라클을 닫기 위한 의도된 보안 수정이며, `workspaces.service.spec.ts` 의 신규 `it.each` 오라클 테스트(게이트 961~998행)로 검증됐다. 다만 이 반전은 동일한 최종 상태(거부)에 대해 **어떤 에러 코드가 먼저 보고되는지**를 바꾼다 — 예: 비-admin 이 개인 워크스페이스를 대상으로 `updateMemberRole` 을 호출하면 종전엔 워크스페이스 유형 에러를 먼저 받았을 자리에서 이제 `ADMIN_REQUIRED` 를 먼저 받는다. 이 diff 안에서는 그 순서 변화를 검증하는 테스트가 있어 회귀는 아니나, 이 diff 밖에서 "어느 에러가 먼저 오는가"에 의존하는 코드(예: 프런트 엔드의 분기, 다른 서비스의 재시도 로직)가 있다면 side effect 로 나타날 수 있다.
  - 제안: 조치 불필요 — 기록 목적. FE/기타 소비자가 이 특정 에러 우선순위에 의존하지 않는지 한 번 더 확인하면 안전하다.

## 요약

이번 diff 는 워크스페이스 경로 파라미터(`@WorkspaceParam`)를 `RolesGuard` 가 인식하도록 배선하고, 거부 응답에 코드를 실었다. 핵심 로직 변경(`roles.guard.ts`, `workspace.decorator.ts`, `workspaces.service.ts`)은 예외적으로 잘 문서화돼 있고 — 특히 부작용이 될 수 있는 지점(멤버십 이중 조회, 403 wire 코드 전역 변경, 인가·조회 순서 반전)마다 자체 docstring 과 `spec/data-flow/12-workspace.md` 의 Rationale 이 "왜 이 부작용을 받아들이는가"까지 미리 답해 두었다. 확인 결과 새 전역 변수·파일시스템 쓰기·환경변수·네트워크 호출은 없고, 유일하게 이름·반환 타입이 바뀐 export 함수(`countWorkspaceConsumingRoutes`)도 소비처가 저장소 내부로 한정돼 있어 영향이 없다. 남는 side effect 는 모두 "의도된 것으로 보이지만 넓거나 비대칭적으로 문서화된" 종류다: (1) `@Roles()` 가 붙은 저장소 전역 라우트의 403 코드가 바뀌는 것은 이번 PR 표제(경로 가드)보다 훨씬 넓은 블라스트 반경이고, (2) 가드·서비스 이중 멤버십 조회는 `workspaces.service.ts` 에는 주석으로 남겼지만 `auth.service.ts`(`switchWorkspace`)에는 대칭 주석이 없다. 둘 다 기능적으로는 안전해 보이나, 다음 사람이 "왜 이게 두 번 도는가"를 코드만 보고 판단할 때 후자에서 오판할 여지가 있다.

## 위험도

LOW
