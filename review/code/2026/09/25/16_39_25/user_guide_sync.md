# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.
- 변경 file 목록은 orchestrator 프롬프트(25개 파일)와 `git diff --name-only origin/main...HEAD`(90+개 파일, `spec/**`·`plan/**`·`review/**` 포함)로 교차 확인.

## 변경 셋 개요
이번 changeset 은 **backend RBAC 가드(경로 파라미터 워크스페이스) 확장** 1건이다 — `RolesGuard` 가 `@Roles()`/`@WorkspaceId()` 뿐 아니라 신규 `@WorkspaceParam(...)` 로 받는 경로 워크스페이스도 검사하도록 확장했고, 가드 거부 403 에 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드를 실었다. **frontend 코드(`codebase/frontend/**`)는 이 changeset 에 전혀 포함되지 않는다** — TSX·dict·backend-labels.ts 어느 것도 diff 에 없다. `spec/**` 다수 문서(`5-system/1-auth.md`, `2-navigation/6-config.md`, `2-navigation/9-user-profile.md`, `conventions/error-codes.md`, `conventions/swagger.md`, `data-flow/12-workspace.md` 등)는 이미 같은 PR 안에서 갱신돼 있다.

## trigger 매칭

### 1) `auth-session-flow-change` (인증·권한·세션 흐름 변경)
- trigger: `codebase/backend/src/modules/auth/**` (match: semantic) — `codebase/backend/src/modules/auth/auth.controller.ts` 가 매칭 (`switchWorkspace` 핸들러가 `@Param('id', ParseUUIDPipe)` → `@WorkspaceParam('id')` 로 교체, `@ApiForbiddenResponse` 추가).
- target: `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e.
- **e2e**: `codebase/backend/test/workspace-path-guard.e2e-spec.ts`(신규) · `workspace-rbac.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 가 같은 changeset 에 포함 — e2e 몫은 충족.
- **`07-workspace-and-team/*.mdx`**: 이번 changeset 에 없음 (`workspaces-and-members.mdx` 등 미변경).

### 2) `backend-api-change` (백엔드 API 추가·변경)
- trigger: `codebase/backend/src/**/*.controller.ts` (semantic) — `auth.controller.ts`·`executions.controller.ts`·`workspaces.controller.ts` 매칭.
- target (a) swagger jsdoc: `@ApiForbiddenResponse` description 이 `NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`EDITOR_REQUIRED` 등을 명시하도록 **같은 changeset 안에서 갱신됨** — 충족.
- target (b) "API 노출 변경이 사용자 안내에 영향 → user-guide 페이지" — 아래 판단 참고.

## 판단 — 07-workspace-and-team/ 미갱신이 실제 갭인가

**증거 기반으로 "아니오"에 무게를 둔다.** 다음 근거들이 이 변경을 "사용자가 보는 흐름이 달라진 변경"이 아니라 "가드 커버리지 모델의 내부 방어 강화"로 특정한다:

1. `plan/complete/spec-draft-workspace-path-guard.md` §A 실측이 명시: *"취약점(인가 누락)은 없다. 결함은 가드의 커버리지 모델이다"* — 13개 경로 라우트 전부 서비스 계층에서 이미 `assertAdmin`/`assertOwner`/`NOT_A_MEMBER` 등으로 인가되고 있었다. 이번 변경은 가드 레이어에도 같은 검증을 중복 배치한 defense-in-depth 이지 새 권한 규칙 도입이 아니다.
2. 거부 코드(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`EDITOR_REQUIRED`)는 **신규 코드가 아니다** — `codebase/frontend/src/app/(main)/w/[slug]/workspace/settings/page.tsx:1010`(`OWNER_REQUIRED`), `codebase/frontend/src/lib/api/auth.ts`(`NOT_A_MEMBER`), `codebase/frontend/src/lib/stores/workspace-store.ts`(`NOT_A_MEMBER`) 등에서 이미 이 코드들을 소비하고 있고, 이번 changeset 은 frontend 를 전혀 건드리지 않았다. 즉 "새 warningCode/errorCode 발행" trigger(§9)에도 해당하지 않는다.
3. `spec/2-navigation/9-user-profile.md` diff 자체가 *"backend 인가 모델은 **불변**"*·*"이 화면의 slug 해소와는 무관한 backend 계층의 예외"*라고 명시 — spec 저자(이 PR 의 planner/developer) 스스로 UI-가시 흐름에는 영향이 없다고 판단하고 적었다.
4. `07-workspace-and-team/workspaces-and-members.mdx` 는 역할별 권한 요약(Owner/Admin/Editor/Viewer)·전환 UX 만 다루고 API 403 body 의 `code` 필드 같은 내부 계약은 원래도 다루지 않는 레벨의 문서다 — 이번 변경으로 그 문서의 어떤 문장도 stale 해지지 않는다.

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 가 glob 상 매칭됐으나(`auth.controller.ts`), 실제 변경은 사용자 가시 권한/흐름을 바꾸지 않는 가드 커버리지 강화로 판단됨
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/common/guards/roles.guard.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
  - 매트릭스 항목: "인증·권한·세션 흐름 변경" → `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e` (PROJECT.md 176행)
  - 확인된 상태: e2e 몫(`workspace-path-guard.e2e-spec.ts` 등)은 같은 changeset 에 포함되어 충족. `07-workspace-and-team/*.mdx` 는 미포함.
  - 상세: §"판단" 절 근거 1~4 — 코드는 이미 존재했고 frontend 는 이미 이 코드들을 처리하고 있었으며 spec 자체가 "backend 인가 모델은 불변"이라 적음. 사용자가 관찰할 수 있는 새로운 메시지·새로운 제약·새로운 UI 분기는 없음.
  - 제안: 확정적 갭은 아니라고 판단하나, 완전히 안전 마진을 두려면 PR 본문/CHANGELOG 에 "07-workspace-and-team/ 은 사용자 가시 동작 불변이라 갱신 생략" 한 줄을 남겨 다음 리뷰어가 같은 재조사를 반복하지 않도록 하는 것을 권장. 강제 조치는 불필요.

## 요약
매트릭스 21행 중 glob/semantic 으로 매칭된 행은 `auth-session-flow-change`(모듈 auth 컨트롤러)·`backend-api-change`(controller swagger)의 2건이며, `backend-api-change` 는 swagger jsdoc 갱신이 같은 changeset 에 이미 반영돼 완전히 충족한다. `auth-session-flow-change` 는 e2e 몫은 충족했고 `07-workspace-and-team/` MDX 몫만 미반영인데, 실측(spec draft §A "취약점 없음, 결함은 가드 커버리지 모델")·frontend 기존 코드 매핑·spec 자체의 "backend 인가 모델 불변" 명시 세 가지 근거가 이를 실제 사용자 가시 흐름 변경이 아닌 내부 방어 강화로 특정해, CRITICAL/WARNING 이 아닌 INFO 1건으로 하향 분류했다. i18n parity·backend-labels·신규 섹션 locale 등록 등 CRITICAL 대상 trigger 는 이 changeset 에 frontend 코드가 전무해 전혀 매칭되지 않는다.

## 위험도
NONE
