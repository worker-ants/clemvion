### 발견사항

---

**[WARNING] API 응답 정규화 로직이 프레젠테이션 레이어에 분산됨**
- 위치: `[executionId]/page.tsx` L105-124, `executions/page.tsx` L152-156
- 상세: `(data as any).data ?? data`, `(data as unknown as { data?: ExecutionData }).data ?? data` 패턴이 각 queryFn 내부에 반복. 이는 레이어 책임 원칙 위반으로, API 응답 구조의 불일치(래핑 여부)를 처리하는 책임이 프레젠테이션 계층에 노출됨. API 클라이언트 계층(`executionsApi`, `workflowsApi`)이 응답을 정규화하지 않아 모든 소비자가 이를 직접 처리해야 하는 구조.
- 제안: `executionsApi` / `workflowsApi` 내부 또는 axios interceptor에서 `response.data?.data ?? response.data` 정규화를 단 한 번 수행. 프레젠테이션 계층은 타입이 보장된 도메인 객체만 수신해야 함.

---

**[WARNING] 인접 실행 탐색 로직(`adjacentQuery`)이 프론트엔드에 위치**
- 위치: `[executionId]/page.tsx` L115-143
- 상세: "현재 실행의 이전/다음 실행을 찾는다"는 비즈니스 로직이 클라이언트 사이드 `useMemo`/`findIndex`로 구현되어 있음. 이를 위해 최대 100건을 전체 페치하는 구조는 책임 위치 오류의 직접적 결과임. 백엔드에 이미 정렬·필터 API가 존재하는 상황에서 이 로직이 프론트엔드에 있는 것은 레이어 경계 위반이며, 데이터 규모에 따라 기능이 조용히 깨지는 구조.
- 제안: 백엔드에 `/api/executions/:id/adjacent` 또는 커서 기반 prev/next 파라미터를 추가. 프론트엔드는 ID만 수신하여 네비게이션에 사용.

---

**[WARNING] STATUS_* 상수와 `formatDuration`의 이중 정의**
- 위치: `executions/page.tsx` L22-65, `[executionId]/page.tsx` L22-65
- 상세: 동일한 도메인 상수(`STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`)와 유틸 함수가 두 페이지 파일에 복사됨. 이는 DRY 원칙 위반이며, 응집도(cohesion) 관점에서 실행 상태에 관한 정보가 한 곳에 모여 있어야 한다는 원칙에 어긋남. 상태 값이 추가될 때 양쪽을 동기화해야 하는 암묵적 계약이 생기며, 이는 변경에 닫혀있지 않은 구조(OCP 위반).
- 제안: `src/lib/constants/execution-status.ts`로 추출. 두 페이지가 이를 공유하면 상태 정의 변경이 자동으로 전파됨.

---

**[WARNING] `NodeResultsTab` 컴포넌트의 props 과다 및 상태 소유권 오류**
- 위치: `[executionId]/page.tsx` L295-305
- 상세: `nodeExecutions`, `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab` 6개 props 중 `selectedNodeId`와 `nodeDetailTab`은 `NodeResultsTab` 내부에서 완전히 관리 가능한 UI 상태임. 이를 부모로 끌어올린 것은 단일 책임 원칙(SRP) 위반으로, 부모 컴포넌트가 자식의 UI 상태를 소유·관리하는 구조가 됨. 또한 `onNodeClick`(Timeline)에서 노드를 클릭할 때 `nodeDetailTab` 리셋이 누락되는 버그가 상태 소유권 분산에서 비롯됨.
- 제안: `selectedNodeId`, `nodeDetailTab` 상태를 `NodeResultsTab` 내부로 이동. 부모→자식 인터페이스는 `nodeExecutions`와 `initialSelectedNodeId`(Timeline 클릭 시 선택 알림용)만 유지.

---

**[INFO] 페이지 컴포넌트가 데이터 페칭·상태·렌더링 책임을 모두 담당**
- 위치: `[executionId]/page.tsx` 전체
- 상세: 단일 파일이 데이터 페칭(React Query), API 응답 정규화, 비즈니스 로직(인접 탐색, 집계), UI 상태(activeTab, selectedNodeId, nodeDetailTab), 렌더링을 모두 수행. SRP 관점에서 책임이 과도하게 집중됨. 현재 규모에서는 관리 가능하나, Preview 탭 기능(Carousel, Table, AI Agent 시각화 등) 확장 시 파일이 빠르게 비대해질 구조.
- 제안: 데이터 페칭 로직을 커스텀 훅(`useExecutionDetail`, `useAdjacentExecutions`)으로 분리. 노드 결과 표시 로직은 `NodeResultsPanel` 복합 컴포넌트로 캡슐화.

---

**[INFO] `currentIndex === -1` 엣지 케이스에서 잘못된 인접 항목 반환**
- 위치: `[executionId]/page.tsx` L137-143
- 상세: adjacentQuery의 `queryFn` 내부에서 `currentIndex`가 -1일 때 조기 반환 없이 `items[-1 + 1] = items[0]`이 반환됨. 이는 비즈니스 로직 버그이지만, 로직이 프론트엔드에 잘못 위치함으로써 발생하는 아키텍처적 결과이기도 함.
- 제안: 단기적으로 `if (currentIndex === -1) return { prev: null, next: null }` 가드 추가. 근본적으로는 인접 탐색 로직을 백엔드로 이전.

---

### 요약

두 페이지 컴포넌트는 기능적으로 올바르게 구현되어 있으나, 아키텍처 관점에서 레이어 책임 분리가 미흡하다. 가장 큰 문제는 API 응답 정규화(`data.data ?? data`)와 인접 실행 탐색 비즈니스 로직이 프레젠테이션 계층에 혼재한다는 점이다. 이는 API 클라이언트 레이어의 추상화 부재에서 비롯되며, 결과적으로 동일 패턴이 각 queryFn마다 복제되는 구조를 만들었다. 도메인 상수(`STATUS_*`)와 유틸(`formatDuration`)의 이중 정의는 변경 시 양쪽 동기화를 요구하는 암묵적 계약을 형성하며, `NodeResultsTab`의 과도한 props는 상태 소유권이 잘못 배치되어 있음을 보여준다. 전반적으로 각 계층(API Client → Custom Hook → Page → Component)의 경계를 강화하고, 도메인 로직을 적절한 위치로 이동시키는 것이 핵심 과제다.

### 위험도

**MEDIUM**