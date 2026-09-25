# 아키텍처(Architecture) 리뷰 — workspace-path-guard

## 발견사항

- **[INFO]** 경로 워크스페이스 인식이 기존 헤더/토큰 인식과 동형(isomorphic) 구조로 확장됨 — 개방-폐쇄 원칙을 잘 지킴
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:87-139` (`extractWorkspaceParam` · `WorkspaceParam` · `workspaceParamNamesOf`), `codebase/backend/src/common/guards/roles.guard.ts:167-186`
  - 상세: `@WorkspaceId()`/`handlerConsumesWorkspaceId`(기존)와 완전히 같은 기법 — top-level named factory + `ROUTE_ARGS_METADATA`에서 함수 identity 비교 — 을 `@WorkspaceParam()`/`workspaceParamNamesOf`에 그대로 복제해 확장했다. 부트 캐너리(`workspace-reflection-canary.ts`)도 같은 패턴으로 두 판별을 나란히 세도록만 확장됐다. 새 개념을 기존 구조를 변경하지 않고 병렬로 추가한 점에서 개방-폐쇄 원칙에 부합하고, `RolesGuard`·캐너리·정적 가드(`workspace-param-binding-guard.ts`) 세 소비처가 전부 동일한 `workspaceParamNamesOf` 하나만 호출해 판별 로직의 응집도가 유지된다.
  - 제안: 없음 (양호한 패턴).

- **[WARNING]** 역할 계층 판정이 가드(`RolesGuard`)와 서비스(`WorkspacesService`) 두 곳에 독립적으로 존재하며, 이번 변경으로 중복 표면이 크게 넓어짐
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:31-58`(`ROLE_HIERARCHY`/`ROLE_REQUIRED`, 4단계 숫자 서열) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:24`(`ADMIN_ROLES = new Set(['owner','admin'])`, 평면 집합) 및 `workspaces.service.ts:941-947`(`assertAdmin`)
  - 상세: 이번 PR 이전에는 `@Roles()`가 `edges`/`nodes`/`executions` 등 소수 라우트에만 붙어 있어 "가드의 역할 서열 vs 서비스의 개별 assert" 중복 표면이 작았다. 이번 변경으로 `workspaces.controller.ts`의 admin/owner 라우트 8곳 이상(`update`·`updateSettings`·`addMember`·`updateMember`·`listInvitations`·`createInvitation`·`resendInvitation`·`revokeInvitation`·`remove`)에 `@Roles('admin'|'owner')`가 새로 붙으면서, 같은 인가 판정이 가드의 `ROLE_HIERARCHY`(숫자 서열 비교)와 서비스의 `ADMIN_ROLES`(집합 멤버십)라는 **두 개의 독립된 표현**으로 이중 유지된다. 두 표현이 같은 정책(“admin 이상”)을 인코딩하지만 공유 상수·공유 타입이 없어, 향후 역할 체계에 새 단계(예: `editor`와 `admin` 사이)가 추가되면 두 곳을 사람이 기억해 동시에 고쳐야 한다.
  - 제안: 당장 리팩터를 요구할 정도는 아니지만(`workspace-roles-attachment.spec.ts`가 메타데이터 값을 reflection 으로 직접 고정해 즉시 회귀를 잡아준다), 두 표현을 하나의 공유 모듈(예: `common/constants/workspace-roles.ts`)로 합쳐 `ROLE_HIERARCHY`와 `ADMIN_ROLES`를 파생시키는 후속 정리를 고려할 만하다.

- **[INFO]** `RolesGuard.canActivate`가 두 개의 서로 다른 인가 소스(헤더/토큰 컨텍스트, 경로 파라미터)를 한 메서드 안에서 분기 처리해 책임이 늘었으나, private 메서드 추출로 완화됨
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:151-244` (`canActivate` 151-195, `checkRequestContext` 198-220, `assertMember` 227-244)
  - 상세: 이 가드는 이제 (1) `@Roles()` 리플렉션, (2) 인증 여부, (3) 경로 워크스페이스 판별·루프·검증, (4) 헤더/토큰 워크스페이스 판별·검증, (5) 멤버십·역할 서열 판정, (6) 거부 코드 매핑까지 한 클래스가 담당한다. `checkRequestContext`/`assertMember`로 추출해 SRP 붕괴를 억제했지만, `canActivate` 자체는 여전히 "경로 기반 분기"와 "요청 컨텍스트 기반 분기"라는 서로 다른 인가 모델을 한 메서드의 제어 흐름(if/for/return 조합)으로 엮고 있어 인지 복잡도가 높다. 보안 크리티컬 클래스라 변경 시 회귀 위험이 사람의 주의력에 의존하는 비중이 크다(현재는 광범위한 `roles.guard.spec.ts`·e2e·`workspace-roles-attachment.spec.ts`가 그 위험을 상쇄한다).
  - 제안: 필수 조치는 아님. 향후 세 번째 워크스페이스 소스(예: 쿼리 파라미터)가 추가된다면, "요청에서 인가 대상 워크스페이스(들)를 뽑아내는" 부분을 `resolveAuthorizationTargets(context, request): string[]` 같은 순수 함수로 분리해 `canActivate`는 그 결과에 대해 멤버십/역할만 판정하도록 좁히는 편이 확장에 유리하다.

