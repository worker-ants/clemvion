# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 경로 워크스페이스 라우트(`@WorkspaceParam`)의 403 거부 코드가 라우트 요구 역할과 무관하게 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 로 재정의되는 것은 wire-contract 상 breaking change 다 — 예: 종전 `ADMIN_REQUIRED`·`OWNER_REQUIRED`·구 `FORBIDDEN` 을 받던 비멤버가 이제 전부 `NOT_A_MEMBER` 를 받는다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(전체 파일 컨텍스트 204~230행) · `codebase/backend/src/modules/workspaces/workspaces.service.ts` `throwNotAMember`/`assertAdmin`(914~964행 부근) · `codebase/backend/test/workspace-rbac.e2e-spec.ts`(414~425행)
  - 상세: 이 지적은 이미 2~4라운드에서 반복 제기됐고(`review/code/2026/09/25/17_47_18/api_contract.md` WARNING, RESOLUTION W7), 매 라운드 "변경 없음"으로 처분됐다 — 근거는 `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"의 명시적 트레이드오프 채택과, `CHANGELOG.md`(31~47행 부근)에 실린 명시적 breaking-change 공지("`error.code` 로 분기하는 클라이언트는 확인할 것", 영향받는 라우트 수 editor 66·admin 9·owner 7·viewer 5까지 정량화)다. 이번 라운드(5라운드)에서 이 처분을 뒤집을 새 근거는 찾지 못했다 — 재확인 차원의 기록이며 새 지적이 아니다.
  - 제안: 조치 불필요. 이미 CHANGELOG·spec Rationale·e2e(`workspace-rbac.e2e-spec.ts`, `workspace-path-guard.e2e-spec.ts`)가 코드값 변경을 직접 단언해 회귀를 잡는다.

- **[INFO]** `POST /api/workspaces/:id/transfer-ownership` 의 실제 HTTP 상태(201, `@HttpCode` 미지정으로 Nest 기본값)와 Swagger 문서(`@ApiOkWrappedResponse` 계열이 광고하는 200)의 불일치.
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts`(261~263행) — 주석이 "OpenAPI 는 200 을 광고한다(기존 불일치, 트래커 등재)" 라고 자체 명시
  - 상세: 이번 diff 가 만든 문제가 아니고, 이미 별도 트래커에 등재돼 있다고 코드가 밝힌다. 4라운드 리뷰에서도 같은 결론(INFO, 회귀 아님)이었다.
  - 제안: 조치 불필요.

- **[INFO]** `assertMember`(guard) 가 다중 `@WorkspaceParam` 라우트에서 각 경로 파라미터마다 **같은 `requiredRoles`** 로 독립 판정한다(`roles.guard.ts` `pathParamNames` 루프, 156~163행) — 현재 저장소에 다중 `@WorkspaceParam` 라우트 실사용은 없지만, 향후 "워크스페이스 A→B 이동" 류 라우트가 생기면 두 워크스페이스에 **동일한** 최소 역할을 강제하는 모양이 되어(예: 소스는 editor, 대상은 admin 요구처럼 비대칭 요구가 필요한 경우) 설계 재검토가 필요할 수 있다.
  - 상세: 이 항목은 4라운드 W4("다중 `@WorkspaceParam` + `@Roles()` 조합")로 이미 다뤄져 "각 워크스페이스에서 요구를 충족해야 통과"로 고정·뮤테이션 테스트(T3·T4 KILLED)까지 마쳤다 — 대칭 요구라는 현재 설계 자체는 의도된 것으로 보이며, 결함이 아니라 향후 확장 시 참고할 설계 여백으로만 기록한다.
  - 제안: 조치 불필요(현재 사용처 없음). 비대칭 요구가 실제로 필요해지면 그때 `@WorkspaceParam` 에 역할별 개별 지정 옵션을 검토.

## 점검 관점별 요약

