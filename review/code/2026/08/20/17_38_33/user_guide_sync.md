STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows[] 20개, id 기준) + `PROJECT.md` §변경 유형 → 갱신
위치 매핑 본문을 SoT 로 적재. prompt 가 나열한 변경 file 목록(165개, 대부분은 이 브랜치가
누적 커밋해 온 `review/code/**`·`review/consistency/**` 세션 산출물)을
`git diff origin/main...HEAD --stat -- . ':!review/**'` (실 코드/문서 34개 파일)로 보강해
대조했다. 이 34개 파일은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처
3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 가드를 추가한다는 단일 결정의 산물이다.

## 매칭된 trigger

1. **`new-ui-string`** (semantic) — `editor-toolbar.tsx`(`t("editor.runWithInputMasked")`,
   `hasMaskedMarkerLeaf` 가드) · `rerun-modal.tsx`(`t("history.rerun.maskedInputBlocked")`)
   두 신규 키.
2. **`run-debug-flow-change`** (semantic) — 위 정책 변경이 Re-run/재실행 UX(비활성화·마커
   차단)를 실제로 바꾸므로 `05-run-and-debug/` 가 타겟.
3. **`backend-api-change`** (semantic) — `execution-response.dto.ts`,
   `background-run-response.dto.ts` 의 swagger `description` 이 새 마스킹 정책 대상.

`new-node`·`node-schema-change`·`integration-provider-change`·`new-userguide-section-dir`·
`auth-session-flow-change`·`expression-language-change`·`new-warning-code`·`new-error-code` 등
나머지 행은 매칭 대상 파일 자체가 이번 diff(34개)에 없다 —
`codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`,
`codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`,
`codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts`,
신규 `content/docs/<NN>-*/` 디렉토리 전무를 `git diff --stat` 로 실측 확인.

## 발견사항

없음 — 매칭된 3개 trigger 모두 같은 changeset 안에서 동반 갱신이 완결돼 있다.

- **docs MDX (`run-debug-flow-change` 타겟)**: `codebase/frontend/src/content/docs/05-run-and-debug/{run-results,running-a-workflow}.{mdx,en.mdx}` 4파일 전부 이번 diff 에 포함. `run-results.mdx`/`.en.mdx` 는 Re-run 버튼 설명에 "자격증명으로 판별된 입력은 마스킹돼 프리필되지 않고, 직접 입력하거나 원본 입력 그대로 사용을 켜야 한다"를, `running-a-workflow.mdx`/`.en.mdx` 는 `Load from History` 스텝에 "마스킹된 값이 남아 있으면 Run 이 비활성"을 ko/en 대칭으로 반영한다.
- **i18n parity (`new-ui-string` 타겟)**: `dict/ko/editor.ts`↔`dict/en/editor.ts` 에 `runWithInputMasked` 양쪽 존재, `dict/ko/history.ts`↔`dict/en/history.ts` 에 `rerun.maskedInputBlocked` 양쪽 존재. `grep -rn` 으로 호출부(`editor-toolbar.tsx:117` `t("editor.runWithInputMasked")`, `rerun-modal.tsx:543` `t("history.rerun.maskedInputBlocked")`) 와 dict 키 경로가 정확히 일치함을 확인. 변경된 3개 TSX/TS 파일(`rerun-modal.tsx`, `editor-toolbar.tsx`, `masked-markers.ts`)의 추가(`+`) 라인을 Python 정규식(`[가-힣]`)으로 전수 스캔해 주석이 아닌 하드코딩 한국어 리터럴이 없음을 재확인 — 신규 문자열은 전부 `t()` 경유.
- **swagger jsdoc (`backend-api-change` 타겟)**: `execution-response.dto.ts`(`ExecutionDto.inputData`, `NodeExecutionSummaryDto.inputData`), `background-run-response.dto.ts`(`BackgroundRunNodeExecutionDto.inputData`) 의 `@ApiPropertyOptional description` 이 "값-패턴 마스킹 대상이다(2026-08-20~)" 로 갱신돼 새 정책과 일치. 사용자 안내 영향분은 위 05-run-and-debug MDX 갱신으로 충족.
- **영역 무관 확인**: `codebase/backend/src/nodes/**`, `auth/**`, `expression-engine/**`, `error-codes.ts`, `backend-labels.ts`, `locale.ts`, 신규 `content/docs/<NN>-*/` — 이번 34파일 diff 중 어느 것도 건드리지 않음.

이 결론은 같은 브랜치의 선행 라운드(`review/code/2026/08/20/15_10_25/user_guide_sync.md`,
`15_32_34/user_guide_sync.md`)가 이미 NONE 으로 도달한 것과 일치하며, 그 이후 라운드
(`15_59_17`·`16_25_35`·`16_51_19`)의 RESOLUTION 을 확인한 결과 backend 테스트 단언 보강·
CHANGELOG/JSDoc 주제문 정정만 있었고 신규 UI 문자열·신규 docs 경로·신규 node/warning/error
code 는 추가되지 않아 이번 최종 changeset(`origin/main...HEAD`, 34파일)에 대해서도 결론이
그대로 유지된다.

## 요약

매트릭스 20개 행(JSON `rows[]`) 중 `new-ui-string`·`run-debug-flow-change`·`backend-api-change`
3개가 매칭됐고, 세 trigger 의 필수 동반 갱신(유저 가이드 MDX 4파일 ko/en, i18n dict ko/en
신규 키 2쌍, DTO swagger jsdoc)이 모두 같은 changeset 안에 포함돼 정합하다. 누락 0건.

## 위험도

NONE
