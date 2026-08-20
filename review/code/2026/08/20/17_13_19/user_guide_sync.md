STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127행~) 을 Read 했다.

## 변경 파일 식별
변경 set (`82a967afb..HEAD`, `codebase/**` 23개 파일 + `CHANGELOG.md` + `plan/in-progress/*.md` 3개 + `spec/*.md` 7개, 나머지는 `review/code|consistency/**` 리뷰 산출물이라 매트릭스 검토 범위 밖)의 골자는 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마스킹 마커 감지 가드 추가.

## trigger 매칭
- **run-debug-flow-change** (실행·디버깅 흐름 변경, semantic) — `executions.service.ts` / `background-runs.service.ts` / DTO 들이 `Execution.inputData` 응답 마스킹 정책을 바꾸고, 프런트 Re-run 모달·에디터 "Run with Input" 툴바가 이를 감지해 실행을 막는 UX 를 새로 추가. target: `codebase/frontend/src/content/docs/05-run-and-debug/`.
- **new-ui-string** (신규 UI 문자열, semantic) — `editor-toolbar.tsx` 의 `t("editor.runWithInputMasked")`, `rerun-modal.tsx` 의 `t("history.rerun.maskedInputBlocked")` 신규 리터럴 키.
- **backend-api-change** (semantic) — `execution-response.dto.ts` / `background-run-response.dto.ts` 의 swagger jsdoc 설명 변경.

## 동반 갱신 확인 (누락 없음)
- 같은 커밋(`37da9b593`)에 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `.en.mdx` (Re-run 버튼 마스킹 동작 안내), `running-a-workflow.mdx` + `.en.mdx` (Load from History 마스킹 차단 안내) 4개가 함께 갱신됨 — run-debug-flow-change target 충족.
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` + `dict/en/editor.ts` 양쪽에 `runWithInputMasked` 등록, `dict/ko/history.ts` + `dict/en/history.ts` 양쪽에 `rerun.maskedInputBlocked` 등록 — ko/en parity 충족 (한쪽만 등록된 키 없음, `grep -rn runWithInputMasked` 로 실사용처와 대조 완료).
- 키 네임스페이스도 실제 호출부와 정확히 일치 — `t("editor.runWithInputMasked")` ↔ `dict/{ko,en}/editor.ts` 최상위, `t("history.rerun.maskedInputBlocked")` ↔ `dict/{ko,en}/history.ts` 의 `rerun.*` 객체.
- `execution-response.dto.ts` / `background-run-response.dto.ts` 의 `@ApiPropertyOptional description` 이 새 마스킹 정책을 반영하도록 갱신됨 — backend-api-change target(swagger jsdoc) 충족.
- 해당 없는 trigger: 새 노드 추가·노드 schema 변경(`codebase/backend/src/nodes/**` 미변경), 통합/제공자 변경, 신규 섹션 디렉토리(`content/docs/<NN>-*/` 신규 없음, 기존 `05-run-and-debug/` 내 편집), 인증·권한·세션 흐름(`modules/auth/**` 미변경), 표현식 언어(`packages/expression-engine/**` 미변경), 신규 warningCode/errorCode(`error-codes.ts`/warningRules 미변경) — 전부 이 changeset 과 무관.

## 요약
매트릭스 21개 행 중 이 changeset 에 매칭되는 행은 3개(run-debug-flow-change / new-ui-string / backend-api-change)이며, 세 행 모두 target 이 **같은 커밋 안에서** 동반 갱신돼 있어 누락이 0건이다. `docs/05-run-and-debug/` 4개 MDX(ko/en × 2 페이지), i18n dict ko/en 키 2개(parity 확인 완료), DTO swagger jsdoc 이 모두 코드 변경과 정합했다. 노드·통합·인증·표현식·warningCode 관련 trigger 는 이 changeset 범위 밖이라 매칭되지 않는다.

## 위험도
NONE
