# Cross-Spec 일관성 검토 — workspace-path-guard (impl-done)

검토 대상: `RolesGuard`/`@WorkspaceParam` 경로 워크스페이스 가드 도입과 그에 따른
`spec/5-system/1-auth.md` · `spec/data-flow/12-workspace.md` · `spec/5-system/2-api-convention.md` ·
`spec/5-system/3-error-handling.md` · `spec/5-system/13-replay-rerun.md` · `spec/conventions/error-codes.md` ·
`spec/conventions/swagger.md` · `spec/2-navigation/6-config.md` · `spec/2-navigation/9-user-profile.md` 갱신.

(주: 이 검토 세션의 프롬프트 번들은 예산 절단으로 target 원문·diff 를 신지 못했다 — `origin/main...HEAD`
diff 를 해당 spec 파일·핵심 코드(`roles.guard.ts` · `workspace.decorator.ts` · `workspace-roles.ts` ·
`workspaces.controller.ts` · `workspaces.service.ts` · `auth.controller.ts`/`auth.service.ts`)에 한해
워킹트리에서 직접 재확인했다.)

## 발견사항

- **[INFO]** 「가드 거부 코드가 전역이다」선언과 타 도메인 spec 의 role-403 서술 간 동기화 갭
  - target 위치: `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드 (2026-09-25)" — "**적용
    범위는 전역이다.** `RolesGuard` 는 `APP_GUARD` 라 이 표는 경로 라우트 15곳만이 아니라 `@Roles()`
    가 붙은 **모든** 라우트... 와 헤더 위조 거부에 함께 적용된다 — 그 라우트들의 역할 · 멤버십 거부
    wire 코드가 `FORBIDDEN` 에서 위 코드로 바뀌었다."
  - 충돌 대상: `spec/conventions/node-cancellation.md`("서버도 `@Roles('editor')` 로 403 을
    낸다"), `spec/data-flow/1-audit.md` §2.1("권한: `@Roles('admin')` — 전역 `RolesGuard` 가 ...
    강제한다"), `spec/5-system/7-llm-client.md`("`@Roles('editor')` 로 강제"),
    `spec/2-navigation/14-execution-history.md`, `spec/0-overview.md`(Integration RBAC 행) — 모두
    workspaces 밖 다른 도메인에서 `@Roles()` 가드의 403 을 언급하지만, 이번 변경으로 그 403 의 wire
    `code` 가 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED` 로 바뀐 사실을 반영하지 않는다.
  - 상세: 직접적 모순(구 코드를 명시적으로 잘못 주장)은 아니다 — 위 문서들은 애초에 wire `code` 를
    명시하지 않고 "403" 만 언급한다. 다만 target 문서가 "전역 적용" 을 명시적으로 선언했으므로, 이
    문서들이 기술하는 엔드포인트(Stop 버튼, 감사 로그 조회, model-config 연결 테스트 등)의 403 본문도
    이제 특정 코드를 낸다는 사실이 spec corpus 전체에 걸쳐 흩어져 있다 — 한 곳(data-flow/12-workspace)
    만 "전역" 이라 적고 실제 피영향 문서들은 갱신되지 않았다. 기능적 모순은 없다(상태 코드 403 은
    그대로).
  - 제안: 필수는 아니나, 위 문서들이 직접 `code` 를 다룰 경우(신규 작성·차기 수정 시) `data-flow/12-
    workspace.md §"가드 거부의 오류 코드"` 를 참조하도록 링크를 추가해 두면 향후 "이 엔드포인트만
    구 방식일 것" 이라는 오독을 막는다. 지금 당장 spec 수정을 요구할 정도는 아니다.

## 정합성이 확인된 항목 (참고)

아래는 충돌 후보로 조사했으나 실측 결과 **정합** — 향후 재조사 시간을 아끼기 위해 기록한다.

