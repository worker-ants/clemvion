# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] 서비스 단위 테스트 — `remove` 소유자 성공 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.spec.ts` — `describe('remove')` 블록
- 상세: `remove` 테스트는 비소유자 403 케이스만 있고, 소유자가 정상 삭제하는 happy-path 케이스가 없다. `datasetRepository.remove` 가 실제로 호출되었는지 검증하지 않는다.
- 제안: `datasetRepo.findOne.mockResolvedValue(makeDataset({ ownerId: OWNER }))` 후 `service.remove('ds-1', WS, OWNER)` 호출 시 `datasetRepo.remove` 가 호출되고 예외가 없음을 확인하는 케이스 추가.

### [INFO] 서비스 단위 테스트 — `clone` 자기 자신의 데이터셋 복제 경로 미검증
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('clone')` 블록
- 상세: clone 테스트는 타 유저가 공유본을 복제하는 케이스와 비공유 private 복제 차단 케이스를 커버한다. 소유자 본인이 자기 데이터셋(private 포함)을 복제하는 경로는 없다. `findAccessible(requireOwner=false)` 에서 `isOwner=true` 분기가 별도 테스트로 고정되지 않아, 소유자 자신이 private 데이터셋을 복제하는 케이스에서 404가 발생하지 않는지 명시적으로 보장되지 않는다.
- 제안: `datasetRepo.findOne.mockResolvedValue(makeDataset({ ownerId: OWNER, visibility: TestDatasetVisibility.PRIVATE }))` 후 `service.clone('ds-1', WS, OWNER)` 가 정상 동작(사본 생성)하는 케이스 추가.

### [INFO] 서비스 단위 테스트 — `update` 중복 이름 409 경로 미검증
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('update')` 블록
- 상세: `create` 는 UNIQUE 위반 → 409 케이스를 테스트하나, `update` 에도 `saveUnique` 를 거치므로 이름 변경 시 중복 발생 케이스가 409로 변환되는지 검증하지 않는다. `saveUnique` 로직이 공유되므로 동작은 정확하지만 명시적 테스트가 없다.
- 제안: `update` 에서 `datasetRepo.save.mockRejectedValueOnce(new QueryFailedError(..., { code: '23505' }))` 후 ConflictException 이 throw 되는지 검증 케이스 추가. INFO 수준으로 우선순위는 낮음.

### [INFO] 서비스 단위 테스트 — `assertWorkflow` 가 각 메서드에서 호출되는지 미검증
- 위치: `workflow-test-datasets.service.spec.ts` — `describe('assertWorkflow')` 블록
- 상세: `assertWorkflow` 의 404 케이스는 `list` 를 통해 간접 검증된다. 그러나 `create` 에서도 `assertWorkflow` 가 먼저 호출되는지(workflow 미존재 시 create 도 404를 반환하는지)는 테스트로 고정되지 않았다.
- 제안: `workflowRepo.findOne.mockResolvedValueOnce(null)` 후 `service.create(...)` 가 NotFoundException 을 throw 하는지 케이스 추가.

### [INFO] 프론트엔드 단위 테스트 — `clone` 및 `remove` UI 동작 케이스 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `dsCloneMock` 과 `dsRemoveMock` 이 vi.fn() 으로 등록되어 있으나 이를 실제로 호출하는 테스트가 없다. 데이터셋 목록에서 "Clone" 버튼 클릭 → `clone` API 호출 후 토스트 표시, "Delete" 버튼 클릭 → `remove` API 호출 후 목록에서 제거 등의 UI 흐름이 커버되지 않는다.
- 제안: `isOwner: false` 인 공유 데이터셋의 "Clone" 버튼 클릭 후 `dsCloneMock` 호출 여부와 성공/실패 토스트 표시 케이스, `isOwner: true` 인 데이터셋의 "Delete" 버튼 클릭 후 `dsRemoveMock` 호출 케이스를 추가한다.

### [INFO] 프론트엔드 단위 테스트 — `Save as Dataset` 의 `visibility` 옵션(workspace 공유) 선택 케이스 부재
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: 현재 "Save as Dataset" 테스트는 기본 `visibility: "private"` 로 create 를 호출하는 케이스만 검증한다. "Share with workspace (read-only)" 체크박스를 선택한 후 `visibility: "workspace"` 로 저장되는 경로가 테스트되지 않는다.
- 제안: 체크박스 선택 후 `dsCreateMock` 이 `{ ..., visibility: "workspace" }` 로 호출되는지 검증 케이스 추가.

### [INFO] 프론트엔드 단위 테스트 — 데이터셋 저장 실패(API 에러) 토스트 케이스 부재
- 위치: `editor-toolbar-run-input.test.tsx`
- 상세: `dsCreateMock` 이 reject 되었을 때 `toastError` 가 호출되는지 검증하는 케이스가 없다. Load-from-History 의 실패 경로는 테스트하고 있어 패턴은 존재한다.
- 제안: `dsCreateMock.mockRejectedValue(new Error("fail"))` 후 `toastError` 호출 여부를 검증하는 케이스 추가.

