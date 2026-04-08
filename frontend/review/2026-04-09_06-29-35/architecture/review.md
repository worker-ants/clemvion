## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] 상태/로직 중복 — STATUS_ICON, STATUS_BADGE_VARIANT, STATUS_LABEL 상수 중복 정의**
- 위치: `executions/[executionId]/page.tsx:22-48`, `executions/page.tsx:21-47`
- 상세: 두 파일에서 동일한 상수 3개가 그대로 복사되어 있음. `formatDuration` 함수도 동일하게 중복. 변경 시 양쪽을 동시에 수정해야 하는 유지보수 부담 발생.
- 제안: `@/lib/constants/execution-status.ts` 또는 `@/components/executions/status.ts` 로 추출하여 단일 출처(Single Source of Truth)를 유지.

---

**[WARNING] 데이터 레이어 책임 누출 — API 응답 unwrapping이 컴포넌트 내에 산재**
- 위치: `executions/[executionId]/page.tsx:112-117`, `executions/page.tsx:153-160`
- 상세: `(data as any).data ?? data`, `(data as unknown as { data?: ExecutionData }).data ?? data` 형태의 응답 파싱 로직이 UI 컴포넌트의 `queryFn` 안에 반복됨. API 응답 구조의 변경이 모든 컴포넌트에 영향을 미침.
- 제안: `executionsApi.getById`, `executionsApi.getByWorkflow` 가 정규화된 데이터를 반환하도록 API 레이어에서 처리. 또는 별도 adapter/mapper 계층 도입.

---

**[WARNING] 인접 실행 네비게이션의 비효율적 데이터 페칭**
- 위치: `executions/[executionId]/page.tsx:119-136`
- 상세: 이전/다음 버튼을 위해 최대 100건 전체를 로드하고 클라이언트에서 현재 위치를 탐색하는 방식. 실행 내역이 100건을 초과하면 네비게이션 누락이 발생하며, 불필요한 데이터를 전송함.
- 제안: 백엔드에서 `prev_id`, `next_id`를 단일 execution 상세 응답에 포함하거나, 전용 `getAdjacentExecutions(executionId)` API 엔드포인트를 제공하는 것이 바람직.

---

**[WARNING] 과도한 prop drilling — NodeResultsTab 컴포넌트**
- 위치: `executions/[executionId]/page.tsx:280-298` (NodeResultsTab props 정의)
- 상세: `NodeResultsTab`이 6개의 props를 받으며 그 중 `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab`은 모두 해당 컴포넌트 내부에서 관리될 수 있는 상태임. 부모 컴포넌트가 하위 탭의 내부 선택 상태를 소유하는 구조는 응집도를 낮춤.
- 제안: `selectedNodeId`, `nodeDetailTab` 상태를 `NodeResultsTab` 내부로 이동. Timeline 탭 클릭 시 초기 노드를 설정해야 하는 경우 `defaultSelectedNodeId` prop으로 단방향 전달.

---

**[INFO] 페이지네이션 버튼 수 제한 없음**
- 위치: `executions/page.tsx:259-269`
- 상세: `totalPages`가 크면 (예: 50페이지) 모든 페이지 버튼을 렌더링하여 UI가 깨짐.
- 제안: 슬라이딩 윈도우 방식의 페이지네이션 (e.g., 1 ... 4 5 6 ... 20) 적용.

---

**[INFO] 테스트 격리 미흡 — `vi.mock`의 고정 구현**
- 위치: `execution-list-page.test.tsx:18-59`
- 상세: `vi.mock`에서 `getByWorkflow`를 고정 데이터로 직접 mock하면 `beforeEach`의 `vi.clearAllMocks()`가 구현을 초기화하지 못함. (clearAllMocks는 호출 기록만 초기화, 구현은 유지)
- 제안: `execution-detail-page.test.tsx`처럼 `mockGetByWorkflow`를 변수로 분리하고 `beforeEach`에서 `mockResolvedValue`로 설정.

---

**[INFO] QueryKey 범위 불일치**
- 위치: `executions/[executionId]/page.tsx:103-108` (`queryKey: ["workflow", workflowId]`), `executions/page.tsx:140-145`
- 상세: 두 페이지 모두 `["workflow", workflowId]`로 동일한 쿼리키를 사용하는 것은 의도된 캐시 공유이지만, execution 상세 페이지에서 workflow 정보를 별도로 fetching하는 것은 list 페이지에서 이미 보유한 데이터를 재사용하지 못함을 의미.
- 제안: 현재 구조에서는 캐시 공유가 자동으로 일어나므로 큰 문제는 아니나, 이를 의도적임을 코멘트로 명시하거나 workflow 데이터를 layout 레벨에서 제공하는 방안 검토.

---

### 요약

전반적으로 컴포넌트 분리와 React Query 활용은 적절하나, **두 페이지 간 상수·유틸 중복**과 **API 응답 파싱 로직의 컴포넌트 내 산재**가 가장 큰 아키텍처 부채다. 특히 `any` 캐스팅을 포함한 response unwrapping이 여러 곳에 반복되는 것은 API 레이어의 책임 경계가 명확하지 않음을 나타낸다. 인접 실행 네비게이션의 오버페칭 전략은 규모 확장 시 기능 결함으로 이어질 수 있으며, `NodeResultsTab`의 과도한 prop drilling은 해당 컴포넌트의 응집도를 저해한다. 테스트는 주요 시나리오를 충실히 커버하나 mock 격리 방식의 불일치가 부분적으로 존재한다.

### 위험도

**MEDIUM**