STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[WARNING]** `Execution.inputData` 마스킹 카브아웃 폐지로 생긴 새 "Run/Re-run 차단" UX 가 `05-run-and-debug/` 유저 가이드에 반영되지 않음
  - 변경 파일:
    - `codebase/backend/src/modules/executions/executions.service.ts` (`Execution.inputData` 를 이제 egress 마스킹, 재제출 카브아웃 폐지)
    - `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`, `dto/background-run-response.dto.ts`
    - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `jsonError` 계산에 `hasMaskedMarkerLeaf(parsed)` 추가, 마커 잔존 시 `t("editor.runWithInputMasked")` 로 Run 버튼 비활성 (line 118 부근, `if (hasMaskedMarkerLeaf(parsed)) return t("editor.runWithInputMasked");`)
    - `codebase/frontend/src/components/executions/rerun-modal.tsx` — `splitMaskedParameters` 신설, `blockedByMaskedInput` 로 Re-run 버튼 비활성 + `role="alert"` 안내(`t("history.rerun.maskedInputBlocked")`)
  - 매트릭스 항목: `run-debug-flow-change` (id, `.claude/config/doc-sync-matrix.json`) / PROJECT.md 표 "실행·디버깅 흐름 변경" 행 — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"` (`trigger.match: "semantic"`, backend 실행 엔진·응답 마스킹 정책 변경 + 그 정책을 소비하는 프런트 실행 표면 변경이므로 의미 매칭)
  - 누락된 동반 갱신:
    - `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` + `.en.mdx` — "Run with Input 다이얼로그" §"`Load from History` 드롭다운으로 이전 실행의 입력 데이터를 불러올 수 있어요" 스텝이 새 차단 동작(마스킹 마커가 남아 있으면 Run 비활성)을 언급하지 않음
    - `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `.en.mdx` — "Re-run 버튼을 눌러 해당 실행의 입력값으로 새 실행을 시작할 수 있어요" 스텝이 새 차단 동작(마커 필드 프리필 스킵 + 비어 있는 동안 제출 차단)을 언급하지 않음
  - 상세: 이 PR 은 `Execution.inputData` 의 egress 마스킹 카브아웃을 폐지하면서(재제출 소비처 3곳 전부 마커 가드 신설), **동일 changeset 안에서 spec SoT 는 정확히 갱신했다** — `spec/3-workflow-editor/3-execution.md:91` 의 "히스토리 로드" 행이 "적재된 JSON 에 마스킹 마커(`***` 등)가 남아 있으면 Run 이 비활성된다" 로 갱신됨. 그런데 이 spec 행이 미러하는 **유저 가이드 페이지**(`running-a-workflow.mdx` 의 "Run with Input" 섹션, `run-results.mdx` 의 "Re-run" 섹션)는 그대로다. 사용자 입장에서는 이전 실행 히스토리를 불러와 Re-run/Run with Input 을 눌렀을 때 처음 보는 "가려진 자격증명 값(`***`)이 남아 있어요" 경고와 비활성 버튼을 마주치는데, 가이드 어디에도 이 동작이 설명돼 있지 않다. PROJECT.md §"자주 누락되는 항목" 이 지목하는 "spec 은 고쳤는데 user-guide MDX 는 안 고친" 패턴과 정확히 같은 형태다.
  - 제안: `running-a-workflow.mdx`/`.en.mdx` 의 "Run with Input 다이얼로그" `Load from History` 스텝에 "적재된 JSON 에 마스킹 마커가 남아 있으면 Run 이 비활성되고, 실제 값으로 바꿔야 실행할 수 있다" 는 caveat 를 추가하고, `run-results.mdx`/`.en.mdx` 의 Re-run 설명에 "자격증명으로 판별된 값은 프리필되지 않으며(빈 칸으로 표시), 채우기 전까지 Re-run 버튼이 비활성된다(단, '원본 입력 그대로 사용' 토글은 예외)" 를 추가한다.

## i18n / backend-labels 점검 (참고, 발견사항 아님)

- 신규 UI 문자열 `editor.runWithInputMasked` (`dict/ko/editor.ts` + `dict/en/editor.ts`), `history.rerun.maskedInputBlocked` (`dict/ko/history.ts` + `dict/en/history.ts`) 는 **ko/en 양쪽 동일 commit 에 등록**돼 parity 위반 없음 — CRITICAL 없음.
- 신규/변경 warningCode·errorCode 발행 없음 → `backend-labels.ts` `WARNING_KO`/`ERROR_KO` 매핑 갱신 대상 없음.
- 신규 노드·신규 통합 provider·신규 유저 가이드 섹션 디렉토리·인증/세션 흐름 변경 없음 → 해당 trigger 들은 매칭되지 않음(NONE).
- `execution-response.dto.ts`/`background-run-response.dto.ts` 의 swagger jsdoc 은 이번 diff 안에서 이미 갱신됨 — "백엔드 API 추가·변경" 행의 (a) swagger 요구는 충족.

## 요약

매트릭스 24개 행 중 이번 변경 set 은 `new-ui-string`(충족, 문제 없음)과 `run-debug-flow-change`(semantic, 미충족) 2개 행에 매칭됐다. i18n parity·backend-labels·locale 등록 등 CRITICAL 유발 축은 전부 정상이었고, 유일한 누락은 `Execution.inputData` 마스킹 정책 전환이 만든 새 "Run/Re-run 차단" UX 가 `05-run-and-debug/running-a-workflow.mdx`·`run-results.mdx` (ko/en 4파일)에 반영되지 않은 것 — spec(`3-execution.md`)은 같은 PR 에서 정확히 갱신됐으므로 이는 spec→user-guide 미러링만 빠진 전형적 사후 보정 패턴이다.

## 위험도

MEDIUM