### [INFO] e2e 테스트 — `update` 성공(소유자가 직접 PATCH)·DELETE 성공 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/test/workflow-test-dataset.e2e-spec.ts`
- 상세: e2e 테스트는 A(생성) · B(가시성) · C(clone) · D(403/404) · E(IDOR) · F(중복) 를 커버한다. 소유자가 직접 PATCH 로 name/input/visibility 를 변경하고 응답이 갱신된 값을 반환하는지, DELETE 후 목록에서 제거되는지를 검증하는 케이스가 없다. `update` 와 `remove` 의 happy-path 가 단위 테스트에서만 커버되어 e2e wiring 이 보장되지 않는다.
- 제안: `PATCH /api/test-datasets/:id` (소유자, name 변경 성공 → 200 + 갱신값) 및 `DELETE /api/test-datasets/:id` (소유자, 성공 → 204 + 이후 목록에서 미노출) 케이스를 e2e에 추가한다. 단, 현 6건(A-F)이 권한 모델의 핵심을 커버하므로 이 갭은 INFO 수준이다.

### [INFO] e2e 테스트 — `name` 유효성 검증(빈 이름·255자 초과) 미검증
- 위치: `workflow-test-dataset.e2e-spec.ts`
- 상세: `CreateWorkflowTestDatasetDto` 에 `@IsNotEmpty()` · `@MaxLength(255)` 가 선언되어 있으나 e2e에서 빈 이름이나 256자 이름으로 POST 시 400이 반환되는지 검증하지 않는다.
- 제안: 경계값 검증 케이스(빈 name → 400, 256자 name → 400) 추가. 우선순위 낮음(class-validator 의 표준 동작이므로 위험 낮음).

### [INFO] `copyName` 메서드 — 255자 경계 이름 절단 동작 단위 테스트 부재
- 위치: `workflow-test-datasets.service.ts` — `copyName` 메서드
- 상세: `copyName` 은 base 이름이 `255 - suffix.length` (= 248) 자를 초과하면 slice 하는 로직이 있다. 이 경계 처리가 단위 테스트에서 검증되지 않는다. 248자 base → 정확히 255자 사본 이름, 249자 base → 절단+suffix 조합이 255자를 초과하지 않는지가 미검증 상태다.
- 제안: `copyName` 을 `private` 에서 `protected` 또는 `public` 으로 노출(테스트 전용)하거나, 긴 이름 클론 시나리오를 서비스 레벨 테스트로 추가한다.

### [INFO] 컨트롤러 레벨 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workflow-test-datasets/` 디렉터리
- 상세: `workflow-test-datasets.controller.ts` 에 대한 `*.spec.ts` 가 없다. `@Roles('editor')` 가드, `@WorkspaceId()` · `@CurrentUser('sub')` 데코레이터 주입, `ParseUUIDPipe` 검증 등 컨트롤러 계층 관심사가 단위 테스트로 커버되지 않는다. 다른 모듈(예: executions.controller.spec.ts)이 컨트롤러 단위 테스트를 보유하고 있는 코드베이스 패턴과 불일치한다.
- 제안: `workflow-test-datasets.controller.spec.ts` 를 추가하여 인증 필요 엔드포인트(`@Roles('editor')`)에서 미인증 요청이 차단되고, 서비스 메서드가 올바른 파라미터로 호출되는지 NestJS TestingModule 기반으로 검증한다. 우선순위는 서비스 테스트 + e2e 가 존재하므로 MEDIUM 수준이다.

## 요약

이번 변경은 `WorkflowTestDatasetsService` 단위 테스트(권한 모델 핵심 — 소유/비소유·clone·중복 충돌), 프론트엔드 컴포넌트 단위 테스트(데이터셋 목록 조회·Save as Dataset 기본 흐름), e2e 테스트(A-F invariant: 생성·가시성·clone·권한·IDOR·중복)를 모두 구비하고 있으며 전반적으로 테스트 기반이 탄탄하다. 테스트 격리(vi.mock / jest.fn 를 통한 의존성 격리)와 가독성(makeDataset 헬퍼, 인바리언트 라벨 표기)도 양호하다. 주요 커버리지 갭은: (1) 컨트롤러 계층 단위 테스트 부재(기존 모듈과 패턴 불일치), (2) `remove` · `clone(자기 자신)` 서비스 happy-path 케이스 누락, (3) e2e에서 `update` · `remove` 성공 경로 미검증, (4) 프론트엔드에서 clone/delete UI 흐름 및 저장 실패 토스트 케이스 부재이며 모두 INFO 수준으로 구현 버그 위험은 낮다. 회귀 위험은 없다.

## 위험도
LOW
