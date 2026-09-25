# 요구사항(Requirement) Review — workspace-path-guard (2라운드)

## 개요

`RolesGuard` 가 경로 파라미터(`@WorkspaceParam`)로 받는 워크스페이스도 인가 대상으로 판정하도록 확장하고,
가드 거부에 코드(`NOT_A_MEMBER` / `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED`)를 싣는 변경.
25개 파일(가드 · 데코레이터 · 부트 캐너리 · 저장소 정적 가드 2종 · 컨트롤러 15곳 전환 · 서비스 인가 선행 · e2e)을
전부 Read 했고, `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" ·
"가드 거부의 오류 코드" · "멤버십 검증은 가드 1곳에서", `plan/in-progress/workspace-path-guard-impl.md`
(구현 요구 1~8, 뮤턴트 표 M1~M17), 1라운드 `review/code/2026/09/25/16_03_32/RESOLUTION.md` 를 대조했다.

## 발견사항

- **[INFO]** plan 체크리스트가 이미 통과한 TEST WORKFLOW 를 미체크 상태로 남겨 둠
  - 위치: `plan/in-progress/workspace-path-guard-impl.md` §체크리스트 (`- [ ] TEST WORKFLOW …`, `- [ ] /ai-review …`, `- [ ] --impl-done`, `- [ ] 트래커 항목 닫기`)
  - 상세: 같은 plan 이 참조하는 1라운드 `RESOLUTION.md` 의 "## TEST 결과" 섹션은 이미 lint·unit(10041 passed)·build(ratchet 포함)·e2e(71 스위트·390 passed) 전부 통과를 기록하고 있다. 체크박스가 실제 완료 상태를 반영하지 못해, 이 plan 만 보는 다음 사람은 "테스트가 아직 안 돌았다"로 오독할 수 있다(메모리 교훈 "plan 체크박스 = 실제 상태"). 코드 결함은 아니고 이 2라운드 리뷰가 수렴하면 함께 갱신될 항목으로 보인다.
  - 제안: 이번 라운드 수렴 후 마무리 커밋에서 체크리스트를 실제 상태로 갱신.

- **[INFO]** `@WorkspaceId()` + `@WorkspaceParam()` 을 함께 소비하는 핸들러에서 헤더가 형식 불량인 경우는 테스트가 없음
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `canActivate` — `pathParamNames.length > 0` 분기의 `return this.checkRequestContext(request, userId, [])` 호출 (전체 파일 컨텍스트 게이트 174행)
  - 상세: 경로 값이 유효하고 `consumesRequestContext` 가 true 인 핸들러(예: `adminPathAndHeader`)에서 `X-Workspace-Id` 헤더가 UUID 형식이 아니면 `checkRequestContext` → `resolveRequestWorkspaceContext` 가 `BadRequestException(VALIDATION_ERROR)` 를 던진다. 이는 `@WorkspaceId()` 단독 라우트의 기존 헤더 검증 동작과 동일해 새로운 버그는 아니지만, `roles.guard.spec.ts` 의 "헤더 컨텍스트까지 소비하는 핸들러" describe 블록에는 헤더가 항상 유효한 UUID 형태(`OTHER_WS`·`VICTIM_WS`·`TOKEN_WS`)만 쓰여 이 조합이 명시적으로 고정돼 있지 않다. 실제 프로덕션 코드에는 이 조합을 쓰는 핸들러가 0곳(plan §구현 중 결정 "오늘 0곳")이라 위험은 낮다.
  - 제안: 현재 우선순위 낮음(회귀 발생 시 잡을 실 라우트가 없음) — 향후 이런 핸들러가 추가될 때 뮤턴트/테스트에 이 조합을 포함시킬 것.

## 상세 점검 결과 (문제 없음 확인)

- **`RolesGuard.canActivate` 분기 전수**: 미인증(`!userId`) → `JwtAuthGuard` 가 `APP_GUARD` 로 선행 등록돼 있어(`app.module.ts`) 실제로는 이 분기에 인증되지 않은 요청이 도달하지 않음(기존 설계 그대로, 이 PR 이 바꾸지 않음). 경로 워크스페이스 분기(`pathParamNames.length > 0`)는 형식 불량 값을 `continue` 로 건너뛰고(파이프에 위임), 유효한 값마다 `assertMember` 를 순차 `await` 하여 멤버십·역할을 검사한 뒤, 헤더 컨텍스트까지 소비하면 역할 재검사 없이 멤버십만 재검증(`requiredRoles: []`)한다 — spec "경로 파라미터 워크스페이스도 가드가 본다" · "헤더 컨텍스트(`@WorkspaceId()`)까지 소비하는 핸들러면 그쪽은 멤버십만 본다" 문장과 정확히 일치.
- **거부 코드 매핑**: `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드·한국어 메시지가 `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" 표와 `workspaces.service.ts` 의 서비스 계층 메시지(`throwAdminRequired` 등)와 문자열 단위로 일치. 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`(규칙 (나) 채택)로, spec 이 기각한 규칙 (가)로 회귀하지 않았음을 `roles.guard.spec.ts` "비멤버는 @Roles(...) 라우트에서도 NOT_A_MEMBER" 테스트가 고정.
- **역할 서열 단일화**: `workspace-roles.ts` 가 `Object.hasOwn` 으로 프로토타입 오염(`constructor` 등)을 막고, `ADMIN_ROLES` 를 서열에서 파생시켜 `roles.guard.ts` · `workspaces.service.ts` · `workspace-invitations.service.ts` 세 곳이 같은 표를 본다(1라운드 W4 조치 확인, `workspace-roles.spec.ts` 4개 테스트로 DTO(`WORKSPACE_ROLES`)와의 정합까지 고정).
- **15곳 전환 완전성**: `workspaces.controller.ts` 의 `:id` 경로 14곳 + `auth.controller.ts` `switchWorkspace` 1곳이 전부 `@WorkspaceParam('id')` 로 바뀌었고, `@Roles()` 부착이 spec 표(Admin 8 · Owner 2 · 멤버 5)와 정확히 일치함을 `workspace-roles-attachment.spec.ts` 의 `describe.each` 15행이 reflection 으로 고정. 저장소 정적 가드 `workspace-param-binding`(신규, fail-closed·허용목록 없음)이 향후 회귀(평범한 `@Param` 으로 워크스페이스 바인딩)를 CI 에서 차단.
- **UUID 형식 처리 비대칭**: 가드는 `isUuidShaped`(nil UUID 등 Postgres 파싱 가능 형태까지 허용, 형식 아니면 판정 없이 통과) → `@WorkspaceParam` 내장 `ParseUUIDPipe`(RFC 엄격) 순서로, spec "가드는 파이프보다 먼저 돈다" · "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭" 절과 e2e(`workspace-path-guard.e2e-spec.ts` "형식이 아닌 경로 값은 400, 형식은 맞는 nil UUID 는 403")가 실제 HTTP 응답 코드까지 검증.
- **오라클 제거**: `workspaces.service.ts` 의 `leaveWorkspace` · `addMemberByEmail` 가 조회보다 인가를 먼저 하도록 순서가 바뀌어, 비멤버가 워크스페이스의 존재·유형을 구분하지 못하게 됨을 `workspaces.service.spec.ts` 의 `workspaceRepo.findOne` 미호출 단언이 고정. `removeMember` 관련 주석도 취소선 + 정정 날짜로 갱신(1라운드 W3 조치 확인).
- **뮤턴트 검증**: plan 의 M1~M17(경로 분기 제거·형식 검사 제거·`@Roles` 무시·병용 핸들러 헤더 검사 생략/역할 오적용·문턱 오산정·비멤버 역할 코드 오류·경로 이름 첫 하나만·캐너리 오산정·컨트롤러별 회귀 등) 전부 RED 로 KILLED 기록 — 이 리뷰에서 별도로 저장소를 뮤테이션하지 않고 그 표를 근거로 채택했다(리뷰 규약상 동시 실행 중인 다른 리뷰어 오염 방지를 위해 자체 뮤테이션은 생략).
- **1라운드 Warning 8건 처분 확인**: `RESOLUTION.md` 의 처분(W1 announce 완료, W2/W6 의도 주석, W3 주석 정정, W4 서열 단일화, W5 상수화, W7/W8 후속 등재·검토완료)이 실제 커밋 `37ee970a2` 의 diff 내용과 부합함을 코드 레벨로 재확인 — 재지적 없음.

## 요약

경로 워크스페이스 인가 로직·거부 코드·역할 계층 단일화·저장소 정적 가드·부트 캐너리 확장까지 spec(`12-workspace.md` §Rationale 3개 절)과 라인 단위로 합치하며, 비즈니스 규칙(비멤버는 항상 NOT_A_MEMBER, 역할 미달은 최소 요구 코드, 경로 값이 인가 대상, 가드→파이프 순서)이 코드·테스트·e2e·CHANGELOG 전체에 일관되게 반영돼 있다. 1라운드에서 지적된 8건의 Warning 은 커밋 `37ee970a2` 로 실제 처리됐고 재지적할 근거를 찾지 못했다. 이번 라운드에서 발견한 것은 plan 체크리스트 미갱신(process, 코드 무관)과 프로덕션에 아직 없는 조합(헤더+경로 동시 소비 핸들러의 헤더 형식 불량)에 대한 테스트 공백 정도로, 둘 다 INFO 수준이며 Critical/Warning 은 없다.

## 위험도

LOW
