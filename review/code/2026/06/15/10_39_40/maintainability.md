# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: V097__workflow_test_dataset.sql

- **[INFO]** 마이그레이션 헤더 주석이 충분히 풍부하고 의도가 명확하다. DOWN 스크립트도 주석으로 포함되어 롤백 의도를 전달하는 점은 긍정적이다. 발견 사항 없음.

---

### 파일 12: workflow-test-dataset.entity.ts

- **[INFO]** `data` 컬럼을 엔티티 속성명 `input` 으로 매핑한 이유가 JSDoc 에 상세히 설명되어 있다 (`TransformInterceptor` 이중 래핑 회피). 이 불일치는 의도적이고 근거가 기록되어 있으나, DB 컬럼명(`data`)과 ORM 속성명(`input`)의 분리는 미래 유지보수자에게 혼동 여지가 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` L489
  - 제안: 현 상태 허용 — JSDoc 설명이 충분하다. 추후 `TransformInterceptor` 를 수정해 `data` 키 오판 문제를 근본 해결할 수 있다면 속성명을 `data` 로 통일하는 것이 장기적으로 더 명확하다.

- **[INFO]** `@Column({ type: 'varchar', length: 20, ... })` 으로 visibility 컬럼을 선언하면서 CHECK 제약은 SQL 마이그레이션에만 있고 TypeORM entity 에는 없다. 값이 유효한지는 DTO 의 `@IsEnum` 에만 의존하는 구조다.
  - 위치: entity L473~L478
  - 제안: 정보 수준. `@Check("visibility IN ('private', 'workspace')")` TypeORM 데코레이터로 entity 레벨에도 명시할 수 있으나, 현재 마이그레이션 + DTO 검증 이중 방어가 있어 실질적 문제는 없다.

---

### 파일 16: workflow-test-datasets.service.ts

- **[INFO]** `findAccessible` 메서드의 파라미터 `requireOwner: boolean` 은 의미를 즉시 파악하기 어렵다. 호출 시 `true` / `false` 리터럴이 나타나는데, 어느 쪽이 어떤 의미인지 호출 지점에서 자명하지 않다.
  - 위치: service L114, L156, L164, L174
  - 제안: `enum AccessLevel { OWNER_ONLY, READABLE }` 또는 `'owner' | 'readable'` 유니온 타입으로 교체하면 `findAccessible(id, ws, uid, 'owner')` 처럼 읽힌다. 현재 규모에서는 허용 수준이나, 메서드가 공개됐거나 호출 지점이 늘어날 경우 개선 가치가 있다.

- **[INFO]** `saveUnique` 에서 `(err as { code?: string }).code` 캐스팅으로 Postgres 에러 코드를 확인한다. `QueryFailedError` 의 `driverError` 또는 타입 가드를 쓰는 패턴이 코드베이스에 이미 존재한다면 일관성을 맞추는 것이 낫다.
  - 위치: service L194~L195
  - 제안: 기존 코드베이스 패턴 확인 후 일치시키는 것 권장. 기능 문제는 없다.

- **[INFO]** `copyName` 메서드의 `' (Copy)'` 문자열이 하드코딩되어 있고 i18n 처리가 없다. 국제화 환경에서 "Copy" 가 영어로 고정된다.
  - 위치: service L207~L211
  - 제안: 현재 서버 메시지는 영어로 통일돼 있는 것으로 보이므로 허용 수준이다. 단, 프론트가 이 이름을 사용자에게 노출한다면 향후 i18n 이 필요하다.

- **[INFO]** `list` 메서드에서 QueryBuilder 를 사용하면서 컬럼 이름을 `'d.workflow_id'`, `'d.owner_id'` 등 snake_case 로 직접 기술한다. TypeORM entity 에 이미 camelCase 속성이 정의돼 있으므로 `'d.workflowId'` 처럼 속성 이름으로 참조하거나 `FindOptionsWhere` 를 쓰는 방식이 리팩토링 시 더 안전하다.
  - 위치: service L81~L87
  - 제안: 기능상 문제는 없으나, DB 컬럼명 변경 시 이 리터럴도 함께 갱신해야 한다는 점을 주의해야 한다. OR 조건(`(d.owner_id = :userId OR d.visibility = :workspace)`)은 `FindOptionsWhere` 로 표현하기 어려우므로 QueryBuilder 사용 자체는 합리적이다.

---

### 파일 13: workflow-test-datasets.controller.ts

- **[INFO]** `@ApiOperation summary` 에 일부 한국어, 일부 영어가 혼용된다 (예: `'테스트 데이터셋 목록'` vs Swagger `description` 의 영어 문장). 기존 코드베이스 패턴을 따른 것이라면 일관성 있다.
  - 위치: controller L52, L91, L127 등
  - 제안: 정보 수준. 기존 모듈 패턴과 일치하면 현 상태 유지.

- **[INFO]** 컨트롤러의 `@Controller()` 에 prefix 가 없다. `GET /workflows/:workflowId/test-datasets` 와 `PATCH /test-datasets/:id` 두 가지 경로 패턴이 같은 컨트롤러에 혼재한다. 이는 의도적 설계(workflow 범위 vs. 데이터셋 직접 접근)이며 JSDoc 에 설명이 있다.
  - 위치: controller L44
  - 제안: 현 상태 허용. 다만 미래에 prefix 변경이 필요하면 두 경로 그룹을 컨트롤러로 분리하는 것도 고려할 수 있다.

---

### 파일 19: editor-toolbar.tsx

- **[WARNING]** `EditorToolbar` 컴포넌트가 과도하게 긴 단일 파일(850+ 줄)이고 이번 변경으로 데이터셋 관련 상태(4개)·핸들러(4개)·쿼리(1개)가 추가됐다. 컴포넌트가 이미 다수의 책임(실행·히스토리·데이터셋·삭제 확인·네이밍 등)을 보유하고 있으며, 유지보수성이 점진적으로 저하되고 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 전체
  - 제안: 이번 변경 자체가 합리적으로 작성됐으나, 장기적으로 `useDatasetFeature`, `useRunHistoryFeature` 같은 커스텀 훅이나 `DatasetPicker`, `SaveDatasetForm` 서브컴포넌트로 분리해 `EditorToolbar` 의 핵심 레이아웃·실행 진입 책임에 집중하는 리팩토링을 고려할 것을 권장한다. **현 PR 범위에서는 기존 패턴을 따라 동일 파일에 추가한 것이므로 이번 변경의 문제가 아니라 기존 누적 부채다.**

- **[INFO]** `datasetPickerOpen` 와 `historyPickerOpen` 이 상호 배타적으로 관리되지만(한 쪽을 열면 다른 쪽을 닫음), 이 로직이 두 `onClick` 핸들러에 각각 흩어져 있다. 추후 세 번째 picker 가 추가되면 일관성을 유지하기 어렵다.
  - 위치: editor-toolbar.tsx L634~L653
  - 제안: `activePanel: 'datasets' | 'history' | null` 형태의 단일 상태로 통합하는 패턴이 유지보수에 유리하다. 현재 항목 수(2개)에서는 허용 가능.

- **[INFO]** `handleSaveDataset` 의 의존성 배열에 `refreshDatasets` 가 포함된다. `refreshDatasets` 는 `useCallback` 으로 감쌌으나 `queryClient`·`workflowId` 의존성이 있다. 의존성 배열은 정확하게 기술되어 있다. 문제 없음.

- **[INFO]** `handleLoadDataset` 가 `useCallback` 으로 감쌌으나 의존성 배열이 빈 배열(`[]`)이다. 내부에서 외부 상태(`setJsonInput`, `setDatasetPickerOpen`)를 setState setter 로 사용하는데, setter 는 참조 안정이므로 실질적으로 올바르다. 코드는 정확하다.

---

### 파일 20: workflow-test-datasets.ts (프론트엔드 API 클라이언트)

- **[INFO]** `update` 메서드의 시그니처가 `Partial<CreateTestDatasetBody>` 를 사용한다. `CreateTestDatasetBody` 와 `UpdateWorkflowTestDatasetDto` 가 구조상 동일하지만, 백엔드 DTO 이름과 프론트엔드 타입 이름이 달리 표현된다. 이는 허용 수준이나, 추후 `create` 와 `update` 의 필드가 달라지면 별도 타입을 정의해야 한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/lib/api/workflow-test-datasets.ts` L721~L727
  - 제안: 기능상 문제 없음. 단, `UpdateTestDatasetBody` 별도 타입을 정의하면 향후 스키마 발산 시 명확하다.

