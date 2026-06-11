# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 분석 개요

리뷰 대상 파일:
- `codebase/backend/src/nodes/data/code/code.handler.ts` (핸들러 리팩터링)
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (classifyError 단위 테스트 추가)
- `codebase/frontend/src/lib/i18n/backend-labels.ts` (CODE_ 에러 코드 ko 매핑 추가)

매트릭스 trigger 검사: `doc-sync-matrix.json` 18개 행 전수 + PROJECT.md §변경 유형 → 갱신 위치 매핑 보조 적재.

해당 commit set (HEAD~3..HEAD) 전체 변경 파일 중 매트릭스에 걸리는 경로:
- `codebase/backend/src/nodes/data/code/code.handler.ts` → `new-node` / `node-schema-change` / `new-error-code` trigger 후보
- `codebase/backend/src/nodes/core/error-codes.ts` → `new-error-code` trigger
- `codebase/frontend/src/lib/i18n/backend-labels.ts` → `new-error-code` target (동반 갱신 파일 자체)
- `codebase/frontend/src/content/docs/02-nodes/data.mdx` / `data.en.mdx` → `node-schema-change` target (동반 갱신 파일 자체)

---

## 발견사항

발견된 CRITICAL / WARNING 누락 없음.

아래는 각 trigger 별 매칭 결과이다.

### trigger: new-error-code (신규 errorCode 발행)

- **trigger 파일**: `codebase/backend/src/nodes/core/error-codes.ts` — `CODE_MEMORY_LIMIT` 신규 추가 (feat commit ccb5f38f)
- **매트릭스 항목**: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"
- **동반 갱신 상태**: 충족 — `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 에 `CODE_MEMORY_LIMIT`, `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED` 세 항목 모두 등록됨 (fix commit 74d312cf).
- **추가 확인**: feat commit 에서 `backend-labels.ts` 갱신이 누락됐으나 fix commit 에서 동일 commit set 안에서 복구됐으므로 merge 기준 누락 없음.

### trigger: node-schema-change (노드 schema 변경)

- **trigger 파일**: `codebase/backend/src/nodes/data/code/code.handler.ts` 변경
- **schema 상태**: `code.schema.ts` 에 변경 없음 (diff 없음). handler 리팩터링은 내부 classifyError 로직 + 모듈-레벨 regex 상수 재구성에 한정. schema 필드(code/language/timeout), warningRules, ui.label/hint/group 값 변경 없음.
- **결론**: schema 변경 없으므로 FieldTable / dict 동반 갱신 의무 없음. 해당 없음.

### trigger: new-node (새 노드 추가)

- **trigger 파일**: `codebase/backend/src/nodes/data/code/` — 신규 노드가 아니라 기존 Code 노드 리팩터링. 디렉터리 신설 없음.
- **결론**: 해당 없음.

### trigger: new-backend-ui-zod-value (신규 ui.label/hint 값)

- **schema 검토**: `Language`, `Code`, `Timeout (sec)` 레이블과 `"Use return to produce output. $input, $vars, $execution, $node, $helpers are injected."` hint 는 이번 변경 전부터 존재하는 기존 값이며, 모두 `backend-labels.ts` 의 `LABEL_KO` / `HINT_KO` 에 등록돼 있음 (각각 lines 88, 34/495, 149, 270).
- **결론**: 신규 zod ui 값 없음. 해당 없음.

### trigger: node-schema-change (docs MDX 동반 갱신)

- **변경 내용**: isolated-vm 전환으로 `CODE_MEMORY_LIMIT` 신규 에러 코드 발행 + 128MB 메모리 리밋 추가.
- **docs MDX 상태**: `codebase/frontend/src/content/docs/02-nodes/data.mdx` 및 `data.en.mdx` 양쪽 모두 feat commit(ccb5f38f)에서 동시 갱신됨 — KO/EN 각각 `CODE_MEMORY_LIMIT` FieldTable 행 + 128MB 메모리 한도 설명 추가 확인.
- **결론**: KO/EN parity 충족. 해당 없음.

### trigger: new-warning-code (warningRules 변경)

- **스키마 검토**: `warningRules` 변경 없음 (`code:no-code` 단일 룰 유지). `WARNING_KO` 매핑 의무 없음.
- **결론**: 해당 없음.

### 기타 trigger (run-debug-flow-change, expression-language-change, auth-session-flow-change, new-ui-string 등)

모두 해당 없음 — 이번 변경은 code 노드 격리 구현·테스트 내부에 한정되며 실행 엔진 흐름, 표현식 언어, 인증 흐름, TSX UI 문자열 어느 것도 변경되지 않았음.

---

## 요약

매트릭스 18개 trigger 전수 검사. 매칭된 trigger: `new-error-code` (CODE_MEMORY_LIMIT 신규 추가) 1개. 동반 갱신 누락 0건 — `ERROR_KO` 매핑 3개 (`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`)가 `backend-labels.ts` 에 등록됐고, `data.mdx` + `data.en.mdx` 양쪽에 CODE_MEMORY_LIMIT FieldTable 행이 추가됐으며, schema 필드/ui.label/warningRules 변경이 없어 추가 동반 갱신 의무가 없다. 유저 가이드 동반 갱신 관점에서 모든 필수 항목이 충족된 상태이다.

## 위험도

NONE
