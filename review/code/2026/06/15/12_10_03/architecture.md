# Architecture Review — workflow-test-datasets

## 발견사항

### [INFO] 엔티티에서 열 이름(`data`)과 속성 이름(`input`) 불일치 — 의도적이나 캡슐화 누출
- 위치: `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` L809
- 상세: `@Column({ name: 'data', ... }) input: Record<string, unknown>` 는 TransformInterceptor 충돌 회피를 위한 의도된 설계이며 코드·spec·코멘트에 명확히 문서화되어 있다. 그러나 DB 컬럼명과 ORM 속성명의 차이가 entity 레이어 밖(service, DTO)에도 `input`이라는 용어로 스며들어 있어, 향후 TransformInterceptor 동작이 바뀔 경우 다수 레이어를 동시에 수정해야 한다. 현재는 INFO 수준이며 문서화로 충분히 완화된 상태.
- 제안: 변경이 필요하다면 entity 한 곳에 `readonly data = this.input` alias 같은 내부 계층을 두어 DB 컬럼명과 domain 속성명 간의 매핑 지식을 entity 안에 가두는 방향을 고려할 수 있다. 현재는 주석이 충분하므로 즉각 수정 불필요.

### [WARNING] `findAccessible`의 boolean 플래그 파라미터 — 기능 분기를 하나의 메서드에 혼재
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1652–1686 (`findAccessible`, `requireOwner: boolean`)
- 상세: `requireOwner=true`(수정/삭제 경로)와 `requireOwner=false`(clone 경로)는 권한 검사 로직이 다르다. boolean 파라미터를 사용하면 호출자가 `true`/`false` 의 의미를 기억해야 하고, 세 번째 가시성 정책이 생길 경우 이 메서드의 조건 분기가 폭발한다(OCP 위반 위험). 현재는 두 분기뿐이라 실용적이지만, 확장 방향에서 취약하다.
- 제안: `findForOwnerOnly(id, workspaceId, userId)` / `findAccessibleForRead(id, workspaceId, userId)` 두 private 메서드로 분리하거나, 접근 정책 타입(`'owner' | 'readable'`)을 사용해 의도를 명시화한다.

### [WARNING] `EditorToolbar` 컴포넌트의 단일 책임 원칙(SRP) 위반 — 데이터셋 UI 상태 증가
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L81–131, L539–620
- 상세: `EditorToolbar`는 이미 실행 제어, 히스토리 로드, 워크플로우 삭제, JSON 검증 등의 관심사를 담고 있다. 이번 변경으로 데이터셋 관련 상태(`datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset`)와 핸들러 4개(`handleLoadDataset`, `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset`)가 추가되어, 단일 컴포넌트의 책임과 상태 표면이 더 커졌다. 현재도 동작하고 이 패턴이 기존 `historyPickerOpen` 등과 일관성이 있어 WARNING 수준이지만, 향후 확장 시 유지보수 부담이 증가한다.
- 제안: `useDatasetManager(workflowId)` 커스텀 훅으로 데이터셋 관련 상태·핸들러를 추출하거나, `<DatasetPicker />` 컴포넌트로 분리한다. 히스토리 picker 도 같은 방식으로 통일하면 `EditorToolbar`가 UI 조합만 담당하게 된다.

### [INFO] `WorkflowTestDatasetsModule`이 `Workflow` 엔티티를 직접 `forFeature`로 가져옴 — 크로스 모듈 Repository 직접 참조
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.module.ts` L1233
- 상세: `TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])` 는 `WorkflowsModule`을 import하지 않고 `Workflow` 엔티티를 직접 가져와 Repository를 사용한다. 이는 NestJS 모노레포에서 흔한 패턴이지만 모듈 경계가 명확하지 않다는 신호다. 워크플로우 존재 검증 책임이 `WorkflowsModule`에 있어야 할지, 현재처럼 데이터셋 서비스에서 직접 repository를 통해 검증할지 정책이 일관되지 않을 경우 중복 검증 또는 검증 누락이 생길 수 있다.
- 제안: `WorkflowsModule`이 `WorkflowExistsGuard` 또는 `WorkflowsService.assertExists()` 같은 공유 서비스를 export한다면, 다른 모듈이 직접 `Workflow` Repository를 소유하지 않아도 된다. 현재 규모에서는 INFO이나 모듈이 늘어날수록 이 패턴이 확산될 수 있다.

### [INFO] `list()` API의 소프트 상한 200건 — 페이지네이션 없는 하드코딩된 상수
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1625
- 상세: `.take(200)` 은 DoS 방지용 소프트 리미트로 코드에 명시적으로 문서화되어 있고 현재 사용 패턴에서는 충분하다. 그러나 상수가 서비스 코드에 리터럴로 박혀 있으며 설정 가능하지 않다.
- 제안: 상수를 모듈 상단 `const LIST_LIMIT = 200` 으로 추출하거나 설정 객체로 이동한다. 즉각 수정 필수는 아님.

### [INFO] frontend API 클라이언트(`workflowTestDatasetsApi`)의 `update` 메서드가 현재 UI에서 미사용
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` L3275–3281
- 상세: `update()` 메서드는 API 클라이언트에 정의되어 있으나, `editor-toolbar.tsx` 의 현재 UI에는 개별 데이터셋 수정 진입점이 없고(삭제·복제만 존재) 테스트에서도 mock되지 않는다. API 계층이 백엔드 계약을 완전히 노출하는 것은 좋은 설계이나, UI가 노출하지 않는 기능이 API 레이어에만 있으면 앞으로 UI 동기화 필요성을 인식하기 어렵다.
- 제안: 코드 자체는 올바르다. `update`가 나중에 인라인 편집 UI로 연결될 계획이라면 주석으로 명시한다.

## 요약

전체적으로 NestJS 표준 모듈 패턴(Controller → Service → Repository)과 레이어 책임 분리가 잘 유지되어 있다. 마이그레이션, 엔티티, DTO, 서비스, 컨트롤러, 프론트엔드 API 클라이언트, i18n 모두 하나의 도메인 경계(`workflow-test-datasets`) 안에 응집되어 있으며 spec SoT(`R-2.2`)와 코드가 동기화되어 있다. `workspace_id` 비정규화, UNIQUE 제약 409 변환, 존재 은닉(404) 등의 설계 결정이 DB, 서비스, 테스트 전 레이어에 일관되게 반영되어 있다. 단, `EditorToolbar`의 상태 누적(SRP 약화)과 `findAccessible`의 boolean 플래그 파라미터(OCP 위험)는 향후 기능 확장 시 리팩토링 비용을 높일 수 있는 구조적 취약점이다. 현재 규모에서 치명적이지는 않으나 우선도 있는 개선 대상이다.

## 위험도

LOW