- **[INFO]** 정적 분석 가드(`repo-guards`)를 이용한 아키텍처 불변식의 코드화 — 좋은 거버넌스 패턴
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`(신규), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:17-21,141-163`
  - 상세: "경로 워크스페이스 ID는 평범한 `@Param`이 아니라 반드시 `@WorkspaceParam`이어야 `RolesGuard`가 본다"는 구조적 불변식을 사람의 코드리뷰에만 맡기지 않고 AST 기반 CI 가드로 fail-closed 강제한다(`isWorkspaceIdName` 이름 휴리스틱 + 허용목록 없음). `param-uuid-pipe-guard`도 `WorkspaceParam`의 내장 파이프를 구조적으로 인식하도록 자연스럽게 확장돼 두 가드의 모집단이 갈리지 않는다(fixture 주석이 "121로 줄 뻔했다"고 스스로 반증 사례를 남겨둠). 이런 "아키텍처 규칙의 실행 가능한 코드화"는 향후 동일 패턴의 이탈을 구조적으로 방지하는 바람직한 설계다.
  - 제안: 없음 (양호한 패턴).

- **[INFO]** 가드 + 서비스 이중 방어선(defense-in-depth)은 의도된 설계이며, "인가가 조회보다 먼저"라는 레이어 원칙이 일관되게 정착됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:255-259`(`addMemberByEmail`, `assertAdmin` → `assertWorkspaceType` 순서 교정), `:650-653`(`leaveWorkspace`, `assertMembership` 선행 추가)
  - 상세: 비멤버가 워크스페이스의 존재·유형(개인/팀)을 추론할 수 있었던 오라클을 "인가 판정을 조회보다 먼저 수행"하는 순서 원칙으로 구조적으로 닫았다. 가드가 이제 경로 워크스페이스도 먼저 막지만, 서비스 계층이 가드의 reflection 파손 시를 대비한 두 번째 방어선으로 같은 원칙을 독립적으로 유지한다 — `workspaces.service.spec.ts`(비멤버 케이스에서 `workspaceRepo.findOne`이 호출되지 않음을 직접 단언)로 이 계약이 고정돼 있다. 레이어 간 책임 분리(프레젠테이션의 크로스커팅 가드 vs 비즈니스 로직의 자체 방어)가 명확하다.
  - 제안: 없음 (양호한 패턴).

- **[INFO]** `RolesGuard`의 경로 파라미터 루프가 순차 `await`를 사용 — 현재는 무해하나 다중 파라미터 시 직렬화됨
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:175-181`
  - 상세: `for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`는 여러 `@WorkspaceParam`이 한 핸들러에 있을 경우 DB 조회를 순차 실행한다. 현재 저장소에는 핸들러당 `@WorkspaceParam`이 최대 1개뿐이라 실질적 영향은 없지만, 설계상 "여러 개면 전부"를 명시적으로 지원하므로(주석 참조) 다중 파라미터가 실제로 쓰이게 되면 지연이 파라미터 수에 비례해 늘어난다.
  - 제안: 실질 영향이 생기기 전까지는 유예 가능. 다중 파라미터 라우트가 실제로 추가되면 `Promise.all`로 병렬화를 검토.

## 요약

이번 변경은 기존에 확립된 "헤더/토큰 워크스페이스 컨텍스트를 함수 identity 리플렉션으로 인식한다"는 패턴을 "경로 파라미터 워크스페이스"로 대칭적으로 확장한 설계로, 개방-폐쇄 원칙과 기존 관례와의 일관성을 잘 지켰다. 특히 AST 기반 정적 가드로 "경로 워크스페이스는 반드시 `@WorkspaceParam`을 거쳐야 한다"는 구조적 불변식을 CI에 코드화한 것과, 서비스 계층에서 "인가가 조회보다 먼저"라는 순서 원칙을 오라클 제거를 위해 전면 적용한 것은 레이어 책임 분리 측면에서 견고하다. 다만 `RolesGuard`가 경로/헤더 두 인가 소스를 한 클래스에서 처리하며 책임이 계속 누적되고 있고, 역할 서열 판정 로직이 가드(`ROLE_HIERARCHY`)와 서비스(`ADMIN_ROLES`)에 독립된 두 표현으로 존재하는 채 이번 PR로 중복 적용 표면이 크게(소수 라우트 → 워크스페이스 관리 8곳 이상) 넓어진 점은 향후 유지보수 시 두 표현의 동기화 누락 위험을 키운다 — 다만 즉각적인 회귀는 전용 metadata 고정 테스트(`workspace-roles-attachment.spec.ts`)와 e2e가 상당 부분 상쇄한다. 순환 의존성이나 레이어 경계 위반, 심각한 안티패턴은 발견되지 않았다.

## 위험도

LOW
