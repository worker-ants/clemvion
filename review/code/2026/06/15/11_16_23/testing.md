# Testing Review

## 발견사항

### **[WARNING]** `remove` 성공 케이스 단위 테스트 미존재
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('remove')` 블록
- 상세: `remove` describe 는 비소유자 403 케이스만 포함. 소유자가 정상 삭제할 경우 `datasetRepo.remove` 가 호출되는지, 반환이 `void` 인지 확인하는 테스트가 없다.
- 제안: 소유자 remove → `datasetRepo.remove` 호출 검증 케이스 추가.

### **[WARNING]** `update` 404 케이스(데이터셋 미존재) 단위 테스트 미존재
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('update')` 블록
- 상세: 소유자 수정 성공 + 비소유자 403 두 케이스만 있고, `findOne`이 `null`을 반환할 때(데이터셋 없음) `NotFoundException`이 발생하는 경로가 테스트되지 않는다.
- 제안: `datasetRepo.findOne.mockResolvedValue(null)` 후 `update` 호출 시 `NotFoundException` 검증 케이스 추가.

### **[WARNING]** `list` 쿼리빌더 mock의 `where` 체인 호출 순서 검증 부재
- 위치: `workflow-test-datasets.service.spec.ts` line ~1405
- 상세: `andWhere` 가 `userId OR workspace` 조건으로 호출됐는지는 검증하지만, 첫 번째 `where('d.workflow_id = :workflowId')` 및 두 번째 `andWhere('d.workspace_id = :workspaceId')` 조건을 검증하지 않는다. `workspace_id` 격리 누락 시 cross-workspace 데이터 노출 버그가 단위 테스트에서 탐지되지 않는다.
- 제안: `qb.where` / `qb.andWhere` 각 인자를 개별 검증하거나, `workspaceId` 파라미터 바인딩이 포함됐는지 `expect.objectContaining({ workspaceId: WS })` 로 추가 단언.

### **[WARNING]** `update` 중복 이름(23505) 단위 테스트 미존재
- 위치: `workflow-test-datasets.service.spec.ts`
- 상세: `create`의 23505 → 409 변환 테스트는 존재하나, `update` 경로의 동일 변환은 커버되지 않는다. `saveUnique` 공유 경로이긴 하나, `update` 특유의 파라미터(name 변경 시 UNIQUE 충돌) 시나리오가 명시적으로 없다.
- 제안: `update`에서 `datasetRepo.save`가 23505 에러를 던질 때 `ConflictException` 발생 검증 케이스 추가.

### **[WARNING]** `clone` 소유자가 자기 것을 복제하는 케이스 미검증
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('clone')` 블록
- 상세: 타 유저가 workspace 공유본 복제, 비소유자가 private 복제 시도(404) 두 케이스만 있다. 소유자가 자기 own 데이터셋(private or workspace)을 복제하는 케이스가 없다. `findAccessible(id, ws, userId, false)` 에서 `isOwner=true`일 때도 정상 실행되어야 하는 경로.
- 제안: `ownerId === userId` + `visibility=private` 인 데이터셋을 같은 유저가 clone 시 성공 케이스 추가.

### **[WARNING]** 프론트엔드 테스트: 데이터셋 목록 빈 상태(empty state) UI 렌더링 테스트 미존재
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: `dsListMock.mockResolvedValue([])` 때 "empty" 문구가 렌더되는지, 저장 폼 취소 시 `saveFormOpen`이 닫히는지 등 UI 상태 전환 케이스가 없다.
- 제안: `dsListMock.mockResolvedValue([])` 후 empty state 텍스트 존재 검증, `saveFormOpen` 토글 시 폼 노출/숨김 테스트 추가.

### **[WARNING]** 프론트엔드 테스트: clone/delete 핸들러 호출 검증 미존재
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: 목록에서 `isOwner=false` 아이템의 Clone 버튼 클릭 → `dsCloneMock` 호출, `isOwner=true` 아이템의 Delete 버튼 클릭 → `dsRemoveMock` 호출 케이스가 없다. mock 변수(`dsCloneMock`, `dsRemoveMock`)가 파일 상단에 선언돼 있으나 사용되지 않는다.
- 제안: 공유 데이터셋 Clone 버튼 클릭 시 `dsCloneMock` 호출 + 내 데이터셋 Delete 버튼 클릭 시 `dsRemoveMock` 호출 검증 케이스 추가.

### **[WARNING]** 프론트엔드 테스트: `handleSaveDataset` 의 JSON 유효성 에러/빈 이름 가드 분기 미검증
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: `Save as Dataset` 버튼은 `jsonError != null || datasetName.trim() === ""` 일 때 disabled 처리되고 `handleSaveDataset` 내부에서도 early return을 하지만, 이 guard 분기에 대한 테스트가 없다.
- 제안: 빈 이름 상태에서 Save 버튼이 disabled 인지 검증하는 케이스 추가.

### **[INFO]** e2e 테스트: `DELETE /test-datasets/:id` 성공 케이스 미존재
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts`
- 상세: e2e invariant A~F 는 명세된 시나리오를 잘 커버하지만, 소유자가 DELETE 요청 후 204 반환 + 목록에서 사라지는 흐름이 없다. D 케이스에서 타 유저 PATCH → 403 을 커버하지만 DELETE 성공 흐름은 없다.
- 제안: 소유자가 DELETE 후 목록 GET 에서 해당 항목이 제거됨을 확인하는 invariant G 케이스 추가 권장.

