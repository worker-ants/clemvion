STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows[] 20개)을 SoT 로 적재하고 PROJECT.md §변경 유형 →
갱신 위치 매핑 본문을 보조로 참조. orchestrator 프롬프트의 변경 file 목록(일부 diff 생략)을
`git diff origin/main...HEAD --name-only` (252파일 전량, `review/**`·`plan/**` 제외 시 실질
code/spec/docs 변경 31파일)으로 보강해 대조했다.

**핵심 관찰**: 이번 changeset 의 code/docs/dict 변경 파일 집합은 같은 PR 의 이전 리뷰 라운드
(`review/code/2026/08/20/15_10_25/user_guide_sync.md`)가 이미 전량 검토해 "누락 0건" 으로
판정한 집합과 **완전히 동일**하다 — `git diff origin/main...HEAD --name-only | grep -v '^review/\|^plan/'`
결과가 24개 code/docs/dict 파일 + 7개 spec 파일로, 이후 라운드(`15_32_34`~`17_38_33`)는
`rerun-modal.tsx`/`executions.service.ts`/`ResponseExecution` JSDoc 등 **동일 파일 내부**의
품질(문서 서술 정확성·이름·판정 로직) fix 만 이어갔고 새 trigger 표면(신규 노드, 신규 backend
provider, 신규 docs 섹션 디렉토리, auth/expression-engine 변경, 신규 warning/error code)을
추가하지 않았다.

## 매칭된 trigger

1. **`run-debug-flow-change`** (실행·디버깅 흐름 변경, semantic) — backend
   `executions.service.ts`/`background-runs.service.ts`가 `Execution.inputData`를 마스킹 대상에
   편입(egress 마스킹 카브아웃 폐지)하고, frontend `rerun-modal.tsx`(Re-run 제출 차단)·
   `editor-toolbar.tsx`(Run 버튼 차단)·`dynamic-form-ui.tsx`(폼 프리필 차단)가 새 차단 UX를
   추가했다. 타겟: `codebase/frontend/src/content/docs/05-run-and-debug/`.
2. **`new-ui-string`** (신규 UI 문자열, semantic) — `editor-toolbar.tsx`의
   `t("editor.runWithInputMasked")`, `rerun-modal.tsx`의 `t("history.rerun.maskedInputBlocked")`
   두 신규 키. 타겟: `dict/{ko,en}/<section>.ts` 양쪽.

## 발견사항

없음 — 두 trigger 모두 같은 changeset 안에서 동반 갱신이 완결돼 있고, 이번 라운드에서 실측
재확인했다.

- **docs MDX (run-debug-flow-change 타겟)**: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `.en.mdx`, `running-a-workflow.mdx` + `.en.mdx` 4파일 모두 changeset에 포함. Re-run 버튼 비활성화(마커 남아있는 동안) · "원본 입력 그대로 사용" 우회 경로 · `Load from History` 차단 UX를 정확히 서술한다 (`run-results.en.mdx:124`, `run-results.mdx:134`, `running-a-workflow.en.mdx:21`, `running-a-workflow.mdx:32`).
- **i18n parity (new-ui-string 타겟)**: `dict/ko/history.ts` ↔ `dict/en/history.ts`의 `rerun.maskedInputBlocked` 키(둘 다 `rerun: { modal: {...}, useOriginalInput, maskedInputBlocked, ... }` 동일 중첩 경로에 위치, `Read`로 직접 대조 확인), `dict/ko/editor.ts` ↔ `dict/en/editor.ts`의 `runWithInputMasked` 키 양쪽 존재. 호출부 `t("editor.runWithInputMasked")`(`editor-toolbar.tsx`), `t("history.rerun.maskedInputBlocked")`(`rerun-modal.tsx`)와 dict 키 경로 일치 확인.
- **가드 테스트 실측**: `cd codebase/frontend && npx vitest run i18n docs` — 35 test files passed (3091 passed / 1 skipped), i18n parity 가드·docs 가드 전부 GREEN. 매트릭스 `new-ui-string`/`node-schema-change` 행의 `verify` 명령과 일치하는 실행.
- **후속 라운드 신규 UI 문자열 재확인**: `rerun-modal.tsx`의 `15_32_34`~`17_38_33` 라운드 편집(`splitMaskedParameters`, `isStructuredType`, `touchedKeys`, `blockedByMaskedInput` 등)은 전부 코드 주석/JSDoc이며 신규 사용자 노출 문자열은 추가하지 않았다 — 기존 `t("history.rerun.maskedInputBlocked")` 호출 1곳만 유지. `git diff origin/main...HEAD -- codebase/frontend/src/components/executions/rerun-modal.tsx` 전문 확인.
- **영역 무관 확인**: `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts`, 신규 `content/docs/<NN>-*/` 디렉토리, provider/integration 신규·변경 — 이번 252파일 diff(`git diff origin/main...HEAD --name-only`) 중 어느 것도 건드리지 않음을 재확인. 나머지 18개 매트릭스 행은 매칭 대상 파일 자체가 없어 해당 없음.

## 요약

매트릭스 20개 행 중 `run-debug-flow-change`·`new-ui-string` 2개가 매칭됐고, 두 trigger의 필수 동반 갱신(유저 가이드 MDX 4파일, i18n dict ko/en 2쌍)이 모두 같은 changeset 안에 완결돼 있음을 이전 라운드 판정에 더해 이번 라운드에서 `git diff` 전량 대조 + 가드 테스트 실행(GREEN)으로 재확인했다. 이후 라운드의 편집은 동일 파일 내부 로직/문서 품질 개선뿐이라 새 trigger 매칭이나 누락이 발생하지 않았다. 누락 0건.

## 위험도

NONE
