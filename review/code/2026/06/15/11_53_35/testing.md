# Testing Review — Workflow Test Datasets (§2.2)

## 발견사항

### [WARNING] 컨트롤러 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`
- 상세: 서비스 레이어는 `workflow-test-datasets.service.spec.ts` 에서 단위 테스트가 존재하나, 컨트롤러에 대한 별도 `.spec.ts` 가 없다. 컨트롤러 레이어 책임인 `ParseUUIDPipe` 동작, 데코레이터(`@WorkspaceId`, `@CurrentUser`) 바인딩, HTTP 상태 코드(`@HttpCode(204)`) 등은 서비스 테스트로 커버되지 않는다.
- 제안: `workflow-test-datasets.controller.spec.ts` 를 추가하거나, e2e 테스트가 이를 충분히 대체하는지 검토. e2e 에서 HTTP 상태 코드·헤더를 검증하고 있으므로 컨트롤러 spec 은 INFO 수준으로 완화 가능하나, `ParseUUIDPipe` 에 유효하지 않은 UUID 전달 시 400 응답 여부는 e2e 에서도 테스트되지 않아 갭이 남는다.

### [WARNING] e2e 테스트에서 `afterAll` db.end() 누락
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` — `beforeAll` 블록
- 상세: `db = createDbClient(); await db.connect();` 이후 `afterAll(async () => { await db.end(); })` 가 없다. 다른 e2e 파일(예: 기존 auth.e2e-spec.ts 등)의 패턴과 불일치가 발생할 수 있으며, CI 환경에서 pg Client 연결 누수로 테스트 프로세스가 hang 하거나 다음 테스트가 DB 연결 상한에 걸릴 위험이 있다.
- 제안: `afterAll(async () => { await db.end(); });` 를 추가한다.

### [WARNING] e2e 테스트 B-케이스: 테스트 간 이름 충돌 가능성
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` — 케이스 B, D, E, F
- 상세: 여러 테스트 케이스가 같은 `workflowId` / `ownerToken` 조합으로 데이터셋을 생성한다. 케이스 B 는 `'owner-private'` 과 `'owner-shared'` 를 생성하는데, 케이스 A 에서 이미 `'owner-private'` 이름으로 데이터셋을 만든다. 따라서 케이스 B 가 `create(ownerToken, { name: 'owner-private', ... })` 를 암묵적으로 재사용할 때 케이스 A 의 데이터가 잔류해 이름 중복 409 가 발생할 수 있다. 현재는 케이스 B 가 `'owner-shared'` 만 새로 생성하므로 직접 충돌은 없지만, 케이스 D 의 `'secret'`, 케이스 F 의 `'dup-name'` 등은 각 테스트 단독 실행 시에도 이전 실행 잔류 데이터와 충돌하는 취약성이 있다.
- 제안: `uniqueName()` 유틸을 적용하거나, `beforeEach` 격리 대신 케이스별 고유 이름 prefix 를 사용한다.

