# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

매트릭스 19개 행 전체를 변경 파일 집합에 대해 검토한 결과, 동반 갱신 누락은 감지되지 않았다.

### 매트릭스 매칭 결과

**`new-ui-string` (id: new-ui-string)** — `editor-toolbar.tsx` 에서 신규 i18n 키를 사용한다: `editor.datasets`, `editor.datasetSaved`, `editor.datasetSaveFailed`, `editor.datasetCloned`, `editor.datasetCloneFailed`, `editor.datasetDeleted`, `editor.datasetDeleteFailed`, `editor.datasetSaveAs`, `editor.datasetSave`, `editor.datasetNamePlaceholder`, `editor.datasetShareWorkspace`, `editor.datasetShared`, `editor.datasetClone`, `editor.datasetDelete`, `editor.datasetListEmpty`. 이 키 전체가 `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` 와 `codebase/frontend/src/lib/i18n/dict/en/editor.ts` 양쪽에 동일 커밋(`feat(execution): §2.2`) 에서 등록됐다. **i18n parity 충족.**

**`backend-api-change` (id: backend-api-change)** — `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` 신규 + DTO 5종 신규. 사용자 안내 영향이 있는 API 추가(Run with Input 데이터셋 저장·불러오기 흐름)에 해당한다. `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` 와 `.en.mdx` 양쪽에 "테스트 데이터셋" / "Test Datasets" 절이 동반 추가됐다(`fix(execution)` 커밋). **충족.**

**`run-debug-flow-change` (id: run-debug-flow-change)** — 신규 테스트 데이터셋 저장·불러오기·복제·삭제 API 와 프론트엔드 `editor-toolbar.tsx` UI 는 "실행·디버깅 흐름 변경"에 해당한다. `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` + `.en.mdx` 양쪽이 동반 갱신됐다. **충족.**

**비매칭 행 (14개):** `new-node`, `node-schema-change`, `integration-provider-change`, `new-userguide-section-dir`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found` — 변경 파일이 해당 trigger glob / 의미 범위에 해당하지 않는다.

추가 확인 사항: `workflow-test-datasets.service.ts` 가 `DUPLICATE_NAME`, `RESOURCE_NOT_FOUND`, `FORBIDDEN` 을 inline 문자열로 emit 하지만, 이 코드들은 중앙 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 을 경유하지 않으므로 `new-error-code` 매트릭스 행의 glob 트리거에 해당하지 않는다. 또한 `backend-labels.ts` 의 `ERROR_KO` 에 이 코드들이 없으나, 이 에러들은 HTTP 응답 JSON 에만 포함되고 프론트엔드가 `translateBackendError` 로 표시하는 execution-node 에러 코드 경로가 아닌 toast/modal 핸들링 경로이므로, 현재 매트릭스 기준에서는 필수 동반 갱신 대상이 아니다.

## 요약

매트릭스 19개 행 중 3개 트리거(`new-ui-string`, `backend-api-change`, `run-debug-flow-change`)가 이번 변경 파일 집합에 매칭됐으며, 해당 트리거의 동반 갱신 대상(i18n dict ko/en 양쪽 키 등록, `05-run-and-debug/running-a-workflow.mdx` + `.en.mdx` 갱신) 이 모두 같은 변경 세트 안에 포함돼 있다. 누락된 동반 갱신은 없다.

## 위험도

NONE
