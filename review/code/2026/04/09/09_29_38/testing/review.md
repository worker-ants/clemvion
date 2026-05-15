### 발견사항

---

**[WARNING] `execution-list-page.test.tsx`: `vi.clearAllMocks()` 후 mock 구현 소실**
- 위치: `execution-list-page.test.tsx` — `beforeEach` + `vi.mock()` 조합
- 상세: `vi.mock()`에서 `getByWorkflow`를 `mockResolvedValue`로 고정 구현한 뒤, `beforeEach`에서 `vi.clearAllMocks()`를 호출. `clearAllMocks()`는 호출 기록만 초기화하고 구현은 유지한다고 알려져 있으나, 실제로는 `mockResolvedValue`로 설정된 구현이 제거될 수 있어 테스트 실행 순서에 따라 불안정한 결과가 나올 수 있음. `execution-detail-page.test.tsx`는 `beforeEach`에서 명시적으로 재설정하는 반면, `execution-list-page.test.tsx`는 재설정 없음.
- 제안: `beforeEach` 내에서 `(executionsApi.getByWorkflow as Mock).mockResolvedValue(...)` 형태로 매 테스트마다 명시적 재설정하거나, `mockGetByWorkflow` 변수로 분리하여 `detail-page.test.tsx`와 동일한 패턴 사용

---

**[WARNING] `execution-detail-page.test.tsx`: Failed Execution 테스트에서 `executionId` 불일치**
- 위치: `execution-detail-page.test.tsx` — `ExecutionDetailPage - Failed Execution` describe 블록
- 상세: `failedExec`의 `id`는 `"exec-1"`이지만, 컴포넌트에 전달하는 `executionId`는 `"exec-fail"`. `queryKey`는 `["execution", "exec-fail"]`로 설정되나 mock은 항상 동일한 응답을 반환해 현재는 통과. 실제 ID 기반 캐싱 로직이 추가되거나 쿼리 조건이 강화되면 테스트가 오동작할 수 있음.
- 제안: `executionId: "exec-1"`로 통일하거나 `failedExec.id`를 `"exec-fail"`로 변경하여 일관성 유지

---

**[WARNING] Prev/Next 네비게이션 테스트 부재**
- 위치: `execution-detail-page.test.tsx` 전체
- 상세: `adjacentQuery`를 통한 이전/다음 실행 이동이 핵심 기능임에도 테스트가 전혀 없음. prev/next가 null일 때 버튼 비활성화, 클릭 시 `router.push` 호출 여부 등 미검증.
- 제안:
  ```ts
  it("disables prev button when no previous execution", async () => {
    mockGetByWorkflow.mockResolvedValue({
      data: [makeExecution()], // 현재 실행이 첫 번째
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    const prevBtn = await screen.findByRole("button", { name: /prev/i });
    expect(prevBtn).toBeDisabled();
  });
  ```

---

**[WARNING] 정렬/필터/페이지네이션 인터랙션 테스트 부재**
- 위치: `execution-list-page.test.tsx` 전체
- 상세: `ExecutionListPage`의 핵심 인터랙션인 컬럼 헤더 클릭(정렬), 필터 버튼 클릭(상태 필터), 페이지 버튼 클릭(페이지네이션)에 대한 테스트가 없음. `handleSort` 토글 로직(asc→desc→asc)도 미검증.
- 제안: 필터 버튼 클릭 후 `executionsApi.getByWorkflow`가 `{ status: "completed" }` 파라미터로 재호출되는지, 정렬 클릭 후 `{ sort: "duration_ms", order: "desc" }` 파라미터가 전달되는지 검증 테스트 추가

---

**[WARNING] `mockBack` 미사용 — router.back() 테스트 누락**
- 위치: `execution-list-page.test.tsx` L6
- 상세: `mockBack = vi.fn()`을 선언했으나 어떤 테스트에서도 검증에 사용하지 않음. 목록 페이지의 뒤로가기 버튼 동작 미검증.
- 제안:
  ```ts
  it("navigates back on back button click", async () => {
    await renderPage();
    await screen.findByText("Test Workflow");
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(mockBack).toHaveBeenCalled();
  });
  ```

---

**[WARNING] `execution-engine.service.spec.ts`: `_selectedPort` 제거 동작에 대한 테스트가 변경 사유 없이 수정됨**
- 위치: `execution-engine.service.spec.ts` L1191-1198
- 상세: `_selectedPort`가 다운스트림 노드 입력에서 제거된다는 새로운 동작을 검증하도록 기대값이 수정되었으나, 이 변경이 의도적 스펙 변경임을 명시하는 테스트 설명이 없음. 현재 주석으로 설명이 추가되었지만, 해당 동작을 직접 검증하는 별도 테스트가 없음.
- 제안: `_selectedPort` 필드가 실제로 스트리핑되는지 명시적으로 검증하는 테스트 추가
  ```ts
  it("should not pass _selectedPort to downstream nodes", () => {
    expect(aInputs[1]).not.toHaveProperty('_selectedPort');
  });
  ```

