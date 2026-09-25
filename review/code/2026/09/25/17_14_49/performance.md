# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `@Param` → `@WorkspaceParam` 전환 라우트마다 멤버십 DB 조회가 최소 1회 늘었다 — 가드와 서비스가 같은 조회를 이중으로 돈다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:147-167` (`canActivate` 의 `pathParamNames` 분기, `assertMember` 호출), `codebase/backend/src/modules/workspaces/workspaces.service.ts:655` (`leaveWorkspace` 에 신설된 `assertMembership` 호출), `codebase/backend/src/modules/workspaces/workspaces.service.ts:221` (`listMembers` 의 기존 `assertMembership`)
  - 상세: `RolesGuard.canActivate` 는 `workspaceParamNamesOf(...).length > 0` 이면(=`@WorkspaceParam` 을 쓰는 라우트) `@Roles()` 유무와 무관하게 **매 요청** `assertMember` → `workspacesService.getMemberRole(workspaceId, userId)` 를 조회한다. 이번 PR 로 `@Param` 에서 `@WorkspaceParam` 으로 옮겨간 라우트가 (`workspace-param-binding-guard.ts` 주석 기준) 15곳이다. 이 중 `@Roles()` 가 없는 라우트(예: `listMembers`, `GET /workspaces/:id/settings`)는 종전엔 가드가 이 분기 자체를 타지 않아(‑`@WorkspaceId()` 미사용 + `needsRoleCheck=false` → 단축 `return true`) 멤버십 조회를 전혀 하지 않았고, 서비스의 `assertMembership` 한 번만 돌았다. 지금은 **가드 + 서비스가 같은 `(workspaceId, userId)` 쌍에 대해 동일한 `getMemberRole` 을 순차로 두 번** 조회한다. `leaveWorkspace` 는 더 심하다 — 가드의 멤버십 조회(1) → 이 PR 이 새로 추가한 서비스의 `assertMembership`(2) → `workspaceRepository.findOne`(3) → 트랜잭션 내부의 `pessimistic_write` 재조회(4) → 대상이 owner 면 owners count 쿼리(5)까지, 최대 5회의 순차 DB 왕복이 한 요청에 쌓인다.
  - 참고: 이 이중화는 코드 docstring(`workspaces.service.ts:930-936`, `roles.guard.ts` 클래스 헤더 "## 경로 워크스페이스")이 "가드 인식이 깨졌을 때의 두 번째 선" 으로 명시적으로 의도한 defense-in-depth다 — 버그가 아니라 보안 트레이드오프다. 다만 그 트레이드오프가 이번에 15개 라우트 규모로 일괄 적용됐다는 사실은 성능 관점에서 수치로 남겨 둘 필요가 있다.
  - 제안: 지금 구조를 되돌릴 필요는 없지만(독립성이 보안 근거다), 호출 빈도가 높은 조회형 라우트(`listMembers` 등)부터 가드가 이미 읽은 `role` 을 `request` 컨텍스트에 실어 서비스가 "이미 검증됨" 표시만 값싸게 재확인하는 절충안을 검토할 가치가 있다. 최소한 이 변경이 "요청당 DB 왕복 +1(많게는 +2~3)" 이라는 점을 성능 회귀 체크리스트에 기록해 두는 것을 권한다.

