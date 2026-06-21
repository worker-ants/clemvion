# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

매트릭스 전체 18개 trigger 중 이번 변경 set 에 매칭되는 trigger 는 아래 4개이며, 모두 동반 갱신이 올바르게 완료된 것을 확인했다.

### 매칭 trigger 1 — `auth-session-flow-change`

- 변경 파일: `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/modules/auth/sessions.service.ts`
- 매트릭스 항목: `auth-session-flow-change` — `"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"`
- 동반 갱신 상태: **완료**
  - `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` — 이메일 변경 흐름 전체(5단계 절차, 세션 처리, 통지 메일, 재발송/취소, OAuth 제한) 신규 섹션 추가됨
  - `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx` — 영문 동반 갱신 완료
  - e2e: `codebase/backend/test/users-email-change.e2e-spec.ts` 신규 추가됨

### 매칭 trigger 2 — `new-ui-string` (i18n parity)

- 변경 파일: `codebase/frontend/src/app/(main)/profile/change-email/page.tsx`, `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx`, `codebase/frontend/src/app/(main)/profile/components/profile-info-card.tsx`
- 매트릭스 항목: `new-ui-string` — `"codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts 양쪽 — 한쪽만 추가 금지 (parity 가드 fail)"`
- 동반 갱신 상태: **완료 (parity 유지)**
  - `codebase/frontend/src/lib/i18n/dict/ko/profile.ts` — 이메일 변경 관련 신규 키 다수 추가 (`changeEmailCta`, `emailPendingLabel`, `changeEmailPageTitle`, `changeEmailPageDescription`, `newEmail`, `newEmailPlaceholder`, `changeEmailReauthHint`, `totpCodeOptional`, `changeEmailSubmit`, `changeEmailRequestSuccess`, `changeEmailFailed`, `changeEmailPendingTitle`, `changeEmailPendingDescription`, `resend`, `changeEmailResent`, `changeEmailCancelled`, `changeEmailVerifying`, `changeEmailVerifySuccess`, `changeEmailVerifyFailed`, `changeEmailMissingToken`)
  - `codebase/frontend/src/lib/i18n/dict/en/profile.ts` — 동일 키 전부 영문으로 동반 등록됨
  - ko/en 키 집합 대칭 확인됨 — parity CRITICAL 없음

### 매칭 trigger 3 — `backend-api-change`

- 변경 파일: `codebase/backend/src/modules/users/users.controller.ts`, `codebase/backend/src/modules/users/dto/email-change-request.dto.ts`, `codebase/backend/src/modules/users/dto/email-change-verify.dto.ts`
- 매트릭스 항목: `backend-api-change` — `"controller·DTO 의 swagger jsdoc"` + `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"`
- 동반 갱신 상태: **완료**
  - 4개 신규 엔드포인트(`POST /me/email-change/request`, `/verify`, `/resend`, `/cancel`) 모두 `@ApiOperation`, `@ApiOkWrappedResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse` Swagger 주석 포함
  - 사용자 가이드 영향 페이지(`password-and-sessions.{mdx,en.mdx}`)도 동반 갱신됨 (trigger 1 참조)

### 매칭 trigger 4 — `spec-major-change`

- 변경 파일: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`
- 매트릭스 항목: `spec-major-change` — `"frontmatter code: / status: / pending_plans: 정합 갱신"`, `"status: partial 이면 pending_plans: 의 plan 신설"`
- 동반 갱신 상태: **완료**
  - `spec/5-system/1-auth.md` frontmatter: `status: partial`, `pending_plans:` 에 기존 plan 참조 유지. `code:` 글로브 `codebase/backend/src/modules/auth/**/*.ts` 등이 신규 구현 파일을 포함
  - 이번 변경에 대한 구현 plan `plan/in-progress/impl-email-change.md` 도 changeset 에 포함됨

## 비매칭 trigger 확인

- `new-node` / `node-schema-change`: 노드 파일(`codebase/backend/src/nodes/`) 변경 없음 — 해당 없음
- `new-warning-code` / `new-error-code`: `warningRules` 또는 `error-codes.ts` 변경 없음. `auth.service.ts` 에서 사용된 `REAUTH_NOT_AVAILABLE`, `RESOURCE_CONFLICT`, `VALIDATION_ERROR` 는 기존 공통 에러 코드로 신규 등록이 아님 — 해당 없음
- `new-userguide-section-dir`: `docs/` 아래 신규 섹션 디렉토리 추가 없음 — 해당 없음
- `new-backend-ui-zod-value`: 백엔드 zod ui.label / hint / group 신규 값 없음 — 해당 없음
- `integration-provider-change`: 통합 provider 변경 없음 — 해당 없음
- `expression-language-change` / `run-debug-flow-change`: 해당 없음

## 요약

매트릭스 18개 trigger 중 4개(`auth-session-flow-change`, `new-ui-string`, `backend-api-change`, `spec-major-change`)가 이번 이메일 변경 기능 구현 changeset 에 매칭됐으며, 모든 trigger 의 동반 갱신 대상 파일이 동일 PR changeset 에 포함됨을 확인했다. i18n parity(ko/en 양쪽 profile.ts), 유저 가이드 양쪽 로케일 MDX, Swagger jsdoc, e2e 모두 누락 없음. 누락된 동반 갱신 0건.

## 위험도

NONE
