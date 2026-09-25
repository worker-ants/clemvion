# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** `integrations.service.ts` 의 로컬 `ADMIN_ROLES` 제거 및 공용 상수 이관은 단일 진실 원칙(SSOT)을 정확히 지킨 리팩터링
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import), 로컬 정의 삭제 지점(diff `-const ADMIN_ROLES = new Set(['owner', 'admin']);`)
  - 상세: 종전 `workspaces.service.ts` · `workspace-invitations.service.ts` 두 곳에서만 공유하던 `ADMIN_ROLES` 를 `integrations.service.ts` 세 번째 소비처까지 확장했다. `workspace-roles.ts` 는 `WORKSPACE_ROLE_LEVEL` 서열에서 `ADMIN_ROLES` 를 파생시키는 구조라(`workspaceRoleLevel(role) >= workspaceRoleLevel('admin')`), 값 집합(`{admin, owner}`)이 세 소비처에서 항상 일치함을 컴파일 타임 대신 "파생" 구조로 보장한다. 의존 방향도 도메인 모듈(`integrations`) → `common/constants`(리프, 무의존)로 올바르며 순환 의존 위험이 없다.
  - 제안: 없음 — 이대로 유지. 문서(`workspace-roles.ts` 헤더 docstring)가 소비처 목록을 손으로 나열하는 방식이라, 네 번째 소비처가 추가될 때 갱신을 잊으면 문서만 stale 해질 수 있다(기능에는 영향 없음, 관찰 목적의 INFO).

- **[INFO]** `workspace.decorator.ts` 의 `routeArgEntriesMatching` 추출은 적절한 수준의 공통화(Extract Function)
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` 함수 `routeArgEntriesMatching`, 호출부 `handlerConsumesWorkspaceId` · `workspaceParamNamesOf`
  - 상세: 종전 `handlerConsumesWorkspaceId` 와 `workspaceParamNamesOf` 가 `ROUTE_ARGS_METADATA` 읽기 + `methodName` 가드 + `Object.values(...).filter(...)` 골격을 바이트 단위로 중복 보유했다. 이번 변경은 그 골격을 모듈 비공개(`export` 안 됨) 함수로 추출해 두 판별 함수가 팩토리 identity만 다르게 넘기도록 좁혔다. 캐너리(`workspace-reflection-canary.ts`)가 헬퍼가 아니라 두 공개 함수를 직접 호출하므로, 리팩터링으로 두 판별의 파손 모드가 하나로 합쳐져도 회귀 감지 범위는 그대로 유지된다 — 리팩터링이 테스트 커버리지를 몰래 좁히지 않았다.
  - 제안: 없음. 다만 이 파일은 (a) 파라미터 데코레이터 정의(프레젠테이션 바인딩)와 (b) `RolesGuard` 가 소비하는 reflection 판별 유틸(인가 로직의 일부)을 한 파일에 같이 둔다 — 이는 이번 diff 가 만든 문제가 아니라 기존 구조이며, 향후 판별 함수가 더 늘면 `workspace-reflection.util.ts` 류로 분리해 "데코레이터 정의" 와 "가드용 reflection 판별" 책임을 나누는 편이 SRP 관점에서 더 명확할 수 있다는 참고 사항.

- **[INFO]** Swagger `description` 문자열의 하드코딩 제거 — 문서를 코드의 투영으로 전환
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` (`switchWorkspace` `@ApiOperation`/`@ApiForbiddenResponse`), `codebase/backend/src/modules/executions/executions.controller.ts` (`@ApiForbiddenResponse` 2곳), `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE`/`removeMember` 인라인)
  - 상세: `NOT_A_MEMBER.code` · `ROLE_REQUIRED.<role>.code` 리터럴 문자열을 상수 보간으로 치환. 가드·서비스가 실제로 던지는 오류 코드와 Swagger 문서가 같은 SoT(`workspace-roles.ts`)에서 파생되므로, 코드명이 바뀌는 날 문서가 자동으로 따라오고 사람이 여러 컨트롤러 파일에 흩어진 리터럴을 동기화할 필요가 사라진다. 세 컨트롤러(프레젠테이션 레이어)가 `common/constants` 를 참조하는 것은 계약 상수 재사용이라 레이어 위반이 아니다 — 실제 인가 로직(가드/서비스)에 대한 의존이 아니라 순수 데이터 상수 의존이다.
  - 제안: 없음.

