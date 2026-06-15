# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] SQL 마이그레이션 — 되돌리기(DOWN) 스크립트가 주석으로만 존재
- 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql` 74-75행
- 상세: `-- DROP TABLE IF EXISTS workflow_test_dataset;` 가 주석 처리되어 있다. Flyway 기반 환경에서는 의도적인 패턴이나, 롤백 시 개발자가 수동으로 실행해야 하므로 운영 실수 가능성이 있다. 신규 테이블 생성이므로 기존 데이터에 영향은 없음.
- 제안: 별도 V097.1__rollback 스크립트나 팀 운영 지침에 따라 DOWN 경로를 명확히 문서화한다.

### [INFO] `WorkflowTestDatasetsModule`이 `Workflow` 엔티티를 `forFeature`에 포함
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.module.ts` 10행
- 상세: `TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])`로 `Workflow` 레포지토리를 이 모듈이 독자적으로 주입받는다. `Workflow`는 이미 `WorkflowsModule`의 `forFeature`에도 등록되어 있으므로, 두 모듈이 동일 엔티티의 레포지토리를 각자 주입받는 구조가 된다. NestJS + TypeORM에서 이 패턴은 정상이며 런타임 충돌은 없으나, `Workflow` 메타데이터가 `root-entities.ts`에 이미 포함되어 있어야 한다는 조건은 충족되어 있음.
- 제안: 이상 없음. 단, `WorkflowsModule`을 imports에서 re-export하는 방식(모듈 의존성 명시)으로 전환 가능하나 현재 방식도 허용 범위 내.

### [INFO] `editor-toolbar.tsx` — 새 로컬 state 6개 추가
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 81-86행
- 상세: `datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset` 등 5개의 `useState` 훅이 컴포넌트 내부에 추가된다. 이는 전역·공유 상태를 건드리지 않고 컴포넌트 로컬 상태만 확장하므로 의도치 않은 부작용 없음.

### [INFO] `Cancel` 버튼 클릭 시 초기화 대상 확장
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 760-836행 (diff 기준)
- 상세: 기존 Cancel 핸들러가 `setRunWithInputOpen(false)`, `setHistoryPickerOpen(false)`, `setJsonInput("{}")` 만 초기화하던 것에서 `setDatasetPickerOpen(false)`, `setSaveFormOpen(false)`, `setDatasetName("")`, `setShareWorkspace(false)` 가 추가되었다. 기존 동작과 완전히 호환되며 추가 state를 초기화하는 것은 의도된 변경.

### [INFO] `toast.success` mock 추가로 기존 테스트에 영향 없음
- 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` 449-457행
- 상세: 기존 mock `{ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }` 에서 `success`가 `vi.fn()` 익명에서 캡처 가능한 `toastSuccess`로 교체되었다. 기존 테스트가 `toast.success`의 호출 여부를 assert하지 않았다면 동작 변화 없음. 추가된 테스트들만 `toastSuccess`를 활용한다.

### [WARNING] `handleSaveDataset`에서 `JSON.parse` 오류 처리 경로
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (handleSaveDataset 내부, diff +175~+195행)
- 상세: `jsonError != null` 조건이 guard로 존재하므로 `JSON.parse(jsonInput)`은 이론상 안전하다. 그러나 `jsonError`는 별도의 `useMemo`/`useCallback`으로 계산되는 파생 상태이며, `jsonInput`과의 동기화가 렌더링 사이클에 의존한다. 비동기 흐름에서 `jsonError`가 stale일 경우 parse 예외가 catch 블록에 떨어질 수 있다. catch 블록은 `toast.error(t("editor.datasetSaveFailed"))`로 처리되므로 UX는 안전하나 원인 에러가 콘솔 로그로만 남음.
- 제안: `catch` 블록에서 `error instanceof SyntaxError` 케이스를 별도 분기하여 더 구체적인 사용자 메시지를 제공하는 것을 고려.

### [INFO] `list` API 쿼리에서 `andWhere` 체이닝 — workspace 범위 격리 확인
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` 1779-1786행
- 상세: `d.workspace_id = :workspaceId` 조건이 AND로 강제되므로, visibility='workspace'인 행도 동일 워크스페이스 내에서만 조회된다. 크로스 워크스페이스 노출 위험 없음.

### [INFO] `copyName` 함수 — 255자 경계 처리
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` 1914-1918행
- 상세: suffix `' (Copy)'`(7자)를 고려하여 base를 `248`자로 trim한다. 경계 값 계산은 `255 - suffix.length = 248`로 정확하다. 부작용 없음.

### [INFO] 새 공개 API 엔드포인트 추가 — 기존 라우팅에 영향 없음
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`
- 상세: `@Controller()` 데코레이터에 prefix가 없어 라우트가 글로벌 수준(`/api/` 이하 직결)에 등록된다. `GET /workflows/:workflowId/test-datasets`, `POST /workflows/:workflowId/test-datasets`, `PATCH /test-datasets/:id`, `DELETE /test-datasets/:id`, `POST /test-datasets/:id/clone` — 기존 라우트와 충돌하는 경로가 없는지 사전 검토 필요. 특히 `:id/clone`이 NestJS 라우터에서 `/:id` Param과 `/clone` 리터럴의 우선순위 충돌 없이 처리되는지 확인해야 한다.
- 제안: 통합 테스트(e2e)가 이미 이 엔드포인트들을 검증하므로 실제 충돌 가능성은 낮음. 이상 없으면 넘어가도 무방.

### [INFO] `app.module.ts` — 모듈 임포트 순서 변경 없음, 기존 동작 유지
- 위치: `codebase/backend/src/app.module.ts`
- 상세: `WorkflowTestDatasetsModule`이 `AuthConfigsModule`과 `FoldersModule` 사이에 삽입된다. NestJS 모듈 로딩 순서는 일반적으로 기능에 영향을 주지 않으므로 부작용 없음.

---

## 요약

이번 변경은 `workflow_test_dataset` 테이블 신설(마이그레이션), NestJS 백엔드 모듈 전체(서비스·컨트롤러·DTO·엔티티), 프론트엔드 에디터 툴바 확장, 단위·e2e 테스트 추가로 구성된 신규 기능 추가다. 전역 변수 도입, 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 부작용, 의도하지 않은 외부 서비스 호출은 발견되지 않았다. 기존 함수/메서드 시그니처 변경은 없으며, 공개 API는 새 엔드포인트만 추가되어 기존 호출자에게 영향이 없다. 프론트엔드 Cancel 핸들러는 기존 상태 초기화를 유지하면서 새 state만 추가로 초기화하므로 회귀 없음. `handleSaveDataset` 내 `JSON.parse` 경로는 `jsonError` guard로 보호되어 있으나 stale state 엣지 케이스에서 예외가 catch 블록으로 처리될 가능성이 낮은 수준으로 존재한다.

---

## 위험도

LOW
