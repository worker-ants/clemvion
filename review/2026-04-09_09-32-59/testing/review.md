### 발견사항

---

**[WARNING] `vi.clearAllMocks()`가 모듈 레벨 mock 구현을 제거하여 테스트 순서 의존성 발생**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` — `beforeEach`
- 상세: `vi.mock()` 블록에서 `mockResolvedValue()`로 설정한 구현이 `vi.clearAllMocks()` 호출 시 제거된다. 이후 테스트에서 mock이 `undefined`를 반환하거나 reject하여 비결정적 실패를 유발한다. CI 환경에서 테스트 실행 순서가 달라지면 재현 불가능한 실패가 발생한다.
- 제안:
  ```ts
  beforeEach(() => {
    vi.clearAllMocks();
    // 모든 mock 구현을 명시적으로 재설정
    mockGetById.mockResolvedValue({ data: { data: mockExecution } });
    (workflowsApi.get as vi.Mock).mockResolvedValue({ data: { data: mockWorkflow } });
    (executionsApi.getByWorkflow as vi.Mock).mockResolvedValue({ data: mockListResponse });
  });
  ```

---

**[WARNING] `formatDuration` 순수 함수에 대한 단위 테스트 없음**
- 위치: `executions/page.tsx:57-65`, `[executionId]/page.tsx:57-65`
- 상세: ms/s/m 단위 변환과 null 처리를 포함하는 순수 함수임에도 단위 테스트가 전혀 없다. 두 파일에 동일 로직이 중복 정의되어 있어 불일치 발생 시 발견이 어렵다.
- 제안: 공통 모듈로 추출 후 경계값 테스트 추가
  ```ts
  // formatDuration.test.ts
  it.each([
    [null, "—"],
    [0, "0ms"],
    [999, "999ms"],
    [1000, "1.0s"],
    [59999, "60.0s"],
    [60000, "1.0m"],
    [3661000, "61.0m"],
  ])("formatDuration(%i) = %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
  ```

---

**[WARNING] 로딩/에러/빈 상태 분기 테스트 누락**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx`
- 상세: 다음 주요 분기가 테스트되지 않는다:
  - `executionQuery.isLoading` → 스켈레톤 렌더링
  - `executionQuery.isError` → "Failed to load execution." 에러 UI (스펙 §3.5)
  - `execution === null` → "Execution not found." UI
  - 실행 목록이 빈 경우 → 빈 상태 UI
- 제안:
  ```ts
  it("renders skeleton while loading", async () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
  
  it("renders error UI when API fails", async () => {
    mockGetById.mockRejectedValue(new Error("Network error"));
    renderPage();
    expect(await screen.findByText(/Failed to load execution/)).toBeDefined();
  });
  
  it("renders not found when execution is null", async () => {
    mockGetById.mockResolvedValue({ data: { data: null } });
    renderPage();
    expect(await screen.findByText("Execution not found.")).toBeDefined();
  });
  ```

---

**[WARNING] 페이지네이션/정렬/필터 인터랙션 테스트 전무**
- 위치: `execution-list-page.test.tsx`
- 상세: `ExecutionListPage`의 핵심 기능인 다음 동작이 모두 미검증이다:
  - 컬럼 헤더 클릭 → `sortField`/`sortOrder` 변경 + API 재호출
  - `asc → desc → asc` 토글 로직
  - 필터 버튼 클릭 → `status` 파라미터 전달
  - 필터 변경 시 1페이지 리셋
  - 페이지 버튼 클릭 → `page` 파라미터 변경
- 제안:
  ```ts
  it("resets to page 1 when filter changes", async () => {
    // page 2로 이동 후 필터 클릭
    fireEvent.click(screen.getByText("Completed"));
    expect(mockGetByWorkflow).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "completed", page: 1 })
    );
  });
  ```

---

**[WARNING] Prev/Next 네비게이션 버튼 동작 테스트 없음**
- 위치: `execution-detail-page.test.tsx`
- 상세: `adjacentQuery`를 통한 이전/다음 실행 이동 기능이 전혀 테스트되지 않는다. prev/next가 null일 때 버튼 비활성화 여부도 미검증이다.
- 제안:
  ```ts
  it("disables Prev button when no previous execution", async () => {
    mockGetByWorkflow.mockResolvedValue({
      data: { data: [mockExecution], pagination: { ... } }
    }); // currentIndex = 0, no prev
    await renderPage();
    const prevBtn = await screen.findByRole("button", { name: /prev/i });
    expect(prevBtn).toBeDisabled();
  });
  
  it("navigates to next execution on Next click", async () => {
    // adjacentQuery에 next가 존재하는 상황 설정
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("exec-2"));
  });
  ```

---

**[WARNING] `currentIndex === -1` 엣지 케이스 테스트 없음**
- 위치: `execution-detail-page.test.tsx` — `adjacentQuery` 관련
- 상세: `items` 배열에 현재 `executionId`가 없을 때 `currentIndex = -1`이 되면 `items[-1+1] = items[0]`이 next로 반환되는 버그가 발생한다 (requirement 리뷰에서도 지적). 이 엣지 케이스에 대한 테스트가 없어 버그가 검증되지 않는다.
- 제안:
  ```ts
  it("returns null for prev/next when executionId not found in list", async () => {
    mockGetByWorkflow.mockResolvedValue({
      data: { data: [{ id: "other-exec" }], pagination: { ... } }
    });
    await renderPage(); // executionId는 "exec-1"
    expect(await screen.findByRole("button", { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
  ```

---

**[WARNING] `Failed Execution` 테스트에서 `executionId` 불일치**
- 위치: `execution-detail-page.test.tsx` L~190
- 상세: `failedExec`의 id는 `"exec-1"`인데 컴포넌트에 `executionId: "exec-fail"`을 전달하고 있다. mock은 항상 동일한 응답을 반환하므로 현재는 통과하지만, `queryKey`가 `["execution", "exec-fail"]`로 설정되어 실제 ID 검증 로직 추가 시 테스트가 깨진다.
- 제안: `failedExec.id = "exec-fail"`로 맞추거나 `executionId: "exec-1"`으로 통일

---

**[INFO] `Failed Execution` describe 블록에서 `createWrapper()` 헬퍼 미사용**
- 위치: `execution-detail-page.test.tsx` L150-170
- 상세: 인라인으로 `QueryClientProvider + Suspense`를 직접 구성하고 있어 `createWrapper()` 헬퍼와 일관성이 없다. 더 중요한 문제는 이 블록의 `QueryClient`가 테스트 간 공유될 가능성으로 캐시 오염이 발생할 수 있다.
- 제안: `createWrapper()` 또는 `renderPage()` 헬퍼로 통일

---

**[INFO] 버튼 쿼리 방식이 DOM 구조에 취약하게 의존**
- 위치: `execution-detail-page.test.tsx` L130-153
- 상세: `getAllByRole("button")[0]`으로 인덱스 접근하거나 `textContent?.includes()`로 버튼을 찾는 방식은 DOM 순서 변경 시 테스트가 잘못 통과하거나 실패한다.
- 제안:
  ```ts
  // 변경 전
  const buttons = screen.getAllByRole("button");
  fireEvent.click(buttons[0]);
  
  // 변경 후
  fireEvent.click(screen.getByRole("button", { name: /back to executions/i }));
  // 또는 aria-label 추가: <button aria-label="Back to executions">
  ```

---

**[INFO] `mockBack` 선언되었으나 `router.back()` 호출 검증 테스트 없음**
- 위치: `execution-list-page.test.tsx` L6
- 상세: `const mockBack = vi.fn()`이 선언되어 있으나 어떤 테스트에서도 호출 여부를 검증하지 않는다.
- 제안:
  ```ts
  it("calls router.back() on back button click", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
  ```

---

**[INFO] `NodeResultsTab` 서브탭 전환 및 `JsonViewer` 렌더링 테스트 없음**
- 위치: `execution-detail-page.test.tsx`
- 상세: 노드 선택 후 Input/Output/Error 서브탭 전환, `JsonViewer`의 JSON 렌더링, Error 탭 조건부 표시(`show: !!selectedNode?.error`)가 미검증이다.
- 제안: 노드 선택 → "Input" 탭 클릭 → `inputData` JSON이 `<pre>` 태그 내에 렌더링되는지 검증하는 테스트 추가

---

**[INFO] Timeline 노드 클릭 시 `nodeDetailTab` 초기화 미검증**
- 위치: `execution-detail-page.test.tsx`
- 상세: side_effect 리뷰에서 지적된 것처럼, Timeline에서 노드 클릭 시 `nodeDetailTab`이 리셋되지 않는 버그가 있으나 이를 검증하는 회귀 테스트가 없다.
- 제안: 에러 있는 노드 → Timeline에서 에러 없는 노드 클릭 → Error 탭이 자동 해제되는지 검증하는 테스트 추가

---

### 요약

테스트 코드는 기본 렌더링 시나리오(완료/실패 실행, 탭 전환, 노드 선택)를 커버하고 있으나, `vi.clearAllMocks()` 후 mock 재설정 누락으로 인한 테스트 간 암묵적 순서 의존성이 가장 심각한 문제다. CI 환경에서 비결정적 실패를 유발할 수 있어 즉시 수정이 필요하다. 핵심 인터랙션 기능(정렬·필터·페이지네이션·Prev/Next 네비게이션)에 대한 커버리지가 전무하고, `currentIndex === -1` 버그와 같이 requirement 리뷰에서 발견된 실제 버그를 잡을 수 있는 회귀 테스트도 없다. `formatDuration` 순수 함수는 두 파일에 중복 정의된 채로 단위 테스트가 없어 불일치 위험이 있다. 테스트 쿼리 방식도 인덱스 기반 접근에서 역할/레이블 기반으로 개선이 필요하다.

### 위험도

**MEDIUM**