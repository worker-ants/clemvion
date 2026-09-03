# User Guide Sync Review — `change-password` 실패 코드 형제 정렬 + 리뷰 1R 조치 (commit `1950e5773` + `139115d34`)

## 적재한 SSOT
- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type) — Read 완료
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (보조, nuance 확인용)

## 변경 파일 컨텍스트
`git diff --name-only origin/main...HEAD` 로 확인한 실제 변경 파일 61개 (코드 8·docs mdx 2·spec 4·plan 4·CHANGELOG 1·`scripts/backend-typecheck-baseline.json` 1·`review/code/2026/09/02/22_07_21/**` 14·`review/consistency/2026/09/02/**` 30). `git diff --name-only HEAD` (uncommitted) 는 0건 — 리뷰 1라운드(`review/code/2026/09/02/22_07_21/`)의 WARNING 조치가 이미 커밋 `139115d34` 로 반영·완료돼 있다.

## 매칭된 trigger
매트릭스 21개 행 중 매칭되는 것은 하나.

- **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`, match: semantic) —
  `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/modules/auth/sessions.service.ts`,
  `codebase/backend/src/modules/auth/sessions.service.spec.ts` 가 glob 에 매칭. targets 원문:
  *"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"*, verify: `make e2e-test`.

나머지 행(new-node, node-schema-change, new-ui-string, integration-provider-change,
new-userguide-section-dir, new-warning-code, new-error-code, expression-language-change,
run-debug-flow-change, new-backend-ui-zod-value 등)은 무관 — `.tsx` 변경 0건(`git diff --name-only
origin/main...HEAD -- '*.tsx'` 실측), `codebase/backend/src/nodes/**` 변경 0건, `codebase/backend/src/nodes/core/error-codes.ts`
변경 0건, `codebase/packages/expression-engine/**` 변경 0건, `codebase/frontend/src/content/docs/*/` 신규
디렉토리 0건.

## 발견사항

이번 changeset 범위(`origin/main...HEAD`, 커밋 2개)에서 `auth-session-flow-change` trigger 의 동반 갱신
누락은 **없다**.

- **docs MDX 관련 페이지** — `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` +
  `.en.mdx` 양쪽이 같은 커밋(`1950e5773`)에서 동반 갱신됨. 종전 "OAuth-only 계정은 비밀번호를 직접
  설정할 수 없다" 는 반대 서술을 "forgot-password → reset-password 로 비밀번호를 **추가**할 수 있다" 로
  정정했고, 실제 파일을 열어 대조한 결과(`sed -n '70,90p'` ko / `'55,70p'` en) ko/en 구조·논조가
  대칭이며 새 안내 문구("비밀번호가 설정되지 않은 계정이에요")가 `users.service.ts` 의 실제 예외
  `message` 리터럴과 일치한다.
- **e2e** — 리뷰 1라운드(`review/code/2026/09/02/22_07_21/user_guide_sync.md`)가 지적한 유일한 WARNING
  ("`PASSWORD_REQUIRED` 신규 분기가 unit 레벨엔 있지만 e2e 레벨엔 없다")이 이번 조치 커밋
  (`139115d34`, RESOLUTION.md §W2)에서 해소됨을 실측 확인: `codebase/backend/test/users-change-password.e2e-spec.ts`
  에 `it('OAuth-only 계정(password_hash NULL) → 401 PASSWORD_REQUIRED', ...)` 케이스가 추가돼 있고
  (`grep -n PASSWORD_REQUIRED` 로 4곳 확인 — 테스트명·assertion·주석), `401` + `error.code ===
  'PASSWORD_REQUIRED'` + 불일치 코드와의 대조군(`.not.toBe('PASSWORD_INVALID')`) + 안내 메시지
  (`toContain('재설정')`) + 감사 미기록까지 실제 HTTP 레벨로 단언한다. 자매 분기(`PASSWORD_INVALID`)
  e2e 도 리터럴이 갱신돼(`toBe('PASSWORD_INVALID')`) 두 분기 모두 e2e 레벨 커버리지가 확보됐다.

## 매칭됐지만 문제 없음 (참고용, 발견사항 아님)

- **i18n dict / TSX** — 이번 changeset 은 `.tsx` 파일을 전혀 건드리지 않는다(`git diff --name-only
  origin/main...HEAD -- '*.tsx'` → 0건, 실측). 사용자에게 노출되는 새 문구는 backend
  `UnauthorizedException.message` 리터럴이며 frontend 는 `axiosMessage(err, ...)` 로 그대로 노출하는
  기존 관행(diff 이전부터 동일 패턴)이라 이번 changeset 이 새로 만든 dict-parity 갭이 아니다.
  `spec/conventions/i18n-userguide.md` Principle 3 스코프(warningCode/노드 라벨)에도 해당하지 않는다.
- **backend-labels.ts (WARNING_KO/ERROR_KO)** — `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는
  `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 이나 `warningRules` 가 아니라
  auth 모듈 HTTP 예외 코드다. `codebase/frontend/src` 전수 grep 결과 이 두 문자열에 대한 참조 0건 —
  frontend 가 코드값으로 분기하지 않고 `message` 만 노출하므로 `new-warning-code`/`new-error-code`
  trigger 대상이 아니다.
- **spec/** 4개 파일(`2-navigation/9-user-profile.md`, `5-system/1-auth.md`, `3-error-handling.md`,
  `conventions/error-codes.md`) — 갱신됐으나 spec 정합성(consistency-checker 영역)이고 본 리뷰어의
  SSOT 대상(`codebase/frontend/src/content/docs/**` + dict + backend-labels)이 아니다.
- **CHANGELOG.md** — doc-sync-matrix 21개 행 어디에도 CHANGELOG 는 target 으로 등재돼 있지 않다(별도
  `documentation` 리뷰 관점의 대상). 참고로 리뷰 1라운드 W3 로 이미 지적·조치돼 이번 changeset 에
  포함돼 있음을 확인했다.
- **review/code/2026/09/02/22_07_21/**·`review/consistency/2026/09/02/**` — 이전 리뷰·consistency-check
  라운드의 정규 산출물이며 doc-sync-matrix trigger 와 무관.

## 요약

매트릭스 21개 change_type 중 이번 changeset(`origin/main...HEAD`, 61개 변경 파일)에 매칭된 것은
`auth-session-flow-change` 1건이며, 그 타깃(docs MDX 관련 페이지 + e2e) 양쪽 모두 같은 changeset 안에서
동반 갱신됐다. 특히 직전 리뷰 라운드가 지적했던 e2e 갭(WARNING 1건)은 이번 조치 커밋(`139115d34`)에서
정확히 리뷰어의 제안대로(OAuth-only → 401 PASSWORD_REQUIRED 케이스) 해소된 것을 실제 테스트 코드로
확인했다. TSX/dict/backend-labels/신규 노드/신규 섹션 디렉토리 관련 trigger 는 모두 무관(0건 실측).
CRITICAL 0 · WARNING 0 · INFO 0.

## 위험도

NONE
