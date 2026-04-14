### 발견사항

- **[WARNING]** `buildSnapshot` 메서드가 public으로 노출됨
  - 위치: `workflows.service.ts`, `buildSnapshot` 메서드 선언부
  - 상세: `buildSnapshot`은 `saveCanvas` 내부에서만 호출되는 유틸리티 메서드이나 `private` 없이 선언되어 클래스 외부에 노출됨. `workflows.service.spec.ts`의 `restoreVersion` 테스트도 이 메서드를 직접 사용하지 않고 `saveCanvas` spy를 통해 검증하므로 `private`으로 변경 가능.
  - 제안: `private buildSnapshot(...)` 으로 변경

- **[WARNING]** `WorkflowVersionsController`의 워크스페이스 소유권 미검증
  - 위치: `workflow-versions.controller.ts`, `findByWorkflow` 및 `findOne` 엔드포인트
  - 상세: `GET /workflows/:wfId/versions` 및 `GET /workflows/:wfId/versions/:versionId`는 workspaceId를 검증하지 않아, 인증된 사용자라면 타 워크스페이스의 버전 이력에 접근 가능. `WorkflowsController`의 `restoreVersion`은 `findById(id, workspaceId)`를 호출하여 소유권을 검증하는 것과 불일치.
  - 제안: 두 엔드포인트에 `@WorkspaceId()` 데코레이터 추가 후 서비스 레이어에서 워크플로우 소유권 검증 추가

- **[INFO]** `mockWorkflowVersionsService.findByWorkflow`가 실제로 테스트되지 않음
  - 위치: `workflows.service.spec.ts`, `mockWorkflowVersionsService` 선언부
  - 상세: `findByWorkflow: jest.fn().mockResolvedValue([])` 가 mock에 포함되나 `WorkflowsService` 관련 테스트 어디서도 호출 검증되지 않음. 불필요한 mock 선언.
  - 제안: 사용하지 않는 `findByWorkflow` mock 제거

- **[INFO]** `DiffSection` 컴포넌트의 children 처리 로직 취약성
  - 위치: `version-diff-dialog.tsx`, `DiffSection` 함수 내부
  - 상세: `Array.isArray(children) ? children : [children]` 후 `.filter(Boolean)` 처리는 React children이 단일 요소일 때 의도대로 동작하나, React의 `Children` API를 사용하지 않아 엣지 케이스 발생 가능. 현재 사용 패턴(빈 배열 `map` 결과)에서는 정상 동작함.
  - 제안: `React.Children.count(children) === 0` 패턴 사용 또는 부모에서 빈 배열 여부를 미리 확인 후 조건부 렌더링

- **[INFO]** `createVersion`의 `changeSummary || undefined` 처리
  - 위치: `workflow-versions.service.ts`, `createVersion` 메서드
  - 상세: 빈 문자열 `""`을 `undefined`로 변환하여 DB에 `NULL`로 저장. 의도된 동작이라면 명시적으로 `changeSummary === '' ? undefined : changeSummary` 형태가 가독성을 높임. 현재 동작은 스펙과 일치.
  - 제안: 명시적 비교로 변경 (선택 사항)

---

### 요약

전체 변경은 `spec/2-navigation/12-workflow-version-history.md`에 정의된 워크플로우 버전 이력 기능 구현 범위에 충실하게 집중되어 있다. 캔버스 저장 시 자동 스냅샷, 버전 목록/상세 조회, Diff, 복원 기능을 포함한 백엔드/프론트엔드 변경 모두 스펙 항목과 1:1 대응되며, 무관한 파일 수정이나 불필요한 리팩토링은 발견되지 않았다. 다만 `WorkflowVersionsController`에서 워크스페이스 소유권 검증이 누락된 점은 동일 모듈 내 다른 엔드포인트와의 일관성 측면에서 수정이 필요하며, `buildSnapshot`의 접근 제어자 누락은 의도하지 않은 API 노출에 해당한다.

### 위험도

**MEDIUM**