# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read. 이번 changeset(`codebase/**` 27개 파일, 전부 backend — auth/RBAC 가드·데코레이터·workspaces 모듈·repo-guards·e2e)을 각 행의 trigger 에 매칭.

## 변경 셋 개요
`RolesGuard` 가 경로 파라미터(`@WorkspaceParam`)로 받는 워크스페이스도 멤버십·역할을 검사하도록 확장하고, 가드 거부 403 에 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드를 실었다. **frontend 코드(`codebase/frontend/**`)는 이번 changeset 에 전혀 포함되지 않는다** — TSX·dict·`backend-labels.ts` 어느 것도 diff 에 없다.

## trigger 매칭 및 검토

### 1) `auth-session-flow-change` (인증·권한·세션 흐름 변경)
- trigger: `codebase/backend/src/modules/auth/**` (semantic) — `auth.controller.ts`(`switchWorkspace` 가 `@Param('id', ParseUUIDPipe)` → `@WorkspaceParam('id')`) · `auth.service.ts` 가 직접 매칭. `common/guards/roles.guard.ts` · `common/decorators/workspace*.ts` · `modules/workspaces/**` 는 같은 RBAC 흐름의 semantic 확장으로 포함.
- target: `codebase/frontend/src/content/docs/07-workspace-and-team/` 관련 페이지 + e2e.
- **e2e**: `codebase/backend/test/workspace-path-guard.e2e-spec.ts`(신규) · `workspace-rbac.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 가 같은 changeset — 충족.
- **`07-workspace-and-team/*.mdx`**: 미변경.

### 2) `backend-api-change` (백엔드 API 추가·변경)
- trigger: `codebase/backend/src/**/*.controller.ts` — `auth.controller.ts` · `executions.controller.ts` · `workspaces.controller.ts` 매칭.
- target (a) swagger jsdoc: `@ApiForbiddenResponse` description 이 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 를 명시하도록 **같은 changeset 안에서 갱신됨** — 직접 확인(예: `executions.controller.ts` diff `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님(NOT_A_MEMBER) · editor 이상 권한 필요(EDITOR_REQUIRED)…' })`, `workspaces.controller.ts` 전체 `@WorkspaceParam` 라우트마다 동반). 충족.
- target (b) "API 노출 변경이 사용자 안내에 영향 → user-guide 페이지" — 아래 판단 참고.

## 판단 — `07-workspace-and-team/` 미갱신이 실제 갭인가

**"아니오"로 판단한다.** 근거:

