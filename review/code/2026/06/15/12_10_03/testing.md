# Testing Review — Workflow Test Datasets (§2.2)

## 발견사항

### [INFO] 컨트롤러 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`
- 상세: 서비스 단위 테스트(`workflow-test-datasets.service.spec.ts`)와 e2e 테스트(`workflow-test-dataset.e2e-spec.ts`)는 존재하나, 컨트롤러 자체에 대한 단위 테스트가 없다. NestJS 컨트롤러는 파라미터 파싱(`ParseUUIDPipe`), 데코레이터(`@WorkspaceId`, `@CurrentUser`), HTTP 상태 코드 매핑 등 테스트할 가치 있는 경계가 있다.
- 제안: 서비스를 mock 한 컨트롤러 단위 테스트 추가. 우선순위는 낮으나, `ParseUUIDPipe` 가 유효하지 않은 UUID 에 400 을 반환하는지 등은 e2e 에서도 검증되지 않았다.

### [WARNING] `workflowTestDatasetsApi.update` 함수 프론트엔드 테스트 완전 누락
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` — `update` 메서드, `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: 프론트엔드 API 클라이언트에 `update(datasetId, body)` 메서드가 정의돼 있고, mock 설정에도 `dsListMock`/`dsCreateMock`/`dsCloneMock`/`dsRemoveMock` 가 있으나 `dsUpdateMock` 는 없다. `editor-toolbar.tsx` 가 현재 `update` 를 직접 호출하지 않는 것으로 보이나, API 클라이언트의 `update` 는 테스트되지 않은 dead code 상태다. 또한 `handleDeleteDataset`/`handleCloneDataset` 의 오류 경로(toast.error 호출)도 테스트에서 커버되지 않는다.
- 제안: (1) `update` 가 UI 에서 실제로 사용되지 않는다면 API 클라이언트에서 제거하거나 TODO 주석을 달아 의도를 명확히 한다. (2) clone/delete 실패 시 `toastError` 가 호출되는지 검증하는 테스트 케이스를 추가한다.

### [WARNING] 서비스 테스트: `update` 의 워크스페이스 격리 미검증
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.spec.ts` — `update` describe 블록 (라인 1410-1445)
- 상세: `update` 테스트에서 `findAccessible` 내부의 `workspaceId` 필터(`{ id, workspaceId }`)가 실제로 작동하는지 검증하지 않는다. mock 된 `findOne` 이 `workspaceId` 인자를 받는지 확인하는 assertion 이 없어, 서비스가 `workspaceId` 없이 id 만으로 조회하도록 변경돼도 이 테스트는 통과한다. `remove` 도 동일한 문제다.
- 제안: `datasetRepo.findOne` 이 `{ where: { id, workspaceId } }` 형태로 호출됐는지 `expect(datasetRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) }))` 로 검증한다.

### [INFO] 서비스 테스트: `list` 의 `andWhere` 순서 두 번째 조건 미검증
- 위치: `workflow-test-datasets.service.spec.ts` 라인 1402-1407
- 상세: `list` 테스트에서 `(d.owner_id = :userId OR d.visibility = :workspace)` 조건을 검증하지만, `d.workspace_id = :workspaceId` 필터(두 번째 `andWhere`)가 쿼리빌더에 실제로 포함됐는지 검증하지 않는다. 워크스페이스 격리 필터가 누락돼도 이 테스트는 통과한다.
- 제안: `expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('workspace_id'), expect.objectContaining({ workspaceId: WS }))` 를 추가한다.

### [INFO] `copyName` 함수 경계값 테스트 부재
- 위치: `workflow-test-datasets.service.ts` 의 `copyName` 메서드 (라인 1753-1757)
- 상세: `copyName` 이 이름 최대 길이(255자)를 초과하지 않도록 슬라이싱하는 로직이 있으나(`const max = 255 - suffix.length`), 이 경계값 동작을 검증하는 테스트가 없다. 255자 이름을 clone 할 때 DB constraint 위반이 발생할 수 있는지 검증이 필요하다.
- 제안: 248자 이름(255 - " (Copy)".length = 248)을 경계로 잘 동작하는지, 249자 이름이 올바르게 슬라이싱되는지 단위 테스트 추가.

### [INFO] e2e 테스트: 인증되지 않은 접근(401) 케이스 부재
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts`
- 상세: e2e 가 A~G 인변리언트를 잘 커버하지만, 토큰 없이 엔드포인트를 호출하는 케이스(401 Unauthorized)가 없다. 인증 가드가 제대로 적용됐는지 확인하는 기초 케이스다.
- 제안: `Authorization` 헤더 없이 `GET /api/workflows/:id/test-datasets` 호출 시 401 을 반환하는지 테스트 추가. 다른 모듈의 e2e 패턴을 따른다.