- **[INFO]** `throwOwnerTransferRequired` 의 `{ code: ROLE_REQUIRED.owner.code, ... }` → `{ ...ROLE_REQUIRED.owner, ... }` 전환은 개방-폐쇄 원칙에 유리
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 함수 `throwOwnerTransferRequired` (diff hunk `@@ -932,7 +938,7 @@`)
  - 상세: 종전엔 `WorkspaceRoleRejection` 의 `code` 필드만 선택적으로 복사했다. 스프레드로 바꾸면서 향후 이 인터페이스에 필드가 추가돼도(예: 힌트 필드) 이 호출부를 따로 고칠 필요가 없다 — `throwNotAMember`/`throwAdminRequired` 가 이미 쓰던 `{ ...X }` 관례와도 일관된다. `message` 를 뒤이어 오버라이드하는 것은 "코드는 가드와 공유, 문구는 이 동작 전용" 이라는 의도된 설계이고 주석에 근거가 남아 있다.
  - 제안: 없음.

- **[INFO]** 문서 자기-정정(self-correction) 이 코드 docstring 안에서 이루어짐 — 좁게 스코프됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership` JSDoc (diff hunk `@@ -708,11 +708,17 @@`)
  - 상세: "두 멤버를 단일 `IN` 쿼리로 동시에 락" 이라던 종전 서술을, 실제 구현(순차 `pessimistic_write` findOne 두 번)에 맞춰 정정하고 정정 근거(`eb009f99c` 커밋부터 그랬다)를 남겼다. 이는 CLAUDE.md 의 "자기-반증형 소정정" 원칙과 유사한 성격이나, 대상이 `spec/` 문서가 아니라 코드 내부 docstring(구현 세부사항 설명)이라 그 절차의 적용 대상이 아니다 — 커밋 취소선 보존 요건도 코드 주석에는 강제되지 않는다. 아키텍처 관점에서는 "동시성 보장" 서술과 실제 구현의 불일치를 없앤 정합성 개선으로, 차후 유지보수자가 잘못된 락 순서 가정으로 리팩터링할 위험을 줄인다.
  - 제안: 없음.

## 요약

이번 8-파일 변경은 `#1399`(경로 워크스페이스 가드) 리뷰가 "수렴 예외"로 넘긴 잔여 5건을 정리하는 동작 불변(behavior-preserving) 하우스키핑이다. 핵심은 (1) `integrations.service.ts` 의 중복 `ADMIN_ROLES` 리터럴을 `workspace-roles.ts` 단일 진실로 흡수하고, (2) `workspace.decorator.ts` 의 두 reflection 판별 함수(`handlerConsumesWorkspaceId`/`workspaceParamNamesOf`) 사이 바이트 단위 중복을 `routeArgEntriesMatching` 으로 추출하며, (3) 세 컨트롤러의 Swagger `description` 리터럴을 같은 상수 표에서 보간해 문서-코드 드리프트 경로를 닫고, (4) `workspaces.service.ts` 의 부정확했던 동시성 docstring 을 실측대로 정정한 것이다. 모든 변경이 기존에 확립된 "역할 서열 단일 표(`WORKSPACE_ROLE_LEVEL` → `ADMIN_ROLES`/`ROLE_REQUIRED`)" 패턴을 일관되게 넓히는 방향이며, 의존 방향(도메인 모듈 → `common/constants` 리프 모듈)이 올바르고 순환 의존·레이어 위반·과잉/과소 추상화 징후가 없다. 테스트(`workspaces.service.spec.ts`)도 코드-vs-가드 문구 구분 근거를 주석으로 남기며 함께 강화됐다. SOLID·결합도·모듈 경계 관점에서 위험 요소를 발견하지 못했으며, 지적한 두 건(INFO)은 개선 여지에 대한 참고 사항일 뿐 이번 diff 가 만든 결함이 아니다.

## 위험도
NONE
