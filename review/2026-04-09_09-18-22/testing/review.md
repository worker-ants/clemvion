### 발견사항

---

**[CRITICAL] `vi.clearAllMocks()`가 모듈 레벨 mock 구현을 제거하여 테스트 순서 의존성 발생**
- 위치: `execution-detail-page.test.tsx` L118, `execution-list-page.test.tsx` L54-56
- 상세: `vi.clearAllMocks()`는 mock 호출 이력뿐 아니라 `vi.mock()`으로 설정한 모듈 레벨 `mockResolvedValue(...)` 구현까지 초기화한다. 두 테스트 파일 모두 `beforeEach`에서 이를 호출하면서 `workflowsApi.get`, `executionsApi.getByWorkflow`의 구현이 소거된다. 현재 테스트가 통과되는 것은 각 파일 내 테스트 순서가 고정되어 있기 때문이며, 테스트 추가·순서 변경·병렬 실행 시 비결정적 실패가 발생한다.
- 제안:
  ```ts
  beforeEach(() => {
    vi.clearAllMocks();
    // mock 구현 명시적 재설정
    (workflowsApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: mockWorkflow } });
    (executionsApi.getByWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockListResponse });
  });
  ```

---

**[WARNING] Failed Execution 테스트에서 `executionId` 불일치로 잠재적 flaky 테스트**
- 위치: `execution-detail-page.test.tsx` — `Failed Execution` describe 블록 (~L190)
- 상세: `failedExec` 픽스처의 id는 `"exec-1"`이나 컴포넌트에 전달되는 `executionId`는 `"exec-fail"`이다. `queryKey`가 `["execution", "exec-fail"]`로 생성되지만 mock은 id에 무관하게 항상 같은 응답을 반환한다. ID 검증 로직이 추가되거나 mock 구현이 변경되면 즉시 깨진다.
- 제안: `failedExec.id`를 `"exec-fail"`로 맞추거나, `executionId` 파라미터를 `"exec-1"`로 통일

---

