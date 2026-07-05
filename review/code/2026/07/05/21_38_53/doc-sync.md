# User Guide Sync Review — orphan i18n key deletion (executions.tab*)

## 검토 대상 변경
`git diff origin/main...HEAD --stat`:
- `codebase/frontend/src/lib/i18n/dict/ko/executions.ts` — 4줄 삭제 (`tabPreview/tabInput/tabOutput/tabError`)
- `codebase/frontend/src/lib/i18n/dict/en/executions.ts` — 동일 4키 삭제 (ko/en 대칭)
- `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — 해당 항목 체크박스 `[ ]` → `[x]` + 완료 서술 갱신 (plan 문서, 매트릭스 trigger 아님)

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` 의 `rows[]` 21개 항목을 Read. 이 변경에 가장 근접한 후보는:
- `new-ui-string` (id) — "신규 UI 문자열 (TSX)" → dict `{ko,en}` 양쪽 parity. 이번 변경은 **신규 추가가 아니라 삭제**이며, TSX 쪽 변경도 없음(사전 V-05 리팩터에서 이미 참조 제거 완료, 본 diff 는 dict 파일만).
- `node-schema-change` / `new-node` — 노드 스키마 무관 (executions 페이지 UI 라벨, 노드 정의 아님). 매칭 안 됨.
- 나머지 행(통합/제공자, 신규 섹션 디렉토리, auth, expression-language, run-debug-flow-change 등) — trigger glob/semantic 조건에 해당 안 됨. `run-debug-flow-change` (`05-run-and-debug/` 갱신 대상)는 "실행·디버깅 흐름 변경"을 트리거로 하는데, 본 변경은 흐름 변경이 아니라 **이미 죽은 dict 키 정리**(V-05 시점에 실질적 UI/흐름 변경은 끝났고 그 결과 정합화 커밋).

PROJECT.md §변경 유형 → 갱신 위치 매핑 prose 도 동일 SoT(JSON 과 1:1 로 test_doc_sync_matrix.py 가 검증) — 삭제 전용 orphan 키 정리에 대한 별도 행은 없음. 가장 근접한 "신규 UI 문자열" 행은 명시적으로 *신규 추가* parity 를 다루며, 방향이 반대인 삭제에는 (좁게 해석하면) 적용되지 않으나 넓게 해석해도 이번 변경은 이미 parity 를 유지한 채(ko/en 양쪽 동시 삭제) 이뤄졌으므로 위반 없음.

## 코드 참조 검증
```
grep -rn "tabPreview\|tabInput\|tabOutput\|tabError" codebase/frontend/src --include="*.ts" --include="*.tsx" | grep -v "/dict/"
```
→ 매치는 전부 `editor.runResults.tab*` (result-detail.tsx) 뿐, `executions.tab*` 참조 0건. 삭제된 키는 실제로 dead code 였음을 재확인 (plan 서술과 일치).

## 유저 가이드 doc 참조 검증
`codebase/frontend/src/content/docs/**` 전체에서 `tabPreview/tabInput/tabOutput/tabError` 리터럴 키 이름 또는 `executions.tab` 문자열 매치 0건.

`05-run-and-debug/run-results.mdx` / `.en.mdx` 는 "Preview/Input/Output/Error" 탭을 **개념적으로** 서술하지만(FieldTable 등), 이는 이미 V-05 리팩터 이후의 통합 `ResultDetail` 컴포넌트가 소비하는 `editor.runResults.tab*` 키를 가리키는 서술이며, 삭제된 `executions.tab*` 와는 무관. 두 네임스페이스의 값(ko: 미리보기/입력/출력/오류, en: Preview/Input/Output/Error)이 동일하므로 어차피 표시 문자열은 변경 없음 — 문서 내용은 삭제 전후 모두 정확.

```
codebase/frontend/src/lib/i18n/dict/en/editor.ts:246: tabPreview: "Preview"
codebase/frontend/src/lib/i18n/dict/en/editor.ts:257: tabError: "Error"
codebase/frontend/src/lib/i18n/dict/ko/editor.ts:245: tabPreview: "미리보기"
codebase/frontend/src/lib/i18n/dict/ko/editor.ts:256: tabError: "오류"
```

## 가드 테스트 실행
`cd codebase/frontend && npm test -- i18n` → **9 test files, 79 passed | 1 skipped**. i18n parity/key-usage 가드(`i18n.test.ts`) 통과, 삭제로 인한 orphan-key 참조 깨짐이나 ko/en 비대칭 없음.

## 결론
이 변경은 매트릭스의 어떤 trigger 행에도 실질적으로 매칭되지 않는다 — 이미 dead 였던 i18n 키를 ko/en 대칭으로 제거하는 정리성 변경이며, 코드·문서 어디에도 residual 참조가 없다. 유저 가이드(`05-run-and-debug/run-results.mdx` 등)는 살아있는 `editor.runResults.tab*` 키를 서술 중이라 이번 삭제로 stale 해지지 않는다. 동반 갱신 누락 없음.

## 발견사항
없음 (해당 없음).

## 요약
매트릭스 21개 trigger 행 검토 결과 이번 변경(orphan i18n 키 4개 ko/en 대칭 삭제)에 매칭되는 필수 동반 갱신 행 없음 — 코드 참조 0건·문서 참조 0건·i18n 가드 79 테스트 통과로 실질 검증 완료. 누락 0건.

## 위험도
NONE