---

### 파일 18: editor-toolbar-run-input.test.tsx (테스트)

- **[INFO]** 테스트 최상위에 `dsListMock`, `dsCreateMock`, `dsCloneMock`, `dsRemoveMock` 를 분리 선언하고 `vi.mock` 내부에서 래핑하는 패턴은 기존 `toastError` 패턴과 일치한다. 일관성 있다.

- **[INFO]** 테스트 `'Datasets: 목록을 펼치면 저장본을 보여주고, 클릭 시 입력에 적재한다'` 에서 `await waitFor(...)` 가 `fireEvent.click(item)` 이후에 위치하는데, `findByText` 의 비동기 해소 후 동기 클릭이 이뤄지는 구조다. 의도는 이해되지만 `waitFor` 를 클릭 이전에 배치하는 게 더 자연스러운 흐름이다.
  - 위치: test 파일 L623~L628
  - 제안: 정보 수준. 기능 검증에는 문제 없다.

---

### 파일 7: chat-channel/types.ts (삭제)

- **[INFO]** `FormModalField` 에서 `min?`, `max?`, `pattern?` 필드를 제거하는 이번 변경(이전 PR 롤백 또는 재계획)은 인터페이스를 작게 유지한다. 이전 PR 에서 추가됐다가 삭제된 흔적이 plan 에 기록돼 있으므로, 이 삭제가 의도적임은 plan 추적으로 파악 가능하다. 별도 주석이 없더라도 spec-sync-form-gaps.md 의 `[ ]` 체크박스가 근거 역할을 한다.