**[WARNING] 로딩/에러/not-found 상태에 대한 테스트 완전 부재**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx`
- 상세: 스켈레톤 렌더링(`isLoading`), API 실패(`isError`), execution null 반환(`"Execution not found."`) 등 세 가지 주요 분기가 모두 미검증이다. 이 중 requirement/review에서 API Error 처리 자체가 스펙 미충족으로 지적되었으므로, 해당 UI가 구현되더라도 회귀 방지 테스트가 없다.
- 제안:
  ```ts
  it("shows skeleton while loading", async () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
  it("shows error UI when API fails", async () => {
    mockGetById.mockRejectedValue(new Error("Network error"));
    renderPage();
    expect(await screen.findByText(/Failed to load execution/)).toBeDefined();
  });
  ```

---

**[WARNING] 핵심 인터랙티브 기능(정렬·필터·페이지네이션·Prev/Next)에 대한 테스트 없음**
- 위치: `execution-list-page.test.tsx`, `execution-detail-page.test.tsx`
- 상세: `ExecutionListPage`의 핵심 기능인 컬럼 헤더 클릭 정렬, 상태 필터 버튼, 페이지네이션이 전혀 테스트되지 않는다. `ExecutionDetailPage`의 Prev/Next 네비게이션 버튼도 미검증이다. 특히 requirement/review에서 `currentIndex === -1` 엣지 케이스(잘못된 prev/next 반환)가 WARNING으로 지적되었는데 이를 검증하는 테스트가 없다.
- 제안:
  ```ts
  it("filters by status when filter button clicked", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Completed" }));
    await waitFor(() => {
      expect(mockGetByWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });
  });
  it("prev button disabled when execution not found in list (currentIndex === -1)", async () => {
    mockGetByWorkflow.mockResolvedValue({ data: { data: { items: [], pagination: {...} } } });
    renderPage();
    expect((await screen.findByText("Prev")).closest("button")).toBeDisabled();
  });
  ```

---

**[WARNING] `waiting_for_input` 필터 버튼 누락이 스펙 요구사항이나 테스트도 없음**
- 위치: requirement/review.md에서 [WARNING]으로 지적, `execution-list-page.test.tsx`
- 상세: spec `2-navigation/6-execution-history.md §2.3`에 "Waiting" 필터가 명시되어 있으나 현재 `FILTER_BUTTONS` 배열에 없다. 필터 버튼 렌더링 테스트도 없어 이 누락이 테스트로 감지되지 않는다.
- 제안: `it("renders all filter buttons including Waiting", ...)` 테스트 추가로 스펙 준수 여부를 검증

---

**[WARNING] `Failed Execution` describe 블록이 `createWrapper()` 헬퍼를 사용하지 않아 캐시 오염 위험**
- 위치: `execution-detail-page.test.tsx` L150-170
- 상세: 다른 describe 블록은 `createWrapper()`로 테스트마다 새 `QueryClient`를 생성하는데, `Failed Execution` 블록만 인라인으로 `QueryClient`를 생성한다. `createWrapper()` 없이 단일 인스턴스를 재사용하면 이전 테스트의 캐시 데이터가 잔류할 수 있다.
- 제안: `createWrapper()` 또는 `renderPage()` 헬퍼로 통일

---

**[WARNING] `formatDuration` 순수 함수의 단위 테스트 없음 — 두 파일에 중복 정의된 채로 미검증**
- 위치: `executions/page.tsx:57-65`, `[executionId]/page.tsx:57-65`
- 상세: `null`, `0ms`, `999ms`, `1000ms`, `59999ms`, `60000ms` 등 경계값 처리 로직이 있는 순수 함수임에도 테스트가 없다. 두 파일에 동일 코드가 복사되어 있어 한쪽만 수정 시 불일치가 발생해도 테스트로 감지되지 않는다.
- 제안: 두 파일의 `formatDuration`을 공통 모듈로 추출한 후 경계값 단위 테스트 추가

---

**[INFO] 버튼 탐색이 DOM 인덱스 및 `textContent` 의존으로 fragile**
- 위치: `execution-detail-page.test.tsx` L130-153
- 상세: `getAllByRole("button")[0]`으로 특정 버튼을 가정하거나, `textContent?.includes("Data Transform")`로 버튼을 탐색한다. DOM 구조나 렌더링 순서 변경 시 false positive/negative 발생 가능성이 있다.
- 제안: `getByRole("button", { name: /back/i })` 또는 `aria-label`/`data-testid` 기반 접근으로 교체

---

**[INFO] `execution-list-page.test.tsx`의 `mockBack`이 선언되었으나 `router.back()` 검증 테스트 없음**
- 위치: `execution-list-page.test.tsx` L6
- 상세: `router.back()`을 테스트하려는 의도로 mock을 선언했으나 실제 검증이 없다. 코드 의도가 불분명하고 미완성 테스트가 잠재적 버그를 숨긴다.
- 제안:
  ```ts
  it("navigates back on back button click", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /back/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
  ```

---

**[INFO] 스펙 변경사항(spec 파일)에 대응하는 테스트 없음**
- 위치: `spec/2-navigation/6-execution-history.md`, `spec/4-nodes/6-presentation-nodes.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`
- 상세: 이번 변경에서 다수의 신규 스펙이 추가되었다 — `waiting_for_input` 필터, adjacent 네비게이션, `currentIndex === -1` 처리, `_selectedPort` 메타데이터 strip, Carousel `itemButtons` 등. 이에 대응하는 테스트 코드 추가 계획이 없다.
- 제안: 각 스펙 항목에 대한 테스트를 작성하여 구현이 스펙을 준수하는지 검증

---

### 요약

이번 리뷰의 핵심 테스트 품질 문제는 두 가지 축으로 요약된다. 첫째, `vi.clearAllMocks()`가 모듈 레벨 mock 구현을 소거하는 패턴이 두 테스트 파일 모두에 존재하여 테스트 실행 순서에 따른 비결정적 실패 위험이 있으며, 이는 CI 환경에서 간헐적으로만 재현되는 종류의 버그여서 즉시 수정이 필요하다. 둘째, 정렬·필터·페이지네이션·Prev/Next 네비게이션 등 핵심 인터랙티브 기능의 커버리지 갭이 광범위하며, 특히 requirement/review에서 WARNING으로 지적된 `currentIndex === -1` 엣지 케이스와 `waiting_for_input` 필터 누락은 테스트가 있었다면 구현 단계에서 발견되었을 문제들이다. `formatDuration`의 중복 정의와 단위 테스트 부재도 향후 불일치 버그의 잠재적 원인이다.

### 위험도

**HIGH**