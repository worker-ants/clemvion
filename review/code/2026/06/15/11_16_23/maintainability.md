# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] `findAccessible` 의 boolean 파라미터 플래그 — 함수 시그니처 의도 모호
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1813–1847
- 상세: `findAccessible(id, workspaceId, userId, requireOwner: boolean)` 의 마지막 인자가 `true`/`false` 로 호출되면 호출부(`findAccessible(id, ws, uid, true)`, `findAccessible(id, ws, uid, false)`)에서 의도를 즉시 파악하기 어렵다. 이는 "boolean trap" 안티패턴으로, 읽는 사람이 함수 정의를 찾아봐야만 의미를 알 수 있다.
- 제안: `requireOwner` 대신 유니온 타입 `'owner' | 'accessible'` 파라미터나 두 개의 분리된 private 메서드(`findForOwner`, `findForReadAccess`)로 교체한다.

### [WARNING] `editor-toolbar.tsx` 에 로컬 상태 변수가 6개 추가 — 컴포넌트 책임 비대화
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L81 영역 (`datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset`, `datasetsQuery`, `refreshDatasets`, `handleLoadDataset`, `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset`)
- 상세: 기존 `EditorToolbar`에 데이터셋 관련 상태 5개와 이벤트 핸들러 4개가 추가되었다. 해당 컴포넌트는 이미 실행·히스토리·삭제 확인 등 복수의 책임을 가지고 있었으며, 이번 변경으로 단일 컴포넌트의 cyclomatic complexity 및 상태 관리 책임이 더 커졌다. 별도 `DatasetPanel` 컴포넌트나 커스텀 훅(`useDatasetPanel`)으로 분리하면 테스트·재사용·독립 변경이 쉬워진다.
- 제안: 데이터셋 관련 상태(`datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset`)와 핸들러(`handleLoadDataset`, `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset`)를 `useDatasetPanel(workflowId)` 커스텀 훅으로 추출한다.

### [WARNING] `copyName` 에 하드코딩된 suffix 문자열 ` (Copy)` 와 매직 넘버 255
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1914–1918
- 상세: `' (Copy)'` 와 `255`가 서비스 내부에 하드코딩되어 있다. `255`는 `name` 컬럼의 `VARCHAR(255)` 제약(`MaxLength(255)` DTO, 마이그레이션 SQL)과 동일한 값인데 세 곳에 분산되어 있어 한 곳을 바꾸면 다른 곳을 놓칠 위험이 있다.
- 제안: `DATASET_NAME_MAX_LENGTH = 255` 상수와 `CLONE_SUFFIX = ' (Copy)'`를 모듈 상단이나 엔티티 파일에 선언하고 DTO `MaxLength`, 서비스 `copyName`, 마이그레이션 주석에서 참조한다.

### [INFO] `workflow-test-datasets.service.ts` 에 `typeorm` 이중 import
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1701–1703
- 상세: `Repository`는 `'typeorm'`에서, `QueryFailedError`도 `'typeorm'`에서 각각 별도 `import` 문으로 가져온다. 두 문을 하나로 합치면 더 간결하다.
- 제안: `import { Repository, QueryFailedError } from 'typeorm';` 으로 통합한다.

