# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## BYPASS 판정 근거

이 호출의 target 은 `spec/5-system/` 로 지정되어 있고 프롬프트에는 해당 디렉터리 전체(및
`spec/**` 다수 파일)가 번들되어 있으나, **이 작업(eslint10-upgrade)에서 `spec/**` 에 대한
실제 변경은 존재하지 않는다.**

실측 (워킹트리: `/Users/gehrig/orca/workspaces/clemvion/oystercatcher/.claude/worktrees/eslint10-upgrade-5e3cf9`):

- `git diff --stat origin/main -- spec/` → **빈 출력** (0 files changed)
- `git diff --stat origin/main -- .` 전체 변경 파일 목록:
  - `codebase/frontend/eslint.config.mjs`
  - `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts`
  - `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts`
  - `plan/in-progress/deps-peer-gating-and-eslint10.md`
  - `review/code/2026/08/28/23_20_05/**` (코드 리뷰 산출물)
  - 전부 `spec/` 밖.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter: `spec_impact: none` (명시적 선언, 작업 목적과 일치 — ESLint 10 업그레이드 차단자 감시 가드/의존성 게이팅으로 순수 codebase+plan 범위)

즉 이번 turn 은 ESLint 10 peer-dependency 차단자를 감시하는 회귀 캐너리 테스트(`eslint10-unblock*.ts`)와 `eslint.config.mjs` 주석/설정 정정, 그리고 그 경위를 기록한 plan 갱신뿐이며 `spec/5-system/`(인증·에러 처리·API 컨벤션 등)의 문서 내용은 이 브랜치에서 한 글자도 바뀌지 않았다.

프롬프트에 번들된 `spec/5-system/1-auth.md`, `3-error-handling.md`, `2-api-convention.md` 등은 **origin/main 과 동일한 기존 내용**이며 이번 diff 의 산출물이 아니다 — 이 checker 가 "target(draft)" 로 비교해야 할 신규·변경 서술이 존재하지 않으므로, cross-spec 충돌 분석의 대상 자체가 없다. (이는 `.claude/docs/subagent-call-contract.md` 가 경고하는 "impl-done scope 번들이 실제 diff 와 무관한 디렉터리를 잘못 지정" 케이스에 해당한다 — grep 으로 실제 코드 변경분에서 `spec/5-system/` 참조나 관련 서술 변경을 찾아도 0건이다.)

## 발견사항

없음 — 비교 대상(target 의 신규/변경 서술)이 존재하지 않아 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌 후보를 특정할 수 없다.

## 요약

이번 `eslint10-upgrade` 작업은 `spec/**` 를 전혀 수정하지 않았다(diff 0건, `spec_impact: none` 명시). Cross-Spec 일관성 checker 에 전달된 target(`spec/5-system/`) 은 이 작업의 실제 변경 범위와 무관한 스코핑으로 보이며, 실제 코드 변경(ESLint 10 차단자 감시 가드, `eslint.config.mjs`, plan 문서)은 spec 영역과 접점이 없다. 따라서 cross-spec 충돌 위험은 없다.

## 위험도

NONE
