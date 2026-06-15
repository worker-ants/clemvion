# 신규 식별자 충돌 검토

검토 모드: `--impl-done`  
Scope: `spec/3-workflow-editor/3-execution.md`  
Diff base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`

---

## 발견사항

충돌 발견 없음. 도입된 모든 식별자가 기존 사용처와 의미·목적 면에서 충돌하지 않는다.

---

## 항목별 검토

### 1. 요구사항 ID

- `R-2.2` — `spec/3-workflow-editor/3-execution.md` §R-2.2 "테스트 데이터셋 저장 — 권한·소유 모델". 동일 ID가 `spec/3-workflow-editor/4-ai-assistant.md`에서도 `§2.2` 표기로 참조되나, 이는 AI Assistant 스펙 내 자체 §2.2 섹션이며 `R-2.2` 요구사항 ID와 다른 것이다. 요구사항 ID 충돌 없음.

### 2. 엔티티·타입명

| 신규 식별자 | 사용 파일 | 기존 충돌 여부 |
|---|---|---|
| `WorkflowTestDataset` (entity class) | `workflow-test-dataset.entity.ts`, `root-entities.ts`, `app.module.ts` | `spec/1-data-model.md §2.13.3` 에 이미 동일 명칭으로 정의됨 — 정합. 충돌 없음 |
| `TestDatasetVisibility` (enum) | backend entity, frontend `workflow-test-datasets.ts` | 코드베이스 전체 grep 결과 해당 파일 외 기존 사용처 없음. 충돌 없음 |
| `WorkflowTestDatasetDto` (response DTO) | `dto/responses/workflow-test-dataset-response.dto.ts` | 기존 DTO 중 동명 없음. 충돌 없음 |
| `CreateWorkflowTestDatasetDto` | `dto/create-workflow-test-dataset.dto.ts` | 기존 없음. 충돌 없음 |
| `UpdateWorkflowTestDatasetDto` | `dto/update-workflow-test-dataset.dto.ts` | 기존 없음. 충돌 없음 |
| `WorkflowTestDatasetsService` | `workflow-test-datasets.service.ts` | 기존 없음. 충돌 없음 |
| `WorkflowTestDatasetsController` | `workflow-test-datasets.controller.ts` | 기존 없음. 충돌 없음 |
| `WorkflowTestDatasetsModule` | `workflow-test-datasets.module.ts` | `app.module.ts` 에 신규 등록. 기존 충돌 없음 |
| `WorkflowTestDatasetData` (frontend interface) | `frontend/src/lib/api/workflow-test-datasets.ts` | 기존 없음. 충돌 없음 |
| `CreateTestDatasetBody` (frontend interface) | 동 파일 | 기존 없음. 충돌 없음 |
| `workflowTestDatasetsApi` (frontend API object) | 동 파일 | 기존 없음. 충돌 없음 |

### 3. API Endpoint

| Method | Path | 기존 충돌 여부 |
|---|---|---|
| `GET` | `/workflows/:workflowId/test-datasets` | `spec/3-workflow-editor/3-execution.md §9` 에 정의됨. 기존 컨트롤러에서 동일 경로 없음. 충돌 없음 |
| `POST` | `/workflows/:workflowId/test-datasets` | 동일. 충돌 없음 |
| `PATCH` | `/test-datasets/:id` | 기존 컨트롤러 grep 결과 사용처 없음. 충돌 없음 |
| `DELETE` | `/test-datasets/:id` | 동일. 충돌 없음 |
| `POST` | `/test-datasets/:id/clone` | 전체 백엔드 컨트롤러에 `/clone` 경로 기존 없음. 충돌 없음 |

### 4. 이벤트·메시지명

이 구현에서 webhook·queue·SSE 이벤트 이름을 신규 도입하지 않는다. 검토 항목 없음.

### 5. 환경변수·설정키

신규 ENV 변수나 config 키 도입 없음. 검토 항목 없음.

### 6. 파일 경로·모듈 구조

| 신규 경로 | 기존 컨벤션 적합성 |
|---|---|
| `codebase/backend/src/modules/workflow-test-datasets/` | 기존 `modules/<domain>/` 패턴 준수. 충돌 없음 |
| `codebase/backend/migrations/V097__workflow_test_dataset.sql` | V096 다음 순번. `V{n}__{desc}.sql` 컨벤션 준수. 충돌 없음 |
| `codebase/frontend/src/lib/api/workflow-test-datasets.ts` | 기존 `lib/api/<domain>.ts` 패턴 준수. 충돌 없음 |

### 7. i18n 키

신규 i18n 키(`datasets`, `datasetShared`, `datasetClone`, `datasetDelete`, `datasetListEmpty`, `datasetSaveAs`, `datasetSave`, `datasetNamePlaceholder`, `datasetShareWorkspace`, `datasetSaved`, `datasetSaveFailed`, `datasetCloned`, `datasetCloneFailed`, `datasetDeleted`, `datasetDeleteFailed`)는 모두 `editor` 네임스페이스에 추가되었으며, 영어·한국어 양쪽 dict에 일괄 적용됐다. 기존 `editor` 딕셔너리에 동명 키 없음. 충돌 없음.

### 8. React Query 키

`["editor-test-datasets", workflowId]` — 기존 코드베이스에서 이 쿼리 키를 사용하는 곳이 `editor-toolbar.tsx` 외에 없음. 충돌 없음.

### 9. 에러 코드

`DUPLICATE_NAME` — 기존 백엔드에서 사용 중이지 않다. `RESOURCE_NOT_FOUND`, `FORBIDDEN` 은 공통 HttpExceptionFilter가 범용적으로 생성하는 코드이며 신규 서비스도 동일 코드를 재사용 — 의미상 충돌 아님. 추가 주의 사항 없음.

---

## 요약

이번 구현(`workflow-test-datasets` 전체 모듈, V097 마이그레이션, 프론트엔드 API 클라이언트 및 에디터 UI 확장)이 도입한 모든 식별자는 spec/1-data-model.md 및 spec/3-workflow-editor/3-execution.md에 이미 정의된 명세와 일치하며, 기존 코드베이스 내 다른 맥락에서 동일 이름이 다른 의미로 사용되는 사례가 발견되지 않았다. API 경로, 엔티티명, DTO, 모듈명, i18n 키, 마이그레이션 버전 번호 모두 기존 컨벤션과 충돌 없이 도입되었다.

---

## 위험도

NONE