### [INFO] `WorkflowTestDatasetDto` 클래스 이름과 파일명의 접두 불일치
- 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts`
- 상세: 파일명이 `workflow-test-dataset-response.dto.ts`인데 클래스명은 `WorkflowTestDatasetDto`(Response 없음)다. 다른 응답 DTO(예: `workflow-assistant` 등)의 명명 패턴을 보면 `XxxResponseDto` 또는 `XxxDto`가 혼재하나, 파일명에 `response`를 붙였으면 클래스명에도 `ResponseDto` suffix를 붙이는 것이 일관성상 낫다. 다만 강제 규약이 확인되지 않으므로 INFO로 분류한다.
- 제안: `WorkflowTestDatasetResponseDto`로 이름을 맞추거나, 파일명에서 `-response`를 제거하여 둘 중 하나로 통일한다.

### [INFO] `e2e` 테스트 내 `create` 헬퍼 함수가 클로저로 `workflowId`를 캡처 — 타 워크플로우 테스트 확장 시 재사용 어려움
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` L2128–2137
- 상세: `create` 헬퍼가 외부 `workflowId` 변수를 암묵적으로 클로저로 캡처한다. 테스트가 단일 워크플로우만 다루는 현 상황에서는 문제없으나, 타 워크플로우가 필요한 케이스(예: cross-workflow 격리 테스트)를 추가할 때 헬퍼를 재사용할 수 없어 중복 코드가 생길 수 있다.
- 제안: `create(token, body, ws?, wfId?)` 처럼 `workflowId`를 선택 파라미터로 명시적으로 받도록 수정한다(기본값은 현재처럼 외부 변수).

### [INFO] `UpdateWorkflowTestDatasetDto` 의 update body 타입이 `Partial<CreateTestDatasetBody>` 재활용 — 프론트 API 클라이언트와 백엔드 DTO 비대칭
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` L2293–2298
- 상세: 프론트엔드 `update` 메서드의 body 타입이 `Partial<CreateTestDatasetBody>`를 재사용한다. `CreateTestDatasetBody`에는 `input`이 `required`이지만 `Partial`이라 사실상 optional이 된다. 백엔드 `UpdateWorkflowTestDatasetDto`는 독립적으로 정의된 반면 프론트는 Create DTO 를 그대로 활용한다. 타입이 괴리되면 IDE 자동완성이 오해를 유발할 수 있다.
- 제안: `UpdateTestDatasetBody` 인터페이스를 별도로 선언하여 의도를 명시한다.

### [INFO] 프론트엔드 `editor-toolbar.tsx` 에서 `Cancel` 버튼의 초기화 로직 중복
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 변경 후 Cancel 버튼 onClick 핸들러
- 상세: Cancel 버튼 onClick 에서 `setRunWithInputOpen(false)`, `setHistoryPickerOpen(false)`, `setDatasetPickerOpen(false)`, `setSaveFormOpen(false)`, `setDatasetName("")`, `setShareWorkspace(false)`, `setJsonInput("{}")` 를 나열한다. 이 초기화 로직이 한 곳에 집중되어 있어 나쁘지 않으나, 향후 상태가 추가될 때마다 이 목록도 수동으로 갱신해야 한다. 커스텀 훅 추출 제안(위 WARNING)이 적용되면 자연스럽게 해소된다.
- 제안: `useDatasetPanel` 훅의 `reset()` 함수를 노출하거나, 상태를 하나의 객체로 합쳐 `setRunWithInputState(initialState)` 형태로 초기화한다.

---

## 요약

전체적으로 이번 변경은 새로운 모듈(`workflow-test-datasets`)을 NestJS 표준 구조(Entity / DTO / Service / Controller / Module)에 따라 깔끔하게 분리했고, SQL 마이그레이션 주석·엔티티 JSDoc·Rationale이 잘 갖춰져 있어 의도 파악이 쉽다. 네이밍·인덱스 설계·에러 코드 패턴도 기존 코드베이스 컨벤션을 충실히 따른다. 다만 두 가지 유지보수성 경고가 존재한다: (1) `findAccessible`의 boolean 플래그는 호출부 가독성을 떨어뜨리는 "boolean trap"이며, (2) `EditorToolbar` 컴포넌트에 데이터셋 관련 상태와 핸들러가 추가되어 컴포넌트 책임이 비대해졌다. 두 항목 모두 즉시 버그를 유발하지는 않지만 장기 유지보수 비용을 높인다. 매직 넘버·이중 import·타입 재활용 문제는 낮은 위험도의 INFO 수준이다.

---

## 위험도

LOW