---

### 파일 8: execution-engine.service.ts (docstring 수정)

- **[INFO]** docstring 에서 `min`/`max`·`pattern` 을 "미적용 (Planned)" 으로 이동한 변경은 이전 변경의 롤백에 해당한다. plan 파일(`spec-sync-form-gaps.md`)의 해당 항목이 다시 `[ ]` 로 복원됐으므로 코드·계획 일관성이 유지된다.

---

## 요약

이번 변경은 신규 `workflow-test-datasets` NestJS 모듈(entity·DTO·service·controller·module), 프론트엔드 API 클라이언트, `EditorToolbar` 컴포넌트 확장, i18n 사전 추가, e2e·unit 테스트 추가로 구성된다. 전반적으로 기존 코드베이스 패턴(NestJS 모듈 구조, TypeORM entity 스타일, React Query 패턴, i18n 사전 구조)을 일관되게 따르고 있으며, 각 계층의 책임 분리도 명확하다. 주요 유지보수 위험은 `EditorToolbar` 의 책임 누적(단일 파일 850+ 줄, 상태 변수 10개 이상)이나 이는 이번 변경의 직접 문제라기보다 기존 누적 부채다. `findAccessible` 의 `boolean` 파라미터 가독성, `copyName` 의 영어 하드코딩, QueryBuilder 내 snake_case 컬럼명 리터럴은 INFO 수준의 개선 여지다. `data` 컬럼을 `input` 속성으로 매핑한 설계는 `TransformInterceptor` 회피 이유가 충분히 문서화되어 있어 허용 가능하다. Critical 발견 없음.

## 위험도

LOW
