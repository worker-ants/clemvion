# 유지보수성(Maintainability) Review

## 발견사항

### [INFO] service.ts: `Repository` 와 `QueryFailedError` 를 같은 typeorm 에서 두 줄로 분리 import
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` 라인 7-8
- 상세: `import { Repository } from 'typeorm';` 와 `import { QueryFailedError } from 'typeorm';` 가 별도 라인으로 선언되어 있다. 같은 모듈에서 나온 import 는 하나의 구문으로 묶는 것이 이 codebase 의 일반적 컨벤션이며, 이 파일 자체의 다른 import 방식(NestJS 여러 심볼을 한 줄로 묶음)과도 불일치한다.
- 제안: `import { Repository, QueryFailedError } from 'typeorm';` 로 병합.

### [INFO] service.ts: `findAccessible` 의 `requireOwner: boolean` 파라미터 — 의도 모호성
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` `findAccessible` 메서드
- 상세: `requireOwner` 라는 boolean flag 가 내부적으로 두 가지 완전히 다른 접근 검사 경로를 제어한다. `true` 는 "소유자 아니면 403", `false` 는 "비소유 + 비공개 이면 404(존재 은닉)". 이 이중 역할은 메서드 이름과 파라미터 이름만으로는 파악하기 어렵다. 현재 주석이 이를 보완하고 있어 크리티컬하지는 않으나, 향후 세 번째 접근 모드가 추가될 경우 boolean 을 enum 으로 교체해야 하는 시점이 올 수 있다.
- 제안: 현 규모에서는 주석이 충분하지만, 장기적으로 `AccessMode = 'owner-only' | 'readable'` 같은 enum/string literal 타입으로 교체하면 의도가 더 명확해진다.

### [WARNING] editor-toolbar.tsx: 단일 컴포넌트에 데이터셋 + 히스토리 + 실행 상태 + 폼 상태가 집중 — 함수/상태 과부하
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
- 상세: 이번 변경으로 `datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset` 5개 상태와 `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset`, `refreshDatasets` 핸들러가 추가됐다. 기존에도 실행·히스토리·삭제 확인 등 다수 상태가 있는 컴포넌트에 기능이 계속 집적되는 구조다. 현재는 각 핸들러가 작고 명확하게 분리되어 있어 직접적인 결함은 없으나, `editor-toolbar.tsx` 전체 라인 수가 상당히 늘어난 상황이다. 데이터셋 UI 로직이 별도 훅 또는 서브컴포넌트로 추출되지 않으면 향후 기능 추가 시 파일이 단일 책임 원칙을 벗어날 가능성이 높다.
- 제안: `useDatasetManager(workflowId, jsonInput, jsonError)` 커스텀 훅으로 상태(5개) + 핸들러(4개) + query 를 추출하거나, 데이터셋 picker/폼 UI 를 `DatasetPanel` 서브컴포넌트로 분리하는 것을 중기적으로 고려.

### [INFO] editor-toolbar.tsx: 데이터셋 목록 패널과 히스토리 패널이 거의 동일한 JSX 구조를 가짐 — 약한 구조적 중복
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` dataset picker 섹션 vs history picker 섹션
- 상세: 두 패널 모두 `max-h-44 overflow-y-auto rounded-md border ...` 래퍼, 로딩 스피너, 빈 상태 메시지, 항목 리스트 구조를 동일하게 반복하고 있다. 스타일 클래스 문자열도 대부분 동일하다. 기능이 달라 하나로 합치기 어렵지만, `PickerPanel` 공용 레이아웃 컴포넌트로 래퍼+로딩+빈상태 부분만 추출하면 클래스 문자열 변경 시 한 곳만 수정하면 된다.
- 제안: 즉시 수정이 필요한 수준은 아니나, 세 번째 유사 패널이 추가될 때는 공용 컴포넌트 추출을 강제한다.

### [INFO] service.ts `copyName`: 매직 넘버 248(암묵적), suffix 문자열 하드코딩
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` `copyName` 메서드
- 상세: `const suffix = ' (Copy)'` 와 `const max = 255 - suffix.length` 는 255 가 entity 의 `name` 컬럼 길이 제약과 연동된 값이다. 255 자체는 entity 에 `@Column({ length: 255 })` 로 선언되어 있어 단일 진실이 아니다. entity 의 길이 상수와 서비스 계산이 각자 하드코딩되어 있어 컬럼 길이가 변경될 때 두 곳을 모두 수정해야 한다.
- 제안: entity 또는 shared constants 파일에 `NAME_MAX_LENGTH = 255` 상수를 선언하고 양쪽에서 참조하면 단일 진실이 유지된다. 현재 규모에서는 LOW 위험이지만 향후 오탐 가능성이 있다.

