### 발견사항

---

**[WARNING] STATUS_* 상수 3종이 두 파일에 중복 정의됨**
- 위치: `page.tsx` (ExecutionDetailPage) L22-42, `executions/page.tsx` (ExecutionListPage) L22-42
- 상세: `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL` 와 `formatDuration` 함수가 두 파일에 동일하게 존재. 상태값 추가 시 두 곳을 모두 수정해야 함.
- 제안: `src/lib/utils/execution-status.ts` 또는 `src/lib/constants/execution.ts`로 추출하여 공유.

---

**[WARNING] API 응답 래핑 처리가 일관성 없이 분산됨**
- 위치: `[executionId]/page.tsx` L105-109, L117-124, `executions/page.tsx` L152-156
- 상세: `(data as any).data ?? data`, `(data as unknown as { data?: ExecutionData }).data ?? data` 패턴이 각 queryFn마다 반복. `eslint-disable` 주석도 반복 등장. API 클라이언트 레이어에서 응답 정규화가 이루어지지 않고 있음.
- 제안: `executionsApi`/`workflowsApi` 내부 또는 axios interceptor에서 `data.data ?? data`를 한 번만 처리.

---

**[WARNING] `adjacentQuery`가 전체 실행 목록 100건을 매번 fetch하는 비효율 구조**
- 위치: `[executionId]/page.tsx` L115-133
- 상세: prev/next 탐색을 위해 `limit: 100`으로 전체를 가져와 클라이언트에서 인덱스를 찾음. 목록이 100건 초과 시 누락. 이 로직은 유지보수 중 쉽게 놓칠 수 있는 암묵적 한계.
- 제안: 백엔드에 `prev`/`next` ID를 반환하는 엔드포인트 추가, 또는 쿼리 파라미터로 커서 기반 탐색 지원. 최소한 상수와 주석으로 한계를 명시.

---

**[WARNING] `NodeResultsTab` props가 과도하게 많음 (6개)**
- 위치: `[executionId]/page.tsx` L295-305
- 상세: `nodeExecutions`, `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab` — 상태와 핸들러가 모두 외부에서 주입됨. 컴포넌트 내부에서 관리해도 되는 상태가 부모로 끌어올려져 있어 시그니처가 복잡.
- 제안: `selectedNodeId`와 `nodeDetailTab` 상태를 `NodeResultsTab` 내부로 이동. Timeline에서 node 클릭 시 탭 전환만 부모에서 처리하면 됨.

---

**[INFO] `detailTabs` 배열이 렌더마다 재생성됨**
- 위치: `[executionId]/page.tsx` L307-311
- 상세: `NodeResultsTab` 함수 본문에 `detailTabs` 배열 리터럴이 선언되어 있어 매 렌더마다 새 배열 생성. `selectedNode?.error` 의존성이 있어 `useMemo` 적용이 적절.
- 제안: `useMemo(() => [...], [selectedNode?.error])`로 감싸거나 상수 배열로 분리 후 `show` 조건만 인라인 처리.

---

**[INFO] 테스트의 `Failed Execution` describe 블록이 `createWrapper` 헬퍼를 사용하지 않음**
- 위치: `execution-detail-page.test.tsx` L150-170
- 상세: 해당 블록에서만 인라인으로 `QueryClientProvider` + `Suspense` wrapper를 직접 구성. 위에 `createWrapper()` 헬퍼가 있음에도 재사용하지 않아 일관성 부족.
- 제안: `createWrapper()` 또는 `renderPage()` 헬퍼 재사용.

---

**[INFO] `execution-list-page.test.tsx`의 `mockBack`이 선언되었으나 미사용**
- 위치: `execution-list-page.test.tsx` L6
- 상세: `const mockBack = vi.fn()`이 선언되어 있으나 어떤 assertion에서도 사용되지 않음. 불필요한 노이즈.
- 제안: 실제로 `router.back()`을 검증하는 테스트 추가 또는 변수 제거.

---

**[INFO] 페이지네이션 버튼이 `totalPages`가 많을 때 UI 깨짐**
- 위치: `executions/page.tsx` L241-258
- 상세: `Array.from({ length: totalPages }).map(...)` 로 페이지 버튼을 전부 렌더링. 페이지 수가 많으면 버튼이 수십 개 나열됨. 유지보수 중 페이지 수 증가 시 UI 문제 발생.
- 제안: 슬라이딩 윈도우 방식의 페이지 번호 표시 (예: 현재 ±2 범위 + 양 끝) 또는 숫자 버튼 제거하고 "Page X / Y" 텍스트만 표시.

---

### 요약

전반적으로 코드 구조는 명확하고 각 컴포넌트의 역할이 잘 분리되어 있다. 그러나 `STATUS_ICON/BADGE_VARIANT/LABEL` 상수와 `formatDuration` 함수가 두 파일에 그대로 복제되어 있어, 실행 상태가 추가되거나 변경될 때 양쪽을 모두 수정해야 하는 동기화 위험이 가장 큰 유지보수 부담이다. API 응답 정규화 패턴의 분산과 `eslint-disable` 주석 반복은 API 레이어 추상화 부재를 나타내며, `NodeResultsTab`의 과도한 props는 상태 위치 결정 재검토가 필요함을 시사한다. 테스트는 주요 시나리오를 잘 커버하고 있으나 헬퍼 함수 미재사용과 미사용 mock 등 소소한 일관성 문제가 있다.

### 위험도

**MEDIUM**