1. `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다"(2026-09-25 신설)가 명시: *"2026-09-25 실측: 인가 누락은 없었으나 두 메서드(`leaveWorkspace`·`addMemberByEmail`)가 인가 전에 워크스페이스를 조회해 비멤버가 «없음·개인·팀» 을 구분할 수 있었다(존재·유형 오라클)."* 즉 이번 변경은 **새 권한 규칙 도입이 아니라 가드 커버리지 모델의 defense-in-depth**다 — 서비스 계층은 이미 `assertAdmin`/`assertOwner`/`NOT_A_MEMBER` 로 동일 권한을 강제하고 있었다.
2. 거부 코드(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)는 **신규가 아니다** — `codebase/frontend/src/app/(main)/w/[slug]/workspace/settings/page.tsx:1010`(`OWNER_REQUIRED` 분기), `codebase/frontend/src/lib/stores/workspace-store.ts` / `lib/api/auth.ts`(`NOT_A_MEMBER`)에서 이미 소비 중이고, 이번 changeset 은 frontend 를 건드리지 않았다. `EDITOR_REQUIRED`/`ADMIN_REQUIRED` 가 이제 신규로 66/9개 라우트에 실리지만, 이들은 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum(매트릭스 `new-error-code` 행의 실제 대상)이나 `warningRules`(`new-warning-code` 행의 대상)와 다른 계열의 HTTP RBAC 거부 코드다 — 두 행의 glob/semantic 정의 어디에도 해당하지 않는다. 거부 `message` 필드 자체가 서비스 계층과 동일한 한국어([`spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드"](../../../../../spec/data-flow/12-workspace.md) "메시지는 서비스 계층과 같은 한국어다")라, `error.code` 를 직접 분기하지 않는 일반 호출부는 여전히 한글 메시지를 그대로 노출한다 — CRITICAL 급 영문 노출 경로는 확인되지 않았다.
3. `CHANGELOG.md`(Unreleased, "워크스페이스 권한 거부가 코드를 싣고…")가 이미 "`error.code` 로 분기하는 클라이언트는 확인할 것(자사 frontend 는 `OWNER_REQUIRED` 한 자리만 분기하고 가드도 같은 코드를 낸다)" 라고 명시 — 신규 코드의 frontend 무소비 상태를 팀이 인지·기록해 뒀다(직전 라운드 `review/code/2026/09/25/16_39_25` W8 처분).
4. `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 는 역할별 권한 요약(Owner/Admin/Editor/Viewer 표)·초대/떠나기/이양 UX 만 다루고, API 403 body 의 `code` 필드 같은 wire 계약은 원래 다루지 않는 레벨의 문서다(직접 확인: "나가기"·"Owner 이양"·"삭제" 절 — 유일 owner 차단, owner-only 삭제 등 서술된 권한 규칙은 이번 변경으로 전혀 달라지지 않았다). 사용자가 관찰할 수 있는 새 메시지·새 제약·새 UI 분기는 없다.
5. 이 changeset 은 **직전 라운드(`review/code/2026/09/25/16_39_25`)와 동일 결론에 도달한 이전 user-guide-sync 리뷰**([`review/code/2026/09/25/16_39_25/user_guide_sync.md`](./16_39_25/user_guide_sync.md))의 후속 라운드다 — 그 라운드도 같은 근거(스펙 실측·frontend 기존 코드 매핑)로 INFO/NONE 판정했고, 이번 라운드(27개 파일, 2라운드 대비 repo-guard 정적 가드·reflection canary 파일 추가)에서도 frontend/docs 변경이 전무해 결론이 달라질 근거가 없다.

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 가 매칭됐으나(semantic — `auth.controller.ts`/`RolesGuard`/`workspaces` 모듈), 실제 변경은 사용자 가시 권한·흐름을 바꾸지 않는 가드 커버리지 강화(defense-in-depth)로 판단됨
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/common/guards/roles.guard.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 등
  - 매트릭스 항목: "인증·권한·세션 흐름 변경" → targets `["codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"]`
  - 확인된 상태: e2e 몫(`workspace-path-guard.e2e-spec.ts` 등)은 충족. `07-workspace-and-team/*.mdx` 는 미포함이지만 위 §판단 근거 1~5 로 실제 stale 이 아님.
  - 상세: 서비스 계층 인가는 원래도 동일했고(오라클 2곳만 신규 폐쇄), 신규 거부 코드는 이미 frontend 가 부분 소비 중인 코드 계열의 확장이며 메시지는 한국어로 유지, CHANGELOG 가 프런트 확인 필요성을 이미 명시. 매트릭스의 `new-error-code`/`new-warning-code` 행(대상: `error-codes.ts` `ErrorCode` enum, `warningRules`)과는 다른 계열이라 CRITICAL 대상이 아니다.
  - 제안: 강제 조치 불필요. 다음 리뷰 라운드가 같은 재조사를 반복하지 않도록, 이 판단은 이미 두 라운드(`16_39_25`, 본 `17_14_49`)에서 동일하게 도달했다는 점만 기록해 둔다.

## 요약
매트릭스 21행 중 매칭된 행은 `auth-session-flow-change`(모듈 auth·RBAC 가드)·`backend-api-change`(controller swagger)의 2건. `backend-api-change` 의 swagger jsdoc target 은 같은 changeset 에서 완전히 갱신돼 충족. `auth-session-flow-change` 는 e2e 몫은 충족했고 `07-workspace-and-team/` MDX 몫만 미반영인데, spec 실측("인가 누락 없음, 결함은 가드 커버리지 모델")·기존 frontend 코드 매핑·CHANGELOG 의 명시적 클라이언트 확인 문구·문서 자체의 서술 불변 네 가지 근거로 실제 사용자 가시 흐름 변경이 아닌 내부 방어 강화로 특정해 INFO 1건으로 하향했다(직전 라운드와 동일 결론). i18n parity·backend-labels·신규 섹션 locale 등록 등 CRITICAL 대상 trigger 는 이 changeset 에 frontend 코드가 전무해 매칭되지 않는다. CRITICAL 0 · WARNING 0 · INFO 1.

## 위험도
NONE