### [INFO] e2e spec: `create` 헬퍼가 `workflowId` 를 클로저로 참조 — 선언 시점 불안정
- 위치: `/codebase/backend/test/workflow-test-dataset.e2e-spec.ts` 라인 2115-2126
- 상세: `const create = (token, body, ws = workspaceId) => ...` 는 `beforeAll` 이 완료된 이후 `workflowId` 가 채워지는 클로저 변수를 참조한다. `it` 블록이 실행되는 시점에는 `beforeAll` 이 완료되어 있어 실질적 문제는 없으나, `workflowId` 가 `let` 으로 선언된 최상위 변수라는 점이 `create` 함수 시그니처에 드러나지 않아 헬퍼의 의존성을 파악하기 위해 상위 스코프를 추적해야 한다. 다른 e2e 파일도 동일 패턴을 사용하므로 codebase 일관성 면에서는 문제없다.
- 제안: 현 패턴 유지 가능. 필요하다면 `create` 에 `wfId = workflowId` 파라미터를 추가해 의존성을 명시적으로 표현하는 방향을 고려.

### [INFO] controller: PATCH/DELETE/clone 엔드포인트의 URL 패턴이 list/create 와 불일치
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`
- 상세: `GET/POST`는 `/workflows/:workflowId/test-datasets` (nested resource), `PATCH/DELETE/clone`은 `/test-datasets/:id` (flat resource). 이는 의도적 설계(id 만으로 충분하므로 workflowId 중복 불필요, spec §9와 일치)이고 컨트롤러 JSDoc에도 언급되어 있으나, 동일 리소스가 두 가지 URL 구조로 표현되어 있어 처음 코드를 읽는 개발자가 의아해할 수 있다. 기존 코드베이스에 유사 선례가 있는지 확인이 필요하다.
- 제안: 컨트롤러 클래스 JSDoc에 URL 구조 선택 이유(id-only로 충분, spec §9 기준)를 한 줄 추가하면 유지보수 시 혼선이 줄어든다.

### [INFO] frontend API 클라이언트: `update` 메서드의 body 타입이 `Partial<CreateTestDatasetBody>` — UpdateBody 미정의
- 위치: `/codebase/frontend/src/lib/api/workflow-test-datasets.ts` `update` 메서드
- 상세: backend 의 `UpdateWorkflowTestDatasetDto` 에 대응하는 별도 `UpdateTestDatasetBody` 인터페이스가 없고, `Partial<CreateTestDatasetBody>` 를 재사용하고 있다. `CreateTestDatasetBody.input` 이 `Record<string, unknown>` (필수)인데 `Partial<>` 로 감싸면 선택적이 되므로 의미상 올바르다. 그러나 향후 create 와 update 의 body 가 달라지면 이 묵시적 의존이 오류를 유발할 수 있다.
- 제안: `UpdateTestDatasetBody` 를 명시적 인터페이스로 분리 선언하면 독립적 진화가 가능해진다. 현재 규모에서는 INFO 수준.

## 요약

전체적으로 이번 변경은 새로운 `workflow-test-datasets` 모듈을 명확한 책임 분리(migration / entity / dto / service / controller / module / e2e / frontend API / i18n)로 구성했으며, 각 파일은 단일 관심사를 잘 유지하고 있다. 네이밍은 codebase 컨벤션을 충실히 따르고 있고, SQL migration 헤더 주석·JSDoc·인라인 설명도 충분해 의도 파악이 용이하다. 주요 유지보수 리스크는 `editor-toolbar.tsx` 가 이번 변경으로 상태·핸들러·JSX 가 추가되어 컴포넌트 비대화 경향이 심화된 점이며, 중기적으로 데이터셋 관련 로직을 커스텀 훅 또는 서브컴포넌트로 추출하는 리팩터링이 권장된다. 나머지 발견사항(import 병합, 상수 중복, Partial 재사용)은 즉각적 버그 위험은 없는 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
