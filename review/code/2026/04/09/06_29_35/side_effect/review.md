## 발견사항

### 파일 1: `execution-detail-page` (page.tsx)

- **[WARNING]** `adjacentQuery`가 최대 100개의 실행 목록을 전체 페치
  - 위치: `adjacentQuery` queryFn (~L120-140)
  - 상세: prev/next ID를 찾기 위해 `limit: 100`으로 전체 목록을 가져옴. 실행 수가 많을 경우 불필요한 대용량 네트워크 호출 발생. 현재 실행이 100번째 이후에 있으면 prev/next가 null로 잘못 계산됨.
  - 제안: 백엔드에서 adjacent 엔드포인트를 제공하거나, cursor-based 방식으로 현재 execution의 앞뒤 항목만 조회

- **[WARNING]** `nodeDetailTab`이 노드 선택 시 자동 초기화되지 않는 케이스 존재
  - 위치: `NodeResultsTab` 컴포넌트 내 노드 버튼 클릭 핸들러
  - 상세: 노드 목록 클릭 시 `onSetNodeDetailTab(ne.error ? "error" : "output")`으로 탭을 변경하지만, Timeline에서 노드 클릭 시 `setSelectedNodeId(nodeId); setActiveTab("node-results")`만 실행하고 `nodeDetailTab`은 이전 상태를 유지. 에러 없는 노드에서 에러 있는 노드로 Timeline 경유 시 "error" 탭이 선택된 채 유지될 수 있음.
  - 제안: `onNodeClick` 핸들러에서 `setNodeDetailTab`도 함께 리셋

- **[INFO]** `executionQuery`의 타입 캐스팅 이중 처리
  - 위치: executionQuery queryFn (~L107-112)
  - 상세: `(data as unknown as { data?: ExecutionData }).data ?? data`로 래핑 처리하는데, 이는 API 응답 구조의 불일치를 런타임에 임시 처리. `eslint-disable` 없이 `any` 캐스팅이 필요한 adjacentQuery와 일관성이 없음.
  - 제안: API 클라이언트 레이어에서 응답 unwrapping을 통일

---

### 파일 2: `execution-detail-page.test.tsx`

- **[WARNING]** `vi.clearAllMocks()` 후 mock 재설정 없이 `renderPage()` 호출하는 테스트 패턴
  - 위치: `beforeEach` + `renderPage()` 조합
  - 상세: `createWrapper()`가 매번 새 `QueryClient`를 생성하여 캐시 오염은 방지되지만, `vi.clearAllMocks()`가 `workflowsApi.get`의 초기 mock 구현(`mockResolvedValue(...)`)도 제거함. `workflowsApi`는 `vi.fn().mockResolvedValue(...)`로 모듈 레벨에서 설정되어 있어 `clearAllMocks` 이후에는 구현이 없는 상태가 됨. 테스트 간 실행 순서에 따라 workflow 이름이 표시되지 않을 수 있음.
  - 제안: `beforeEach`에서 `workflowsApi.get`도 재설정하거나 `vi.resetAllMocks()` 대신 `mockGetById`/`mockGetByWorkflow`만 선택적으로 리셋

- **[WARNING]** Failed execution 테스트에서 executionId 불일치
  - 위치: `ExecutionDetailPage - Failed Execution` describe, ~L190
  - 상세: `mockGetById`에 `exec-fail` ID로 설정하지 않고 `failedExec`(id: "exec-1")을 등록한 후, 컴포넌트에는 `executionId: "exec-fail"`을 전달. `queryKey`는 `["execution", "exec-fail"]`이 되지만 mock은 항상 같은 응답을 반환하므로 현재는 통과하나, 실제 ID 검증 로직이 추가되면 깨질 수 있음.
  - 제안: `executionId`를 "exec-1"로 통일하거나 failedExec의 id를 "exec-fail"로 맞춤

- **[INFO]** `screen.getAllByRole("button")`로 버튼 인덱스 접근
  - 위치: 백 버튼 테스트, navigates to execution list 테스트
  - 상세: `buttons[0]`이 항상 ArrowLeft 버튼이라고 가정하는데, DOM 순서 변경 시 테스트가 잘못 통과할 수 있음.
  - 제안: `getByRole("button", { name: /back/i })` 또는 `aria-label` 추가

---

### 파일 3: `execution-list-page.test.tsx`

- **[WARNING]** `vi.clearAllMocks()`로 모듈 레벨 mock 구현 소실
  - 위치: `beforeEach(() => { vi.clearAllMocks(); })`
  - 상세: 파일 2와 동일 문제. `workflowsApi.get`과 `executionsApi.getByWorkflow`가 모듈 레벨에서 `mockResolvedValue`로 설정되어 있는데, `clearAllMocks()`는 이 구현을 제거함. 첫 번째 테스트 이후부터는 mock이 undefined를 반환할 수 있어 Promise rejection 또는 빈 응답 처리로 이어짐.
  - 제안: `beforeEach` 내에서 mock 구현을 재설정

- **[INFO]** `document.querySelectorAll("tbody tr")`의 전역 DOM 의존
  - 위치: "navigates to execution detail on row click" 테스트
  - 상세: `screen` API 대신 `document` 전역을 직접 사용. 병렬 테스트 실행 환경에서 다른 컴포넌트의 DOM과 충돌 가능성 있음(현재 vitest는 기본 격리이므로 실질 위험은 낮음).
  - 제안: `within(screen.getByRole("table")).getAllByRole("row")`로 범위 한정

---

### 파일 4: `execution-list-page` (page.tsx)

- **[INFO]** `handleSort` 호출 시 page 리셋과 sortField 변경이 동시에 발생하나 `useQuery` queryKey 업데이트는 배치 처리
  - 위치: `handleSort` 함수
  - 상세: React의 상태 업데이트 배칭으로 인해 `setSortField`, `setSortOrder`, `setPage`가 한 번에 처리되어 올바르게 동작함. 의도치 않은 중간 상태의 추가 쿼리 발생 없음 — 이 부분은 정상.

- **[INFO]** 페이지네이션 버튼 수가 `totalPages`에 비례하여 무한 증가
  - 위치: Pagination 섹션, `Array.from({ length: totalPages })`
  - 상세: totalPages가 클 경우 버튼이 무한 렌더링됨. 현재 페이지 앞뒤 N개만 보여주는 windowing이 없음.
  - 제안: 현재 페이지 ±2 범위만 렌더링하고 양끝에 첫/마지막 페이지 버튼 제공

---

## 요약

전반적으로 전역 상태 오염이나 파일시스템/환경변수 부작용은 없으며, 인터페이스 시그니처 변경으로 인한 호환성 파괴도 발견되지 않았다. 주요 부작용 위험은 두 가지 영역에 집중된다: (1) `adjacentQuery`의 대량 페치로 인한 불필요한 네트워크 부하 및 100건 초과 시 잘못된 네비게이션 계산, (2) 테스트 파일에서 `vi.clearAllMocks()`가 모듈 레벨 mock 구현을 제거하여 테스트 실행 순서에 따라 불안정한 결과를 초래할 수 있는 패턴. Timeline 탭에서 노드 클릭 시 `nodeDetailTab` 상태가 부분적으로만 초기화되는 것도 의도치 않은 UI 상태 잔류를 유발할 수 있다.

## 위험도

**MEDIUM**