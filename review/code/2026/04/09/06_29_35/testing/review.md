### 발견사항

---

**[WARNING] `formatDuration` 함수에 대한 단위 테스트 없음**
- 위치: `page.tsx` (both list and detail), `execution-detail-page.test.tsx`
- 상세: `formatDuration`은 ms/s/m 단위 변환, null 처리, 경계값(999ms, 1000ms, 59.9s, 60s)을 포함하는 순수 함수임에도 전용 단위 테스트가 없음. 두 파일에 동일 로직이 중복 정의되어 있어 불일치 위험 존재.
- 제안: `formatDuration.test.ts`에서 `null`, `0`, `999`, `1000`, `59999`, `60000`, `3661000` 등 경계값 단위 테스트 추가

---

**[WARNING] 로딩/에러 상태 테스트 부재**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx`
- 상세: `executionQuery.isLoading` 시 스켈레톤 렌더링, API 실패 시 에러 처리, execution 데이터가 null일 때 "Execution not found" 화면 등 주요 분기가 테스트되지 않음.
- 제안:
  ```ts
  it("renders skeleton while loading", async () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    // verify animate-pulse elements appear
  });
  it("renders not found when execution is null", async () => {
    mockGetById.mockResolvedValue({ data: { data: null } });
    expect(await screen.findByText("Execution not found.")).toBeDefined();
  });
  ```

---

**[WARNING] 페이지네이션/정렬/필터 상태 변경 테스트 없음**
- 위치: `execution-list-page.test.tsx`
- 상세: `ExecutionListPage`의 핵심 기능인 정렬(컬럼 헤더 클릭 시 `sortField`/`sortOrder` 변경), 필터 버튼 클릭 시 API 재호출, 페이지네이션 동작이 전혀 테스트되지 않음. `handleSort` 토글 로직(asc→desc→asc)도 미검증.
- 제안: 정렬 클릭 후 `mockGetByWorkflow`가 적절한 파라미터로 재호출되었는지, `Completed` 필터 클릭 후 `status: "completed"` 파라미터가 전달되는지 검증 테스트 추가

---

**[WARNING] Prev/Next 네비게이션 버튼 테스트 없음**
- 위치: `execution-detail-page.test.tsx`
- 상세: `adjacentQuery`를 통해 이전/다음 실행으로 이동하는 기능이 테스트되지 않음. prev/next가 null일 때 버튼 비활성화 여부도 미검증.
- 제안:
  ```ts
  it("prev button is disabled when no previous execution", async () => {
    // mockGetByWorkflow returns current exec at index 0 (no prev)
    await renderPage();
    const prevBtn = await screen.findByText("Prev");
    expect(prevBtn.closest("button")).toBeDisabled();
  });
  it("navigates to prev execution on click", async () => { ... });
  ```

---

**[WARNING] Timeline → Node Results 탭 연동 테스트 불완전**
- 위치: `execution-detail-page.test.tsx` L83-91
- 상세: Timeline에서 노드 클릭 시 Node Results 탭으로 전환되고 해당 노드가 선택되는 동작(`onNodeClick`)이 테스트되지 않음. 현재 테스트는 탭 전환만 검증.
- 제안:
  ```ts
  it("clicking node in timeline switches to Node Results with node selected", async () => {
    await renderPage();
    const timelineNode = await screen.findByText("Data Transform");
    fireEvent.click(timelineNode.closest("button")!);
    expect(screen.queryByText("Select a node to view details")).toBeNull();
    expect(screen.getByText("transform")).toBeDefined(); // badge visible
  });
  ```

---

**[WARNING] Failed Execution 테스트에서 `vi.clearAllMocks()` 후 mock 미재설정 문제**
- 위치: `execution-detail-page.test.tsx` L118
- 상세: `vi.clearAllMocks()` 후 `mockGetByWorkflow`를 재설정하지 않아, `adjacentQuery`가 실패할 수 있음. `mockGetByWorkflow.mockResolvedValue(...)` 호출이 누락되면 undefined rejection 발생 가능.
- 제안: 실제로는 `mockGetByWorkflow`도 설정하고 있으나, `exec-fail` ID로 조회 시 items 배열에 없으므로 `currentIndex = -1` → prev/next 모두 null이 되는 엣지 케이스를 명시적으로 검증 필요

---

**[INFO] `NodeResultsTab` input/output/error 탭 전환 테스트 없음**
- 위치: `execution-detail-page.test.tsx`
- 상세: 노드 선택 후 Input/Output/Error 서브탭 전환, `JsonViewer` 렌더링, error 탭 조건부 노출(`show: !!selectedNode?.error`) 미검증
- 제안: 노드 선택 후 "Input" 탭 클릭 → `inputData` JSON이 렌더링되는지 검증하는 테스트 추가

---

**[INFO] `execution-list-page.test.tsx`의 `beforeEach`에서 `vi.clearAllMocks()`만 호출하고 mock 재설정 없음**
- 위치: `execution-list-page.test.tsx` L54-56
- 상세: 모듈 레벨에서 `vi.mock` 시 `mockResolvedValue`로 설정했으나, `vi.clearAllMocks()`가 이를 초기화함. 현재 테스트들이 통과되는 것은 각 테스트 실행 전 mock이 아직 살아있기 때문으로, 순서 의존성 발생 가능.
- 제안: `beforeEach` 내에서 `(executionsApi.getByWorkflow as vi.Mock).mockResolvedValue(...)` 형태로 매 테스트마다 명시적 재설정

---

**[INFO] `mockBack` 변수가 선언되었으나 `router.back()` 호출 테스트 없음**
- 위치: `execution-list-page.test.tsx` L6
- 상세: `mockBack`을 정의했으나 실제 검증에 사용하는 테스트가 없음. Back 버튼이 `router.back()`을 호출하는지 검증 누락.
- 제안:
  ```ts
  it("navigates back on back button click", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "" })); // ArrowLeft icon button
    expect(mockBack).toHaveBeenCalled();
  });
  ```

---

### 요약

전반적으로 핵심 렌더링 시나리오(정상 완료, 실패 실행, 탭 전환, 노드 선택, 네비게이션)에 대한 기본 테스트는 구성되어 있으나, 로딩/에러 상태, 인터랙티브 기능(정렬·필터·페이지네이션·Prev/Next), 서브탭 동작 등 중요한 커버리지 갭이 다수 존재한다. 특히 `vi.clearAllMocks()` 후 mock 재설정 누락으로 인한 테스트 간 암묵적 순서 의존성은 CI 환경에서 비결정적 실패를 유발할 수 있어 즉시 수정이 필요하다. `formatDuration`처럼 두 파일에 중복 정의된 순수 함수는 단위 테스트와 함께 공통 모듈로 분리하는 것이 바람직하다.

### 위험도

**MEDIUM**