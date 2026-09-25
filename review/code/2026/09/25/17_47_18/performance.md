# 성능(Performance) 리뷰 — workspace-path-guard

## 발견사항

- **[WARNING]** 경로 워크스페이스 라우트 15곳에서 멤버십 SELECT 가 요청당 2회(가드 + 서비스) 확정 실행된다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:155-168`(`RolesGuard.canActivate` → `assertMember` → `WorkspacesService.getMemberRole`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:481`(`getWorkspaceSettings`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:220`(`listMembers` → `assertMembership`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:936,944`(`assertMembership`/`assertAdmin`)
  - 상세: `@WorkspaceParam('id')` 로 옮겨간 15개 라우트(`workspaces.controller.ts` 14곳 + `auth.controller.ts` `switchWorkspace`)는 이제 `RolesGuard.canActivate` 가 `workspaceParamNamesOf` 로 경로 값을 찾아 매 요청 `assertMember` → `workspacesService.getMemberRole(workspaceId, userId)` 를 무조건 호출한다(157-162행, `@Roles()` 유무와 무관). 그런데 해당 핸들러가 위임하는 서비스 메서드(`getWorkspaceSettings`, `listMembers`, `assertMembership`, `assertAdmin` 등)는 여전히 자신의 `getMemberRole` 조회를 첫 줄에 그대로 갖고 있다 — 즉 `GET /workspaces/:id/members`, `GET /workspaces/:id/settings` 같은 **읽기 전용, 상대적으로 빈번한** 엔드포인트를 포함해 이 15개 라우트 전부가 요청당 같은 `workspace_member` 조회를 순차적으로 두 번 실행한다. PR 은 이를 "가드 인식이 깨졌을 때의 두 번째 선"으로 명시적으로 문서화·의도했고(`workspaces.service.ts:925-931` 주석, `workspace-invitations.service.ts:532-538`), 가드의 role 을 서비스로 전달해 재사용하지 않는 이유(독립성 상실)도 근거가 있다. 설계 트레이드오프 자체는 타당하지만, **요청당 DB 왕복이 이전 대비 2배로 늘었다**는 사실은 실측 없이 문서에만 남아 있다 — 이 라우트들의 트래픽이 늘어나면(특히 `getSettings`/`listMembers` 처럼 뮤테이션이 아닌 라우트) 누적 DB 부하가 측정 없이 커질 수 있다.
  - 제안: 지금 당장 구조를 바꾸라는 뜻은 아니다(의도된 defense-in-depth). 다만 (1) 이 배가가 실제 쿼리 비용에 미치는 영향을 한 번 측정해 PR 본문·spec Rationale 에 남기고, (2) `workspace_member (workspace_id, user_id)` 복합 인덱스가 있는지 확인해 두 조회 모두가 인덱스 스캔인지 보장하는 것을 권한다. 만약 이 라우트들이 향후 hot-path 가 되면, 서비스 계층 재조회를 "가드가 이미 검증했다는 사실 자체"만 신뢰하지 않는 방식(예: 가드가 조회 시각·워크스페이스ID 를 request 에 남기고 서비스가 그 동일성만 재검증)으로 좁혀 쿼리 재사용 여지를 열어 둘 수 있다.

- **[INFO]** `@WorkspaceParam` 이 여럿인 핸들러에서 멤버십 조회가 순차(await-in-loop)로 돈다 — 현재 실제 라우트는 전부 1개뿐이라 영향 없음
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:157-163` (`canActivate` 의 `for (const name of pathParamNames) { ... await this.assertMember(...) }`)
  - 상세: 한 핸들러가 `@WorkspaceParam` 을 두 개 이상 쓰면(테스트 fixture `twoPaths`, `roles.guard.spec.ts:722-725` 가 `getMemberRole` 이 2번 불림을 명시적으로 단언) 가드는 이들을 `Promise.all` 이 아니라 `for...of` + `await` 로 순차 처리한다. 각 조회는 서로 다른 `workspaceId` 에 대한 독립적인 멤버십 검사라 병렬화해도 로직상 문제가 없다. 다만 `grep` 실측 결과(`workspaces.controller.ts`, `auth.controller.ts`) 현재 배선된 15개 라우트는 모두 `@WorkspaceParam` 을 정확히 1개씩만 쓰므로, 오늘 시점에는 이 순차성이 지연을 유발하지 않는다.
  - 제안: 지금 고칠 우선순위는 낮다. 다만 향후 한 핸들러가 워크스페이스 경로 파라미터를 2개 이상 받게 되면(예: 워크스페이스 간 이동/복사 API), `Promise.all(pathParamNames.map(...))` 로 병렬화해 두는 것을 검토할 것 — 코드에 이미 "여럿이면 전부 본다" 는 계약이 스펙(`roles.guard.spec.ts:709-725`)으로 고정돼 있으므로 구현을 바꿔도 그 계약은 유지된다.

- **[INFO]** 부트 캐너리 `countWorkspaceConsumingRoutes` 는 라우트당 reflection 호출이 1→2회로 늘었지만 부팅 1회성이라 무해
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:98-124`(`countWorkspaceConsumingRoutes`)
  - 상세: 모든 컨트롤러 메서드에 대해 `handlerConsumesWorkspaceId` 와 `workspaceParamNamesOf` 를 각각 호출해 `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` 를 같은 키로 두 번 읽는다(각 함수 내부에서 별도로 `Reflect.getMetadata` 호출). 라우트 수(부팅 로그 기준 142건)를 감안해도 부팅 시 1회만 실행되는 캐너리라 실질 영향은 없다.
  - 제안: 조치 불필요. 다만 `RolesGuard.canActivate` 쪽(요청 경로)에서는 이미 `!needsRoleCheck && ...` 단축평가로 불필요한 `handlerConsumesWorkspaceId` 호출을 피하고 있어(`roles.guard.ts:149-152` 주석 "필요한 분기에서만") 설계 의도가 요청 경로와 부팅 경로에서 다르게 최적화된 것으로 보이며, 이는 적절하다.

- **[INFO]** `workspaceParamNamesOf` 가 모든 인증된 요청에서 무조건 1회 추가 `Reflect.getMetadata` 를 수행한다 — 캐싱되지 않은 순수 reflection 이지만 저비용
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:154-155` (`const pathParamNames = workspaceParamNamesOf(controllerClass, handler);`)
  - 상세: 이 호출은 `@WorkspaceParam` 여부와 무관하게 인증된 모든 요청마다 실행된다(종전에는 `handlerConsumesWorkspaceId` 호출도 조건부였던 것과 대비). `controllerClass`/`handler` 의 identity 는 부팅 후 불변이므로 이 reflection 결과는 요청마다 달라지지 않는 순수 함수 결과다 — 이론적으로 `WeakMap<Function, string[]>` 캐시로 요청당 비용을 0으로 만들 수 있다. 다만 `reflect-metadata` 의 `Reflect.getMetadata` 자체가 O(1)에 가까운 해시 조회라 실측 없이 이 항목만으로 병목이라 단정하기는 어렵다.
  - 제안: 우선순위 낮음(INFO). 다만 이 가드가 `APP_GUARD` 로 전역 등록되어 있어 트래픽이 큰 배포에서는 요청당 reflection 호출 수(현재 최대 2~3회)가 누적 CPU 로 보일 수 있으니, 부하 프로파일링에서 가드가 상위에 잡히면 이 캐싱을 1순위 후보로 고려할 것.

## 요약

이번 diff 의 핵심은 워크스페이스 인가 로직(가드·서비스·데코레이터)의 리팩터링과 보안 결함(경로 파라미터 워크스페이스를 가드가 못 보던 문제) 수정으로, 순수 성능 관점에서 새로운 알고리즘적 비효율이나 N+1 루프, 메모리 누수는 발견되지 않았다. 다만 보안 수정의 직접적 대가로 15개 워크스페이스 라우트(뮤테이션뿐 아니라 `getSettings`/`listMembers` 같은 읽기 라우트 포함)가 요청당 동일한 멤버십 SELECT 를 가드·서비스 두 계층에서 순차 실행하게 되어 DB 왕복이 사실상 2배로 늘었다 — 이는 코드 주석에 "의도된 중복"으로 명시적으로 정당화되어 있고 트랜잭션·독립성 근거도 타당하지만, 실측(쿼리 비용·인덱스 확인)이 아직 문서에 남아 있지 않다는 점에서 WARNING 으로 표시했다. 그 외 순차 `await` 루프(다중 `@WorkspaceParam`)와 캐싱되지 않은 reflection 호출은 현재 실제 라우트 배선상 영향이 없거나 미미해 INFO 수준이다. 정적 분석 도구(source-scan, repo-guards)는 CI 시점에만 도는 AST 순회로 런타임 성능과 무관하다.

## 위험도

LOW
