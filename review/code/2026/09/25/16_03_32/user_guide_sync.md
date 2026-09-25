# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 22행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(표 + "자주 누락되는 항목") 을 함께 Read.
- 변경 file 목록: prompt 의 22개 파일 전부 `codebase/backend/**` (decorators/guards/auth·executions·workspaces 컨트롤러·서비스·repo-guards 픽스처·e2e spec). `git diff --name-only HEAD~5 HEAD` 로 보강해 `CHANGELOG.md` · `spec/{2-navigation,5-system,conventions}/*.md` · `plan/**` 도 함께 확인. **frontend/channel-web-chat 파일은 이 changeset 에 0건.**

## 발견사항

- **[WARNING]** 인증·권한 흐름 변경(`@WorkspaceParam` 경로 워크스페이스 가드 + `RolesGuard` 거부 코드 전면 표준화)이 `07-workspace-and-team/` 유저 가이드 검토 없이 착지
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts` (switchWorkspace: `@Param('id', ParseUUIDPipe)` → `@WorkspaceParam('id')`), `codebase/backend/src/common/guards/roles.guard.ts` (거부 시 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드 신규 부여, 경로 워크스페이스 15곳 판정 추가), `codebase/backend/src/common/decorators/workspace.decorator.ts` (`@WorkspaceParam` 신설), `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (13개 라우트에 `@Roles()` 신규 부착)
  - 매트릭스 항목: `auth-session-flow-change` (`doc-sync-matrix.json` id) / PROJECT.md 176행 "인증·권한·세션 흐름 변경 | `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e | `make e2e-test`" — trigger `codebase/backend/src/modules/auth/**` 에 `auth.controller.ts` 가 직접 매칭. PROJECT.md 209행은 이 조합을 "자주 누락되는 항목" 1순위로 명시: "흐름 변경 + 가이드 갱신 + e2e 가 한 묶음"
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` (+ `.en.mdx`) — 이 changeset 에 전혀 포함되지 않음. e2e 쪽은 `codebase/backend/test/workspace-path-guard.e2e-spec.ts` · `workspace-rbac.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 로 충족됨(묶음의 절반만 이행).
  - 상세: `CHANGELOG.md` "Unreleased — 워크스페이스 권한 거부가 코드를 싣고, 경로의 워크스페이스를 가드가 판정한다" 항목을 직접 대조한 결과, 이 PR 은 순수 내부 리팩터가 아니라 **관측 가능한 API 응답 변화**를 명시한다: (1) 비멤버가 Admin/Owner 라우트 10곳에서 받던 `ADMIN_REQUIRED`/`OWNER_REQUIRED` 가 `NOT_A_MEMBER` 로 바뀜, (2) `POST /:id/leave`·`POST /:id/members` 등에서 종전엔 없음(404)/개인/팀을 구분해 답하던 것이 이제 전부 `403 NOT_A_MEMBER`, (3) nil UUID 경로값이 `400`→`403`, (4) **종전 버그 수정** — "자기 워크스페이스의 owner 가 헤더에 다른 워크스페이스를 실으면 정당한 이양이 403 이었다"(= `transferOwnership` 이 경로 워크스페이스 대신 헤더/토큰 워크스페이스로 판정하던 결함). 다만 `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 본문은 역할표·이양 절차를 개괄 수준으로만 서술하고(특정 HTTP 코드·엣지케이스 언급 없음), 서비스 계층 `assertAdmin`/`resolveTokenWorkspaceContext` 가 이미 동일한 최종 판정(누가 무엇을 할 수 있는가)을 내리고 있었음을 `workspaces.service.ts`/`auth.service.ts` 로 확인했다 — 즉 **가드 계층의 방어 심층화 + 에러 코드 표준화**이지 사용자가 보는 권한 경계 자체는 바뀌지 않았다. 그럼에도 plan(`plan/in-progress/workspace-path-guard-impl.md`)에는 `ERROR_KO` 등록 여부(요구 6)는 "왜 등록하지 않는지"를 실측(`translateBackendError` 프로덕션 호출부 0건)까지 남겨 명시적으로 결정한 반면, `07-workspace-and-team/` 검토 여부는 plan·consistency 리뷰 산출물 어디에도 언급이 없다(grep 0건) — 즉 트리거는 맞았는데 "검토했지만 불필요"라는 결정 자체가 기록되지 않았다.
  - 제안: 두 선택지 중 하나를 같은 PR 안에서 처리 — (a) `workspaces-and-members.mdx`/`.en.mdx` "워크스페이스 떠나기·삭제"/"Owner 이양" 절에 실제로 사용자가 체감할 변화(예: 이양 시 헤더 워크스페이스가 아닌 URL 의 워크스페이스 기준으로 판정된다는 점)를 한두 문장 보강, 또는 (b) `ERROR_KO` 결정과 동일한 형식으로 plan 에 "07-workspace-and-team 검토함 — 사용자 가시 권한 경계·문구 불변이라 갱신 불필요" 라는 명시적 근거를 남겨 다음 사람이 같은 grep 을 반복하지 않게 한다.

- **[INFO]** `backend-api-change` 트리거(controller/DTO 변경) 는 swagger jsdoc 동반 갱신이 이미 충실히 이행됨 — 별도 조치 불요
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
  - 매트릭스 항목: `backend-api-change` — targets "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 확인: (a) 는 diff 상에서 `@ApiForbiddenResponse` 설명이 새 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 반영하도록 동일 PR 안에서 갱신됨. plan 은 "요구 8 의 범위 — 경로 15곳·재실행·chain 만"으로 스코프를 의도적으로 좁혔고(나머지 ~30개 컨트롤러의 `@ApiForbiddenResponse` 문구는 "틀린 문장은 아니"라는 실측 근거와 함께 후속 트래커로 명시 이연) 이 결정은 문서화돼 있어 누락으로 보지 않음. (b) 는 위 WARNING 항목과 동일 사안.
  - 상세: 별도 조치 불필요 — 참고용 기록.

## 매칭 안 된/해당 없음 확인
- 새 노드 추가·노드 schema 변경·신규 UI 문자열(TSX)·신규 위젯 chrome 문자열·통합 제공자 변경·신규 섹션 디렉토리·표현식 언어 변경·실행/디버깅 흐름 변경 — 모두 trigger 글로브/semantic 조건에 매칭되는 변경 파일 없음(frontend/channel-web-chat/packages/expression-engine 파일 0건). i18n dict·backend-labels·locale.ts 어느 것도 이 changeset 대상이 아님(변경 안 해도 정상).
- 신규 warningCode/errorCode(`error-codes.ts` `ErrorCode` enum) — 미변경. `NOT_A_MEMBER` 등은 HTTP `ForbiddenException` 코드이지 node 실행 `ErrorCode`/`warningRules` 가 아니며, `ERROR_KO`/`WARNING_KO` 매핑 대상 함수(`translateBackendError`)가 프로덕션에서 호출되지 않는다는 사실을 developer 가 실측 후 명시적으로 미등록 결정 — 타당함.
- `new-bullmq-queue`, `new-cross-cutting-enum`, `new-handler-output-field`, `auth-config-type-enum-change`, `spec-major-change`, `userguide-gui-flow-section` — 해당 변경 없음.
- spec 갱신(`spec/5-system/1-auth.md` 등)은 이미 별도 planner 턴(`c5a17edea`, `e2e257707`)에서 처리되어 이 changeset 의 코드와 같은 PR 에 포함됨 — spec-major-change 트리거 충족 확인.

## 요약
매트릭스 22개 trigger 중 이 changeset(전부 backend, frontend/docs 변경 0건)에 매칭되는 것은 `auth-session-flow-change`(semantic, `modules/auth/**`)와 `backend-api-change`(semantic, controller 변경) 2개다. `backend-api-change`(swagger jsdoc)는 충실히 이행됐고 스코프 축소 근거도 plan 에 기록돼 있다. `auth-session-flow-change`는 e2e 절반은 충족했으나 PROJECT.md 가 "자주 누락되는 항목" 1순위로 명시한 `07-workspace-and-team/` 유저 가이드 검토가 plan·리뷰 산출물 어디에도 기록되지 않은 채 누락됐다 — CHANGELOG 는 관측 가능한 응답 변화(코드 재배정 · 과거 이양 버그 수정)를 상세히 남겼지만 그 내용이 유저 가이드 검토 여부까지 대신하지는 않는다. 총 발견 1건 WARNING + 1건 INFO(불필요 확인).

## 위험도
MEDIUM
