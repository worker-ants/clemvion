# 신규 식별자 충돌 검토 — Personal 통합 소유자 강제 (`spec/2-navigation/4-integration.md §8` 등)

## 검토 범위

target: `spec/2-navigation/4-integration.md §8` 판정 규칙 신설 (`f47069564`), 부수 변경
`spec/5-system/3-error-handling.md §1.2`(`ADMIN_REQUIRED` 발행처 추가) ·
`spec/4-nodes/4-integration/_product-overview.md`(INT-MG-07 문구 보강) · §9.4 `INTEGRATION_NAME_TAKEN` 등재 ·
frontmatter `status: partial` + `pending_plans`. 구현 plan(`plan/in-progress/integration-personal-owner.md`)이
예고하는 신규 코드 식별자(`isIntegrationVisibleTo` · `integrationVisibilityClause` · `requireVisible` ·
`assertCanModify` · `requireModifiable` · 파일 `modules/integrations/integration-visibility.ts`)도 함께 확인했다
(구현 착수 전이므로 아직 코드에는 없음 — "새로 도입될" 식별자로 검사).

## 발견사항

이번 target 이 도입하는 식별자는 전부 기존 식별자의 **재사용**이거나, 코드베이스에 전례가 없는 **완전
신규명**으로 확인되어 실질 충돌을 찾지 못했다.

- **`403 ADMIN_REQUIRED`** — target 은 새로 도입하는 것이 아니라 기존 `RolesGuard`/`WorkspacesService.assertAdmin()`
  이 이미 쓰는 공유 코드(`codebase/backend/src/common/constants/workspace-roles.ts:63` `ROLE_REQUIRED.admin`)를
  그대로 가져다 쓴다. `spec/5-system/3-error-handling.md:46` 의 기존 정의("Admin 권한 필요")와 의미가 완전히
  일치하고, target 은 발행처 목록에 `IntegrationsService` 를 한 항목 추가할 뿐이다. 충돌 아님(의도된 재사용).
- **`INTEGRATION_NAME_TAKEN`** — `codebase/backend/src/modules/integrations/integrations.service.ts:1594` 에
  이미 존재하는 코드를 §9.4 문서에 뒤늦게 등재하는 것뿐, 새 식별자 아님.
- **`resolveRole`** — 구현 plan 설계 절이 "컨트롤러 — `@CurrentUser()` · `resolveRole` 를 붙여 서비스로 넘긴다"
  고 적는데, `IntegrationsController`/`IntegrationsService` 에 이미 동명 메서드가 있다
  (`integrations.controller.ts:386,458,515`, `integrations.service.ts:1750` `resolveRole(workspaceId, userId) → workspacesService.getMemberRole`).
  의미도 "요청자의 워크스페이스 역할 조회"로 plan 의 의도와 일치 — 신규 도입이 아니라 기존 헬퍼 재사용.
- **`requireVisible` / `assertCanModify` / `requireModifiable` / `isIntegrationVisibleTo` / `integrationVisibilityClause`**
  — 코드베이스 전체(`grep -rn` on `codebase/backend/src`)에 0건, spec 에도 0건. 기존 `assertCanRotate`
  (`integrations.service.ts:1100`, 이번 plan 이 "일반화" 대상으로 명시)와 이름이 겹치지 않고 계열도 자연스럽다.
  신규 파일 `modules/integrations/integration-visibility.ts` 도 같은 모듈의 기존 명명 관례(`integration-oauth.service.ts`,
  `integration-status-reason.ts`, `integration-expiry-scanner.service.ts` — `integration-` 단수 접두 + 역할명)와
  일치하고 겹치는 파일이 없다.
- **`§8 권한 규칙` 앵커(`#8-권한-규칙`)** — `spec/0-overview.md` · `spec/4-nodes/4-integration/_product-overview.md`
  (INT-MG-07) · `spec/5-system/3-error-handling.md` 세 곳이 이 앵커를 참조하는데, 실제 헤딩 `## 8. 권한 규칙`
  이 만드는 GitHub 스타일 앵커와 일치해 깨진 링크 없음.
- **`INT-MG-07`** — spec 전체에서 `_product-overview.md:25` 단 한 곳에서만 쓰이는 고유 ID. 충돌 없음.
- **`status: partial` / `pending_plans`** — `spec/2-navigation/2-trigger-list.md` 등 이미 20개 가까운 spec 문서가
  쓰는 정식 라이프사이클 규약(`spec-impl-evidence.md`)이지 이번에 새로 만든 값이 아님.
- **`conflict` / `status` / `existingIntegrationId` / `existingName`** (precheck 응답 필드, (D) 변경안) — §9.2 에
  이미 정의된 `Cafe24PrecheckResultDto` 필드 그대로이며 새 필드를 추가하지 않는다.
- **API endpoint** — target 은 새 endpoint 를 만들지 않는다(`GET /api/integrations`, `:id` 하위 경로,
  `oauth/begin`, precheck 둘 다 §9 에 기존 정의된 경로). 인가 판정만 추가.
- **"판정 규칙"** (신설 소제목) — `spec/2-navigation/14-execution-history.md:99` · `spec/5-system/2-api-convention.md:330` ·
  `spec/5-system/4-execution-engine.md:1552` 에도 같은 문구가 쓰이지만, 코드가 참조하는 식별자가 아니라
  일반 한국어 서술 제목이라 이 checker 의 스코프(요구사항 ID·엔티티명·endpoint·이벤트명·ENV·파일경로)에
  해당하는 "식별자" 로 보지 않았다 — 각 문서 안 문맥이 달라 혼동 여지도 낮다(INFO 로도 안 올림).

## 요약

target 이 실제로 새로 만드는 이름(`integration-visibility.ts`, `isIntegrationVisibleTo`, `integrationVisibilityClause`,
`requireVisible`, `assertCanModify`, `requireModifiable`)은 코드베이스·spec 전체에 선례가 없어 충돌하지 않으며,
동일 모듈의 기존 파일·메서드 명명 관례와도 자연스럽게 이어진다. 반대로 target 이 "새로 부여하는 것처럼" 보이는
`ADMIN_REQUIRED` · `INTEGRATION_NAME_TAKEN` · `resolveRole` · `status: partial`/`pending_plans` 는 실제로는 전부
기존 코드/문서에 이미 존재하는 식별자의 의도된 재사용이며, 의미도 기존 정의와 일치해 다른 뜻으로 덮어쓰지 않는다.
§8 앵커·INT-MG-07 등 상호 참조도 깨지지 않았다. 신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING 이 없다.

## 위험도

NONE
