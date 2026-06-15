# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 없음 — 의도치 않은 상태 변경
모든 서비스 메서드(`list`, `create`, `update`, `remove`, `clone`)는 TypeORM Repository를 통해 DB 행만 변경하며, 외부 전역 상태나 모듈 수준 변수를 건드리지 않는다. `toDto`·`copyName`·`findAccessible` 등 내부 헬퍼는 순수 변환 함수다.

### 발견사항 없음 — 전역 변수
새로 도입된 코드는 모두 NestJS DI 컨텍스트(Injectable, 인스턴스 변수) 또는 React 컴포넌트 로컬 state(`useState`) 안에 캡슐화된다. 모듈 스코프 가변 전역은 없다.

### 발견사항 없음 — 파일시스템 부작용
마이그레이션 파일(V097)은 Flyway 등 마이그레이션 도구가 명시적으로 실행하기 전까지는 아무 효과도 없다. 애플리케이션 코드에서 파일을 생성·수정·삭제하는 경로는 없다.

### **[WARNING]** `ROOT_ENTITIES` 배열 확장 — 기동 시 TypeORM 메타데이터 스캔 부하 소폭 증가
- 위치: `/codebase/backend/src/database/root-entities.ts` (line 434)
- 상세: `ROOT_ENTITIES`에 `WorkflowTestDataset`가 추가됨으로써 TypeORM이 애플리케이션 부트 시 파싱·등록해야 할 entity 수가 1개 늘어난다. 이는 정상적인 신규 entity 등록 절차이며, 기존 entity 행동에는 영향 없다. 다만 `app.module.spec.ts`의 cardinality 검사(`ROOT_ENTITIES.size === REQUIRED_ENTITIES.length`)가 양쪽 모두 동기화되지 않으면 CI에서 즉시 감지된다 — 이번 변경은 두 곳 모두 일관되게 갱신됨.
- 제안: 문제 없음. INFO 수준으로 충분하나, 향후 entity 추가 시 이 패턴을 그대로 유지하면 된다.

### **[INFO]** `WorkflowTestDatasetsModule`이 `Workflow` entity를 `forFeature`에 추가 등록
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.module.ts` (line 1233)
- 상세: `TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])`로 `Workflow`가 이 모듈의 Repository에도 등록된다. `WorkflowsModule`이 이미 `Workflow`를 등록하고 있으므로, NestJS 모듈 경계에서 중복 등록되는 상황이다. TypeORM의 `forFeature` 중복 등록은 정상 지원되며 충돌하지 않는다. 단, `Workflow` repository 접근이 두 모듈에 걸쳐 있으므로 향후 `WorkflowsModule`의 내부 구현이 변경될 경우 이 의존성을 인지해야 한다.
- 제안: 현재 동작에는 문제 없음. `WorkflowsModule`이 `WorkflowRepository`를 export하는 방식으로 리팩터링하면 의존성 방향이 더 명확해진다(선택사항).

### **[INFO]** 프론트엔드 `queryClient.invalidateQueries` 호출 — 관련 캐시 무효화 파급
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (refreshDatasets 콜백, ~line 2547)
- 상세: `queryKey: ["editor-test-datasets", workflowId]`로 범위가 명확히 제한되어 있어, 다른 쿼리 캐시에 영향을 주지 않는다. 데이터셋 CRUD 성공 후 목록만 재조회하는 의도와 일치한다.
- 제안: 문제 없음.

### **[INFO]** `historyPickerOpen`과 `datasetPickerOpen`의 상호 토글 로직 — 공유 UI 상태 변경
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (line ~2643, ~2659)
- 상세: "Datasets" 버튼 클릭 시 `setHistoryPickerOpen(false)`를, "History" 버튼 클릭 시 `setDatasetPickerOpen(false)`를 함께 호출한다. 이는 두 피커가 동시에 열리지 않도록 의도된 동작이며, 기존 `historyPickerOpen` 상태의 시맨틱을 변경하지 않는다. Cancel 버튼 핸들러에도 `setDatasetPickerOpen(false)`·`setSaveFormOpen(false)` 등이 추가되어 정리가 완전하다.
- 제안: 문제 없음. 의도된 상호 배타 동작이다.

### **[INFO]** 엔티티 컬럼명(`data`)과 TypeScript 속성명(`input`) 불일치 — TransformInterceptor 충돌 회피 의도
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` (line 809)
- 상세: `@Column({ name: 'data', type: 'jsonb' }) input: ...` 구조는 의도적으로 응답 최상위에 `data` 키를 피하기 위한 설계다(주석에 명시). DB 컬럼과 TS 속성 이름이 다른 것은 TypeORM의 `name` 옵션이 정상 처리한다. 부작용 없음.
- 제안: 문제 없음. 설계 의도가 주석으로 명확히 문서화되어 있다.

### **[INFO]** e2e 테스트의 `db` Client — 테스트 간 DB 연결 공유
- 위치: `/codebase/backend/test/workflow-test-dataset.e2e-spec.ts` (line 1981, 1989)
- 상세: `beforeAll`에서 `db.connect()`를 호출하지만, `afterAll`에서 `db.end()`를 호출하는 코드가 없다. 다른 e2e 스펙들과 비교했을 때 패턴 일관성 확인이 필요하다. 단, 테스트 러너 종료 시 프로세스가 끝나므로 실제 연결 누수가 운영에 영향을 주지는 않는다. 단 Jest의 "open handles" 경고가 발생할 수 있다.
- 제안: `afterAll(async () => { await db.end(); });` 추가를 권장한다(LOW 우선순위, 테스트 안정성).

## 요약

이번 변경은 `workflow_test_dataset` 테이블 및 관련 NestJS 모듈(서비스·컨트롤러·DTO·entity)을 새로 추가하고, 프론트엔드 에디터 툴바에 데이터셋 저장/불러오기 UI를 추가하는 순수 신규 기능 구현이다. 기존 entity·모듈·API의 시그니처나 공개 인터페이스를 변경하지 않으며, 전역 변수 도입·파일시스템 부작용·환경 변수 읽기·네트워크 호출 추가는 없다. `ROOT_ENTITIES` 배열과 `AppModule` imports 배열에 대한 추가는 기존 패턴을 그대로 따른 정상 등록이고 cardinality 가드 테스트로 동기화가 검증된다. 식별된 INFO 항목들은 모두 의도된 설계 결정이거나 미미한 테스트 정리 권장사항으로, 기능·안전성에 영향을 주지 않는다.

## 위험도

LOW