### **[INFO]** e2e `E` 케이스: `expect([403, 404]).toContain(res.status)` 허용 범위 과도
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` line ~2227
- 상세: cross-workspace 접근 시 서비스 코드에서 `workspaceId` 필터로 `null → NotFoundException(404)` 경로가 명확함에도, 403 도 허용하는 느슨한 단언이다. 서비스 로직이 403 을 반환하지 않는 케이스라면 단언을 404 로 고정하는 것이 더 정확하다.
- 제안: 코드 경로를 확인 후 `expect(res.status).toBe(404)` 로 단언 강화 검토.

### **[INFO]** `copyName` 단위 테스트 미존재 (255자 경계값)
- 위치: `workflow-test-datasets.service.spec.ts`
- 상세: `copyName`은 255 - suffix.length = 247 자 초과 시 슬라이싱 로직을 갖지만 해당 경계값 테스트가 없다. 255자 이름 복제 시 결과가 정확히 255자 이내인지 검증 필요.
- 제안: `copyName` private 메서드를 간접 테스트하는 clone 케이스에 248자 이상 이름을 사용한 경계값 케이스 추가.

### **[INFO]** SQL 마이그레이션(V097)에 대한 migration 단위 테스트 부재
- 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- 상세: 신규 마이그레이션에 대해 DDL 문법 오류나 FK/INDEX 생성 실패를 잡는 자동화 테스트가 없다. e2e `beforeAll` 에서 실 DB 위에 마이그레이션이 적용되므로 e2e 자체가 간접 smoke 역할은 하나, 마이그레이션 전용 단위 검증은 없다.
- 제안: 프로젝트에 migration smoke test 패턴이 있다면 적용, 없다면 현행 e2e 커버로 수용 가능.

## 요약

전체적으로 단위 테스트(`service.spec.ts`)와 e2e 테스트가 함께 제공되어 핵심 권한 모델(소유자/비소유자, private/workspace, cross-workspace IDOR)을 체계적으로 검증한다. `makeDataset` 팩토리와 `beforeEach` 모듈 재생성 구조로 테스트 격리도 양호하다. 다만 `remove` 성공 경로, `update` 404 경로, 중복 이름의 `update` 경로, 소유자 self-clone 경로 등 서비스 브랜치 일부가 단위 테스트에서 커버되지 않는다. 프론트엔드 테스트는 load/create 핵심 경로만 검증하고 clone·delete 버튼 이벤트 핸들러가 미검증 상태이며, 선언된 `dsCloneMock`·`dsRemoveMock`이 실제 단언에 사용되지 않는 dead mock이 존재한다. 이 갭들은 회귀 위험이 중간 수준이므로 보완이 권장된다.

## 위험도

MEDIUM
