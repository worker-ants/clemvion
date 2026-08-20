STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows[] 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
본문을 SoT 로 적재. orchestrator 가 제공한 프롬프트의 변경 file 목록(요약 40+파일, 일부 diff
생략)을 `git diff origin/main...HEAD --name-only` (78파일 전량)으로 보강해 대조했다.

## 매칭된 trigger

이번 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드)은
매트릭스 20개 행 중 2개에 매칭된다.

1. **`run-debug-flow-change`** (실행·디버깅 흐름 변경, semantic) — backend
   `executions.service.ts`/`background-runs.service.ts` 가 `Execution.inputData` 를 마스킹 대상에
   편입하고, frontend `rerun-modal.tsx`(제출 차단)·`editor-toolbar.tsx`(Run 차단)가 새 차단 UX 를
   추가했다. 타겟: `codebase/frontend/src/content/docs/05-run-and-debug/`.
2. **`new-ui-string`** (신규 UI 문자열, semantic) — `editor-toolbar.tsx` 의
   `t("editor.runWithInputMasked")`, `rerun-modal.tsx` 의 `t("history.rerun.maskedInputBlocked")`
   두 신규 키. 타겟: `dict/{ko,en}/<section>.ts` 양쪽.

## 발견사항

없음 — 두 trigger 모두 같은 changeset 안에서 동반 갱신이 완결돼 있다.

- **docs MDX (run-debug-flow-change 타겟)**: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `.en.mdx`, `running-a-workflow.mdx` + `.en.mdx` 4파일 모두 이번 changeset 에 포함돼 있고, Re-run 버튼 비활성화(마커 남아있는 동안)·"원본 입력 그대로 사용" 우회 경로·`Load from History` 차단 UX 를 정확히 서술한다. `run-results.en.mdx:124`, `run-results.mdx:134`, `running-a-workflow.en.mdx:21`, `running-a-workflow.mdx:32` 가 각각 신규 동작을 반영. 노드 레벨 Input/Output/Error 마스킹(`***`) 서술도 기존에 이미 있어 이번 정책 변경(Execution 레벨도 동일 규칙)과 모순 없이 정합.
- **i18n parity (new-ui-string 타겟)**: `codebase/frontend/src/lib/i18n/dict/ko/editor.ts`(`runWithInputMasked`) ↔ `dict/en/editor.ts`(동일 키) 양쪽 존재. `dict/ko/history.ts`(`maskedInputBlocked`) ↔ `dict/en/history.ts`(동일 키) 양쪽 존재. 호출부 `t("editor.runWithInputMasked")`(editor-toolbar.tsx), `t("history.rerun.maskedInputBlocked")`(rerun-modal.tsx) 와 dict 키 경로가 정확히 일치함을 확인.
- **영역 무관 확인**: `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts`, 신규 `content/docs/<NN>-*/` 디렉토리, provider/integration 신규·변경 — 이번 78파일 diff 중 어느 것도 건드리지 않음을 `git diff --name-only` + grep 으로 실측 확인. 나머지 18개 매트릭스 행은 매칭 대상 파일 자체가 없어 해당 없음.

## 요약

매트릭스 20개 행 중 `run-debug-flow-change`·`new-ui-string` 2개가 매칭됐고, 두 trigger 의 필수 동반 갱신(유저 가이드 MDX 4파일, i18n dict ko/en 2쌍)이 모두 같은 changeset 안에 이미 포함돼 정합하다. 누락 0건.

## 위험도

NONE