---

**[WARNING] `carousel.handler.spec.ts`: `source` 필드 없는 backward compatibility 테스트 중복 추가**
- 위치: `carousel.handler.spec.ts` L32-34
- 상세: `'should pass without source in dynamic mode (backward compatible)'` 테스트가 추가되었으나, 기존 `'should pass with valid titleField in dynamic mode'` 테스트도 `source` 없이 `{ titleField: 'name' }`만 전달. 동일한 동작을 두 테스트가 검증하는 중복 발생.
- 제안: 기존 테스트를 backward compatibility 명시 테스트로 리네이밍하고 중복 제거

---

**[INFO] `carousel-buttons.handler.spec.ts`: 기존 테스트에 `source` 필드 추가만으로는 새 기능 커버리지 부족**
- 위치: `carousel-buttons.handler.spec.ts`
- 상세: 기존 validation 테스트에 `source` 필드를 추가했으나, `itemButtons` validation, `buttonItemMap` 생성, dynamic 모드에서 아이템별 버튼 ID 생성(`${btn.id}__item_${idx}`) 등 신규 기능에 대한 테스트가 없음.
- 제안: 다음 테스트 추가 필요:
  ```ts
  it('should generate per-item button IDs in dynamic mode')
  it('should build buttonItemMap correctly')
  it('should validate itemButtons max 4 per item')
  it('should fail with duplicate itemButton IDs')
  ```

---

**[INFO] `use-execution-events.test.ts`: mock 반환값 구조 변경 후 래핑 제거 일관성**
- 위치: `use-execution-events.test.ts` L81-83
- 상세: `mockGetById.mockResolvedValue({ data: createMockExecution() })`에서 `mockGetById.mockResolvedValue(createMockExecution())`으로 변경됨. `executionsApi.getById`의 반환 타입이 `ExecutionData`로 변경된 것을 올바르게 반영. 단, 변경된 `unwrap()` 헬퍼 함수 자체에 대한 단위 테스트가 없음.
- 제안: `executionsApi` 레이어의 `unwrap()` 함수에 대한 단위 테스트 추가 (래핑된 응답 처리, 비래핑 응답 처리, edge case)

---

**[INFO] `execution-status.test.ts`: `formatDuration(59999)` 경계값 테스트 결과 검증**
- 위치: `execution-status.test.ts` L42
- 상세: `formatDuration(59999)`의 기대값이 `"60.0s"`. 실제 구현에서 `59999 / 1000 = 59.999`, `toFixed(1) = "60.0"` 이므로 정상이나, 이 케이스는 사실상 "분" 단위 직전 경계값. `60000ms`가 `"1m 0s"`를 반환하는 것과 함께 경계 구간이 명확히 검증됨. 추가로 `null`과 `undefined` 차이 검증이 없음.
- 제안: `formatDuration(undefined as unknown as null)`도 동일하게 `"—"`를 반환하는지 검증 추가 고려

---

**[INFO] `execution-detail-page.test.tsx`: `Failed Execution` describe 블록에서 `createWrapper()` 미사용**
- 위치: `execution-detail-page.test.tsx` L155-175
- 상세: 상위 describe에서는 `createWrapper()`/`renderPage()` 헬퍼를 사용하지만, Failed Execution 블록에서는 인라인으로 `QueryClient + QueryClientProvider + Suspense`를 직접 구성. 일관성 부족 및 유지보수 부담.
- 제안: `renderPage("exec-fail")` 또는 `renderPage()` 형태로 헬퍼 재사용

---

**[INFO] `execution-list-page.test.tsx`: `document.querySelectorAll("tbody tr")` DOM 전역 접근**
- 위치: `execution-list-page.test.tsx` — `navigates to execution detail on row click` 테스트
- 상세: `screen` API 대신 `document.querySelectorAll`로 DOM을 직접 조회. `@testing-library`의 권장 방식이 아니며 DOM 구조 변경에 취약.
- 제안: `within(screen.getByRole("table")).getAllByRole("row")` 또는 `data-testid` 활용

---

### 요약

백엔드 테스트(carousel, execution-engine)는 신규 기능(`itemButtons`, `buttonItemMap`, `_selectedPort` 스트리핑)에 대한 커버리지가 부분적으로 누락되어 있고, 프론트엔드 테스트는 핵심 인터랙션(정렬, 필터, 페이지네이션, Prev/Next 네비게이션)에 대한 검증이 전무하다. `vi.clearAllMocks()` 후 mock 재설정 패턴 불일치와 `executionId` 불일치 문제는 CI에서 비결정적 실패를 유발할 수 있어 즉시 수정이 필요하다. `execution-status.test.ts`의 추가와 `use-execution-events.test.ts`의 mock 구조 정합성 수정은 긍정적이나, `unwrap()` 함수 자체의 단위 테스트 부재와 `carousel` 신규 기능 테스트 누락이 전체 커버리지를 낮추고 있다.

### 위험도
**MEDIUM**