- **경로 파라미터 마이그레이션 완전성**: `workspaces.controller.ts` 의 `:id` 를 쓰는 라우트는 정확히
  14곳(`git grep -nE '@(Get|Post|Patch|Delete)\('`로 재확인), 전부 `@WorkspaceParam('id')` 로 이전됨.
  `auth.controller.ts` switch 라우트 1곳 포함 총 15곳 — target 문서의 "15곳" 서술과 일치.
  `:memberId`/`:invitationId` 는 여전히 `@Param(..., ParseUUIDPipe)` 4곳으로 남아 있고, target 표의
  "4곳" 서술과 일치.
- **`@Roles()` 부여와 §3.2 RBAC 매트릭스**: 신규로 `@Roles('admin')` 이 붙은 라우트(`PATCH /:id`,
  `PATCH /:id/settings`, `POST /:id/members`, `PATCH /:id/members/:memberId`,
  `GET|POST /:id/invitations`, `resend`, `revoke`) 는 매트릭스의 "Workspace 설정 RU(Admin)" ·
  "멤버 관리 CRUD(Admin)" 행과 일치한다. `@Roles('owner')` 가 붙은 `DELETE /:id` ·
  `POST /:id/transfer-ownership` 도 "Workspace 삭제 D(Owner만)" 행과 일치한다. `GET /:id/settings` ·
  `GET /:id/members` · `POST /:id/leave` 는 `@Roles()` 없이 멤버십만 요구해 "R(전 역할)"/자가-서비스
  행과 일치한다.
- **URL slug 계층 분리 vs 경로 워크스페이스 예외**: `spec/2-navigation/9-user-profile.md` 의 "backend
  인가 모델은 불변(header-first)" 문장에 이번 diff 가 정확히 새 예외 조항(경로 파라미터 라우트는
  header/token 이 아니라 경로 값이 인가 대상)을 추가해 두어, `data-flow/12-workspace.md` 의 신규
  Rationale 과 모순 없이 정렬된다.
- **에러 코드 레지스트리**: `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 는
  `spec/` 전체에서 이번에 갱신된 9개 파일 밖에는 등장하지 않는다(요구사항 ID/코드명 충돌 없음).
  `error-codes.md` 의 초대 모듈 lowercase 레지스트리에서 `forbidden` 행을 뺀 정정도 "발행 0건" 근거가
  실제 코드(`workspace-invitations.service.ts` 의 admin 관련 throw 가 전부 `admin_required` 이며
  `forbidden` 리터럴은 없음)와 일치한다.
- **RBAC 서열 SoT 일원화**: 프론트 `role-gate.tsx` 의 `ROLE_LEVEL` 주석이 backend 신규
  `workspace-roles.ts` 의 `WORKSPACE_ROLE_LEVEL` 을 정확히 가리키도록 갱신되어, 값(viewer=1 ·
  editor=2 · admin=3 · owner=4) 도 동일 — 계층 불일치 없음.

## 요약

target 이 수정한 9개 spec 파일은 서로 간, 그리고 `1-data-model.md`·`5-system/1-auth.md §3.1/§3.2`
RBAC 정의·`2-navigation/9-user-profile.md` 워크스페이스 전환 모델과 **직접 모순되는 지점을 찾지
못했다**. 경로 파라미터 워크스페이스 가드 이전 대상(14+1곳)·UUID 파이프 분담(가드 `isUuidShaped` →
`@WorkspaceParam` 내장 `ParseUUIDPipe`)·에러 코드 신설(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/
`ADMIN_REQUIRED`/`OWNER_REQUIRED`)이 코드(`roles.guard.ts`·`workspace.decorator.ts`·
`workspace-roles.ts`·`workspaces.controller.ts`·`workspaces.service.ts`·`auth.controller/service.ts`)와
정확히 일치하며, 관련 RBAC 매트릭스·URL slug 계층 분리 서술과도 정렬된다. 유일하게 남는 것은 "가드
거부 코드는 전역 적용" 이라는 target 의 선언이 워크스페이스 밖 다른 도메인 spec(감사 로그 조회,
Stop 버튼, model-config 연결 테스트 등)에는 아직 명시적으로 반영되지 않았다는 문서 동기화 갭이며,
이는 기능적 모순이 아니라 완성도 이슈라 INFO 로 등급을 매겼다.

## 위험도

LOW
