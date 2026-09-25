# 아키텍처(Architecture) Review — workspace-path-guard (5라운드)

## 발견사항

- **[WARNING]** 경로 워크스페이스 reflection 이 팩토리만 다른 두 병렬 구현으로 중복됐다
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:62`(`handlerConsumesWorkspaceId`, 기존)와 `codebase/backend/src/common/decorators/workspace.decorator.ts:124`(`workspaceParamNamesOf`, 신규)
  - 상세: 두 함수 모두 `handler.name` 부재 가드 → `Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName)` 조회 → 없으면 빈 결과 반환 → `Object.values(argsMetadata)` 를 특정 `factory` identity 로 필터링, 하는 동일한 골격을 그대로 복제했다. 코드 자신의 docstring 이 이를 인정한다 — "`handlerConsumesWorkspaceId` 와 같은 reflection 이다 — 같은 `ROUTE_ARGS_METADATA` 를 같은 `Function.name` 키로 읽고, 팩토리만 다르다"(`workspace.decorator.ts:120`). 같은 PR 이 `decoratorCallName` 중복(`param-uuid-pipe-guard.ts` ↔ `workspace-param-binding-guard.ts`)은 `source-scan.ts` 공용 헬퍼로 뽑아 해소했는데(파일 1·2, 4라운드 이전 WARNING 처분), 정작 이 보안 핵심 reflection 쌍은 같은 처방을 받지 못했다. 두 구현이 갈라지면(예: 한쪽만 nullish 가드를 놓치거나 metadata 키 해석을 바꾸는 리팩터) `RolesGuard` 의 fail-open/fail-closed 경계가 비대칭으로 깨질 수 있고, 그 경우를 잡는 것은 오직 `workspace-reflection-canary.spec.ts` 의 카운트 급락 관측뿐이다 — 구조적으로 막는 대신 사후 관측에 의존한다.
  - 제안: `factoryEntries(controllerClass, handler, factory)` 같은 제네릭 헬퍼로 "메서드명 가드 + metadata 조회 + factory identity 필터" 부분을 통합하고, `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 는 그 위에서 `some`/`map` 만 다르게 얹는 형태로 좁힐 것. (동작 결함은 아니라 이번 라운드 정지 규칙상 수렴 후보일 수 있으나, 이 PR 이 같은 클래스의 중복을 이미 한 번 리팩터한 전례가 있어 비대칭이 두드러진다.)

- **[WARNING]** Swagger 403 설명 상수가 실제 에러 코드 SoT(`workspace-roles.ts`)에서 파생되지 않고 문자열로 재선언됐다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:66`~`68` (`FORBIDDEN_MEMBER_ROUTE` · `FORBIDDEN_ADMIN_ROUTE` · `FORBIDDEN_OWNER_ROUTE`)
  - 상세: 이 PR 은 `NOT_A_MEMBER` · `ROLE_REQUIRED` 를 `common/constants/workspace-roles.ts` 한 표로 모아 `RolesGuard` · `WorkspacesService` · `WorkspaceInvitationsService` · `AuthService` 가 같은 값을 공유하도록 만들었다(파일 4) — 정확히 "표현이 갈리면 다른 답을 낸다" 는 문제를 없애려는 설계다. 그런데 같은 PR 이 새로 만든 이 세 상수는 `NOT_A_MEMBER.code` / `ROLE_REQUIRED.admin.code` / `ROLE_REQUIRED.owner.code` 를 참조하지 않고 `'NOT_A_MEMBER'` · `'ADMIN_REQUIRED'` · `'OWNER_REQUIRED'` 를 문자열 리터럴로 다시 적었다. 런타임 코드 축은 단일 진실을 달성했지만 API 문서(Swagger) 축은 여전히 수작업 동기화 상태라, 코드명이 바뀌어도 컴파일 오류도 테스트 실패도 없이 조용히 낡는다 — 이 PR 전체가 경계하는 "표가 갈리는" 패턴이 문서 레이어에만 그대로 남았다.
  - 제안: 세 상수를 `` `워크스페이스 멤버가 아님(${NOT_A_MEMBER.code})` `` 형태로 실제 상수의 `.code` 를 보간해 선언하면 코드명 변경이 자동 반영된다. 최소한 저장소 가드(`param-uuid-pipe-guard.ts` 류)처럼 "설명 문자열이 실제 코드와 일치하는지" 를 대조하는 테스트 한 줄로 드리프트를 잡을 수 있다.

- **[INFO]** 경로-스코프 인가가 아직 워크스페이스 전용으로 하드코딩돼 있다
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:114`(`WorkspaceParam`), `codebase/backend/src/common/guards/roles.guard.ts:154`~`168`(경로 분기)
  - 상세: `@WorkspaceParam` → `workspaceParamNamesOf` → `RolesGuard` 분기 → `workspace-param-binding` 저장소 가드로 이어지는 네 겹의 스캐폴딩이 전부 "워크스페이스" 개념에 결합돼 있다. 지금은 경로로 인가해야 하는 리소스가 워크스페이스 하나뿐이라 YAGNI 관점에서 정당한 선택이지만, 이후 유사한 경로-스코프 리소스(예: 프로젝트·조직)가 추가되면 이 네 겹을 그대로 복제해야 한다. 지금 일반화하라는 뜻은 아니다 — 두 번째 사례가 생기는 시점에 공통 추상화(`PathScopedResource` 류)를 뽑아낼 신호로 기록해 둔다.
  - 제안: 조치 불요. 두 번째 경로-스코프 리소스가 생기면 이 네 파일을 함께 참고해 일반화 여부를 판단할 것.

## 요약

핵심 설계(역할 서열·거부 본문의 단일 진실 테이블화, 가드+서비스 방어적 이중 계층, 인가-선-조회-후 순서 정정, `@WorkspaceParam` 을 통한 경로 워크스페이스 인가로의 구조적 확장)는 이미 1~4라운드에 걸쳐 검증·정착됐고 이번 diff 는 그 위에서 일관된 패턴(파이프 내장 데코레이터, identity 기반 reflection, 공유 상수 spread)을 반복 적용한다. SOLID·레이어 분리·순환 의존성 관점에서 새로 도입된 구조적 결함은 없다. 다만 이 PR 이 스스로 "표가 갈리면 위험하다" 는 원칙으로 런타임 코드의 중복을 걷어낸 것과 대조적으로, (1) 두 reflection 함수(`handlerConsumesWorkspaceId`/`workspaceParamNamesOf`)가 같은 골격을 그대로 복제했고 (2) Swagger 문서 상수가 그 단일 진실 테이블에서 파생되지 않아 같은 종류의(다만 훨씬 저위험인) 드리프트 표면이 문서 레이어에 남았다. 둘 다 동작 결함이 아니라 유지보수성 신호이며, 과거 라운드의 유사 사례(비용 실측·이름 휴리스틱 한계)처럼 "구조·문서 형태" 로 분류돼 수렴될 가능성이 있다.

## 위험도

LOW