- **[WARNING]** `RolesGuard.canActivate` 가 `@Roles()` 라우트에서도 두 reflection 판별을 무조건 실행한다 — 종전엔 단축 평가로 건너뛰었다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:147-155`
  - 상세: 종전 코드는 `if (!needsRoleCheck && !handlerConsumesWorkspaceId(context.getClass(), context.getHandler()))` 형태라, `needsRoleCheck` 가 `true`(= `@Roles()` 가 붙은 라우트, 이 저장소의 워크스페이스 mutate 라우트 대다수)면 JS `&&` 단축 평가로 `handlerConsumesWorkspaceId` 호출 자체가 실행되지 않았다. 새 코드는 `const consumesRequestContext = handlerConsumesWorkspaceId(...)` 와 `const pathParamNames = workspaceParamNamesOf(...)` 를 함수 상단에서 **무조건** 계산한다 — `@Roles()` 가 있는 모든 인증된 요청에서 이제 `Reflect.getMetadata(ROUTE_ARGS_METADATA, …)` 를 2회(각각 함수 안에서) 호출하고, `Object.values(...).some/.filter().map().filter()` 를 추가로 돈다. `RolesGuard` 는 전역 `APP_GUARD` 라 앱의 사실상 전 요청에 걸쳐 누적된다.
  - 상세(비용의 크기): 개별 호출은 파라미터 수가 보통 한 자릿수인 작은 배열에 대한 연산이라 마이크로초 단위로 작다 — CRITICAL 로 볼 정도의 지연은 아니다. 다만 `pathParamNames.length === 0` 이고 `needsRoleCheck === true` 인 가장 흔한 케이스(순수 `@Roles()+@WorkspaceParam`, `@WorkspaceId()` 미사용)에서는 `consumesRequestContext` 값이 최종 분기 결정에 **전혀 영향을 주지 않는다**(`pathParamNames.length>0` 분기로 이미 처리되거나, `!needsRoleCheck && !consumesRequestContext` 조건이 `needsRoleCheck=true` 로 인해 항상 거짓이 되어 그대로 `checkRequestContext` 로 진입) — 즉 이 경로에서 `handlerConsumesWorkspaceId` 계산은 결과에 안 쓰이는 순수 낭비다.
  - 제안: `consumesRequestContext` 를 필요한 분기(즉 `pathParamNames.length > 0` 이후, 또는 `!needsRoleCheck` 분기)에서만 지연 계산하도록 되돌리면 매 요청 reflection 호출 횟수를 다시 줄일 수 있다. given 현재 요청량이 크지 않다면 급하지 않음.

- **[INFO]** `pathParamNames` 순회의 순차 `await` — 현재는 N=1 이라 관측 비용 없음, 설계상 N+1 여지
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163`
  - 상세: `for (const name of pathParamNames) { … await this.assertMember(raw, userId, requiredRoles); }` 는 한 핸들러가 `@WorkspaceParam` 을 둘 이상 가지면 각 이름에 대해 `getMemberRole` DB 조회를 **순차**로 돈다(`Promise.all` 미사용). 현재 저장소의 모든 라우트가 경로 파라미터 1개(`:id`)만 쓰므로 오늘 관측되는 비용은 0이다(N=1).
  - 제안: 지금 당장 고칠 필요는 없다. 다만 두 워크스페이스를 동시에 다루는 라우트(예: 리소스를 다른 워크스페이스로 옮기는 엔드포인트)가 추가될 때 이 구조를 그대로 복제하면 조용히 순차 N+1 패턴이 굳어진다 — 그때는 `Promise.all(pathParamNames.map(...))` 로 병렬화를 권장.

- **[INFO]** 부트타임 canary·CI 정적 스캐너는 성능 영향 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`countWorkspaceConsumingRoutes`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`
  - 상세: 캐너리는 부팅 시 1회, 컨트롤러 × 메서드에 대한 단일 O(routes) 순회이며(핸들러당 reflection 호출이 1회에서 2회로 늘었지만 부팅 1회성이라 무해), 두 repo-guard 는 `*.controller.ts` 만 스캔하는 CI/테스트 전용 정적 분석기로 파일당 단일 `ts.createSourceFile` + 단일 AST 순회에서 카운트와 위반을 함께 낸다(별도 재순회 없음, `docstring` 이 스스로 "판정과 카운트는 같은 루프" 를 원칙으로 명시). 런타임 요청 경로와 무관하다.

- **[INFO]** `workspace-roles.ts` 상수 테이블 — 모듈 로드 시 1회 계산, 요청 경로는 O(1)
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:9-32`
  - 상세: `WORKSPACE_ROLE_LEVEL`, `ADMIN_ROLES`(`Object.keys(...).filter(...)`)는 import 시 한 번만 평가되고, `workspaceRoleLevel()` 은 `Object.hasOwn` + 객체 인덱싱으로 매 호출 O(1)이다. `RolesGuard.assertMember` 의 `requiredRoles.reduce(...)` 도 `requiredRoles` 길이가 사실상 1~2개라 문제 없다.

## 요약

이번 PR 의 핵심(역할 서열·거부 코드 단일화, `@WorkspaceParam` 도입)은 알고리즘적으로 전부 O(1)~O(작은 상수) 이고 새로운 N² 패턴이나 블로킹 I/O 는 없다. 다만 보안 목적으로 `RolesGuard` 가 경로 워크스페이스 라우트마다 멤버십을 무조건 재조회하게 되면서, 이미 서비스 계층에 있던 동일한 멤버십/역할 확인과 겹쳐 **요청당 DB 왕복이 최소 1회, 일부 라우트(`leaveWorkspace` 등)는 최대 4~5회까지 순차로 쌓인다** — 이는 코드가 "가드 인식이 깨졌을 때의 두 번째 선" 으로 명시적으로 문서화한 의도된 트레이드오프이지 버그는 아니다. 아울러 가드의 `canActivate` 가 `@Roles()` 라우트에서도 두 reflection 판별을 무조건(종전엔 단축 평가로 생략되던 경로까지) 실행하도록 바뀌어 전역 가드의 요청당 오버헤드가 소폭 늘었다. 두 findings 모두 개별 비용은 작지만(추가 인덱스 SELECT 1회, 마이크로초 단위 reflection), 이 저장소의 거의 모든 워크스페이스 mutate/조회 라우트(15곳 이상)에 일괄 적용된 구조적 변화라 누적 지연으로 인지해 둘 필요가 있다. 즉시 조치가 필요한 CRITICAL 은 없다.

## 위험도

MEDIUM
