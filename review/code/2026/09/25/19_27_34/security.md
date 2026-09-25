# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/common/constants/workspace-roles.ts`
- `codebase/backend/src/common/decorators/workspace.decorator.ts`
- `codebase/backend/src/modules/auth/auth.controller.ts`
- `codebase/backend/src/modules/executions/executions.controller.ts`
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`

이번 변경은 "경로 워크스페이스 가드" 작업의 후속(followup)으로, 실제 인가 로직을 바꾸지 않는 **순수 리팩터링 + docstring/Swagger 문구 정정**이 대부분이다.

1. `integrations.service.ts` 의 로컬 `ADMIN_ROLES = new Set(['owner','admin'])` 를 제거하고 공용 `workspace-roles.ts` 의 `ADMIN_ROLES`(= `workspaceRoleLevel(role) >= workspaceRoleLevel('admin')`, 즉 `admin`·`owner`)로 교체 — 값 집합이 동일함을 확인(`admin=3, owner=4` 서열이므로 `>= admin` 은 정확히 `{admin, owner}`). 로직 변화 없음.
2. `workspace.decorator.ts` 에서 `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 가 각자 중복하던 `ROUTE_ARGS_METADATA` 조회·필터 골격을 `routeArgEntriesMatching()` 으로 통합. 필터 조건(`entry?.factory === factory`)과 반환 형태가 기존과 동일 — 팩토리 identity 비교 방식(가드 우회 방지의 핵심 메커니즘)은 그대로 유지된다.
3. `auth.controller.ts` / `executions.controller.ts` / `workspaces.controller.ts` 의 Swagger `description` 리터럴에 하드코딩돼 있던 에러 코드 문자열(`NOT_A_MEMBER`, `ADMIN_REQUIRED`, `EDITOR_REQUIRED`, `OWNER_REQUIRED` 등)을 공용 상수(`workspace-roles.ts`)에서 보간하도록 변경. 이 코드들은 이미 실제 403 응답 바디에 그대로 실리는 값이라(런타임에 이미 공개), Swagger 문서에서 상수 참조로 바꾼다고 새로운 정보 노출은 없다.
4. `workspaces.service.ts` 의 `transferOwnership` docstring 정정 — 종전 "두 멤버를 단일 IN 쿼리로 동시에 락" 이라는 설명이 실제 구현(순차 `findOne` 두 번 + `pessimistic_write`)과 달랐던 것을 실측 기반으로 정정. 실제 락 획득 순서(워크스페이스 행 → 요청자 멤버 → 대상 멤버, 전부 트랜잭션 내부에서 `pessimistic_write`)와 서비스 계층의 무락 사전 인가(`getMemberRole` → `throwOwnerTransferRequired`) + 트랜잭션 내 재검증 구조를 코드로 직접 대조했고, 동시성 보장(A→B/B→A 데드락 방지, owner 재이양 경합 처리)에 논리적 결함은 없다.
5. `throwOwnerTransferRequired()` 를 `{ code: ROLE_REQUIRED.owner.code, message: '...' }` 리터럴에서 `{ ...ROLE_REQUIRED.owner, message: '...' }` 스프레드로 변경 — 스프레드 뒤에 명시된 `message` 키가 마지막에 와서 덮어쓰므로(JS 객체 리터럴 프로퍼티 순서 규칙) 최종 결과는 `{ code: 'OWNER_REQUIRED', message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.' }` 로 종전과 동일 — 갱신된 spec 테스트(`workspaces.service.spec.ts`)도 이를 확인한다.

## 발견사항

이번 diff 범위 안에서 CRITICAL/WARNING 수준의 보안 결함은 발견되지 않았다.

- **[INFO]** 리팩터링이 인가 판정 로직 자체를 변경하지 않음을 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (구 로컬 `ADMIN_ROLES` 삭제 지점), `codebase/backend/src/common/decorators/workspace.decorator.ts` 함수 `routeArgEntriesMatching`
  - 상세: `ADMIN_ROLES` 값 집합이 `workspaceRoleLevel` 서열 기반 파생값과 리터럴 `new Set(['owner','admin'])` 사이에서 동일함을 대조했고, `routeArgEntriesMatching` 추출도 `entry?.factory === factory` identity 비교 의미론을 그대로 보존한다. 다만 이런 "동명이인 상수 통합" 류 리팩터링은 향후 `WORKSPACE_ROLE_LEVEL` 서열이 바뀔 경우(`admin` 삽입 위치 변경 등) `ADMIN_ROLES` 파생 집합도 자동으로 따라 변하므로, 서열 변경 PR 에서는 이 파생 집합이 여전히 의도한 역할군과 일치하는지 재확인이 필요하다는 점을 남겨둔다.
  - 제안: 조치 불요(정보성). 향후 `WORKSPACE_ROLE_LEVEL` 변경 PR 리뷰 체크리스트에 "ADMIN_ROLES 파생 집합 재검증"을 포함 권장.

- **[INFO]** Swagger `description` 에 내부 에러 코드 상수 보간
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`(`switchWorkspace`), `codebase/backend/src/modules/executions/executions.controller.ts`(`reRun`, `getChain`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts`(`FORBIDDEN_MEMBER_ROUTE` 등)
  - 상세: `NOT_A_MEMBER.code`, `ROLE_REQUIRED.editor.code` 등을 템플릿 리터럴로 문서 문자열에 삽입 — 이 값들은 이미 실제 403 응답 바디(`{code, message}`)로 클라이언트에 노출되는 값과 동일하므로 신규 정보 노출이 아니다. 시크릿·내부 경로·스택트레이스 등 민감 정보는 포함되지 않는다.
  - 제안: 조치 불요.

## 요약

이번 변경은 인가(authorization) 관련 상수·reflection 헬퍼·에러 응답 문구를 여러 파일에 흩어져 있던 것에서 단일 소스(`workspace-roles.ts`)로 모으는 유지보수성 개선(DRY) 커밋이며, 실제 접근 제어 판정 로직·락 전략·에러 코드 값에는 변화가 없다. `ADMIN_ROLES` 값 집합 동등성과 `routeArgEntriesMatching` 의 identity 비교 의미론을 직접 대조 확인했고, `transferOwnership` 의 docstring 정정도 실제 구현(순차 `findOne` + `pessimistic_write` 락, 무락 사전 인가 + 트랜잭션 내 재검증)과 일치함을 확인했다. 인젝션·하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 등 OWASP Top 10 관점에서 새로 도입된 취약점은 없다.

## 위험도

NONE