### [INFO] e2e 테스트: E 케이스(IDOR)의 assertion 이 느슨함
- 위치: `workflow-test-dataset.e2e-spec.ts` 라인 2317
- 상세: `expect([403, 404]).toContain(res.status)` 로 403 또는 404 모두 허용한다. cross-workspace 접근 시 서버가 일관되게 동일한 코드를 반환해야 IDOR 보안 속성이 명확해진다. 현재 서비스 코드는 `workspaceId` 불일치 시 `findOne` 이 null 을 반환해 404 를 던지므로 404 가 확정적이다.
- 제안: assertion 을 `expect(res.status).toBe(404)` 로 확정하거나, 해당 동작이 의도적으로 미정인 이유를 주석으로 명시한다.

### [INFO] 프론트엔드 테스트: `handleSaveDataset` 오류 처리 누락
- 위치: `editor-toolbar-run-input.test.tsx` — "Save as Dataset" 테스트 블록
- 상세: `dsCreateMock` 이 reject 됐을 때 `toastError` 가 호출되는지(datasetSaveFailed 키) 검증하는 케이스가 없다. `handleSaveDataset` 내 catch 블록이 테스트되지 않는다.
- 제안: `dsCreateMock.mockRejectedValue(new Error('network'))` 후 `toastError` 호출 여부를 검증하는 케이스 추가.

### [INFO] 프론트엔드 테스트: `saveFormOpen` 토글 후 폼 상태 초기화 미검증
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: 저장 성공 후 `setSaveFormOpen(false)`, `setDatasetName("")`, `setShareWorkspace(false)` 로 상태가 초기화되는지 테스트하지 않는다. 저장 완료 후 폼이 닫히고 필드가 비워지는 UX 동작이 회귀할 수 있다.
- 제안: 저장 성공 후 "Dataset name" 입력이 비워지고 저장 폼이 사라지는지 assertion 추가.

### [INFO] SQL 마이그레이션 테스트: `updated_at` 자동 갱신 트리거 부재
- 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- 상세: `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` 는 `INSERT` 시 초기값을 설정하지만, `UPDATE` 시 자동 갱신 트리거가 없다. TypeORM `@UpdateDateColumn` 이 ORM 레이어에서 처리하지만, 직접 SQL `UPDATE` 나 raw query 경로에서는 `updated_at` 이 갱신되지 않는다. 다른 마이그레이션 파일들에도 동일 패턴이 있는지 확인 필요.
- 제안: 프로젝트가 raw SQL UPDATE 를 사용하지 않는 것이 확정된다면 INFO 로 수용 가능. 아니라면 `CREATE TRIGGER` 또는 e2e 에서 PATCH 후 `updatedAt` 이 변경됐는지 검증하는 케이스 추가.

## 요약

`workflow-test-datasets` 모듈의 테스트 구조는 전반적으로 양호하다. 서비스 단위 테스트(`workflow-test-datasets.service.spec.ts`)는 권한 모델의 핵심 케이스(소유자/비소유자 403, UNIQUE 위반 409, clone 가시성 규칙)를 충분히 다루고 있고, e2e 테스트는 실 Postgres 위에서 A~G 인변리언트 전체를 검증한다. `app.module.spec.ts` 의 entity 등록 가드도 `WorkflowTestDataset` 를 즉시 추가해 회귀 방지를 강제한다. 프론트엔드 테스트도 5개 케이스(목록 로드·저장·빈 상태·clone·delete)로 주요 상호작용을 커버한다. 주요 갭은 (1) 서비스 테스트에서 `findAccessible` 의 `workspaceId` 격리 필터 검증 누락, (2) `list` 쿼리빌더의 workspace_id andWhere 미검증, (3) 프론트엔드 API 클라이언트의 `update` 메서드가 UI 에서 미사용이나 테스트도 없는 dead code 상태, (4) clone/delete/save 의 오류 경로(toast.error) 프론트엔드 테스트 부재다. 이 중 WARNING 2건(서비스 workspaceId 격리 assertion 누락, 프론트엔드 update 미사용/미테스트)이 향후 회귀 위험이 있으며, 나머지는 INFO 수준이다.

## 위험도

LOW
