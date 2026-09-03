# User Guide Sync Review — `change-password` 실패 코드 형제 정렬 (commit `93146d2f2`)

## 적재한 SSOT
- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type)
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (보조)

## 매칭된 trigger
변경 파일 46개 중 매트릭스 trigger 와 매칭되는 것은 하나뿐이다.

- **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`, match: semantic) —
  `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/modules/auth/sessions.service.ts` 가
  매칭. targets 원문: *"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"*, verify: `make e2e-test`.

나머지 매트릭스 행(new-node, node-schema-change, new-ui-string, integration-provider-change,
new-userguide-section-dir, new-warning-code, new-error-code, expression-language-change,
run-debug-flow-change 등)은 이번 changeset 과 무관 — 신규 노드·TSX 변경·신규 섹션 디렉토리·
`nodes/core/error-codes.ts`·`packages/expression-engine/**` 어느 것도 손대지 않았다(확인:
`git show --name-only 93146d2f2 | grep -E '\.tsx|\.ts$|\.mdx$'` → frontend 쪽은 docs mdx 2개뿐,
`.tsx` 변경 0건).

## 발견사항

- **[WARNING]** `auth-session-flow-change` 의 "+ e2e" 타깃이 신규 분기(OAuth-only → `PASSWORD_REQUIRED`)에 대해 e2e 레벨로 채워지지 않음
  - 변경 파일: `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/modules/auth/sessions.service.ts`, `codebase/backend/src/modules/users/users.service.ts` (trigger), `codebase/backend/test/users-change-password.e2e-spec.ts` (동반 갱신 대상이나 불완전)
  - 매트릭스 항목: `auth-session-flow-change` — targets 원문 `"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"`
  - 누락된 동반 갱신: `codebase/backend/test/users-change-password.e2e-spec.ts` 에 OAuth-only(`passwordHash` 부재) 계정이 `/users/me/change-password` 를 호출했을 때 `401 PASSWORD_REQUIRED` 를 받는 e2e 케이스
  - 상세: 이번 커밋은 `UsersService.changePassword` 가 미설정(OAuth-only)과 불일치 두 조건에 같은 코드(`INVALID_PASSWORD`)를 던지던 것을 형제 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`)로 분리한다. `users.service.spec.ts` 단위 테스트는 이 분기를 잘 커버하지만(`OAuth-only 계정(passwordHash 부재)은 PASSWORD_REQUIRED 를 낸다` 등), `users-change-password.e2e-spec.ts` 는 기존 테스트 하나(`INVALID_PASSWORD`→`PASSWORD_INVALID` 리터럴 치환)만 갱신됐고, 새로 갈라진 `PASSWORD_REQUIRED` 분기를 실제 HTTP 레벨(라우팅·가드·직렬화 전 과정)로 재현하는 테스트는 없다 — 이 파일 안의 `PASSWORD_REQUIRED` 언급은 주석 1곳뿐(`grep` 확인, 실제 assertion 아님). e2e 는 unit 이 못 잡는 라우팅/직렬화/HTTP status 문제를 잡는 층이라, 인증 코드 분기(B 등급 표면, `PASSWORD_REQUIRED` vs `PASSWORD_INVALID` 오분류 시 OAuth-only 사용자가 다시 "비밀번호가 틀렸다" 는 오안내를 받는 회귀)에는 특히 중요하다.
  - 제안: `users-change-password.e2e-spec.ts` 에 OAuth-only 사용자(`passwordHash IS NULL`)로 `/users/me/change-password` 호출 → `401` + `error.code === 'PASSWORD_REQUIRED'` 를 단언하는 케이스 추가. 참고로 이 gap 은 이미 해당 plan 자신이 인지하고 있다 — `plan/in-progress/auth-change-password-oauth-only-code-split.md` 의 체크리스트 마지막 항목(`developer 턴 — ... + 단위/e2e ...`)이 아직 `- [ ]` 로 미체크 상태라 self-tracked 이지만, 이번 changeset(commit `93146d2f2`) 시점에는 미해소로 남아 있다.

## 매칭됐지만 문제 없음 (참고용, 발견사항 아님)

- **docs MDX** — `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` + `.en.mdx` 양쪽이 같은 커밋에서 갱신됨. "OAuth-only 계정은 현재 비밀번호를 재확인할 수 없다" 는 종전 서술을 "forgot-password → reset-password 로 비밀번호를 **추가**할 수 있다" 로 정정 — `spec/5-system/1-auth.md §1.1.A` 및 구현과 일치. ko/en 대칭 확인됨. 동반 갱신 누락 없음.
- **i18n dict / TSX** — 이번 커밋은 `.tsx` 파일을 전혀 건드리지 않는다. 사용자에게 노출되는 새 문구(`'비밀번호가 설정되지 않은 계정이에요...'`, `'현재 비밀번호가 일치하지 않아요.'`)는 backend `UnauthorizedException.message` 리터럴이고, frontend 는 `axiosMessage(err, ...)` 로 이 문자열을 그대로(로케일 무관) 노출한다 — 이 패턴은 이번 커밋 이전에도 `auth.service.ts`/`sessions.service.ts` 의 인접 분기가 이미 쓰던 기존 관행(변경 diff에 안 걸림, 확인함)이라 이번 changeset 이 새로 도입한 회귀가 아니다. 또한 `spec/conventions/i18n-userguide.md` Principle 3 은 "백엔드 발행 **warningCode / 노드 라벨**의 frontend 매핑" 만을 스코프로 명시하므로 이 일반 예외 메시지는 애초에 `backend-labels.ts` 매핑 대상이 아니다 — CRITICAL/WARNING 판정 대상 아님(참고로 남김).
- **backend-labels.ts (WARNING_KO/ERROR_KO)** — `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 이나 `warningRules` 가 아니라 auth 모듈의 HTTP 예외 코드다. `codebase/frontend/src` 전수 grep 결과 이 두 문자열에 대한 참조가 0건 — frontend 가 코드값 자체를 소비하지 않고 `message` 만 노출하므로 `backend-labels.ts` 매핑 대상 trigger(`new-warning-code`/`new-error-code`)에 해당하지 않는다.
- **spec/** 파일들(`2-navigation/9-user-profile.md`, `5-system/1-auth.md`, `3-error-handling.md`, `conventions/error-codes.md`) — 갱신은 됐으나 이는 spec 정합성(consistency-checker/cross-spec 영역)이고 본 리뷰어(user-guide-sync, `codebase/frontend/src/content/docs/**` + dict + backend-labels)의 SSOT 대상이 아니다.

## 요약
매트릭스 21개 change_type 중 이번 46개 변경 파일에 매칭된 것은 `auth-session-flow-change` 1건뿐이다. 그 타깃 중 docs MDX(ko/en)는 같은 커밋 안에서 정확히 동반 갱신됐고, `backend-labels.ts`/i18n dict 는 애초에 이번 변경이 건드리는 표면이 아니라 매칭되지 않는다(트리거 무관, TSX 변경 0건). 유일한 갭은 타깃의 "+ e2e" 절반 — 신설 분기(OAuth-only → `PASSWORD_REQUIRED`)가 unit 레벨엔 있지만 e2e 레벨엔 없다(WARNING 1건, 이미 plan 체크리스트에도 미체크로 self-tracked). CRITICAL 은 0건.

## 위험도
LOW