### [WARNING] 서비스 spec — `update` 테스트에서 인자 순서 오류 (잠재적 회귀)
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.spec.ts` L1412–1414
- 상세: 서비스 시그니처는 `update(id, workspaceId, userId, dto)` 이나, 테스트에서 `service.update(WF, WS, OWNER, { name: 'new' })` 를 호출한다. 여기서 첫 인자로 `WF`(워크플로우 id = 'wf-1')를 전달하고 있으나 실제 `update` 첫 인자는 **dataset id** 다. `datasetRepo.findOne` 이 `makeDataset({ ownerId: OWNER })` 를 반환하도록 mock 되어 있어 현재는 통과하지만, 인자 의미가 잘못 매칭된 상태이다. 리팩토링 시 이 테스트가 오탐 또는 미탐을 유발할 수 있다.
- 제안: 해당 호출을 `service.update('ds-1', WS, OWNER, { name: 'new' })` 로 수정하고, `findOne` 에 실제로 전달된 인자(`{ where: { id: 'ds-1', workspaceId: WS } }`)를 검증하는 assertion 을 추가한다.

### [WARNING] 프론트엔드 `update` API 호출 경로 미테스트
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` — `update()` 메서드; `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `workflowTestDatasetsApi.update()` 함수가 API 클라이언트에 정의되어 있으나, 추가된 프론트엔드 테스트(`editor-toolbar-run-input.test.tsx`) 에서 `dsUpdateMock` 이 정의되지 않고 `update` 경로가 전혀 테스트되지 않는다. 에디터 툴바에서 update 를 직접 호출하지 않더라도, 해당 API 메서드 자체의 정합성(path `/test-datasets/:id` PATCH) 이 검증되지 않는다.
- 제안: update API 클라이언트 메서드에 대한 단위 테스트를 추가하거나, 향후 UI 에서 update 를 사용할 때 mock 체계에 포함되어 있음을 확인한다. 현 PR 범위에서 UI 에 update 호출이 없다면 INFO 로 강등 가능.

### [INFO] `copyName` private 메서드 단위 테스트 누락
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `copyName()` L1795–1798
- 상세: 255자 경계 트리밍 로직(`base.length > max ? base.slice(0, max) : base`)이 private 메서드에 있어 직접 테스트되지 않는다. clone 테스트에서 간접적으로 커버되나, 정확히 255자 / 248자(248 + 7 = 255) / 249자(초과) 경계값은 테스트되지 않는다.
- 제안: `clone` describe 블록에 255자 경계 이름에 대한 케이스를 1개 추가한다.

### [INFO] `saveUnique` — 비-23505 DB 에러 재전파 테스트 누락
- 위치: `workflow-test-datasets.service.spec.ts` — `create` / `update` describe
- 상세: `saveUnique` 는 23505 외의 DB 에러를 그대로 re-throw 하는 분기가 있으나 테스트가 없다. 운영상 중요하지는 않으나 분기 커버리지 갭이다.
- 제안: `save` mock 이 `new Error('DB connection lost')` 를 throw 할 때 동일 에러가 그대로 전파되는 테스트 1개 추가.

### [INFO] e2e 케이스 E(IDOR) — 어설션이 403 또는 404 모두 허용
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` L2416–2418
- 상세: `expect([403, 404]).toContain(res.status)` 는 보안 테스트로서 지나치게 관대하다. `findAccessible` 로직상 다른 workspace id 로 조회하면 반드시 404 가 반환되어야 하므로, 더 구체적인 어설션이 가능하다.
- 제안: `expect(res.status).toBe(404)` 로 고정하여 IDOR 은닉 동작을 명확히 검증한다.

### [INFO] 프론트엔드 테스트 — `handleSaveDataset` shareWorkspace=true 경로 미테스트
- 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `'Save as Dataset'` 테스트는 기본 `visibility: "private"` 경로만 검증한다. 체크박스를 켜서 `visibility: "workspace"` 로 저장하는 경로가 프론트엔드 테스트에서 커버되지 않는다.
- 제안: `shareWorkspace` 체크박스를 toggle 하는 케이스를 추가하고, `dsCreateMock` 이 `{ visibility: "workspace" }` 로 호출되는지 검증한다.

### [INFO] 프론트엔드 테스트 — toast 호출 결과 검증 부재
- 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` — `toastSuccess`, `toastError` mock
- 상세: `toastSuccess`, `toastError` mock 이 정의되었으나 실제 테스트에서 이 mock 들이 호출되었는지 assert 하는 케이스가 없다. 저장 성공/실패 시 사용자 피드백이 실제로 발생하는지 검증이 빠져 있다.
- 제안: `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset` 성공 테스트에 `expect(toastSuccess).toHaveBeenCalled()` assertion 추가.

---

## 요약

이번 변경은 전반적으로 테스트 구조가 잘 갖춰져 있다. 백엔드 서비스 단위 테스트(`workflow-test-datasets.service.spec.ts`)는 핵심 권한 분기(소유자/비소유자, private/workspace 가시성), UNIQUE 위반 409 변환, 워크플로우 404, clone 흐름을 명확하게 커버한다. `app.module.spec.ts` 의 entity 등록 가드 테스트도 새 엔티티를 올바르게 추가했다. e2e 테스트는 7개 invariant 를 실 Postgres 에서 검증하며 IDOR 케이스까지 포함한다. 프론트엔드 테스트는 데이터셋 목록/저장/복제/삭제의 주요 UX 경로를 mock 기반으로 커버한다. 다만 e2e 의 `afterAll db.end()` 누락과 서비스 spec 의 `update` 인자 순서 오류는 실제 동작 오염·CI 취약성을 유발할 수 있어 수정이 필요하다. 컨트롤러 레이어의 ParseUUIDPipe(잘못된 UUID → 400) 경로, 프론트엔드 toast 호출 검증, `copyName` 255자 경계, `shareWorkspace=true` 저장 경로는 커버리지 갭으로 남아 있다.

## 위험도

MEDIUM