1. **하위 호환성**: 위 INFO 1건(비멤버 응답 `code` 통일) 외 breaking change 없음. 15개 경로 워크스페이스 라우트(`workspaces.controller.ts` 14 · `auth.controller.ts` switchWorkspace 1)에 신규 `@Roles()` 가 붙었으나 서비스 계층이 이미 같은 요구를 강제했으므로 정상 클라이언트 동작(허용/거부 여부·상태 코드)에는 영향 없다.
2. **버전 관리**: 이 프로젝트는 URL 버저닝을 쓰지 않는 정책(`spec/5-system/2-api-convention.md`)이며 무관.
3. **응답 형식**: `{ code, message }` 형태가 유지되고, `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 4개 코드가 `common/constants/workspace-roles.ts` 단일 소스에서 파생돼 가드·서비스 두 계층의 드리프트 위험이 구조적으로 제거됐다. `false` 반환(코드 없는 기본 403)으로 남는 두 엣지 케이스(미인증이 `@Roles()` 라우트에 닿는 경우·컨텍스트 부재)는 docstring 에 명시적으로 적혀 있고 도달 불가/희귀 경로로 문서화됨.
4. **에러 응답**: `@WorkspaceParam` 이 `ParseUUIDPipe` 를 내장해 형식 오류(400)와 미가입/부재 워크스페이스(403)를 구조적으로 분리한다. 모든 변경 라우트의 `@ApiForbiddenResponse` description 이 새 코드 조합을 반영해 갱신됨.
5. **요청 검증**: `@WorkspaceParam('id')` 가 `ParseUUIDPipe` 를 강제 내장해 라우트마다 수기로 붙이던 `@Param('id', ParseUUIDPipe)` 누락 위험을 제거. `AddMemberDto`/`UpdateMemberRoleDto` 의 `WORKSPACE_ROLES` 가 `satisfies readonly WorkspaceRoleName[]` 로 가드 서열과 컴파일 타임에 동기화되고, 반대 방향 누락은 `workspace-roles.spec.ts` 가 막는다.
6. **URL/경로 설계**: 변경 없음. 기존 RESTful 구조(`/workspaces/:id/...`) 그대로 유지, 바인딩 방식만 변경.
7. **페이지네이션**: 이번 diff 범위에 목록 API 페이지네이션 변경 없음. 해당 없음.
8. **인증/인가**: 이번 변경의 핵심. 경로 파라미터로 워크스페이스를 받는 15개 라우트의 인가가 서비스 계층 단독에서 전역 `RolesGuard` 로 승격됐다(`transferOwnership` 은 종전 헤더·토큰 워크스페이스를 오판정하던 결함까지 고쳐짐). 서비스 계층 검사는 "가드 인식이 깨졌을 때의 두 번째 선"으로 의도적으로 남아 defense-in-depth 를 유지하며, 정적 저장소 가드(`workspace-param-binding-guard`)와 부트 캐너리(`workspace-reflection-canary.ts`)가 향후 회귀를 fail-closed 로 차단한다.

## 요약

경로 파라미터로 워크스페이스를 받는 15개 라우트의 인가를 서비스 계층 단독 검증에서 전역 `RolesGuard` 로 승격시키고, 멤버십·역할 거부 코드를 가드·서비스가 공유하는 단일 상수 테이블(`workspace-roles.ts`)로 통합한 변경이다. `@WorkspaceParam` 이 `ParseUUIDPipe` 를 구조적으로 내장해 요청 검증 누락 위험을 없앴고, Swagger `@ApiForbiddenResponse` 문서·e2e(`workspace-path-guard.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)·unit(`workspaces.service.spec.ts`)이 상태 코드·에러 코드·existence-oracle 폐쇄를 전방위로 검증한다. 유일한 API-계약상 트레이드오프(비멤버 응답 코드가 요구 역할과 무관하게 `NOT_A_MEMBER` 로 통일되는 breaking change)는 1~4라운드에 걸쳐 이미 검토·수용되었고 `spec/data-flow/12-workspace.md` §Rationale 과 `CHANGELOG.md` 에 명시적으로 announce 되어 있다. 이번(5라운드) 검토에서 이전 처분을 뒤집을 새 근거나 새로운 CRITICAL/WARNING 급 API 계약 결함은 발견하지 못했다.

## 위험도

LOW
