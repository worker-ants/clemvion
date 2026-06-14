# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

매트릭스 전체 행(16개) 중 이번 변경 set 에 매칭되는 trigger 는 아래 2개이며, 모두 동반 갱신이 충족됐다.

### 매칭 trigger 1 — `auth-session-flow-change` (만족)

- 변경 파일: `codebase/backend/src/modules/auth/auth.service.ts`
- 매트릭스 항목: `인증·권한·세션 흐름 변경` — trigger glob `codebase/backend/src/modules/auth/**`
- 대상: `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`
- 판정: `password-and-sessions.mdx` + `password-and-sessions.en.mdx` 양쪽이 같은 커밋에 신설됨. i18n parity(ko/en 양쪽) 충족.
- ImplAnchor 점검: `password-and-sessions.en.mdx` 및 `.mdx` 에 `<ImplAnchor kind="ui-entry" file="codebase/frontend/src/app/(main)/profile/change-password/page.tsx" symbol="ChangePasswordPage" ...>` 포함. 해당 파일 실존 확인됨.
- 누락 없음.

### 매칭 trigger 2 — `new-userguide-section-dir` (해당 없음 — 신규 디렉토리 아님)

- `07-workspace-and-team/` 디렉토리는 기존에 이미 존재. `locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일(`ko`, `en`)에 `"07-workspace-and-team"` 이미 등록돼 있음. 신규 섹션 디렉토리 등록 누락 없음.

### 나머지 trigger 매칭 불해당

- `new-node` / `node-schema-change`: `codebase/backend/src/nodes/**` 변경 없음.
- `new-ui-string`: 신규 TSX 파일 없음. 한국어 리터럴 TSX 변경 없음.
- `new-warning-code` / `new-error-code`: `warningRules` 또는 `error-codes.ts` 변경 없음.
- `expression-language-change`: `codebase/packages/expression-engine/**` 변경 없음.
- `run-debug-flow-change`: 실행 엔진·디버그 로깅 변경 없음.
- `backend-api-change`: 이번 변경은 내부 bcrypt 리팩터(`hashPassword` DRY 공용화)로 신규 API endpoint / DTO 추가 없음. 세션 revoke 동작 변경은 `password-and-sessions.mdx` 에 문서화됨.
- `integration-provider-change`: 통합 provider 변경 없음.

## 요약

매트릭스 16개 trigger 전수 점검. 유효 매칭은 `auth-session-flow-change` 1개로, 동반 갱신 대상인 `07-workspace-and-team/password-and-sessions.{mdx,en.mdx}` 양쪽이 같은 커밋에 포함돼 있고 ImplAnchor 파일 실존·locale.ts 섹션 등록도 이상 없다. 누락 0건.

## 위험도

NONE
