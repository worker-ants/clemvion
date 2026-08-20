STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 검토 방법

`.claude/config/doc-sync-matrix.json` (`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
본문(§자주 누락되는 항목)을 SSOT 로 적재. 변경 파일은 `git diff origin/main...HEAD --stat`
(merge-base `82a967af`, 165 files, 실제 코드/문서 변경분은 그중 약 27개 — 나머지는
`review/**` 감사 산출물)로 prompt 목록을 실측 대조했다. 이 changeset 은 같은 작업에 대해
이미 5라운드(`14_08_45`→`15_59_17`) code-review + 6라운드 consistency-check 를 거친 뒤의
최종 diff이며, 직전 두 라운드(`15_10_25`, `15_59_17`)의 user_guide_sync 리뷰가 이미 동일
결론(누락 0건, NONE)을 냈다. 본 라운드는 그 이후 커밋(`38b4669bd` 라운드4, `e1607c737`
라운드5)이 새 trigger 를 추가했는지를 독립적으로 재검증했다.

## 매칭된 trigger

1. **`run-debug-flow-change`** (실행·디버깅 흐름 변경, semantic) — backend
   `executions.service.ts`/`background-runs.service.ts` 가 `Execution.inputData` 를 값-마스킹
   대상에 편입하고, frontend `rerun-modal.tsx`(Re-run 차단)·`editor-toolbar.tsx`(Run 차단)가
   신규 사용자 가시 차단 UX 를 추가했다. 타겟: `codebase/frontend/src/content/docs/05-run-and-debug/`.
2. **`new-ui-string`** (신규 UI 문자열, semantic) — `editor-toolbar.tsx` 의
   `t("editor.runWithInputMasked")`, `rerun-modal.tsx` 의 `t("history.rerun.maskedInputBlocked")`
   두 신규 키(`git show e1607c737 -- rerun-modal.tsx` 로 라운드4/5 diff 도 재확인 — 이후 추가된
   변경은 순수 리팩터(`isStructuredType` 추출)뿐이고 신규 문자열 없음). 타겟:
   `dict/{ko,en}/<section>.ts` 양쪽.
3. **`backend-api-change`** (`**/dto/**`, semantic) — `execution-response.dto.ts`,
   `background-run-response.dto.ts` 의 `@ApiPropertyOptional description` 변경. 타겟: swagger
   jsdoc + 관련 user-guide.

## 발견사항

없음 — 매칭된 3개 trigger 모두 같은 changeset 안에서 동반 갱신이 완결돼 있다.

- **docs MDX (`run-debug-flow-change` 타겟)**: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`+`.en.mdx`, `running-a-workflow.mdx`+`.en.mdx` 4파일 모두 이번 changeset 에 포함. Re-run 버튼 마스킹·차단·"원본 입력 그대로 사용" 우회 경로, `Load from History` 마스킹 차단 UX 를 정확히 서술(`run-results.mdx:134`, `run-results.en.mdx:124`, `running-a-workflow.mdx:32`, `running-a-workflow.en.mdx:21`).
- **i18n parity (`new-ui-string` 타겟)**: `dict/ko/editor.ts:62-63` ↔ `dict/en/editor.ts:64-65` (`runWithInputMasked`), `dict/ko/history.ts:12-13` ↔ `dict/en/history.ts:14-15` (`maskedInputBlocked`) 양쪽 존재. 호출부 키 경로와 정확히 일치. `Dict["editor"]`/`Dict["history"]` 타입 단언으로 구조 동기도 컴파일타임 강제.
- **swagger jsdoc (`backend-api-change` 타겟)**: `execution-response.dto.ts`(`ExecutionDto.inputData`, `NodeExecutionSummaryDto.inputData`), `background-run-response.dto.ts` 의 `description` 이 "두 레벨 모두 마스킹 대상" 최신 정책으로 갱신됨. 관련 user-guide 는 위 `run-debug-flow-change` 항목과 동일 파일로 커버.
- **라운드4/5 추가분 재검증**: `38b4669bd`(object/array coerce-failure 세 번째 차단 조건 추가), `e1607c737`(`isStructuredType` 공용화 + ingestion 마커 보존 캐너리 보강)는 둘 다 backend/컴포넌트 내부 로직·JSDoc·spec/plan/CHANGELOG 갱신뿐이며 신규 UI 문자열·신규 노드·auth·expression-engine·warning/error 코드·신규 docs 섹션 디렉토리를 도입하지 않는다. `git diff origin/main...HEAD` 에 `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts`, `content/docs/<NN>-*/` 신규 디렉토리 — 전부 매치 0건 (grep/`git diff --stat` 실측).
- **i18n 자주 누락 패턴** (PROJECT.md §자주 누락되는 항목): backend warning/error 코드 신규 발행 없음(`sanitize-error-message.ts` 변경은 JSDoc 텍스트뿐, `ErrorCode` enum·`SECRET_LEAK_PATTERNS` 값 자체는 무변경) → `backend-labels.ts` 갱신 불요 확인.

## 요약

매트릭스 21행 중 `run-debug-flow-change`·`new-ui-string`·`backend-api-change` 3행이 매칭되고, 셋 모두 필수 동반 갱신(유저 가이드 MDX 4파일, i18n dict ko/en 2쌍, DTO swagger jsdoc)이 같은 changeset 에 이미 포함돼 정합하다. 직전 두 라운드가 이미 도달한 결론과 동일하며, 그 이후 라운드4·5 커밋도 신규 trigger 를 만들지 않았음을 독립 재검증했다. 누락 0건.

## 위험도

NONE
